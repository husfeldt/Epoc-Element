import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'scripts', '.raw_comfy');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'sprites');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const REPORT_PATH = path.join(ROOT, 'public', 'sprite-validation-report.json');
const COMFY_URL = 'http://127.0.0.1:8188';

const CLASS_A_STYLE =
  'pure isolated 3D subject only, NO tile base, NO square slab, NO diamond pedestal, NO cutaway soil edges, floating subject on pure solid #FFFFFF white studio background, crisp unblurred silhouette, high-angle aerial three-quarter view, natural satellite-inspired earth tones, top-left directional sunlight, no text, no border';

const NEGATIVE_PROMPT =
  'diamond pedestal, diamond base, square base, square slab, cutaway soil, isometric block, diorama tile, plinth, hexagonal tile, hex base, thick base, pedestal, floor grid, dark background, sky, horizon, text, watermark, signature, frame, border, cartoonish';

function buildPromptForId(id, category) {
  const s = `${id} ${category}`.toLowerCase();
  if (s.includes('mountain')) {
    const tone = s.includes('arctic')
      ? 'snow-clad dark slate alpine mountain peaks'
      : s.includes('arid')
        ? 'red-ochre desert sandstone canyon peaks'
        : 'weathered grey granite mountain peaks with light crest snow';
    return `${tone}, craggy rocky ridges only, ${CLASS_A_STYLE}`;
  }
  if (s.includes('forest') || s.includes('jungle') || s.includes('pine')) {
    const trees = s.includes('arctic') || s.includes('pine')
      ? 'irregular organic cluster of dark green snow-dusted spruce and pine trees'
      : s.includes('jungle') || s.includes('tropical')
        ? 'irregular organic cluster of emerald tropical palms and rainforest trees'
        : 'irregular organic cluster of lush olive-green oak and birch trees, no snow';
    return `${trees}, pure trees and trunks only with NO ground patch, ${CLASS_A_STYLE}`;
  }
  if (s.includes('dune') || s.includes('desert')) {
    return `wind-sculpted golden-ochre desert sand dunes and weathered sandstone rocks, tapered irregular edges, ${CLASS_A_STYLE}`;
  }
  if (s.includes('foothills') || s.includes('coastal_rock') || s.includes('boulder')) {
    return `irregular cluster of weathered mossy granite boulders and fractured stone crags, rocks only, ${CLASS_A_STYLE}`;
  }
  if (s.includes('coral')) {
    return `organic irregular branching coral reef cluster in muted turquoise and terracotta tones, ${CLASS_A_STYLE}`;
  }
  if (s.includes('camp')) {
    return `tribal leather hide tents, small wooden palisade stakes, and campfire, irregular organic layout, ${CLASS_A_STYLE}`;
  }
  if (s.includes('ruin')) {
    return `weathered ancient broken stone columns and mossy temple arches, irregular silhouette, ${CLASS_A_STYLE}`;
  }
  if (s.includes('horse')) {
    return `3 wild chestnut horses grazing in a loose natural triangle, horses only, ${CLASS_A_STYLE}`;
  }
  return `organic natural 3D landscape feature (${id.replace(/_/g, ' ')}), ${CLASS_A_STYLE}`;
}

// NO Isometric-3D LoRA! CheckpointLoaderSimple directly so ComfyUI never forces 4-sided diamond diorama blocks.
function buildGroundlessWorkflow(id, prompt, seed, isWide) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'flux1-schnell-fp8.safetensors' },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: prompt },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['1', 1], text: NEGATIVE_PROMPT },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: isWide ? 1280 : 1024, height: isWide ? 832 : 1024, batch_size: 1 },
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['3', 0],
        negative: ['4', 0],
        latent_image: ['5', 0],
        seed,
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
      inputs: { images: ['7', 0], filename_prefix: `epoc_p2g_${id}` },
    },
  };
}

async function queueAndFetch(id, prompt, seed, isWide) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildGroundlessWorkflow(id, prompt, seed, isWide) }),
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
  if (!imageMeta) throw new Error(`Timed out waiting for ${id}`);

  const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(imageMeta.filename)}&subfolder=${encodeURIComponent(imageMeta.subfolder || '')}&type=${encodeURIComponent(imageMeta.type || 'output')}`;
  const imgRes = await fetch(viewUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const rawPath = path.join(RAW_DIR, `${id}.png`);
  fs.writeFileSync(rawPath, buf);
  return rawPath;
}

async function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const byId = new Map(manifest.sprites.map((s) => [s.id, s]));

  const failedList = report.failedItems || [];
  console.log(`Re-rendering ${failedList.length} failed sprites WITHOUT Isometric-3D LoRA + auto-retry validation...`);

  for (let i = 0; i < failedList.length; i++) {
    const item = failedList[i];
    const entry = byId.get(item.id);
    if (!entry) continue;

    const outPath = path.join(OUT_DIR, path.basename(entry.file));
    const isWide = entry.footprint === '2x1' || entry.footprint === '3x1';
    const targetW = entry.width || (isWide ? 360 : 240);
    const isSnow = /arctic|snow|ice|marble|city/i.test(item.id);
    const prompt = buildPromptForId(item.id, entry.category || '');

    let passed = false;
    for (let attempt = 0; attempt < 3 && !passed; attempt++) {
      const seed = 200000 + i * 100 + attempt * 17;
      console.log(`[${i + 1}/${failedList.length}] ${item.id} (attempt ${attempt + 1}/3, seed ${seed})...`);
      const rawPath = await queueAndFetch(item.id, prompt, seed, isWide);
      const pyArgs = [path.join(ROOT, 'scripts', 'cutout_sprite.py'), rawPath, outPath, String(targetW)];
      if (!isSnow) pyArgs.push('--interior-key');
      const cutJson = execFileSync('python', pyArgs, { encoding: 'utf8' }).trim();
      const dims = JSON.parse(cutJson);
      entry.width = dims.width;
      entry.height = dims.height;

      const valJson = execFileSync(
        'python',
        [path.join(ROOT, 'scripts', 'validate-sprites.py'), '--single', outPath, item.id],
        { encoding: 'utf8' }
      ).trim();
      const val = JSON.parse(valJson);
      passed = val.passed;
      if (!passed) {
        console.log(`  -> Retry needed: ${val.reasons.join(', ')}`);
      } else {
        console.log(`  -> PASS`);
      }
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sprites: Array.from(byId.values()) }, null, 2));
  }

  console.log('Running bottom-10% feathering & final validation report...');
  execFileSync('python', [path.join(ROOT, 'scripts', 'blend-sprites.py')], { stdio: 'inherit' });
  execFileSync('python', [path.join(ROOT, 'scripts', 'validate-sprites.py')], { stdio: 'inherit' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
