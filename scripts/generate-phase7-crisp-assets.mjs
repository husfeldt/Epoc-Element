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

const CRISP_STYLE =
  'crisp painterly 2.5D strategy game map miniature prop, sharp unblurred silhouette, high-angle isometric aerial view, natural satellite-inspired earth tones, consistent top-left directional sunlight with shadows falling bottom-right, isolated on a pure solid #FFFFFF white studio background, no square slab, no hex border, no text';

const NEGATIVE_PROMPT =
  'blurry edges, soft halo, square base, diamond base, hexagonal tile, pedestal, diorama block, white noise speckles, floor grid, dark background, sky, horizon, text, watermark, frame, border, cartoonish, neon colors';

const CATALOG = [
  // 4 Conifer Pine Forest 7-hex & 3x1 clusters
  {
    id: 'mega_pine_7hex_01',
    category: 'mega_pine_7hex',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 121001,
    interiorKey: false,
    prompt: `expansive 7-hex northern conifer pine forest canopy of dark emerald spruce and fir trees, crisp unblurred tree crowns leaning slightly with top-left sunlight, ${CRISP_STYLE}`,
  },
  {
    id: 'mega_pine_7hex_02',
    category: 'mega_pine_7hex',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 121002,
    interiorKey: false,
    prompt: `sweeping boreal conifer woodland cluster of tall dark pine trees with natural forest clearings and crisp evergreen needles, ${CRISP_STYLE}`,
  },
  {
    id: 'pine_range_3x1_01',
    category: 'pine_range_3x1',
    footprint: '3x1',
    targetWidth: 480,
    seed: 121003,
    interiorKey: false,
    prompt: `wide horizontal 3x1 belt of dense dark green pine and spruce trees, crisp unblurred evergreen crowns, ${CRISP_STYLE}`,
  },
  {
    id: 'pine_range_3x1_02',
    category: 'pine_range_3x1',
    footprint: '3x1',
    targetWidth: 480,
    seed: 121004,
    interiorKey: false,
    prompt: `panoramic 3x1 subarctic conifer forest strip with tall slender fir trees and crisp shadows to bottom-right, ${CRISP_STYLE}`,
  },

  // 4 Broadleaf Deciduous Forest 7-hex & 3x1 clusters
  {
    id: 'mega_broadleaf_7hex_01',
    category: 'mega_broadleaf_7hex',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 122001,
    interiorKey: true,
    prompt: `expansive 7-hex temperate broadleaf oak and birch forest canopy, lush olive and sage green rounded crowns, crisp edges, no snow, ${CRISP_STYLE}`,
  },
  {
    id: 'mega_broadleaf_7hex_02',
    category: 'mega_broadleaf_7hex',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 122002,
    interiorKey: true,
    prompt: `sweeping 7-hex deciduous woodland of tall oaks, beech, and silver birch trees with crisp sunlit upper-left foliage, no snow, ${CRISP_STYLE}`,
  },
  {
    id: 'broadleaf_range_3x1_01',
    category: 'broadleaf_range_3x1',
    footprint: '3x1',
    targetWidth: 480,
    seed: 122003,
    interiorKey: true,
    prompt: `wide horizontal 3x1 belt of lush temperate oak and birch woodland trees, crisp rounded tree canopies, no snow, ${CRISP_STYLE}`,
  },
  {
    id: 'broadleaf_range_3x1_02',
    category: 'broadleaf_range_3x1',
    footprint: '3x1',
    targetWidth: 480,
    seed: 122004,
    interiorKey: true,
    prompt: `panoramic 3x1 grove of olive-green broadleaf trees with dappled woodland clearings and crisp crowns, no snow, ${CRISP_STYLE}`,
  },

  // 4 Crisp Red Canyon Arch / Mesa & Granite Crag formations
  {
    id: 'canyon_arch_01',
    category: 'canyon_arch',
    footprint: '1x1',
    targetWidth: 235,
    seed: 123001,
    interiorKey: true,
    prompt: `crisp weathered red-ochre sandstone natural stone arch and desert canyon spire, sharp unblurred rock edges, ${CRISP_STYLE}`,
  },
  {
    id: 'canyon_arch_02',
    category: 'canyon_arch',
    footprint: '2x1',
    targetWidth: 380,
    seed: 123002,
    interiorKey: true,
    prompt: `wide 2x1 dramatic desert red-rock mesa ridge with carved sandstone canyon arch, crisp unblurred rock silhouette, ${CRISP_STYLE}`,
  },
  {
    id: 'granite_crag_01',
    category: 'granite_crag',
    footprint: '1x1',
    targetWidth: 225,
    seed: 123003,
    interiorKey: true,
    prompt: `crisp jagged grey granite highland crag and weathered stone cliff face with sharp rock facets, ${CRISP_STYLE}`,
  },
  {
    id: 'granite_crag_02',
    category: 'granite_crag',
    footprint: '2x1',
    targetWidth: 370,
    seed: 123004,
    interiorKey: true,
    prompt: `wide 2x1 rugged grey granite mountain ridge outcrop with sharp sunlit rock crests, ${CRISP_STYLE}`,
  },

  // 3 Crisp Ancient Ruin complexes
  {
    id: 'ruin_temple_courtyard_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 245,
    seed: 124001,
    interiorKey: true,
    prompt: `crisp ancient sunken stone temple courtyard with broken marble columns and mossy flagstones, sharp architectural edges, ${CRISP_STYLE}`,
  },
  {
    id: 'ruin_stone_aqueduct_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 245,
    seed: 124002,
    interiorKey: true,
    prompt: `crisp overgrown ancient Roman-style weathered stone aqueduct arches covered in creeping ivy, sharp stonework, ${CRISP_STYLE}`,
  },
  {
    id: 'ruin_obelisk_ring_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 240,
    seed: 124003,
    interiorKey: true,
    prompt: `crisp weathered ancient carved stone obelisk ring and ruined altar stones on flat ground, sharp edges, ${CRISP_STYLE}`,
  },
];

function buildWorkflow(item) {
  const isWide = item.footprint === '2x1' || item.footprint === '3x1';
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
        strength_model: 0.42,
        strength_clip: 0.42,
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
      inputs: { width: isWide ? 1280 : 1024, height: isWide ? 832 : 1024, batch_size: 1 },
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p7_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 3 crisp ComfyUI sprites...`);
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
      anchorY: item.footprint === '7-hex' ? 0.56 : 0.66,
    });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2));
  }

  console.log('Running bottom-only alpha feathering...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
