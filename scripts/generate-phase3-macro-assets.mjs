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
  'clean painterly 2.5D strategy game map miniature prop on flat level ground, no hill, no mound, no pedestal, high-angle isometric aerial view, natural satellite-inspired earth tones, soft top-left directional sunlight, organic irregular natural silhouette with no rectangular slab or pedestal base, isolated centered object on a pure solid #FFFFFF white studio background, no noise speckles, no floor grid, no border, no text';

const NEGATIVE_PROMPT =
  'hill, mound, knoll, raised earth, hexagonal tile, hex base, rectangular pedestal, square slab base, diorama block, plinth, white noise speckles, grainy dots, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  // Sparse Edge Woodland Variants (for 1-3 matching neighbor perimeter hexes)
  {
    id: 'forest_edge_temperate_01',
    category: 'forest_edge_temperate',
    footprint: '1x1',
    targetWidth: 215,
    seed: 91001,
    interiorKey: true,
    prompt: `sparse open grove of 3 scattered temperate oak and birch trees with sunlit grassy gaps, light woodland edge, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_edge_temperate_02',
    category: 'forest_edge_temperate',
    footprint: '1x1',
    targetWidth: 215,
    seed: 91002,
    interiorKey: true,
    prompt: `small airy cluster of 3 slender olive-green woodland trees and low shrubs, forest perimeter clearing, no snow, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_edge_arctic_01',
    category: 'forest_edge_arctic',
    footprint: '1x1',
    targetWidth: 215,
    seed: 91003,
    interiorKey: false,
    prompt: `sparse scattered group of 3 subarctic snow-dusted spruce trees with wide spacing, northern taiga edge, ${CLEAN_STYLE}`,
  },
  {
    id: 'forest_edge_arctic_02',
    category: 'forest_edge_arctic',
    footprint: '1x1',
    targetWidth: 215,
    seed: 91004,
    interiorKey: false,
    prompt: `light cluster of 3 frost-tipped boreal pine trees on flat tundra border, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_edge_tropical_01',
    category: 'jungle_edge_tropical',
    footprint: '1x1',
    targetWidth: 220,
    seed: 91005,
    interiorKey: true,
    prompt: `airy tropical woodland edge with 3 tall coconut palms and low emerald ferns, open spacing, ${CLEAN_STYLE}`,
  },
  {
    id: 'jungle_edge_tropical_02',
    category: 'jungle_edge_tropical',
    footprint: '1x1',
    targetWidth: 220,
    seed: 91006,
    interiorKey: true,
    prompt: `sparse rainforest perimeter grove of 2 broad tropical trees and fan palms, clean painterly foliage, ${CLEAN_STYLE}`,
  },
  // 3x1 Multi-Hex Tectonic Mountain Chains
  {
    id: 'mountain_range_3x1_01',
    category: 'mountain_range_3x1',
    footprint: '3x1',
    targetWidth: 520,
    seed: 91007,
    interiorKey: false,
    prompt: `wide sweeping horizontal chain of 4 connected granite mountain peaks with jagged ridges and light crest snow, panoramic 3x1 range, ${CLEAN_STYLE}`,
  },
  {
    id: 'mountain_range_3x1_02',
    category: 'mountain_range_3x1',
    footprint: '3x1',
    targetWidth: 520,
    seed: 91008,
    interiorKey: false,
    prompt: `broad horizontal arid sandstone canyon ridge and red-ochre mountain massif chain, panoramic 3x1 formation, ${CLEAN_STYLE}`,
  },
  // Desert Edge Scrub & Rocky Outcrops
  {
    id: 'scrub_dunes_01',
    category: 'scrub_dunes',
    footprint: '1x1',
    targetWidth: 225,
    seed: 91009,
    interiorKey: true,
    prompt: `low wind-swept desert sand ripples with sparse dry steppe scrub bushes and small weathered stones, ${CLEAN_STYLE}`,
  },
  {
    id: 'scrub_dunes_02',
    category: 'scrub_dunes',
    footprint: '1x1',
    targetWidth: 225,
    seed: 91010,
    interiorKey: true,
    prompt: `subtle flat tan desert gravel patch with small arid thorn bushes and low sand drift, ${CLEAN_STYLE}`,
  },
  {
    id: 'rocky_desert_outcrops_01',
    category: 'rocky_desert_outcrops',
    footprint: '1x1',
    targetWidth: 235,
    seed: 91011,
    interiorKey: true,
    prompt: `weathered ochre sandstone rock spires and dry desert boulders on flat sand, ${CLEAN_STYLE}`,
  },
  // Tundra Cairn Ancient Ruins
  {
    id: 'ancient_ruins_tundra_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 235,
    seed: 91012,
    interiorKey: false,
    prompt: `ancient weathered stone monolith circle and frost-dusted northern cairn stones on flat ground, ${CLEAN_STYLE}`,
  },
];

function buildWorkflow(item) {
  const isWide = item.footprint === '3x1';
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
      inputs: { width: isWide ? 1344 : 1024, height: isWide ? 768 : 1024, batch_size: 1 },
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p3m_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 2/3 core/edge/3x1 ComfyUI sprites...`);
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

  console.log('Running bottom-skirt feathering & color harmonization...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
