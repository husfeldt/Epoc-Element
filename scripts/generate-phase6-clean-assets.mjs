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

const BASE_FREE_STYLE =
  'isolated rocky ridge crest and weathered boulders only, NO circular mound base, NO ground pad, NO grassy skirt, NO sandy patch, high-angle isometric aerial view, natural satellite-inspired muted stone and moss tones, soft top-left directional sunlight, isolated on a pure solid #FFFFFF white studio background, no floor grid, no border, no text';

const MEGA_HIGHLAND_STYLE =
  'expansive 2.5D aerial strategy game highland landscape cluster, muted olive-green grass and weathered grey granite outcrops, NO bright orange or yellow sand, irregular asymmetric organic edges, isolated on a pure solid #FFFFFF white studio background, no hex border, no flower shape, no text';

const NEGATIVE_PROMPT =
  'circular mound, conical hill, ground pad, sandy base, orange sand, yellow crater, flower shape, square base, diamond base, flat bottom, hexagonal tile, pedestal, diorama block, white noise speckles, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  // 8 base-free rocky ridge segments, mossy cliff outcrops & highland boulder clusters
  {
    id: 'ridge_outcrop_01',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 205,
    seed: 101001,
    interiorKey: true,
    prompt: `isolated weathered grey granite ridge crest with sharp fractured rock faces and dark moss crevices, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_02',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 205,
    seed: 101002,
    interiorKey: true,
    prompt: `small jagged limestone cliff escarpment and fallen rock scree, isolated rock formation only, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_03',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 195,
    seed: 101003,
    interiorKey: true,
    prompt: `cluster of 5 weathered mossy highland boulders and slate stones, isolated boulders only, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_04',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 205,
    seed: 101004,
    interiorKey: true,
    prompt: `slanted granite rock ledge with sparse dark heather tufts tucked in stone cracks, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_05',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 205,
    seed: 101005,
    interiorKey: true,
    prompt: `eroded dark slate highland outcrop with stepped stone strata, isolated rocks only, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_06',
    category: 'ridge_outcrop',
    footprint: '1x1',
    targetWidth: 195,
    seed: 101006,
    interiorKey: true,
    prompt: `mossy stone tor and scattered weathered field rocks, isolated rock formation only, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_wide_01',
    category: 'ridge_outcrop_wide',
    footprint: '2x1',
    targetWidth: 360,
    seed: 101007,
    interiorKey: true,
    prompt: `long horizontal weathered granite ridge line and broken rock escarpment spanning two hexes, isolated rocks only, ${BASE_FREE_STYLE}`,
  },
  {
    id: 'ridge_outcrop_wide_02',
    category: 'ridge_outcrop_wide',
    footprint: '2x1',
    targetWidth: 360,
    seed: 101008,
    interiorKey: true,
    prompt: `sweeping mossy cliff shelf and rugged stone outcrops arranged in a natural diagonal ridge, isolated rocks only, ${BASE_FREE_STYLE}`,
  },

  // Replace sandy-orange 7-hex highland clusters with biome-matched Temperate Granite & Mossy Slate + Arctic Slate
  {
    id: 'mega_highland_crags_01',
    category: 'mega_highland_crags',
    footprint: '7-hex',
    targetWidth: 660,
    seed: 102001,
    interiorKey: true,
    prompt: `natural temperate highland region of mossy olive-green slopes, weathered grey granite ridge lines, and sparse dark pine trees, ${MEGA_HIGHLAND_STYLE}`,
  },
  {
    id: 'mega_highland_crags_02',
    category: 'mega_highland_crags',
    footprint: '7-hex',
    targetWidth: 660,
    seed: 102002,
    interiorKey: true,
    prompt: `rolling dark-green temperate moorland hills with scattered grey limestone outcrops and heather patches, ${MEGA_HIGHLAND_STYLE}`,
  },
  {
    id: 'mega_highland_arctic_01',
    category: 'mega_highland_arctic',
    footprint: '7-hex',
    targetWidth: 660,
    seed: 102003,
    interiorKey: false,
    prompt: `subarctic frost-dusted dark slate highland ridges and wind-scoured tundra boulders, ${MEGA_HIGHLAND_STYLE}`,
  },

  // Discrete, dark submerged fish school silhouette (no bright disc or sticker outline)
  {
    id: 'resource_fish_01',
    category: 'resource_fish',
    footprint: '1x1',
    targetWidth: 135,
    seed: 103001,
    interiorKey: true,
    prompt: `subtle dark navy-slate school of 7 small fish silhouettes swimming in a loose organic arc, isolated on pure solid #FFFFFF white background, no water circle, no bright outline, no splash disc, ${BASE_FREE_STYLE}`,
  },
];

function buildWorkflow(item) {
  const is2x1 = item.footprint === '2x1';
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
      inputs: { width: is2x1 ? 1280 : 1024, height: is2x1 ? 832 : 1024, batch_size: 1 },
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p6_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 2/4 ComfyUI sprites (base-free ridges, highland clusters, discrete fish)...`);
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

  console.log('Running asymmetric multi-octave noise alpha erosion...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
