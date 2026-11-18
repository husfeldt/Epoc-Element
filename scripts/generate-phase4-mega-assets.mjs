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
  'clean painterly 2.5D strategy game map miniature prop on flat level ground, no hill, no mound, no pedestal, high-angle isometric aerial view, natural satellite-inspired earth tones, soft top-left directional sunlight, organic irregular natural silhouette with no square pad, no diamond base, no rectangular slab, isolated centered object on a pure solid #FFFFFF white studio background, no floor grid, no border, no text';

const MEGA_STYLE =
  'expansive 2.5D aerial strategy game landscape formation, high-angle isometric cartographic view, cohesive cluster tapering organically at all outer edges with feathered natural perimeter, natural satellite-inspired earth tones, soft top-left directional sunlight, isolated centered cluster on a pure solid #FFFFFF white studio background, no square slab, no hex border, no text';

const NEGATIVE_PROMPT =
  'square base, square patch, diamond base, wooden fence, corral, flat horizontal bottom, hexagonal tile, hex base, rectangular pedestal, diorama block, plinth, white noise speckles, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, neon colors';

const CATALOG = [
  // Phase 1: Pad-free wild horses & 6 organic arctic sea ice silhouettes
  {
    id: 'resource_horses_01',
    category: 'resource_horses',
    footprint: '1x1',
    targetWidth: 225,
    seed: 95001,
    interiorKey: true,
    prompt: `small herd of 4 wild chestnut and bay horses grazing freely, isolated subjects on pure solid #FFFFFF white studio background, no fence, no square patch, no ground pad, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_01',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95002,
    interiorKey: false,
    prompt: `irregular fractured arctic ice floe and jagged blue-white sea iceberg silhouette, organic jagged edges, no flat horizontal bottom, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_02',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95003,
    interiorKey: false,
    prompt: `cluster of 3 floating glacial drift ice chunks with irregular cracked edges and pale turquoise shadow, no flat bottom, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_03',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95004,
    interiorKey: false,
    prompt: `sculpted wind-eroded arctic iceberg spire surrounded by small broken ice shards, irregular organic base, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_04',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95005,
    interiorKey: false,
    prompt: `crescent-shaped fractured sea ice sheet with snow-dusted ridges and irregular jagged perimeter, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_05',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95006,
    interiorKey: false,
    prompt: `twin-peaked glacial iceberg with deep teal crevasses and broken floating ice fragments, irregular base, ${CLEAN_STYLE}`,
  },
  {
    id: 'arctic_sea_ice_06',
    category: 'arctic_sea_ice',
    footprint: '1x1',
    targetWidth: 215,
    seed: 95007,
    interiorKey: false,
    prompt: `scattered archipelago of flat irregular sea-ice plates and small icy pinnacles, organic silhouette, ${CLEAN_STYLE}`,
  },

  // Phase 2: 7-Hex ("Flower Cluster") Multi-Tile Landscape Formations
  {
    id: 'mega_mountain_massif_arctic_01',
    category: 'mega_mountain_massif_arctic',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96001,
    interiorKey: false,
    prompt: `grand 7-hex alpine snow-clad mountain massif with central towering glacial peaks, internal valleys, and tapering rocky foothills around the outer perimeter, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_mountain_massif_arctic_02',
    category: 'mega_mountain_massif_arctic',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96002,
    interiorKey: false,
    prompt: `sweeping northern slate mountain range cluster with snow-covered ridges in center and gentler snowy slopes along outer edges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_mountain_massif_temperate_01',
    category: 'mega_mountain_massif_temperate',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96003,
    interiorKey: false,
    prompt: `massive temperate granite mountain cluster with high central peaks, light crest snow, and pine-dotted foothills tapering outward, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_mountain_massif_temperate_02',
    category: 'mega_mountain_massif_temperate',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96004,
    interiorKey: false,
    prompt: `broad weathered limestone mountain massif with rugged central spires, grassy valleys, and tapering outer ridges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_mountain_massif_arid_01',
    category: 'mega_mountain_massif_arid',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96005,
    interiorKey: false,
    prompt: `monumental red-ochre desert canyon massif and wind-eroded sandstone peaks tapering into rocky desert ridges at the outer edges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_mountain_massif_arid_02',
    category: 'mega_mountain_massif_arid',
    footprint: '7-hex',
    targetWidth: 700,
    seed: 96006,
    interiorKey: false,
    prompt: `sweeping arid sandstone mesa complex with tall central canyon walls and eroded desert foothills around the perimeter, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_temperate_01',
    category: 'mega_woodland_canopy_temperate',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96007,
    interiorKey: true,
    prompt: `expansive continuous temperate oak and birch forest canopy with tall dense trees in the core and natural thinning clearings at the outer edges, no snow, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_temperate_02',
    category: 'mega_woodland_canopy_temperate',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96008,
    interiorKey: true,
    prompt: `broad lush olive-green and sage broadleaf woodland cluster with organic irregular gaps and tapered outer tree line, no snow, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_arctic_01',
    category: 'mega_woodland_canopy_arctic',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96009,
    interiorKey: false,
    prompt: `vast boreal taiga forest cluster of dark spruce and snow-dusted conifers, dense in center and thinning naturally along outer perimeter, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_arctic_02',
    category: 'mega_woodland_canopy_arctic',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96010,
    interiorKey: false,
    prompt: `sweeping subarctic pine and fir woodland expanse with frost-tipped dark green evergreens tapering at outer edges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_tropical_01',
    category: 'mega_woodland_canopy_tropical',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96011,
    interiorKey: true,
    prompt: `lush continuous tropical rainforest canopy with tall emerald kapok trees and coconut palms in the core, thinning softly at outer edges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_woodland_canopy_tropical_02',
    category: 'mega_woodland_canopy_tropical',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96012,
    interiorKey: true,
    prompt: `expansive equatorial jungle grove with layered broad-leaf canopies and tropical palms, organic feathered perimeter, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_highland_crags_01',
    category: 'mega_highland_crags',
    footprint: '7-hex',
    targetWidth: 660,
    seed: 96013,
    interiorKey: true,
    prompt: `rugged cluster of weathered highland rocky ridges, mossy boulders, and low steppe scrub spread across a 7-hex formation, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_highland_crags_02',
    category: 'mega_highland_crags',
    footprint: '7-hex',
    targetWidth: 660,
    seed: 96014,
    interiorKey: true,
    prompt: `broad natural highland escarpment with scattered granite outcrops, dry grass tufts, and gentle rocky ledges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_dune_sea_01',
    category: 'mega_dune_sea',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96015,
    interiorKey: true,
    prompt: `sweeping 7-hex wind-sculpted desert sand dune sea with crisp golden-ochre dune crests tapering into rippled sand edges, ${MEGA_STYLE}`,
  },
  {
    id: 'mega_dune_sea_02',
    category: 'mega_dune_sea',
    footprint: '7-hex',
    targetWidth: 680,
    seed: 96016,
    interiorKey: true,
    prompt: `expansive desert erg with crescent barchan sand dunes and wind-blown sand ridges fading softly at the perimeter, ${MEGA_STYLE}`,
  },

  // Phase 2: Subtle 1x1 Micro-Features to break up dull open plains & hills
  {
    id: 'micro_scattered_boulders_01',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 185,
    seed: 97001,
    interiorKey: true,
    prompt: `subtle low-profile cluster of 4 weathered grey field boulders and tiny tufts of grass on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'micro_scattered_boulders_02',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 185,
    seed: 97002,
    interiorKey: true,
    prompt: `small natural arrangement of mossy stones and low pebbles on flat earth, subtle map micro-detail, ${CLEAN_STYLE}`,
  },
  {
    id: 'micro_heather_scrub_01',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 185,
    seed: 97003,
    interiorKey: true,
    prompt: `low-profile patch of wild olive heather bushes and muted wildflowers on flat ground, ${CLEAN_STYLE}`,
  },
  {
    id: 'micro_lone_oak_grove_01',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 195,
    seed: 97004,
    interiorKey: true,
    prompt: `single graceful lone oak tree with 2 tiny shrubs on flat level ground, airy open silhouette, ${CLEAN_STYLE}`,
  },
  {
    id: 'micro_dry_grass_tufts_01',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 185,
    seed: 97005,
    interiorKey: true,
    prompt: `subtle scattered tufts of golden steppe grass and small dry shrubs on flat earth, ${CLEAN_STYLE}`,
  },
  {
    id: 'micro_eroded_rock_outcrop_01',
    category: 'micro_plains_hills',
    footprint: '1x1',
    targetWidth: 195,
    seed: 97006,
    interiorKey: true,
    prompt: `low weathered limestone rock ledge and highland scree on flat ground, subtle terrain detail, ${CLEAN_STYLE}`,
  },

  // Phase 3: 8 Unique Natural Wonders & Ancient World Wonders
  {
    id: 'wonder_mount_celestial',
    category: 'wonder',
    footprint: '2x1',
    targetWidth: 440,
    seed: 98001,
    interiorKey: false,
    prompt: `towering sacred snow-crowned twin-peak alpine mountain massif with gleaming turquoise glacial waterfall, dramatic landmark, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_sunken_emerald_canyon',
    category: 'wonder',
    footprint: '2x1',
    targetWidth: 440,
    seed: 98002,
    interiorKey: true,
    prompt: `dramatic terraced emerald gorge and canyon with glowing turquoise river pools and lush cliffside vegetation, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_great_sapphire_atoll',
    category: 'wonder',
    footprint: '2x1',
    targetWidth: 440,
    seed: 98003,
    interiorKey: true,
    prompt: `vibrant circular tropical coral lagoon atoll with turquoise reef ring and tiny white sandbar islets, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_crimson_pillar_mesas',
    category: 'wonder',
    footprint: '2x1',
    targetWidth: 440,
    seed: 98004,
    interiorKey: true,
    prompt: `monumental red-rock desert sandstone spires and dramatic natural stone arch canyon formation, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_overgrown_sun_ziggurat',
    category: 'wonder',
    footprint: '1x1',
    targetWidth: 270,
    seed: 98005,
    interiorKey: true,
    prompt: `ancient stepped stone sun pyramid ziggurat overgrown with lush tropical jungle vines and moss, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_colossus_of_the_coast',
    category: 'wonder',
    footprint: '1x1',
    targetWidth: 265,
    seed: 98006,
    interiorKey: true,
    prompt: `weathered ancient giant bronze-and-stone colossus statue standing on rocky coastal headland, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_astral_monolith_ring',
    category: 'wonder',
    footprint: '1x1',
    targetWidth: 260,
    seed: 98007,
    interiorKey: true,
    prompt: `ancient weathered standing stone monolith circle with moss and carved runes on flat highland grass, ${CLEAN_STYLE}`,
  },
  {
    id: 'wonder_petrified_leviathan',
    category: 'wonder',
    footprint: '2x1',
    targetWidth: 420,
    seed: 98008,
    interiorKey: true,
    prompt: `colossal ancient fossilized giant ribcage bones half-buried in weathered desert canyon sand, dramatic landmark, ${CLEAN_STYLE}`,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p4m_${item.id}` },
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

  console.log(`Generating ${CATALOG.length} Phase 1-3 ComfyUI sprites (7-hex, micro, wonders, ice)...`);
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

  console.log('Running organic radial-noise alpha erosion & bottom-skirt feathering...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  console.log(`Done! Total sprites in manifest: ${byId.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
