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

const FLAT_STYLE =
  'clean painterly 2.5D strategy game map miniature prop on flat level ground, no hill, no mound, no pedestal, high-angle isometric aerial view, natural satellite-inspired earth tones, soft top-left directional sunlight, organic irregular natural silhouette with no rectangular slab or raised base, isolated centered object on a pure solid #FFFFFF white studio background, no floor grid, no border, no text';

const NEGATIVE_PROMPT =
  'hill, mound, knoll, raised earth, conical hill, green hill, elevated terrain, hexagonal tile, hex base, rectangular pedestal, square slab base, diorama block, plinth, white noise speckles, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  {
    id: 'resource_horses_01',
    category: 'resource_horses',
    footprint: '1x1',
    targetWidth: 230,
    seed: 81001,
    prompt: `small herd of 4 wild chestnut and bay horses grazing on flat level olive-green grass, subtle wooden corral fence, ${FLAT_STYLE}`,
  },
  {
    id: 'resource_wheat_01',
    category: 'resource_wheat',
    footprint: '1x1',
    targetWidth: 230,
    seed: 81002,
    prompt: `natural patch of golden ripe wheat stalks and small harvested grain sheaves on flat level earth, ${FLAT_STYLE}`,
  },
  {
    id: 'resource_spices_01',
    category: 'resource_spices',
    footprint: '1x1',
    targetWidth: 230,
    seed: 81003,
    prompt: `cluster of aromatic tropical spice bushes with warm saffron and cinnamon blossoms on flat level ground, ${FLAT_STYLE}`,
  },
  {
    id: 'ancient_ruins_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 245,
    seed: 81004,
    prompt: `weathered mossy stone temple columns and broken archways resting directly on flat level ground, ${FLAT_STYLE}`,
  },
  {
    id: 'ancient_ruins_02',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 245,
    seed: 81005,
    prompt: `overgrown ancient stone amphitheater pillars and crumbling carved wall on flat level ground, ${FLAT_STYLE}`,
  },
  {
    id: 'ancient_ruins_03',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 245,
    seed: 81006,
    prompt: `weathered sandstone obelisk ruins and broken desert pillars resting on flat level sand, ${FLAT_STYLE}`,
  },
  {
    id: 'barbarian_camp_01',
    category: 'barbarian_camp',
    footprint: '1x1',
    targetWidth: 245,
    seed: 81007,
    prompt: `tribal wooden palisade ring with leather hide tents and small campfire on flat level ground, ${FLAT_STYLE}`,
  },
  {
    id: 'barbarian_camp_02',
    category: 'barbarian_camp',
    footprint: '1x1',
    targetWidth: 245,
    seed: 81008,
    prompt: `nomad raider encampment with canvas yurts, wooden stakes, and supply crates on flat level ground, ${FLAT_STYLE}`,
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
        strength_model: 0.45,
        strength_clip: 0.45,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_flat_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} flat-base ComfyUI resource/landmark sprites...`);
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
      anchorY: 0.66,
    });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2));
  }

  console.log('Running bottom-skirt feathering & color harmonization...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
