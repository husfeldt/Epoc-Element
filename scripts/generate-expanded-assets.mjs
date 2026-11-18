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

const STYLE_WRAPPER =
  'realistic detailed 2.5D strategy game map miniature prop, high-angle isometric aerial view, natural satellite-inspired earth tones, crisp geological and botanical detail, soft top-left directional sunlight, organic irregular natural silhouette with no rectangular slab or pedestal base, isolated centered object on a pure solid #FFFFFF white studio background, no floor grid, no hex tile base, no border, no text';

const DECAL_WRAPPER =
  'flat low-profile top-down isometric ground surface detail patch, subtle natural earth-tone terrain texture, no tall vertical walls, soft irregular edges fading cleanly, isolated centered patch on a pure solid #FFFFFF white studio background, no border, no text';

const NEGATIVE_PROMPT =
  'hexagonal tile, hex base, rectangular pedestal, square slab base, diorama block, plinth, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, flat vector, neon colors';

const EXPANDED_CATALOG = [
  // 1. Mountains & Ridges (Biome-matched 1x1 & 2x1 variants)
  {
    id: 'mountain_arctic_01',
    category: 'mountain_arctic',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40101,
    prompt: `tall craggy spire arctic alpine mountain peak with dark slate cliffs and heavy glacial snow caps, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_arctic_02',
    category: 'mountain_arctic',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40102,
    prompt: `twin alpine mountain peaks covered in deep snowdrifts and windswept icy rock ridges, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_temperate_01',
    category: 'mountain_temperate',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40201,
    prompt: `broad granite massif mountain with weathered grey-brown stone ridges and light snow in high crevices, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_temperate_02',
    category: 'mountain_temperate',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40202,
    prompt: `eroded saddle peak mountain with rugged grey rock gullies and sparse pine trees along lower slopes, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_temperate_03',
    category: 'mountain_temperate',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40203,
    prompt: `steep cliff crag granite mountain with fractured stone faces and grassy talus base, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_arid_01',
    category: 'mountain_arid',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40301,
    prompt: `wind-eroded red and ochre sandstone desert mesa mountain peak with stratified rock cliffs, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_arid_02',
    category: 'mountain_arid',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40302,
    prompt: `arid desert canyon ridge peak with weathered tan-brown rock spires and dry scree, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_range_wide_04',
    category: 'mountain_range_wide',
    footprint: '2x1',
    targetWidth: 460,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40401,
    prompt: `wide alpine mountain ridge chain with heavy snow-capped jagged peaks and dark glacial slate valleys, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_range_wide_05',
    category: 'mountain_range_wide',
    footprint: '2x1',
    targetWidth: 460,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 40402,
    prompt: `elongated temperate granite mountain range with weathered grey-brown ridges and forested lower gullies, ${STYLE_WRAPPER}`,
  },

  // 2. Dense Multi-Scale Forests & Jungles
  {
    id: 'jungle_canopy_04',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 280,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50101,
    prompt: `broad lush overlapping tropical rainforest canopy with emergent giant kapok trees and dense palm-fern underbrush, ${STYLE_WRAPPER}`,
  },
  {
    id: 'jungle_canopy_05',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 280,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50102,
    prompt: `dense equatorial jungle grove of tall tropical trees, broad-leaf palms, and deep green misted foliage, ${STYLE_WRAPPER}`,
  },
  {
    id: 'jungle_canopy_06',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 280,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50103,
    prompt: `thick tropical rainforest cluster with layered emerald canopy crowns and banana palms, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_01',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50201,
    prompt: `dense cluster of temperate oak and birch woodland trees with natural olive-green foliage, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_02',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50202,
    prompt: `mixed temperate broadleaf and pine forest copse with varied sage and moss-green tree crowns, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_03',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50203,
    prompt: `lush woodland grove of tall oaks, maples, and soft olive undergrowth bushes, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_04',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50204,
    prompt: `sparse temperate forest glade with clustered beech trees and mossy boulders, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_05',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50205,
    prompt: `dense old-growth temperate woodland canopy with deep green oaks and tall spruces, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_temperate_06',
    category: 'forest_temperate',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50206,
    prompt: `temperate river-valley woods with mixed birch, oak, and subtle golden-olive foliage, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_arctic_01',
    category: 'forest_arctic',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50301,
    prompt: `snow-dusted boreal spruce and dark pine tree cluster in cold arctic tundra, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_arctic_02',
    category: 'forest_arctic',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50302,
    prompt: `frosted subarctic taiga pine grove with heavy snow on dark evergreen branches, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_arctic_03',
    category: 'forest_arctic',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50303,
    prompt: `sparse arctic conifer stand of windblown snow-covered firs and dark slate rocks, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_arctic_04',
    category: 'forest_arctic',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.66,
    seed: 50304,
    prompt: `dense northern boreal pine forest with frost-tipped dark green spruce crowns, ${STYLE_WRAPPER}`,
  },

  // 3. Ground Detail Decal Overlays (low-profile transparent patches)
  {
    id: 'decal_rocky_scree_01',
    category: 'decal_rocky_scree',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60101,
    prompt: `scattered weathered grey-brown scree stones and gravel pebbles, ${DECAL_WRAPPER}`,
  },
  {
    id: 'decal_meadow_wildflowers_01',
    category: 'decal_meadow_wildflowers',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60201,
    prompt: `subtle patch of olive meadow grass tufts with tiny muted cream and pale yellow wildflowers, ${DECAL_WRAPPER}`,
  },
  {
    id: 'decal_dry_steppe_scrub_01',
    category: 'decal_dry_steppe_scrub',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60301,
    prompt: `patch of dry golden-ochre steppe grass tufts and low arid sagebrush, ${DECAL_WRAPPER}`,
  },
  {
    id: 'decal_desert_gravel_ripples_01',
    category: 'decal_desert_gravel_ripples',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60401,
    prompt: `windblown desert sandstone gravel and fine tan sand ripple patch, ${DECAL_WRAPPER}`,
  },
  {
    id: 'decal_tundra_lichen_rocks_01',
    category: 'decal_tundra_lichen_rocks',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60501,
    prompt: `flat weathered permafrost rocks with grey-green arctic lichen and frost patches, ${DECAL_WRAPPER}`,
  },
  {
    id: 'decal_coastal_boulders_01',
    category: 'decal_coastal_boulders',
    footprint: '1x1',
    targetWidth: 220,
    anchorX: 0.5,
    anchorY: 0.5,
    seed: 60601,
    prompt: `low cluster of sea-washed coastal granite boulders and damp pebbles, ${DECAL_WRAPPER}`,
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
        strength_model: item.category.startsWith('decal_') ? 0.3 : 0.52,
        strength_clip: item.category.startsWith('decal_') ? 0.3 : 0.52,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_exp_${item.id}` },
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

  console.log(`Generating ${EXPANDED_CATALOG.length} expanded ComfyUI sprites...`);
  for (let i = 0; i < EXPANDED_CATALOG.length; i++) {
    const item = EXPANDED_CATALOG[i];
    const outFile = `${item.id}.png`;
    const outPath = path.join(OUT_DIR, outFile);

    console.log(`[${i + 1}/${EXPANDED_CATALOG.length}] Generating ${item.id}...`);
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
      anchorX: item.anchorX,
      anchorY: item.anchorY,
    });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2));
  }

  console.log('Running bottom-skirt feathering & color harmonization...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`All done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
