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

const CLEAN_STYLE =
  'clean painterly 2.5D strategy game map miniature prop on flat level ground, no hill, no mound, no pedestal, high-angle isometric aerial view, natural satellite-inspired earth tones, soft top-left directional sunlight, organic irregular natural silhouette with no square pad, no diamond base, no sandy square, isolated centered object on a pure solid #FFFFFF white studio background, no floor grid, no border, no text';

const NEGATIVE_PROMPT =
  'sandy square, sand pad, square base, square patch, diamond base, wooden fence, corral, flat horizontal bottom, hexagonal tile, hex base, rectangular pedestal, diorama block, plinth, white noise speckles, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  // Phase 1: Lush dark-emerald tropical jungle & mossy tropical hills (no sandy pad)
  {
    id: 'jungle_tropical_clean_01',
    category: 'jungle_tropical_clean',
    footprint: '1x1',
    targetWidth: 240,
    seed: 99101,
    interiorKey: true,
    prompt: `lush dark-emerald tropical rainforest canopy cluster with deep-green palms and broad jungle leaves, no sandy ground, no square base, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_tropical_clean_02',
    category: 'jungle_tropical_clean',
    footprint: '1x1',
    targetWidth: 240,
    seed: 99102,
    interiorKey: true,
    prompt: `dense dark-green equatorial jungle trees and tropical fern crowns, rich emerald foliage, no sand, no diamond base, ${CLEAN_STYLE}`,
  },
  {
    id: 'hills_tropical_01',
    category: 'hills_tropical',
    footprint: '1x1',
    targetWidth: 235,
    seed: 99103,
    interiorKey: true,
    prompt: `mossy dark-emerald tropical highland ridge with lush jungle ferns and weathered grey stones, organic irregular silhouette, no boxy pad, ${CLEAN_STYLE}`,
  },
  {
    id: 'hills_tropical_02',
    category: 'hills_tropical',
    footprint: '1x1',
    targetWidth: 235,
    seed: 99104,
    interiorKey: true,
    prompt: `gentle rolling mossy green tropical foothills with small palm saplings and dark volcanic rock outcrops, no square base, ${CLEAN_STYLE}`,
  },

  // Phase 3: Real 2.5D Resource Props
  {
    id: 'resource_iron_01',
    category: 'resource_iron',
    footprint: '1x1',
    targetWidth: 215,
    seed: 99201,
    interiorKey: true,
    prompt: `dark metallic iron ore rock outcrop with silver-grey hematite veins on flat earth, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_coal_01',
    category: 'resource_coal',
    footprint: '1x1',
    targetWidth: 215,
    seed: 99202,
    interiorKey: true,
    prompt: `glossy black anthracite coal seam rock outcrop with dark slate shards on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_copper_01',
    category: 'resource_copper',
    footprint: '1x1',
    targetWidth: 215,
    seed: 99203,
    interiorKey: true,
    prompt: `weathered bronze-orange copper ore rocks with turquoise malachite mineral veins on flat earth, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_marble_01',
    category: 'resource_marble',
    footprint: '1x1',
    targetWidth: 215,
    seed: 99204,
    interiorKey: false,
    prompt: `smooth cream-white veined marble stone outcrop and small quarried marble blocks on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_cattle_01',
    category: 'resource_cattle',
    footprint: '1x1',
    targetWidth: 220,
    seed: 99205,
    interiorKey: true,
    prompt: `small herd of 4 brown and white spotted cattle grazing freely on flat olive grass, no fence, no square patch, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_timber_01',
    category: 'resource_timber',
    footprint: '1x1',
    targetWidth: 220,
    seed: 99206,
    interiorKey: true,
    prompt: `neat stack of felled oak timber logs beside 2 pine trees on flat forest floor, no square pad, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_fish_01',
    category: 'resource_fish',
    footprint: '1x1',
    targetWidth: 205,
    seed: 99207,
    interiorKey: true,
    prompt: `school of shimmering silver coastal fish swimming in a tight organic swirl, isolated on pure solid #FFFFFF white background, ${CLEAN_STYLE}`,
  },
  {
    id: 'resource_whales_01',
    category: 'resource_whales',
    footprint: '1x1',
    targetWidth: 225,
    seed: 99208,
    interiorKey: true,
    prompt: `deep-blue baleen whale surfacing with white tail fluke and gentle sea spray, isolated on pure solid #FFFFFF white background, ${CLEAN_STYLE}`,
  },

  // Phase 3: Unknown "Package" / Supply Caches (mystery_package)
  {
    id: 'mystery_package_01',
    category: 'mystery_package',
    footprint: '1x1',
    targetWidth: 205,
    seed: 99301,
    interiorKey: true,
    prompt: `cluster of weathered wooden expedition supply crates bound with rope and canvas tarp on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'mystery_package_02',
    category: 'mystery_package',
    footprint: '1x1',
    targetWidth: 205,
    seed: 99302,
    interiorKey: true,
    prompt: `tied leather expedition packs, rolled explorer maps, and wooden supply barrel on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'mystery_package_03',
    category: 'mystery_package',
    footprint: '1x1',
    targetWidth: 205,
    seed: 99303,
    interiorKey: true,
    prompt: `sealed ancient iron-bound cargo chest with brass lock and leather straps on flat earth, ${CLEAN_STYLE}`,
  },

  // Phase 3: Illustrative Anomaly Landmarks (Replace Cyan Diamonds)
  {
    id: 'anomaly_observatory_01',
    category: 'anomaly_observatory',
    footprint: '1x1',
    targetWidth: 225,
    seed: 99401,
    interiorKey: true,
    prompt: `ancient ruined stone observatory plinth with weathered brass armillary sphere and astrolabe, ${CLEAN_STYLE}`,
  },
  {
    id: 'anomaly_ley_monolith_01',
    category: 'anomaly_ley_monolith',
    footprint: '1x1',
    targetWidth: 220,
    seed: 99402,
    interiorKey: true,
    prompt: `tall weathered dark basalt monolith etched with subtle glowing amber-gold geothermal runes and steam vents, ${CLEAN_STYLE}`,
  },
  {
    id: 'anomaly_fossil_dig_01',
    category: 'anomaly_fossil_dig',
    footprint: '1x1',
    targetWidth: 225,
    seed: 99403,
    interiorKey: true,
    prompt: `archaeological fossil excavation dig site with exposed ancient ribs, paleontologist brush tools, and wooden stakes, ${CLEAN_STYLE}`,
  },
  {
    id: 'anomaly_relic_shrine_01',
    category: 'anomaly_relic_shrine',
    footprint: '1x1',
    targetWidth: 220,
    seed: 99404,
    interiorKey: true,
    prompt: `mossy ancient stone botanical shrine overgrown with rare glowing emerald orchids and medicinal herbs, ${CLEAN_STYLE}`,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p5_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 1/3 ComfyUI sprites (tropical, resources, packages, anomalies)...`);
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const outFile = `${item.id}.png`;
    const outPath = path.join(OUT_DIR, outFile);

    console.log(`[${i + 1}/${CATALOG.length}] Generating ${item.id}...`);
    const rawPath = await queueAndFetch(item);
    const pyArgs = [path.join(ROOT, 'scripts', 'cutout_sprite.py'), rawPath, outPath, String(item.targetWidth)];
    if (item.interiorKey) pyArgs.push('--interior-key');
    const cutJson = execFileSync('python', pyArgs, { encoding: 'utf8' }).trim();
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

  console.log('Running organic radial-noise alpha erosion & bottom-skirt feathering...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
