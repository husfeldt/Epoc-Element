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

const NEGATIVE_PROMPT =
  'hexagonal tile, hex base, rectangular pedestal, square slab base, diorama block, plinth, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish, flat vector, neon colors';

const CATALOG = [
  // 1. Multi-Tile & Natural Landscape Formations
  {
    id: 'mountain_range_wide_01',
    category: 'mountain_range_wide',
    footprint: '2x1',
    targetWidth: 460,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10101,
    prompt: `elongated craggy alpine granite mountain range ridge with multiple jagged peaks, eroded gullies, scree slopes, and natural snow in high crevices, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_range_wide_02',
    category: 'mountain_range_wide',
    footprint: '2x1',
    targetWidth: 460,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10102,
    prompt: `wide twin-peak rocky granite mountain chain with deep shadow valleys, sparse pine trees at the base, and weathered stone cliffs, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_range_wide_03',
    category: 'mountain_range_wide',
    footprint: '2x1',
    targetWidth: 460,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10103,
    prompt: `long weathered sandstone and ochre desert mountain range ridge with stratified canyons and rocky talus slopes, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_peak_01',
    category: 'mountain_peak',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10201,
    prompt: `single towering jagged granite mountain peak with eroded ridges and snow-filled rock crevices, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_peak_02',
    category: 'mountain_peak',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10202,
    prompt: `steep mossy tropical mountain peak with a slender silver waterfall cascading down rocky cliffs, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mountain_peak_03',
    category: 'mountain_peak',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 10203,
    prompt: `rugged arctic snow-covered mountain peak with exposed dark slate cliff faces, ${STYLE_WRAPPER}`,
  },
  {
    id: 'foothills_rocky_01',
    category: 'foothills_rocky',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 10301,
    prompt: `cluster of weathered rocky foothills with olive-green grass and exposed granite outcrops, ${STYLE_WRAPPER}`,
  },
  {
    id: 'foothills_rocky_02',
    category: 'foothills_rocky',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 10302,
    prompt: `eroded sandstone mesa foothills with warm ochre boulders and dry desert scrub, ${STYLE_WRAPPER}`,
  },
  {
    id: 'foothills_rocky_03',
    category: 'foothills_rocky',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 10303,
    prompt: `rolling mossy highland ridge with scattered grey stones and heather patches, ${STYLE_WRAPPER}`,
  },
  {
    id: 'desert_dunes_01',
    category: 'desert_dunes',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.72,
    seed: 10401,
    prompt: `wind-sculpted golden sand dune crest with fine wind ripples and soft leeward shadow, ${STYLE_WRAPPER}`,
  },
  {
    id: 'desert_dunes_02',
    category: 'desert_dunes',
    footprint: '2x1',
    targetWidth: 420,
    anchorX: 0.5,
    anchorY: 0.72,
    seed: 10402,
    prompt: `wide sweeping crescent desert sand dune ridge with wind-carved tan sand ripples, ${STYLE_WRAPPER}`,
  },
  {
    id: 'desert_dunes_03',
    category: 'desert_dunes',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.72,
    seed: 10403,
    prompt: `arid sandstone rock formation surrounded by windblown golden desert sand drifts, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_pine_01',
    category: 'forest_pine',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10501,
    prompt: `dense cluster of realistic dark evergreen pine and spruce trees of varying heights, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_pine_02',
    category: 'forest_pine',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10502,
    prompt: `grove of tall boreal conifer fir trees with mossy forest floor shadow, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_pine_03',
    category: 'forest_pine',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10503,
    prompt: `snow-dusted subarctic pine forest cluster with dark green needles and frost, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_pine_04',
    category: 'forest_pine',
    footprint: '2x1',
    targetWidth: 400,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10504,
    prompt: `wide dense woodland stretch of realistic spruce and pine trees, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_deciduous_01',
    category: 'forest_deciduous',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10601,
    prompt: `lush cluster of realistic oak and beech deciduous woodland trees with rich olive-green foliage canopies, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_deciduous_02',
    category: 'forest_deciduous',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10602,
    prompt: `dense temperate broadleaf forest grove with varied autumn-olive and sage tree crowns, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_deciduous_03',
    category: 'forest_deciduous',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10603,
    prompt: `natural woodland copse of tall oaks, birches, and forest undergrowth bushes, ${STYLE_WRAPPER}`,
  },
  {
    id: 'forest_deciduous_04',
    category: 'forest_deciduous',
    footprint: '2x1',
    targetWidth: 400,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10604,
    prompt: `wide continuous temperate forest canopy of mixed oak and maple trees, ${STYLE_WRAPPER}`,
  },
  {
    id: 'jungle_canopy_01',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10701,
    prompt: `dense tropical rainforest canopy cluster with emergent palm trees, broad ferns, and deep green jungle foliage, ${STYLE_WRAPPER}`,
  },
  {
    id: 'jungle_canopy_02',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10702,
    prompt: `lush equatorial jungle thicket with tall tropical canopy trees and hanging vines, ${STYLE_WRAPPER}`,
  },
  {
    id: 'jungle_canopy_03',
    category: 'jungle_canopy',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 10703,
    prompt: `tropical mangrove and palm jungle cluster with dense layered foliage, ${STYLE_WRAPPER}`,
  },
  {
    id: 'oasis_palm_01',
    category: 'oasis_palm',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.72,
    seed: 10801,
    prompt: `clear desert oasis spring pool ringed by date palm trees, reeds, and wet golden sand, ${STYLE_WRAPPER}`,
  },
  {
    id: 'oasis_palm_02',
    category: 'oasis_palm',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.72,
    seed: 10802,
    prompt: `natural desert oasis lagoon with clustered date palms and grassy banks, ${STYLE_WRAPPER}`,
  },
  {
    id: 'coral_shoal_01',
    category: 'coral_shoal',
    footprint: '1x1',
    targetWidth: 250,
    anchorX: 0.5,
    anchorY: 0.65,
    seed: 10901,
    prompt: `natural coastal sandbar islet with weathered sea rocks, sparse tropical palms, and muted coral shoals, ${STYLE_WRAPPER}`,
  },
  {
    id: 'coral_shoal_02',
    category: 'coral_shoal',
    footprint: '1x1',
    targetWidth: 250,
    anchorX: 0.5,
    anchorY: 0.65,
    seed: 10902,
    prompt: `low rocky tidal reef outcrop with sea-washed boulders and coastal sandbar, ${STYLE_WRAPPER}`,
  },

  // 2. Artefacts, Caves & Special Resources
  {
    id: 'ancient_ruins_01',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 20101,
    prompt: `overgrown ancient weathered stone temple ruins with broken marble pillars, mossy flagstones, and fallen lintels, ${STYLE_WRAPPER}`,
  },
  {
    id: 'ancient_ruins_02',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 20102,
    prompt: `ancient sunken stone amphitheater and weathered standing monoliths covered in moss and ivy, ${STYLE_WRAPPER}`,
  },
  {
    id: 'ancient_ruins_03',
    category: 'ancient_ruins',
    footprint: '1x1',
    targetWidth: 260,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 20103,
    prompt: `ancient weathered stone obelisk and crumbling stepped shrine ruins, ${STYLE_WRAPPER}`,
  },
  {
    id: 'cave_entrance_01',
    category: 'cave_entrance',
    footprint: '1x1',
    targetWidth: 250,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 20201,
    prompt: `natural dark rocky cavern mouth set into a rugged cliffside boulder outcrop with moss and ferns, ${STYLE_WRAPPER}`,
  },
  {
    id: 'cave_entrance_02',
    category: 'cave_entrance',
    footprint: '1x1',
    targetWidth: 250,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 20202,
    prompt: `deep mysterious stone cave entrance carved into a weathered granite hillside crag, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_gold_01',
    category: 'mineral_gold',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20301,
    prompt: `rugged exposed quartz and granite rock outcrop with glittering natural gold ore veins, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_gold_02',
    category: 'mineral_gold',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20302,
    prompt: `weathered rocky crag with rich metallic gold nuggets embedded in dark stone, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_iron_01',
    category: 'mineral_iron',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20401,
    prompt: `dark jagged iron ore rock formation with rust-red and metallic grey mineral seams, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_iron_02',
    category: 'mineral_iron',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20402,
    prompt: `exposed dark basalt and magnetite iron deposit crag, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_gems_01',
    category: 'mineral_gems',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20501,
    prompt: `rocky mineral outcrop with natural uncut emerald and amethyst crystal clusters embedded in stone, ${STYLE_WRAPPER}`,
  },
  {
    id: 'mineral_stone_01',
    category: 'mineral_stone',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20601,
    prompt: `tiered pale limestone and marble cliffside stone outcrop with fractured rock blocks, ${STYLE_WRAPPER}`,
  },
  {
    id: 'resource_horses_01',
    category: 'resource_horses',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20701,
    prompt: `small herd of wild brown and chestnut horses grazing on a patch of natural meadow grass, ${STYLE_WRAPPER}`,
  },
  {
    id: 'resource_wheat_01',
    category: 'resource_wheat',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20801,
    prompt: `lush patch of golden ripe wild wheat grain stalks swaying together, ${STYLE_WRAPPER}`,
  },
  {
    id: 'resource_spices_01',
    category: 'resource_spices',
    footprint: '1x1',
    targetWidth: 240,
    anchorX: 0.5,
    anchorY: 0.75,
    seed: 20901,
    prompt: `cluster of lush aromatic tropical spice shrubs with reddish-amber blossoms and dark green leaves, ${STYLE_WRAPPER}`,
  },

  // 3. Encampments & Settlement Structures
  {
    id: 'barbarian_camp_01',
    category: 'barbarian_camp',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 30101,
    prompt: `rugged ancient barbarian camp with circular wooden log palisade, leather hide tents, central campfire, and wooden watchtower, ${STYLE_WRAPPER}`,
  },
  {
    id: 'barbarian_camp_02',
    category: 'barbarian_camp',
    footprint: '1x1',
    targetWidth: 270,
    anchorX: 0.5,
    anchorY: 0.76,
    seed: 30102,
    prompt: `tribal raider outpost with spiked timber barricade, fur-draped huts, and smoldering hearth, ${STYLE_WRAPPER}`,
  },
  {
    id: 'city_settlement_01',
    category: 'city_settlement',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 30201,
    prompt: `tiered ancient classical stone-and-timber walled city settlement with central citadel keep, terracotta roofs, and marketplace courtyard, ${STYLE_WRAPPER}`,
  },
  {
    id: 'city_settlement_02',
    category: 'city_settlement',
    footprint: '1x1',
    targetWidth: 300,
    anchorX: 0.5,
    anchorY: 0.78,
    seed: 30202,
    prompt: `historic fortified medieval stone town cluster with central stone tower, timber-framed houses, and stone perimeter wall, ${STYLE_WRAPPER}`,
  },
];

function buildWorkflow(item) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: 'flux1-schnell-fp8.safetensors',
      },
    },
    '2': {
      class_type: 'LoraLoader',
      inputs: {
        model: ['1', 0],
        clip: ['1', 1],
        lora_name: 'Isometric-3D.safetensors',
        strength_model: 0.55,
        strength_clip: 0.55,
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 1],
        text: item.prompt,
      },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 1],
        text: NEGATIVE_PROMPT,
      },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
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
      inputs: {
        samples: ['6', 0],
        vae: ['1', 2],
      },
    },
    '8': {
      class_type: 'SaveImage',
      inputs: {
        images: ['7', 0],
        filename_prefix: `epoc_prop_${item.id}`,
      },
    },
  };
}

async function queueAndFetch(item) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildWorkflow(item) }),
  });
  if (!res.ok) {
    throw new Error(`ComfyUI /prompt failed (${res.status}): ${await res.text()}`);
  }
  const { prompt_id } = await res.json();

  // Poll /history/{prompt_id}
  let imageMeta = null;
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 750));
    const hRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    if (!hRes.ok) continue;
    const hist = await hRes.json();
    const entry = hist[prompt_id];
    if (entry?.outputs?.['8']?.images?.length) {
      imageMeta = entry.outputs['8'].images[0];
      break;
    }
    if (entry?.status?.status_str === 'error') {
      throw new Error(`ComfyUI execution error for ${item.id}: ${JSON.stringify(entry.status)}`);
    }
  }
  if (!imageMeta) {
    throw new Error(`Timed out waiting for ${item.id}`);
  }

  const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(imageMeta.filename)}&subfolder=${encodeURIComponent(imageMeta.subfolder || '')}&type=${encodeURIComponent(imageMeta.type || 'output')}`;
  const imgRes = await fetch(viewUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download ${imageMeta.filename}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const rawPath = path.join(RAW_DIR, `${item.id}.png`);
  fs.writeFileSync(rawPath, buf);
  return rawPath;
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const isSample = process.argv.includes('--sample');
  const skipExisting = process.argv.includes('--skip-existing');
  const items = isSample
    ? CATALOG.filter((i) => i.id === 'mountain_range_wide_01' || i.id === 'ancient_ruins_01')
    : CATALOG;

  let existingManifest = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).sprites || [];
    } catch {
      existingManifest = [];
    }
  }
  const byId = new Map(existingManifest.map((s) => [s.id, s]));

  console.log(`Generating ${items.length} ComfyUI 2.5D sprites...`);
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const outFile = `${item.id}.png`;
    const outPath = path.join(OUT_DIR, outFile);

    if (skipExisting && fs.existsSync(outPath) && byId.has(item.id)) {
      console.log(`[${idx + 1}/${items.length}] Skipping existing ${item.id}`);
      continue;
    }

    console.log(`[${idx + 1}/${items.length}] Generating ${item.id} (${item.footprint})...`);
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
    console.log(`  -> Saved ${outFile} (${dims.width}x${dims.height})`);

    // Persist manifest incrementally
    fs.writeFileSync(
      MANIFEST_PATH,
      JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2)
    );
  }

  console.log(`Done! Manifest written to ${MANIFEST_PATH} (${byId.size} sprites).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
