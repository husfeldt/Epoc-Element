import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'scripts', '.raw_comfy');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'sprites');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const COMFY_URL = 'http://127.0.0.1:8188';

const SUBJECT_ONLY_STYLE =
  'single isolated 3D game miniature subject only, 100% pure solid #FFFFFF white background, ZERO ground, ZERO grass, ZERO dirt pad, ZERO water background, ZERO pedestal, ZERO fence, clean crisp edges, high-angle isometric three-quarter view, natural realistic colors, soft top-left sunlight';

const NEGATIVE_PROMPT =
  'ground, grass, dirt, terrain, floor, base, pad, pedestal, tile, square, circle, fence, corral, water surface, ocean background, waves, splash ring, multiple animals, herd, text, watermark, frame, border';

const CATALOG = [
  {
    id: 'single_horse_01',
    category: 'single_horse',
    footprint: '1x1',
    targetWidth: 96,
    seed: 111001,
    prompt: `one single wild chestnut horse standing in profile, full horse body with four legs visible, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_cattle_01',
    category: 'single_cattle',
    footprint: '1x1',
    targetWidth: 96,
    seed: 111002,
    prompt: `one single brown and white grazing cow standing in three-quarter profile, full body with four legs visible, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_whale_01',
    category: 'single_whale',
    footprint: '1x1',
    targetWidth: 120,
    seed: 111003,
    prompt: `one single dark-blue humpback whale silhouette from above, streamlined body and tail fluke only, no water background, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_fish_01',
    category: 'single_fish',
    footprint: '1x1',
    targetWidth: 64,
    seed: 111004,
    prompt: `one single silver-blue ocean fish silhouette from above, streamlined body and fins only, no water background, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_tree_oak_01',
    category: 'single_tree_oak',
    footprint: '1x1',
    targetWidth: 115,
    seed: 111005,
    prompt: `one single lush olive-green oak tree with rounded leafy crown and short brown trunk only, no grass base, no ground pad, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_tree_pine_01',
    category: 'single_tree_pine',
    footprint: '1x1',
    targetWidth: 105,
    seed: 111006,
    prompt: `one single tall dark evergreen spruce pine tree with conical needle canopy and short trunk only, no ground pad, ${SUBJECT_ONLY_STYLE}`,
  },
  {
    id: 'single_tree_palm_01',
    category: 'single_tree_palm',
    footprint: '1x1',
    targetWidth: 115,
    seed: 111007,
    prompt: `one single emerald tropical palm tree with curved trunk and crown of palm fronds only, no sand base, no ground pad, ${SUBJECT_ONLY_STYLE}`,
  },
];

function buildWorkflow(item) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'flux1-schnell-fp8.safetensors' },
    },
    '2': {
      class_type: 'LoraLoader',
      inputs: {
        model: ['1', 0],
        clip: ['1', 1],
        lora_name: 'Isometric-3D.safetensors',
        strength_model: 0.35,
        strength_clip: 0.35,
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['2', 1], text: item.prompt },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['2', 1], text: NEGATIVE_PROMPT },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 1024, height: 1024, batch_size: 1 },
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        model: ['2', 0],
        positive: ['3', 0],
        negative: ['4', 0],
        latent_image: ['5', 0],
        seed: item.seed,
        steps: 4,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
      },
    },
    '7': {
      class_type: 'VAEDecode',
      inputs: { samples: ['6', 0], vae: ['1', 2] },
    },
    '8': {
      class_type: 'SaveImage',
      inputs: { images: ['7', 0], filename_prefix: `epoc_groundless_${item.id}` },
    },
  };
}

async function queueAndFetch(item) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildWorkflow(item) }),
  });
  if (!res.ok) throw new Error(`ComfyUI /prompt failed (${res.status})`);
  const { prompt_id } = await res.json();

  let imageMeta = null;
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const hRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    if (!hRes.ok) continue;
    const hist = await hRes.json();
    const entry = hist[prompt_id];
    if (entry?.outputs?.['8']?.images?.length) {
      imageMeta = entry.outputs['8'].images[0];
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
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const existingManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).sprites || [];
  const byId = new Map(existingManifest.map((s) => [s.id, s]));

  console.log(`Generating ${CATALOG.length} pure groundless individual animal & tree sprites...`);
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const outFile = `${item.id}.png`;
    const outPath = path.join(OUT_DIR, outFile);

    console.log(`[${i + 1}/${CATALOG.length}] Generating ${item.id}...`);
    const rawPath = await queueAndFetch(item);
    const cutJson = execFileSync(
      'python',
      [path.join(ROOT, 'scripts', 'cutout_sprite.py'), rawPath, outPath, String(item.targetWidth), '--interior-key'],
      { encoding: 'utf8' }
    ).trim();
    const dims = JSON.parse(cutJson);

    byId.set(item.id, {
      id: item.id,
      category: item.category,
      file: `/assets/sprites/${outFile}`,
      footprint: item.footprint,
      width: dims.width,
      height: dims.height,
      anchorX: 0.5,
      anchorY: 0.82,
    });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2));
  }

  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
