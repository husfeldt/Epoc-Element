import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GUIDANCE_DIR = path.join(ROOT, 'scripts', 'hex_guidance');
const RAW_DIR = path.join(ROOT, 'scripts', '.raw_comfy');
const TEST_OUT_DIR = path.join(ROOT, 'public', 'assets', 'hex_tests');
const COMFY_URL = 'http://127.0.0.1:8188';

const HEX_STYLE =
  '6-sided isometric pointy-top hexagon strategy game terrain tile, painterly 2.5D Civ VI map art style, natural muted satellite-inspired earth tones, top-left directional sunlight, flush flat ground edges that blend seamlessly at ground level with no raised coaster rim or thick soil bevel, pure solid #FFFFFF white background outside the 6-sided hexagon, no square base, no 4-sided diamond, no text';

const NEGATIVE_PROMPT =
  'square tile, 4-sided diamond, rotated square, rectangular slab, thick cutaway block, raised coaster rim, thick soil bevel, extruded cliff pedestal, dark background, sky, horizon, text, watermark, signature, border, frame, cartoonish';

const TESTS = [
  {
    id: 'hex_test_mountain',
    guidance: 'hex_iso_mountain_guidance.png',
    mask: 'hex_iso_mountain_mask.png',
    interiorKey: false,
    seed: 551019,
    denoise: 0.86,
    prompt: `craggy grey granite alpine mountain peak with light crest snow rising from a 6-sided hexagonal rocky foothill base, ${HEX_STYLE}`,
  },
  {
    id: 'hex_test_forest',
    guidance: 'hex_iso_temperate_guidance.png',
    mask: 'hex_iso_temperate_mask.png',
    interiorKey: true,
    seed: 551002,
    prompt: `lush olive-green oak and birch temperate woodland grove on a 6-sided hexagonal mossy forest floor, ${HEX_STYLE}`,
  },
  {
    id: 'hex_test_desert',
    guidance: 'hex_iso_desert_guidance.png',
    mask: 'hex_iso_desert_mask.png',
    interiorKey: true,
    seed: 551003,
    prompt: `wind-sculpted golden-ochre desert sand dunes and weathered sandstone arch on a 6-sided hexagonal sand base, ${HEX_STYLE}`,
  },
  {
    id: 'hex_test_ruins',
    guidance: 'hex_iso_temperate_guidance.png',
    mask: 'hex_iso_temperate_mask.png',
    interiorKey: true,
    seed: 551004,
    prompt: `weathered ancient stone temple ruins and mossy marble columns on a 6-sided hexagonal grassy clearing, ${HEX_STYLE}`,
  },
];

async function uploadToComfy(filePath, name) {
  const form = new FormData();
  const blob = new Blob([fs.readFileSync(filePath)], { type: 'image/png' });
  form.append('image', blob, name);
  form.append('overwrite', 'true');
  const res = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed for ${name}: ${res.status}`);
  const data = await res.json();
  return data.name || name;
}

function buildHexGuidedWorkflow(item, guidanceName, maskName) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'flux1-schnell-fp8.safetensors' },
    },
    '2': {
      class_type: 'LoadImage',
      inputs: { image: guidanceName },
    },
    '3': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['2', 0], vae: ['1', 2] },
    },
    '4': {
      class_type: 'LoadImage',
      inputs: { image: maskName },
    },
    '5': {
      class_type: 'ImageToMask',
      inputs: { image: ['4', 0], channel: 'red' },
    },
    '6': {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['3', 0], mask: ['5', 0] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: item.prompt },
    },
    '8': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: NEGATIVE_PROMPT },
    },
    '9': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['7', 0],
        negative: ['8', 0],
        latent_image: ['6', 0],
        seed: item.seed,
        steps: 6,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: item.denoise ?? 0.86,
      },
    },
    '10': {
      class_type: 'VAEDecode',
      inputs: { samples: ['9', 0], vae: ['1', 2] },
    },
    '11': {
      class_type: 'SaveImage',
      inputs: { images: ['10', 0], filename_prefix: `epoc_hextest_${item.id}` },
    },
  };
}

async function queueAndFetch(item, guidanceName, maskName) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildHexGuidedWorkflow(item, guidanceName, maskName) }),
  });
  if (!res.ok) throw new Error(`ComfyUI /prompt failed (${res.status}): ${await res.text()}`);
  const { prompt_id } = await res.json();

  let imageMeta = null;
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const hRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    if (!hRes.ok) continue;
    const hist = await hRes.json();
    const entry = hist[prompt_id];
    if (entry?.outputs?.['11']?.images?.length) {
      imageMeta = entry.outputs['11'].images[0];
      break;
    }
  }
  if (!imageMeta) throw new Error(`Timed out waiting for ${item.id}`);

  const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(imageMeta.filename)}&subfolder=${encodeURIComponent(imageMeta.subfolder || '')}&type=${encodeURIComponent(imageMeta.type || 'output')}`;
  const imgRes = await fetch(viewUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const rawPath = path.join(RAW_DIR, `${item.id}.png`);
  fs.writeFileSync(rawPath, buf);
  return rawPath;
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(TEST_OUT_DIR, { recursive: true });

  for (let i = 0; i < TESTS.length; i++) {
    const item = TESTS[i];
    const gName = await uploadToComfy(path.join(GUIDANCE_DIR, item.guidance), item.guidance);
    const mName = await uploadToComfy(path.join(GUIDANCE_DIR, item.mask), item.mask);

    console.log(`[${i + 1}/${TESTS.length}] Generating hex-guided ${item.id}...`);
    const rawPath = await queueAndFetch(item, gName, mName);
    const outPath = path.join(TEST_OUT_DIR, `${item.id}.png`);
    const pyArgs = [path.join(ROOT, 'scripts', 'cutout_sprite.py'), rawPath, outPath, '280'];
    if (item.interiorKey) pyArgs.push('--interior-key');
    const cutJson = execFileSync('python', pyArgs, { encoding: 'utf8' }).trim();
    console.log(`  -> Cutout: ${cutJson}`);

    const valJson = execFileSync(
      'python',
      [path.join(ROOT, 'scripts', 'validate-sprites.py'), '--single', outPath, item.id],
      { encoding: 'utf8' }
    ).trim();
    console.log(`  -> Validation: ${valJson}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
