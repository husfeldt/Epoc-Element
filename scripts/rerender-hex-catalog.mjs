import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GUIDANCE_DIR = path.join(ROOT, 'scripts', 'hex_guidance');
const RAW_DIR = path.join(ROOT, 'scripts', '.raw_comfy');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'sprites');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const BACKUP_MANIFEST_PATH = path.join(OUT_DIR, 'manifest.pre_hex_test.json');
const COMFY_URL = 'http://127.0.0.1:8188';

const HEX_STYLE =
  '6-sided isometric pointy-top hexagon strategy game terrain tile, painterly 2.5D Civ VI map art style, natural muted satellite-inspired earth tones, top-left directional sunlight, flush flat ground edges that blend seamlessly at ground level with no raised coaster rim or thick soil bevel, pure solid #FFFFFF white background outside the hexagon perimeter, no square base, no 4-sided diamond, no text';

const NEGATIVE_PROMPT =
  'square tile, 4-sided diamond, rotated square, rectangular slab, thick cutaway block, raised coaster rim, thick soil bevel, extruded cliff pedestal, dark background, sky, horizon, text, watermark, signature, border, frame, cartoonish';

// Groundless multi-entity / copse sprites preserved as-is
const PRESERVE_GROUNDLESS = new Set([
  'single_horse_01',
  'single_cattle_01',
  'single_whale_01',
  'single_fish_01',
  'single_tree_oak_01',
  'single_tree_pine_01',
  'single_tree_palm_01',
]);

// Snow/white-preserving sprites that should NOT have interior white chroma-keyed out
const NO_INTERIOR_KEY = new Set([
  'mountain_peak_01',
  'mountain_peak_03',
  'mountain_arctic_01',
  'mountain_arctic_02',
  'mountain_temperate_01',
  'mountain_temperate_02',
  'mountain_temperate_03',
  'mountain_range_wide_01',
  'mountain_range_wide_04',
  'mountain_range_3x1_01',
  'mega_mountain_massif_arctic_01',
  'mega_mountain_massif_arctic_02',
  'mega_mountain_massif_temperate_01',
  'mega_mountain_massif_temperate_02',
  'mega_highland_arctic_01',
  'arctic_sea_ice_01',
  'arctic_sea_ice_02',
  'arctic_sea_ice_03',
  'arctic_sea_ice_04',
  'arctic_sea_ice_05',
  'arctic_sea_ice_06',
  'arctic_sea_stack_01',
  'ancient_ruins_tundra_01',
  'wonder_mount_celestial',
  'resource_marble_01',
  'mineral_stone_01',
]);

function extractExistingPrompts() {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.mjs') && f !== 'rerender-hex-catalog.mjs');
  const map = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const re = /id:\s*'([^']+)'[\s\S]{0,600}?prompt:\s*([`'])([\s\S]*?)\2/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      let subject = m[3]
        .replace(/,?\s*\$\{[^}]+\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (subject && !map.has(m[1])) {
        map.set(m[1], subject);
      }
    }
  }
  return map;
}

function resolveGuidancePrefix(id, footprint) {
  const s = id.toLowerCase();
  let biome = 'temperate';
  if (
    s.includes('arctic') ||
    s.includes('tundra') ||
    s.includes('sea_ice') ||
    s.includes('pine')
  ) {
    biome = s.includes('pine') && !s.includes('arctic') ? 'temperate' : 'arctic';
  } else if (
    s.includes('desert') ||
    s.includes('arid') ||
    s.includes('dune') ||
    s.includes('canyon') ||
    s.includes('oasis') ||
    s.includes('scrub') ||
    s.includes('crimson_pillar')
  ) {
    biome = 'desert';
  } else if (
    s.includes('coral') ||
    s.includes('kelp') ||
    s.includes('sand_cay') ||
    s.includes('coastal_rock') ||
    s.includes('atoll') ||
    s.includes('sunken_emerald')
  ) {
    biome = 'coast';
  } else if (
    s.includes('mountain') ||
    s.includes('ridge') ||
    s.includes('crag') ||
    s.includes('highland') ||
    s.includes('granite') ||
    s.includes('iron') ||
    s.includes('coal') ||
    s.includes('copper') ||
    s.includes('stone') ||
    s.includes('marble') ||
    s.includes('gold') ||
    s.includes('gems') ||
    s.includes('cave')
  ) {
    biome = 'mountain';
  }

  if (footprint === '7-hex') {
    const valid = ['temperate', 'mountain', 'desert', 'arctic'];
    const b = valid.includes(biome) ? biome : 'temperate';
    return `hex_7hex_${b}`;
  }
  if (footprint === '3x1') {
    const valid = ['temperate', 'mountain', 'desert'];
    const b = valid.includes(biome) ? biome : 'temperate';
    return `hex_3x1_${b}`;
  }
  if (footprint === '2x1') {
    return `hex_2x1_${biome}`;
  }
  return `hex_iso_${biome}`;
}

function computeTargetWidth(footprint) {
  if (footprint === '7-hex') return 560;
  if (footprint === '3x1') return 540;
  if (footprint === '2x1') return 420;
  return 280;
}

function computeHexAnchorY(footprint, width, height) {
  // Exact vertical center based on pointy-top yScale=0.65 geometry
  let bottomFracOfWidth = 0.65 / Math.sqrt(3); // 0.37528 for 1x1
  if (footprint === '2x1') bottomFracOfWidth = 0.65 / (2 * Math.sqrt(3)); // 0.18764
  else if (footprint === '3x1') bottomFracOfWidth = 0.65 / (3 * Math.sqrt(3)); // 0.12509
  else if (footprint === '7-hex') bottomFracOfWidth = (2.5 * 0.65) / (3 * Math.sqrt(3)); // 0.31273

  const ay = 1.0 - bottomFracOfWidth * (width / Math.max(1, height));
  return Number(Math.max(0.35, Math.min(0.78, ay)).toFixed(3));
}

async function uploadImageToComfy(filePath, subfolder = 'hex_guidance') {
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const form = new FormData();
  form.append('image', new Blob([buf], { type: 'image/png' }), name);
  form.append('subfolder', subfolder);
  form.append('overwrite', 'true');
  const res = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed for ${name}: ${res.status}`);
  const json = await res.json();
  return json.subfolder ? `${json.subfolder}/${json.name}` : json.name;
}

function buildWorkflow(item, guidanceName, maskName, seed) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'flux1-schnell-fp8.safetensors' },
    },
    '2': {
      class_type: 'LoadImage',
      inputs: { image: guidanceName },
    },
    '3': {
      class_type: 'LoadImage',
      inputs: { image: maskName },
    },
    '4': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['2', 0], vae: ['1', 2] },
    },
    '5': {
      class_type: 'ImageToMask',
      inputs: { image: ['3', 0], channel: 'red' },
    },
    '6': {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['4', 0], mask: ['5', 0] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: item.prompt },
    },
    '8': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: NEGATIVE_PROMPT },
    },
    '9': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['7', 0],
        negative: ['8', 0],
        latent_image: ['6', 0],
        seed,
        steps: 6,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 0.86,
      },
    },
    '10': {
      class_type: 'VAEDecode',
      inputs: { samples: ['9', 0], vae: ['1', 2] },
    },
    '11': {
      class_type: 'SaveImage',
      inputs: { images: ['10', 0], filename_prefix: `epoc_hex_${item.id}` },
    },
  };
}

async function queueAndFetch(item, guidanceName, maskName, seed) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildWorkflow(item, guidanceName, maskName, seed) }),
  });
  if (!res.ok) throw new Error(`ComfyUI prompt failed: ${res.status} ${await res.text()}`);
  const { prompt_id } = await res.json();

  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const histRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json();
    const rec = hist[prompt_id];
    if (!rec) continue;
    if (rec.status?.status_str === 'error') {
      throw new Error(`ComfyUI error: ${JSON.stringify(rec.status)}`);
    }
    const outputs = rec.outputs?.['11']?.images;
    if (outputs && outputs.length > 0) {
      const imgInfo = outputs[0];
      const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder || '')}&type=${encodeURIComponent(imgInfo.type || 'output')}`;
      const imgRes = await fetch(viewUrl);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }
  }
  throw new Error(`Timeout waiting for ${item.id}`);
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 900000) + 100000;
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean)) : null;

  // Restore clean pre-pilot manifest as base if starting fresh without --resume
  const baseManifestPath = fs.existsSync(BACKUP_MANIFEST_PATH) && !resume && !onlySet ? BACKUP_MANIFEST_PATH : MANIFEST_PATH;
  const manifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));
  const trText = fs.readFileSync(path.join(ROOT, 'src', 'engine', 'terrainRenderer.ts'), 'utf8');

  // Also restore original 7 pilot entries in manifest if we loaded MANIFEST_PATH? No, if !resume we loaded BACKUP_MANIFEST_PATH!
  const promptMap = extractExistingPrompts();
  promptMap.set(
    'anomaly_observatory_01',
    'ancient 3D stone astronomical observatory ruin with a weathered carved stone dome, brass armillary sphere, and mossy stone steps on olive grass'
  );
  const megaPrompts = {
    mega_mountain_massif_arctic_01: 'massive snow-capped arctic granite mountain massif with jagged glacial ridges and alpine valleys filling the entire multi-hex footprint',
    mega_mountain_massif_arctic_02: 'towering frozen slate mountain range with steep snowfields and rocky buttresses filling the entire multi-hex footprint',
    mega_mountain_massif_temperate_01: 'grand alpine granite mountain massif with forested lower slopes and rocky crags filling the entire multi-hex footprint',
    mega_mountain_massif_temperate_02: 'broad misty mountain range with twin jagged granite peaks and pine-covered foothills filling the entire multi-hex footprint',
    mega_mountain_massif_arid_01: 'vast arid sandstone mountain massif with stratified red-ochre cliffs and canyons filling the entire multi-hex footprint',
    mega_mountain_massif_arid_02: 'weathered desert mesa massif with eroded red rock spires and scree slopes filling the entire multi-hex footprint',
    mega_woodland_canopy_temperate_01: 'lush dense temperate broadleaf and oak woodland forest filling the entire multi-hex footprint with varied green and golden-olive canopies',
    mega_woodland_canopy_arctic_01: 'dense snow-dusted boreal taiga pine forest filling the entire multi-hex footprint',
    mega_woodland_canopy_tropical_01: 'dense lush tropical rainforest canopy with broad emerald palms and jungle trees filling the entire multi-hex footprint',
    mega_woodland_canopy_tropical_02: 'vibrant tropical jungle grove with layered rainforest canopy and mossy boulders filling the entire multi-hex footprint',
    mega_highland_crags_01: 'rugged highland granite crags and grassy escarpments filling the entire multi-hex footprint',
    mega_highland_crags_02: 'weathered mossy highland rock ridges and heather slopes filling the entire multi-hex footprint',
    mega_dune_sea_01: 'sweeping golden-ochre desert sand dunes with wind-carved ripples filling the entire multi-hex footprint',
    mega_dune_sea_02: 'warm arid desert erg with sculpted sand ridges and sandstone outcrops filling the entire multi-hex footprint',
    mega_highland_arctic_01: 'frozen tundra highland crags with snowdrifts and dark slate ridges filling the entire multi-hex footprint',
    mega_pine_7hex_01: 'dense evergreen pine forest cluster filling the entire multi-hex footprint on muted olive-green forest floor',
    mega_pine_7hex_02: 'deep boreal conifer woodland filling the entire multi-hex footprint with varied dark spruce and pine trees',
    mega_broadleaf_7hex_01: 'rich temperate deciduous oak and beech forest filling the entire multi-hex footprint',
    mega_broadleaf_7hex_02: 'lush autumn-tinted temperate broadleaf forest filling the entire multi-hex footprint',
  };
  for (const [k, v] of Object.entries(megaPrompts)) {
    if (!promptMap.has(k)) promptMap.set(k, v);
  }
  const venvPython = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python';
  const cutoutScript = path.join(ROOT, 'scripts', 'cutout_sprite.py');

  // Upload all guidance + mask pairs once
  const uploadedGuidance = new Map();
  const guidanceFiles = fs.readdirSync(GUIDANCE_DIR).filter((f) => f.endsWith('.png'));
  console.log(`Uploading ${guidanceFiles.length} hex guidance/mask files to ComfyUI...`);
  for (const gf of guidanceFiles) {
    const upName = await uploadImageToComfy(path.join(GUIDANCE_DIR, gf));
    uploadedGuidance.set(gf, upName);
  }

  const targets = manifest.sprites.filter((s) => {
    if (PRESERVE_GROUNDLESS.has(s.id)) return false;
    const isActive = trText.includes(s.id) || s.category === 'city_settlement' || s.category === 'barbarian_camp';
    if (!isActive) return false;
    if (onlySet && !onlySet.has(s.id)) return false;
    if (resume && s.hexTile === true && !s.file.includes('/hex_tests/')) return false;
    return true;
  });

  console.log(`Re-rendering ${targets.length} active sprites as 6-sided hex tiles...`);

  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i];
    const footprint = entry.footprint || '1x1';
    const prefix = resolveGuidancePrefix(entry.id, footprint);
    const guidanceFile = `${prefix}_guidance.png`;
    const maskFile = `${prefix}_mask.png`;
    const guidanceName = uploadedGuidance.get(guidanceFile);
    const maskName = uploadedGuidance.get(maskFile);

    const subject = promptMap.get(entry.id) || entry.id.replace(/_\d+$/, '').replace(/_/g, ' ');
    const shapeHint =
      footprint === '7-hex'
        ? 'dense continuous multi-hex landscape cluster filling the irregular multi-hex footprint naturally with no geometric stone border'
        : footprint === '3x1'
          ? 'elongated continuous 3-tile-wide landscape chain filling the horizontal footprint naturally'
          : footprint === '2x1'
            ? 'wide twin-tile continuous landscape formation filling the 2-hex footprint naturally'
            : '6-sided hexagonal terrain tile';

    const prompt = `${subject}, ${shapeHint}, ${HEX_STYLE}`;
    const seed = hashSeed(entry.id);

    console.log(`[${i + 1}/${targets.length}] ${entry.id} (${footprint}, ${prefix})...`);
    const rawBuf = await queueAndFetch({ id: entry.id, prompt }, guidanceName, maskName, seed);
    const rawPath = path.join(RAW_DIR, `${entry.id}_hex_raw.png`);
    fs.writeFileSync(rawPath, rawBuf);

    const outPath = path.join(OUT_DIR, `${entry.id}.png`);
    const targetWidth = computeTargetWidth(footprint);
    const cutoutArgs = [cutoutScript, rawPath, outPath, String(targetWidth)];
    if (!NO_INTERIOR_KEY.has(entry.id)) {
      cutoutArgs.push('--interior-key');
    }

    const cutoutOut = execFileSync(pythonExe, cutoutArgs, { encoding: 'utf8' });
    const dims = JSON.parse(cutoutOut.trim());

    entry.file = `/assets/sprites/${entry.id}.png`;
    entry.width = dims.width;
    entry.height = dims.height;
    entry.anchorX = 0.5;
    entry.anchorY = computeHexAnchorY(footprint, dims.width, dims.height);
    entry.hexTile = true;

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`  -> ${dims.width}x${dims.height}, anchorY=${entry.anchorY}`);
  }

  console.log('Hex catalog regeneration complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
