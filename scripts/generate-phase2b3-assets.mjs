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
  'clean painterly 2.5D strategy game map miniature prop, high-angle isometric aerial view, smooth cohesive shading, natural satellite-inspired earth tones, soft top-left directional sunlight, organic irregular natural silhouette with no rectangular slab or pedestal base, isolated centered object on a pure solid #FFFFFF white studio background, no noise speckles, no floor grid, no border, no text';

const NEGATIVE_PROMPT =
  'hexagonal tile, hex base, rectangular pedestal, square slab base, diorama block, plinth, white noise speckles, grainy dots, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  // Phase 2b: Cleaner, compact (~12% smaller -> 235px) climate-cohesive foliage
  {
    id: 'forest_arctic_clean_01',
    category: 'forest_arctic_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70101,
    prompt: `clean compact cluster of snow-dusted dark spruce and pine trees, smooth painterly evergreen needles with soft snow caps, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_arctic_clean_02',
    category: 'forest_arctic_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70102,
    prompt: `cohesive subarctic taiga pine grove with dark forest-green conifers and gentle frost on upper branches, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_arctic_clean_03',
    category: 'forest_arctic_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70103,
    prompt: `small dense cluster of northern snowy fir trees with clean dark green silhouettes, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_temperate_clean_01',
    category: 'forest_temperate_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70201,
    prompt: `clean cohesive cluster of lush olive-green oak and birch woodland trees, smooth rounded painterly canopies, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_temperate_clean_02',
    category: 'forest_temperate_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70202,
    prompt: `refined temperate broadleaf forest grove with rich sage-green and moss-green tree crowns, smooth shading, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_temperate_clean_03',
    category: 'forest_temperate_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70203,
    prompt: `compact temperate woodland copse of tall oaks and dark green pines, clean painterly foliage, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_temperate_clean_04',
    category: 'forest_temperate_clean',
    footprint: '1x1',
    targetWidth: 235,
    seed: 70204,
    prompt: `cool temperate deciduous forest cluster with olive-green oaks and warm muted golden-sage birch trees, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_tropical_clean_01',
    category: 'jungle_tropical_clean',
    footprint: '1x1',
    targetWidth: 245,
    seed: 70301,
    prompt: `clean layered emerald tropical rainforest canopy with broad-leaf jungle trees and coconut palms, smooth painterly shading, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_tropical_clean_02',
    category: 'jungle_tropical_clean',
    footprint: '1x1',
    targetWidth: 245,
    seed: 70302,
    prompt: `lush equatorial jungle grove with deep green tropical canopy crowns and fan palms, smooth cohesive foliage, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_tropical_clean_03',
    category: 'jungle_tropical_clean',
    footprint: '1x1',
    targetWidth: 245,
    seed: 70303,
    prompt: `compact tropical rainforest cluster with tall kapok tree canopy and tropical ferns, ${CLEAN_STYLE}`,
  },

  // Phase 3: Climate-matched Ocean & Coastal Sprites
  {
    id: 'sea_ice_floes_01',
    category: 'sea_ice_floes',
    footprint: '1x1',
    targetWidth: 220,
    seed: 80101,
    prompt: `cluster of natural drifting arctic sea ice floes with pale blue-white fractured edges, ${CLEAN_STYLE}`,
  },
  {
    id: 'sea_ice_floes_02',
    category: 'sea_ice_floes',
    footprint: '1x1',
    targetWidth: 220,
    seed: 80102,
    prompt: `small jagged arctic iceberg and floating pack ice chunks, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_stack_01',
    category: 'arctic_sea_stack',
    footprint: '1x1',
    targetWidth: 220,
    seed: 80103,
    prompt: `rugged dark slate arctic sea stack rock formation dusted with frost, ${CLEAN_STYLE}`,
  },
  {
    id: 'coastal_rock_outcrops_01',
    category: 'coastal_rock_outcrops',
    footprint: '1x1',
    targetWidth: 210,
    seed: 80201,
    prompt: `cluster of weathered grey coastal granite sea rocks and tide-washed boulders, ${CLEAN_STYLE}`,
  },
  {
    id: 'coastal_rock_outcrops_02',
    category: 'coastal_rock_outcrops',
    footprint: '1x1',
    targetWidth: 210,
    seed: 80202,
    prompt: `low temperate coastal reef rock outcrop with dark wet stones and sea spray, ${CLEAN_STYLE}`,
  },
  {
    id: 'kelp_shoals_01',
    category: 'kelp_shoals',
    footprint: '1x1',
    targetWidth: 210,
    seed: 80203,
    prompt: `subtle submerged coastal rocky shoal with dark olive-brown kelp fronds just beneath clear water, ${CLEAN_STYLE}`,
  },
  {
    id: 'coral_reef_01',
    category: 'coral_reef',
    footprint: '1x1',
    targetWidth: 215,
    seed: 80301,
    prompt: `natural muted tropical coral reef formation with subtle teal, ochre, and dusty coral heads, ${CLEAN_STYLE}`,
  },
  {
    id: 'coral_reef_02',
    category: 'coral_reef',
    footprint: '1x1',
    targetWidth: 215,
    seed: 80302,
    prompt: `low submerged tropical coral atoll shoal with pale sandbar and muted reef rocks, ${CLEAN_STYLE}`,
  },
  {
    id: 'tropical_sand_cay_01',
    category: 'tropical_sand_cay',
    footprint: '1x1',
    targetWidth: 225,
    seed: 80303,
    prompt: `small warm golden-white tropical sand cay islet with two slender coconut palms, ${CLEAN_STYLE}`,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p23_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 2b/3 ComfyUI sprites...`);
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const outFile = `${item.id}.png`;
    const outPath = path.join(OUT_DIR, outFile);

    console.log(`[${i + 1}/${CATALOG.length}] Generating ${item.id}...`);
    const rawPath = await queueAndFetch(item);
    const cutJson = execFileSync(
      'python',
      [path.join(ROOT, 'scripts', 'cutout_sprite.py'), rawPath, outPath, String(item.targetWidth)],
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
