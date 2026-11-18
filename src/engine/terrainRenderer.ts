import { ComfySpriteEntry, comfyPropAtlas } from './comfyPropAtlas';
import {
  HEX_SIZE,
  MapViewMode,
  axialToPixel,
  hexDistance,
  hexInRange,
  hexNeighbors,
  tileKey,
} from './hexMath';
import { fbm2D, hash2D, tileableFbm2D, worley2D } from './noise';
import {
  FeatureSpriteKind,
  GroundTextureKey,
  ProceduralSprite,
  proceduralAtlas,
  resolveGroundTextureKey,
} from './proceduralAtlas';
import { BakedWorldTerrain } from './worldTerrainBaker';
import { GameState, HexTile, TemperatureZone, WorldRenderProp } from '../types/game';

export interface VisibleTileItem {
  tile: HexTile;
  px: number;
  py: number;
  explored: boolean;
  visible: boolean;
}

export interface YSortedDrawable {
  sortY: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function getHexCorners(cx: number, cy: number, size: number, yScale: number) {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle) * yScale,
    });
  }
  return pts;
}

// Cached seamless tileable water wave-normal & caustic ripple texture
let cachedCausticCanvas: HTMLCanvasElement | null = null;
function getWaterCausticCanvas(): HTMLCanvasElement {
  if (cachedCausticCanvas) return cachedCausticCanvas;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = tileableFbm2D(u, v, 6, 4409, 3);
      const cell = worley2D(u * 6, v * 6, 4421);
      // Bright caustic ridges along Worley cell boundaries + gentle wave swell
      const caustic = Math.pow(Math.max(0, Math.min(1, cell * 1.15)), 3.2);
      const val = Math.min(1, caustic * 0.72 + n * 0.28);
      const idx = (y * size + x) * 4;
      data[idx] = 200;
      data[idx + 1] = 232;
      data[idx + 2] = 245;
      data[idx + 3] = Math.round(val * 46);
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedCausticCanvas = c;
  return c;
}

// Cached seamless 512x512 tileable high-frequency ground surface detail textures (OffscreenCanvas)
type DetailBiomeKind = 'grass_plains' | 'desert' | 'tundra_snow';
const detailTextureCache = new Map<DetailBiomeKind, OffscreenCanvas | HTMLCanvasElement>();

function createScratchCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function getDetailTextureCanvas(kind: DetailBiomeKind): OffscreenCanvas | HTMLCanvasElement {
  const cached = detailTextureCache.get(kind);
  if (cached) return cached;

  const size = 512;
  const c = createScratchCanvas(size, size);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;
      let lum = 128;
      let rOff = 0;
      let gOff = 0;
      let bOff = 0;

      if (kind === 'grass_plains') {
        // Fine grass-blade stippling, subtle wildflower/clover flecks, organic soil grain
        const blade = tileableFbm2D(u, v * 1.4, 28, 5101, 2);
        const grain = hash2D(x, y, 5113);
        const clover = worley2D(u * 18, v * 18, 5147);
        lum = 112 + blade * 46 + (grain - 0.5) * 28;
        if (clover < 0.16) {
          // Subtle pale wildflower / clover fleck
          rOff = 18;
          gOff = 22;
          bOff = -8;
        } else if (blade < 0.36) {
          // Fine soil grain shadow
          rOff = 6;
          gOff = -6;
          bOff = -10;
        }
      } else if (kind === 'desert') {
        // Crisp wind-blown sand ripples and fine gravel grit
        const warp = tileableFbm2D(u, v, 8, 6203, 2);
        const ripple = Math.sin((u * 18 + v * 7 + warp * 1.6) * Math.PI * 2) * 0.5 + 0.5;
        const grit = hash2D(x, y, 6217);
        lum = 108 + ripple * 48 + (grit - 0.5) * 30;
        if (grit > 0.88) {
          rOff = -14;
          gOff = -16;
          bOff = -18;
        }
      } else {
        // Wind-scoured snow crust and rocky permafrost grain
        const scour = tileableFbm2D(u * 1.5, v * 0.7, 16, 7307, 3);
        const rock = worley2D(u * 14, v * 14, 7321);
        const grit = hash2D(x, y, 7333);
        lum = 116 + scour * 42 + (grit - 0.5) * 22;
        if (rock < 0.22) {
          rOff = -14;
          gOff = -10;
          bOff = -4;
        }
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(lum + rOff)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(lum + gOff)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(lum + bOff)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  detailTextureCache.set(kind, c);
  return c;
}

// Cache for submerged seabed sprites (60% opacity, softened contrast, wide radial edge feathering)
const submergedSeabedCache = new Map<string, OffscreenCanvas | HTMLCanvasElement>();
function getSubmergedSeabedSprite(sp: ComfySpriteEntry): OffscreenCanvas | HTMLCanvasElement | null {
  if (!sp.image || !sp.loaded) return null;
  const cached = submergedSeabedCache.get(sp.id);
  if (cached) return cached;

  const w = sp.image.naturalWidth || sp.width;
  const h = sp.image.naturalHeight || sp.height;
  if (w <= 0 || h <= 0) return null;

  const c = createScratchCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.save();
  ctx.filter = 'saturate(0.58) contrast(0.80) brightness(0.92)';
  ctx.drawImage(sp.image, 0, 0, w, h);
  ctx.restore();

  // Wide radial edge feathering so reefs/kelp/sandbars dissolve into the seabed
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const cx = w * 0.5;
  const cy = h * 0.54;
  const rMax = Math.max(w, h) * 0.48;
  const mask = ctx.createRadialGradient(cx, cy, rMax * 0.25, cx, cy, rMax);
  mask.addColorStop(0, 'rgba(255,255,255,0.62)');
  mask.addColorStop(0.65, 'rgba(255,255,255,0.36)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  submergedSeabedCache.set(sp.id, c);
  return c;
}

/**
 * PHASE 2 & PHASE 4:
 * - Draws the pre-baked world terrain + seabed buffer
 * - Composites seamless 512x512 world-space micro-detail textures over open land
 * - Sub-Layer 4A: Draws submerged coral reefs, kelp beds, and sandbars on the seabed
 * - Sub-Layer 4B: Draws translucent bathymetry water column absorption over Sub-Layer 4A
 * - Sub-Layer 4C: Scrolls animated water wave/caustic ripples & breaking surf foam
 * - Masks unexplored frontier tiles with parchment
 */
export function renderBakedWorldTerrainLayer(
  ctx: CanvasRenderingContext2D,
  baked: BakedWorldTerrain,
  visibleList: VisibleTileItem[],
  yScale: number,
  timeSec: number
) {
  ctx.drawImage(
    baked.canvas,
    baked.minX,
    baked.minY,
    baked.worldW,
    baked.worldH
  );

  // Phase 2: Tiled World-Space High-Frequency Ground Micro-Textures (soft-light at 30% opacity)
  const grassList: VisibleTileItem[] = [];
  const desertList: VisibleTileItem[] = [];
  const tundraList: VisibleTileItem[] = [];
  for (const item of visibleList) {
    if (!item.explored) continue;
    const b = item.tile.biome;
    if (b === 'ocean' || b === 'coast') continue;
    if (b === 'desert') desertList.push(item);
    else if (b === 'tundra' || item.tile.temperature === 'arctic') tundraList.push(item);
    else grassList.push(item);
  }

  const applyDetailPass = (items: VisibleTileItem[], kind: DetailBiomeKind) => {
    if (items.length === 0) return;
    const tex = getDetailTextureCanvas(kind);
    const pat = ctx.createPattern(tex, 'repeat');
    if (!pat) return;
    const m = new DOMMatrix();
    m.scaleSelf(0.32, 0.32 * yScale);
    pat.setTransform(m);

    ctx.save();
    ctx.beginPath();
    for (const item of items) {
      const pts = getHexCorners(item.px, item.py, HEX_SIZE + 1.5, yScale);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = pat;
    ctx.fillRect(baked.minX, baked.minY, baked.worldW, baked.worldH);
    ctx.restore();
  };

  applyDetailPass(grassList, 'grass_plains');
  applyDetailPass(desertList, 'desert');
  applyDetailPass(tundraList, 'tundra_snow');

  // Sub-Layer 4A: Submerged Water Features (coral reefs, kelp shoals, sandbars & discrete submerged fish) on the seabed
  comfyPropAtlas.ensureLoaded();
  const baseW = yScale < 1 ? HEX_SIZE * 1.32 : HEX_SIZE * 1.12;
  for (const item of visibleList) {
    if (!item.explored || item.tile.biome !== 'coast') continue;
    const { tile, px, py } = item;
    const variant = Math.abs(tile.q * 73856093 ^ tile.r * 19349663);

    // Phase 3: Multi-Entity Submerged Marine Life (2-3 individual whales or 4-5 individual fish beneath the water column)
    if (tile.resourceProp === 'fish' || tile.resourceProp === 'whales') {
      const isWhale = tile.resourceProp === 'whales';
      const marineSp = comfyPropAtlas.getSpriteFromIds(
        [isWhale ? 'single_whale_01' : 'single_fish_01'],
        variant
      );
      if (marineSp && marineSp.image && marineSp.loaded) {
        const count = isWhale ? 2 + (variant % 2) : 4 + (variant % 2);
        const baseOffsets = [
          [-12, -6],
          [10, -5],
          [2, 8],
          [-9, 7],
          [13, 6],
        ];
        const basePhase = hash2D(tile.q, tile.r, 551) * Math.PI * 2;
        for (let mIdx = 0; mIdx < count; mIdx++) {
          const indivPhase = basePhase + mIdx * 1.45;
          const speed = isWhale ? 0.45 : 0.78;
          const tOrb = timeSec * speed + indivPhase;
          const radX = isWhale ? 7.5 : 5.5;
          const radY = (isWhale ? 3.8 : 2.8) * yScale;
          const dx = baseOffsets[mIdx][0] + Math.sin(tOrb) * radX;
          const dy = baseOffsets[mIdx][1] * yScale + Math.sin(tOrb * 2) * radY;
          const vx = Math.cos(tOrb) * radX;
          const vy = Math.cos(tOrb * 2) * 2 * radY;
          const heading = Math.atan2(vy, vx) * 0.22;
          const undulate = 1 + Math.sin(timeSec * (isWhale ? 2.1 : 4.2) + indivPhase) * 0.04;
          const indivW = baseW * (isWhale ? 0.36 : 0.22) * (0.9 + (mIdx % 3) * 0.08);
          const indivH =
            indivW * (marineSp.height / Math.max(1, marineSp.width)) * (yScale === 1 ? 0.86 : 1.0);

          ctx.save();
          ctx.globalAlpha = isWhale ? 0.54 : 0.48;
          ctx.filter = 'saturate(0.65) contrast(0.85) brightness(0.88)';
          ctx.translate(px + dx, py + dy);
          ctx.rotate(heading);
          ctx.scale(vx < 0 ? -1 : 1, undulate);
          ctx.drawImage(marineSp.image, -indivW * 0.5, -indivH * 0.5, indivW, indivH);
          ctx.restore();
        }
      }
    }

    if (tile.shoreline === 'icy_shore') continue;
    const lat = Math.abs(tile.r / 40 - 0.5) * 2;
    let sp: ComfySpriteEntry | null = null;
    if (tile.clusterType === 'coral_lagoon' && tile.clusterRole === 'center') {
      sp = comfyPropAtlas.getSpriteFromIds(['tropical_sand_cay_01', 'coral_shoal_01'], variant);
    } else if (tile.shoreline === 'coral_reef' || (lat < 0.38 && variant % 4 === 0)) {
      sp = comfyPropAtlas.getSpriteFromIds(['coral_reef_01', 'coral_reef_02'], variant);
    } else if (variant % 5 === 2) {
      sp = comfyPropAtlas.getSpriteFromIds(['kelp_shoals_01'], variant);
    }
    if (!sp) continue;

    const subCanvas = getSubmergedSeabedSprite(sp);
    if (!subCanvas) continue;
    const drawW = baseW * 0.96;
    const drawH = drawW * (sp.height / Math.max(1, sp.width)) * (yScale === 1 ? 0.86 : 1.0);
    const ox = (hash2D(tile.q, tile.r, 333) - 0.5) * 6;
    const oy = (hash2D(tile.q, tile.r, 444) - 0.5) * 4 * yScale;
    ctx.drawImage(
      subCanvas,
      px + ox - drawW * sp.anchorX,
      py + oy - drawH * sp.anchorY + 2 * yScale,
      drawW,
      drawH
    );
  }

  // Sub-Layer 4B: Translucent Water Column Absorption (tints submerged features beneath the sea)
  if (baked.waterColumnCanvas) {
    ctx.drawImage(
      baked.waterColumnCanvas,
      baked.minX,
      baked.minY,
      baked.worldW,
      baked.worldH
    );
  }

  // Sub-Layer 4C: Multi-layered scrolling animated water wave & caustic texture over explored water tiles
  const causticTex = getWaterCausticCanvas();
  const pat1 = ctx.createPattern(causticTex, 'repeat');
  const pat2 = ctx.createPattern(causticTex, 'repeat');
  if (pat1 && pat2) {
    const m1 = new DOMMatrix();
    m1.translateSelf(timeSec * 6.5, timeSec * 3.2);
    m1.scaleSelf(0.65, 0.65 * yScale);
    pat1.setTransform(m1);

    const m2 = new DOMMatrix();
    m2.translateSelf(-timeSec * 4.2, timeSec * 5.1);
    m2.rotateSelf(18);
    m2.scaleSelf(0.48, 0.48 * yScale);
    pat2.setTransform(m2);

    ctx.save();
    ctx.beginPath();
    for (const item of visibleList) {
      if (!item.explored) continue;
      if (item.tile.biome !== 'ocean' && item.tile.biome !== 'coast') continue;
      const pts = getHexCorners(item.px, item.py, HEX_SIZE + 1.5, yScale);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }
    ctx.clip();

    ctx.globalAlpha = 0.64;
    ctx.fillStyle = pat1;
    ctx.fillRect(baked.minX, baked.minY, baked.worldW, baked.worldH);
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = pat2;
    ctx.fillRect(baked.minX, baked.minY, baked.worldW, baked.worldH);
    ctx.restore();
  }

  // Subtle pelagic wave crests & whitecaps in deeper ocean water
  ctx.save();
  ctx.lineCap = 'round';
  for (const item of visibleList) {
    if (!item.explored || item.tile.biome !== 'ocean') continue;
    const { tile, px, py } = item;
    const h = hash2D(tile.q, tile.r, 809);
    if (h > 0.42) continue;
    const wavePhase = timeSec * 1.1 + h * 18.0;
    const driftX = ((timeSec * 4.5 + h * 30) % 18) - 9;
    const alpha = Math.max(0, Math.sin(wavePhase) * 0.24);
    if (alpha <= 0.03) continue;
    ctx.strokeStyle = `rgba(225, 245, 255, ${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + driftX - 8, py + (h - 0.2) * 14 * yScale);
    ctx.quadraticCurveTo(px + driftX, py + (h - 0.2) * 14 * yScale - 2.5 * yScale, px + driftX + 8, py + (h - 0.2) * 14 * yScale);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Rolling Coastal Surf along Chaikin-smoothed ocean coastlines (skipping calm freshwater lakes)
  if (baked.coastPolylines.length > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let ring = 0; ring < 3; ring++) {
      const phase = (timeSec * 0.46 + ring * 0.33) % 1;
      const alpha = Math.sin(phase * Math.PI) * (0.48 - ring * 0.09);
      if (alpha <= 0.02) continue;
      ctx.strokeStyle = `rgba(236, 248, 252, ${alpha})`;
      ctx.lineWidth = 1.6 - ring * 0.25;
      ctx.setLineDash([14 - ring * 2, 6 + ring * 3, 6, 9]);
      ctx.lineDashOffset = -timeSec * (9 + ring * 3) + ring * 19;

      for (const poly of baked.coastPolylines) {
        if (poly.points.length < 2 || poly.shoreType === 'icy_shore') continue;
        ctx.beginPath();
        const shift = (phase - 0.5) * 2.2;
        ctx.moveTo(poly.points[0].x + shift, poly.points[0].y + shift * yScale);
        for (let i = 1; i < poly.points.length; i++) {
          ctx.lineTo(poly.points[i].x + shift, poly.points[i].y + shift * yScale);
        }
        if (poly.closed) ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 2b. Unified Multi-Hex Freshwater Lakes (single merged Chaikin-smoothed contour, no touching circles)
  if (baked.lakePolylines && baked.lakePolylines.length > 0) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const poly of baked.lakePolylines) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();

      // Feathered grassy/reedy bank transition
      ctx.strokeStyle = 'rgba(78, 118, 54, 0.36)';
      ctx.lineWidth = 5.5;
      ctx.stroke();

      // Calm, clearer emerald-teal freshwater body
      ctx.fillStyle = 'rgba(32, 128, 134, 0.42)';
      ctx.fill();

      // Subtle inner shoreline ripple
      ctx.strokeStyle = 'rgba(182, 232, 234, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  if (baked.riverPolylines.length > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const rPts of baked.riverPolylines) {
      if (rPts.length < 2) continue;
      const total = rPts.length - 1;

      // Pass 1: Wide (22px), very subtle (12% opacity) lush green/earthy valley tint
      ctx.strokeStyle = 'rgba(56, 98, 46, 0.12)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(rPts[0].x, rPts[0].y);
      for (let i = 1; i < rPts.length; i++) ctx.lineTo(rPts[i].x, rPts[i].y);
      ctx.stroke();

      // Pass 2 & 3: Soft recessed riverbed shadow + organic noise-varied translucent water core
      for (let i = 0; i < total; i++) {
        const t = i / Math.max(1, total - 1);
        // Taper smoothly from 0px & 0% opacity at spring over first 14%, flare & fade at mouth (>88%)
        const sourceFade = t < 0.14 ? t / 0.14 : 1.0;
        const mouthFade = t > 0.88 ? Math.max(0.15, 1.0 - (t - 0.88) / 0.12) : 1.0;
        const alpha = sourceFade * mouthFade;
        const a = rPts[i];
        const b = rPts[i + 1];
        // Organic width variation using low-frequency noise (1.5px springs -> 10px deltas)
        const widthNoise = 0.80 + fbm2D(a.x * 0.024, a.y * 0.024, 771, 2) * 0.46;
        const baseW =
          (1.5 + Math.pow(t, 1.05) * 8.5) * widthNoise * (t > 0.88 ? 1.0 + (t - 0.88) * 3.2 : 1.0);
        const w = baseW * sourceFade;
        if (w <= 0.15 || alpha <= 0.02) continue;

        // Soft feathered riverbed shadow offset to upper-left (no hard outline)
        ctx.strokeStyle = `rgba(18, 28, 20, ${0.24 * alpha})`;
        ctx.lineWidth = w + 2.0;
        ctx.beginPath();
        ctx.moveTo(a.x - 0.8, a.y - 0.8 * yScale);
        ctx.lineTo(b.x - 0.8, b.y - 0.8 * yScale);
        ctx.stroke();

        // Translucent sky-reflecting water (#2a5868 -> #3d7585)
        const cr = Math.round(42 + t * 19);
        const cg = Math.round(88 + t * 29);
        const cb = Math.round(104 + t * 29);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.86 * alpha})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Faint longitudinal sunlit shimmer (parallel to flow, no cross-wise stripes)
        const shimmerAlpha = (0.14 + 0.06 * Math.sin(timeSec * 1.4 - t * 6.0)) * alpha;
        ctx.strokeStyle = `rgba(186, 224, 234, ${shimmerAlpha})`;
        ctx.lineWidth = Math.max(0.5, w * 0.22);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Seamless carved shoreline inlet & sandy delta bar at the river mouth
      const mouth = rPts[rPts.length - 1];
      const prevM = rPts[Math.max(0, rPts.length - 2)];
      const mAngle = Math.atan2(mouth.y - prevM.y, mouth.x - prevM.x);

      // Sandy/silty delta bar flanking the estuary mouth
      const deltaGrad = ctx.createRadialGradient(mouth.x, mouth.y, 2, mouth.x, mouth.y, 20);
      deltaGrad.addColorStop(0, 'rgba(174, 156, 114, 0.32)');
      deltaGrad.addColorStop(0.55, 'rgba(63, 125, 141, 0.34)');
      deltaGrad.addColorStop(1, 'rgba(63, 125, 141, 0)');
      ctx.fillStyle = deltaGrad;
      ctx.beginPath();
      ctx.ellipse(mouth.x, mouth.y, 20, 12 * yScale, mAngle, 0, Math.PI * 2);
      ctx.fill();

      // Eroded dark-water notch cutting into the shoreline
      ctx.fillStyle = 'rgba(34, 92, 108, 0.45)';
      ctx.beginPath();
      ctx.ellipse(
        mouth.x - Math.cos(mAngle) * 4,
        mouth.y - Math.sin(mAngle) * 4 * yScale,
        7,
        4.5 * yScale,
        mAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }

  // 2c. Ambient Surface Ripples & Silver Glints over Fish & Whale tiles
  for (const item of visibleList) {
    if (!item.explored || item.tile.biome !== 'coast') continue;
    const rp = item.tile.resourceProp;
    if (rp !== 'fish' && rp !== 'whales') continue;
    const { tile, px, py } = item;
    const phase = hash2D(tile.q, tile.r, 551);
    const tOrb = timeSec * 0.65 + phase * Math.PI * 2;
    const ox = Math.sin(tOrb) * 6.5;
    const oy = Math.sin(tOrb * 2) * 3.2 * yScale;

    ctx.save();
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const cycle = ((timeSec * 0.34 + phase + rIdx * 0.5) % 1);
      const radius = 5 + cycle * (rp === 'whales' ? 20 : 14);
      const alpha = (1 - cycle) * 0.34;
      ctx.strokeStyle = `rgba(220, 246, 255, ${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(px + ox, py + oy, radius, radius * 0.55 * yScale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Occasional tiny silver water glint
    const glint = Math.max(0, Math.sin(timeSec * 2.4 + phase * 19) - 0.72) * 3.5;
    if (glint > 0.05) {
      ctx.fillStyle = `rgba(245, 252, 255, ${Math.min(0.65, glint)})`;
      ctx.beginPath();
      ctx.arc(px + ox + 3, py + oy - 2, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Mask unexplored tiles cleanly with warm antique cartographic parchment
  ctx.save();
  ctx.fillStyle = '#cdb88e';
  for (const item of visibleList) {
    if (item.explored) continue;
    const pts = getHexCorners(item.px, item.py, HEX_SIZE + 2.2, yScale);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * PASS 5: Over-Canopy Hex Grid
 * Renders a subtle 10% dark-earth grid on open terrain and a 14% soft-light/screen-blended
 * grid pass over forest/jungle canopies so tile boundaries remain readable everywhere,
 * while keeping ocean/coastal water completely free of polygon grid lines.
 */
export function renderOverCanopyHexGrid(
  ctx: CanvasRenderingContext2D,
  visibleList: VisibleTileItem[],
  hexSize: number,
  yScale: number
) {
  ctx.save();
  // Open land grid (10% subtle dark earth)
  ctx.strokeStyle = 'rgba(18, 22, 16, 0.10)';
  ctx.lineWidth = 0.7;
  for (const item of visibleList) {
    if (!item.explored) continue;
    const { tile, px, py } = item;
    if (tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'forest') continue;
    const pts = getHexCorners(px, py, hexSize, yScale);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  // Over-canopy soft-light/screen grid (14% subtle parchment-white over dense woods/jungles)
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(235, 226, 196, 0.14)';
  ctx.lineWidth = 0.85;
  for (const item of visibleList) {
    if (!item.explored) continue;
    const { tile, px, py } = item;
    if (tile.biome !== 'forest') continue;
    const pts = getHexCorners(px, py, hexSize, yScale);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGroundedShadowAndBaseTint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  yScale: number,
  _tile: HexTile
) {
  ctx.save();
  const shad = ctx.createRadialGradient(
    cx + radiusX * 0.16,
    cy + 2.5 * yScale,
    radiusX * 0.10,
    cx + radiusX * 0.16,
    cy + 2.5 * yScale,
    radiusX * 0.78
  );
  shad.addColorStop(0, 'rgba(12, 16, 20, 0.30)');
  shad.addColorStop(0.6, 'rgba(12, 16, 20, 0.10)');
  shad.addColorStop(1, 'rgba(12, 16, 20, 0)');
  ctx.fillStyle = shad;
  ctx.beginPath();
  ctx.ellipse(
    cx + radiusX * 0.16,
    cy + 2.5 * yScale,
    radiusX * 0.78,
    radiusX * 0.36 * yScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

interface JitterOpts {
  flipX?: boolean;
  scaleMult?: number;
  scaleYMult?: number;
  rotationRad?: number;
  offsetX?: number;
  offsetY?: number;
  isEmergentWater?: boolean;
  hslFilter?: string;
}

const GROUND_PALETTE_MID: Record<GroundTextureKey, [number, number, number]> = {
  deep_ocean: [19, 42, 68],
  shallow_coast: [40, 96, 112],
  lake: [34, 86, 110],
  desert: [182, 148, 100],
  arid_steppe: [148, 130, 88],
  savanna: [130, 132, 72],
  plains: [110, 124, 70],
  grassland: [80, 108, 56],
  tundra: [108, 114, 104],
  snow: [196, 208, 220],
  marsh: [62, 86, 56],
};

const baseHarmonizedCache = new Map<string, OffscreenCanvas | HTMLCanvasElement>();

function getBaseHarmonizedSpriteCanvas(
  sprite: ComfySpriteEntry,
  tile: HexTile
): OffscreenCanvas | HTMLCanvasElement | null {
  if (!sprite.image || !sprite.loaded) return null;
  const gKey = resolveGroundTextureKey(tile);
  const cacheKey = `${sprite.id}|${gKey}`;
  const cached = baseHarmonizedCache.get(cacheKey);
  if (cached) return cached;

  const w = sprite.image.naturalWidth || sprite.width;
  const h = sprite.image.naturalHeight || sprite.height;
  if (w <= 0 || h <= 0) return null;

  const [r, g, b] = GROUND_PALETTE_MID[gKey] ?? [110, 124, 70];
  const c = createScratchCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  ctx.drawImage(sprite.image, 0, 0, w, h);

  // Vertical multiply/tint gradient across the base of the sprite
  // so its ground blends seamlessly into the exact olive, tan, or ochre terrain beneath it
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const startY = sprite.hexTile ? h * 0.28 : h * 0.78;
  const grad = ctx.createLinearGradient(0, startY, 0, h);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
  grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${sprite.hexTile ? 0.24 : 0.24})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${sprite.hexTile ? 0.46 : 0.48})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, startY, w, h - startY);
  ctx.restore();

  // For full 6-sided hex tiles, softly feather the outer ground perimeter
  // so adjacent hexes connect seamlessly without a hard coaster rim or corner triangles
  if (sprite.hexTile) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const edgeGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.52,
      Math.min(w, h) * 0.34,
      w * 0.5,
      h * 0.52,
      Math.max(w, h) * 0.52
    );
    edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(0.74, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.90)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, h * 0.28, w, h * 0.72);
    ctx.restore();
  }

  baseHarmonizedCache.set(cacheKey, c);
  return c;
}

function drawEmergentWaterlineFoam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  yScale: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(242, 250, 255, 0.86)';
  ctx.lineWidth = 1.9;
  ctx.setLineDash([8, 4, 5, 3]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * yScale, radiusX * 0.92, radiusX * 0.42 * yScale, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(216, 240, 250, 0.44)';
  ctx.lineWidth = 3.2;
  ctx.setLineDash([12, 7]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2.5 * yScale, radiusX * 1.04, radiusX * 0.48 * yScale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function makeComfySpriteDrawable(
  sprite: ComfySpriteEntry,
  cx: number,
  cy: number,
  drawW: number,
  yScale: number,
  sortY: number,
  tile: HexTile,
  jitter: JitterOpts = {}
): YSortedDrawable {
  const isHexTile = Boolean(sprite.hexTile);
  const sMult = isHexTile ? 1.0 : (jitter.scaleMult ?? 1.0);
  const finalW = isHexTile
    ? HEX_SIZE * (sprite.footprint === '7-hex' ? 5.21 : sprite.footprint === '3x1' ? 5.21 : sprite.footprint === '2x1' ? 3.47 : 1.74)
    : drawW * sMult;
  const drawH = finalW * (sprite.height / Math.max(1, sprite.width)) * (yScale === 1 ? 0.86 : 1.0);
  const fx = isHexTile ? cx : cx + (jitter.offsetX ?? 0);
  const fy = isHexTile ? cy : cy + (jitter.offsetY ?? 0);
  const drawY = fy - drawH * sprite.anchorY + (isHexTile ? 0 : 2 * yScale);

  return {
    sortY,
    draw: (ctx) => {
      if (!sprite.image || !sprite.loaded) return;
      if (jitter.isEmergentWater) {
        drawEmergentWaterlineFoam(ctx, fx, fy, finalW * 0.36, yScale);
      } else if (!isHexTile) {
        drawGroundedShadowAndBaseTint(ctx, fx, fy + 2 * yScale, finalW * 0.36, yScale, tile);
      }
      const imgSource = jitter.isEmergentWater
        ? sprite.image
        : (getBaseHarmonizedSpriteCanvas(sprite, tile) ?? sprite.image);
      ctx.save();
      if (jitter.hslFilter) {
        ctx.filter = jitter.hslFilter;
      }
      ctx.translate(fx, fy);
      if (jitter.rotationRad) {
        ctx.rotate(jitter.rotationRad);
      }
      if (jitter.flipX || (jitter.scaleYMult && jitter.scaleYMult !== 1)) {
        ctx.scale(jitter.flipX ? -1 : 1, jitter.scaleYMult ?? 1);
      }
      ctx.drawImage(
        imgSource,
        -finalW * sprite.anchorX,
        drawY - fy,
        finalW,
        drawH
      );
      ctx.restore();
    },
  };
}

function makeProceduralFallbackDrawable(
  sprite: ProceduralSprite,
  cx: number,
  cy: number,
  drawW: number,
  yScale: number,
  sortY: number
): YSortedDrawable {
  const scale = drawW / sprite.width;
  const drawH = sprite.height * scale * (yScale === 1 ? 0.85 : 1.0);
  const drawX = cx - drawW * 0.5;
  const drawY = cy - drawH * sprite.anchorY + 6 * yScale;

  return {
    sortY,
    draw: (ctx) => {
      ctx.drawImage(sprite.canvas, drawX, drawY, drawW, drawH);
    },
  };
}

export function drawComfyCityOrCampSprite(
  ctx: CanvasRenderingContext2D,
  category: 'city_settlement' | 'barbarian_camp',
  seed: number,
  cx: number,
  cy: number,
  hexSize: number,
  yScale: number,
  tile: HexTile
): boolean {
  const sp = comfyPropAtlas.getSprite(category, seed, '1x1');
  if (!sp || !sp.image || !sp.loaded) return false;
  const isHexTile = Boolean(sp.hexTile);
  const drawW = isHexTile ? hexSize * 1.74 : hexSize * (category === 'city_settlement' ? 1.56 : 1.38);
  const drawH = drawW * (sp.height / Math.max(1, sp.width)) * (yScale === 1 ? 0.86 : 1.0);
  const drawX = cx - drawW * sp.anchorX;
  const drawY = cy - drawH * sp.anchorY + (isHexTile ? 0 : 2 * yScale);
  if (!isHexTile) {
    drawGroundedShadowAndBaseTint(ctx, cx, cy + 2 * yScale, drawW * 0.36, yScale, tile);
  }
  ctx.drawImage(sp.image, drawX, drawY, drawW, drawH);
  return true;
}

/**
 * 3-Hex Radius Variant Exclusion Selector:
 * Forbids picking the same sprite ID within a 3-hex radius when multiple variants exist.
 */
function pickNonRepeatingSprite(
  candidateIds: string[],
  tile: HexTile,
  assignedIds: Map<string, string>,
  seed: number,
  exclusionRadius = 3
): ComfySpriteEntry | null {
  const nearbyUsed = new Set<string>();
  for (const coord of hexInRange(tile.q, tile.r, exclusionRadius)) {
    if (coord.q === tile.q && coord.r === tile.r) continue;
    const used = assignedIds.get(tileKey(coord.q, coord.r));
    if (used) nearbyUsed.add(used);
  }
  const freshIds = candidateIds.filter((id) => !nearbyUsed.has(id));
  const pool = freshIds.length > 0 ? freshIds : candidateIds;
  const chosen = comfyPropAtlas.getSpriteFromIds(pool, seed);
  if (chosen) {
    assignedIds.set(tileKey(tile.q, tile.r), chosen.id);
  }
  return chosen;
}

function getBiomeMountainIds(tile: HexTile): string[] {
  if (tile.temperature === 'arctic') {
    return ['mountain_arctic_01', 'mountain_arctic_02', 'mountain_peak_03'];
  }
  if (tile.temperature === 'arid') {
    return ['mountain_arid_01', 'mountain_arid_02', 'mountain_range_wide_03'];
  }
  if (tile.temperature === 'tropical') {
    return ['mountain_peak_02', 'mountain_temperate_03', 'mountain_temperate_02'];
  }
  return [
    'mountain_temperate_01',
    'mountain_temperate_02',
    'mountain_temperate_03',
    'mountain_peak_01',
  ];
}

function countMatchingBiomeNeighbors(state: GameState, tile: HexTile): number {
  let count = 0;
  for (const n of hexNeighbors(tile.q, tile.r)) {
    const nt = state.tiles[tileKey(n.q, n.r)];
    if (nt && nt.biome === tile.biome) count++;
  }
  return count;
}

function getBiomeForestIds(tile: HexTile, isPerimeter = false): string[] {
  if (tile.temperature === 'tropical' || tile.forestSpecies === 'tropical') {
    return isPerimeter
      ? ['jungle_edge_tropical_01', 'jungle_edge_tropical_02', 'jungle_tropical_clean_03']
      : ['jungle_tropical_clean_01', 'jungle_tropical_clean_02', 'jungle_tropical_clean_03'];
  }
  if (
    tile.temperature === 'arctic' ||
    tile.terrainSubType === 'boreal_taiga' ||
    tile.forestSpecies === 'conifer'
  ) {
    return isPerimeter
      ? ['forest_edge_arctic_01', 'forest_edge_arctic_02', 'forest_arctic_clean_03']
      : ['forest_arctic_clean_01', 'forest_arctic_clean_02', 'forest_arctic_clean_03'];
  }
  return isPerimeter
    ? ['forest_edge_temperate_01', 'forest_edge_temperate_02', 'forest_temperate_clean_03']
    : [
        'forest_temperate_clean_01',
        'forest_temperate_clean_02',
        'forest_temperate_clean_03',
        'forest_temperate_clean_04',
      ];
}

function pickDeterministicSpriteId(
  candidateIds: string[],
  tile: HexTile,
  assignedIds: Map<string, string>,
  seed: number,
  exclusionRadius = 3
): string {
  const nearbyUsed = new Set<string>();
  for (const coord of hexInRange(tile.q, tile.r, exclusionRadius)) {
    if (coord.q === tile.q && coord.r === tile.r) continue;
    const used = assignedIds.get(tileKey(coord.q, coord.r));
    if (used) nearbyUsed.add(used);
  }
  const freshIds = candidateIds.filter((id) => !nearbyUsed.has(id));
  const pool = freshIds.length > 0 ? freshIds : candidateIds;
  const chosen = pool[Math.abs(seed) % pool.length];
  assignedIds.set(tileKey(tile.q, tile.r), chosen);
  return chosen;
}

function hasGreenNeighborTiles(tiles: Record<string, HexTile>, tile: HexTile): boolean {
  for (const n of hexNeighbors(tile.q, tile.r)) {
    const nt = tiles[tileKey(n.q, n.r)];
    if (!nt) continue;
    if (
      nt.biome === 'forest' ||
      nt.terrainSubType === 'marsh' ||
      nt.terrainSubType === 'grassland' ||
      (nt.biome === 'plains' && nt.terrainSubType !== 'arid_steppe' && nt.terrainSubType !== 'savanna')
    ) {
      return true;
    }
  }
  return false;
}

function countMatchingNeighborsTiles(tiles: Record<string, HexTile>, tile: HexTile): number {
  let count = 0;
  for (const n of hexNeighbors(tile.q, tile.r)) {
    const nt = tiles[tileKey(n.q, n.r)];
    if (nt && nt.biome === tile.biome) count++;
  }
  return count;
}

/**
 * PHASE 1 & 2:
 * Computes all 7-hex, 3x1, 2x1, 1x1, and shared-edge bridging prop placements ONCE
 * at map generation so multi-hex formations never pop or revert to 1x1 during camera pan.
 */
export function buildWorldRenderProps(
  tiles: Record<string, HexTile>,
  _width: number,
  height: number
): WorldRenderProp[] {
  const out: WorldRenderProp[] = [];
  const allTiles = Object.values(tiles);
  const spannedTiles = new Set<string>();
  const assignedIds = new Map<string, string>();
  const bridgedPairs = new Set<string>();
  const megaCenters: Array<{ q: number; r: number }> = [];
  let propIdx = 0;

  // Pass A0: Immutable 7-Hex ("Flower Cluster") Multi-Tile Landscape Formations
  for (const tile of allTiles) {
    const tk = tileKey(tile.q, tile.r);
    if (spannedTiles.has(tk)) continue;
    if (tile.feature !== 'none' || tile.resourceProp) continue;
    if (
      tile.biome !== 'mountain' &&
      tile.biome !== 'forest' &&
      tile.biome !== 'hills' &&
      tile.biome !== 'desert'
    ) {
      continue;
    }
    if (megaCenters.some((mc) => hexDistance(mc.q, mc.r, tile.q, tile.r) < 5)) continue;

    const ringTiles: HexTile[] = [];
    let allMatch = true;
    for (const n of hexNeighbors(tile.q, tile.r)) {
      const nk = tileKey(n.q, n.r);
      const nt = tiles[nk];
      if (
        !nt ||
        nt.biome !== tile.biome ||
        spannedTiles.has(nk) ||
        nt.feature !== 'none' ||
        nt.resourceProp
      ) {
        allMatch = false;
        break;
      }
      ringTiles.push(nt);
    }
    if (!allMatch || ringTiles.length < 6) continue;

    const variant = Math.abs(tile.q * 73856093 ^ tile.r * 19349663);
    let megaPool: string[] = [];
    if (tile.biome === 'mountain') {
      megaPool =
        tile.temperature === 'arctic'
          ? ['mega_mountain_massif_arctic_01', 'mega_mountain_massif_arctic_02']
          : tile.temperature === 'arid'
            ? ['mega_mountain_massif_arid_01', 'mega_mountain_massif_arid_02']
            : ['mega_mountain_massif_temperate_01', 'mega_mountain_massif_temperate_02'];
    } else if (tile.biome === 'forest') {
      megaPool =
        tile.temperature === 'tropical' || tile.forestSpecies === 'tropical'
          ? ['mega_woodland_canopy_tropical_01', 'mega_woodland_canopy_tropical_02']
          : tile.temperature === 'arctic' ||
              tile.terrainSubType === 'boreal_taiga' ||
              tile.forestSpecies === 'conifer'
            ? ['mega_pine_7hex_01', 'mega_pine_7hex_02', 'mega_woodland_canopy_arctic_01']
            : ['mega_broadleaf_7hex_01', 'mega_broadleaf_7hex_02', 'mega_woodland_canopy_temperate_01'];
    } else if (tile.biome === 'hills') {
      megaPool =
        tile.temperature === 'arctic'
          ? ['mega_highland_arctic_01']
          : tile.temperature === 'arid'
            ? [] // Keep red sandstone strictly in desert; arid hills use rocky outcrops
            : ['mega_highland_crags_01', 'mega_highland_crags_02'];
    } else if (tile.biome === 'desert' && !hasGreenNeighborTiles(tiles, tile)) {
      megaPool = ['mega_dune_sea_01', 'mega_dune_sea_02'];
    }

    if (megaPool.length === 0) continue;
    const megaId = megaPool[variant % megaPool.length];
    const coveredKeys = [tk, ...ringTiles.map((rt) => tileKey(rt.q, rt.r))];
    const hueShift = Math.round((hash2D(tile.q, tile.r, 811) - 0.5) * 12);
    const brightPct = Math.round(93 + hash2D(tile.q, tile.r, 823) * 14);

    out.push({
      id: `prop_${propIdx++}`,
      spriteId: megaId,
      footprint: '7-hex',
      q: tile.q,
      r: tile.r,
      coveredKeys,
      offsetX: 0,
      offsetY: 0,
      drawWFactor: 3.05,
      flipX: false,
      scaleMult: 0.95 + hash2D(tile.q, tile.r, 829) * 0.10,
      hslFilter: `hue-rotate(${hueShift}deg) brightness(${brightPct}%)`,
      isForest: tile.biome === 'forest',
    });

    megaCenters.push({ q: tile.q, r: tile.r });
    for (const ck of coveredKeys) spannedTiles.add(ck);

    // Composite 2-3 independent 1x1 secondary props onto outer ring hexes
    const secIds =
      tile.biome === 'forest'
        ? getBiomeForestIds(tile, true)
        : ['ridge_outcrop_01', 'ridge_outcrop_03', 'ridge_outcrop_05'];
    const secCount = 2 + (variant % 2);
    for (let sIdx = 0; sIdx < secCount; sIdx++) {
      const rt = ringTiles[(variant + sIdx * 2) % ringTiles.length];
      const rk = tileKey(rt.q, rt.r);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: secIds[(variant + sIdx) % secIds.length],
        footprint: '1x1',
        q: rt.q,
        r: rt.r,
        coveredKeys: [rk],
        offsetX: (hash2D(rt.q, rt.r, 701 + sIdx) - 0.5) * 8,
        offsetY: (hash2D(rt.q, rt.r, 709 + sIdx) - 0.5) * 6,
        drawWFactor: 0.62,
        flipX: false,
        isForest: tile.biome === 'forest',
      });
    }
  }

  // Pass A: Multi-Hex 3x1 & 2x1 Landmark Spanning
  for (const tile of allTiles) {
    const tk = tileKey(tile.q, tile.r);
    if (spannedTiles.has(tk)) continue;
    if (tile.feature !== 'none' || tile.resourceProp) continue;
    if (
      tile.biome !== 'mountain' &&
      tile.biome !== 'desert' &&
      tile.biome !== 'forest' &&
      tile.biome !== 'hills'
    ) {
      continue;
    }

    const eastKey = tileKey(tile.q + 1, tile.r);
    const eastTile = tiles[eastKey];
    if (
      !eastTile ||
      eastTile.biome !== tile.biome ||
      eastTile.temperature !== tile.temperature ||
      spannedTiles.has(eastKey) ||
      eastTile.feature !== 'none' ||
      eastTile.resourceProp
    ) {
      continue;
    }

    const variant = Math.abs(tile.q * 73856093 ^ tile.r * 19349663);
    if (variant % 10 > 4) continue;

    if (tile.biome === 'mountain' || tile.biome === 'forest') {
      const east2Key = tileKey(tile.q + 2, tile.r);
      const east2Tile = tiles[east2Key];
      if (
        east2Tile &&
        east2Tile.biome === tile.biome &&
        !spannedTiles.has(east2Key) &&
        east2Tile.feature === 'none' &&
        !east2Tile.resourceProp
      ) {
        const sp3Id =
          tile.biome === 'mountain'
            ? tile.temperature === 'arid'
              ? 'mountain_range_3x1_02'
              : 'mountain_range_3x1_01'
            : tile.forestSpecies === 'conifer' || tile.temperature === 'arctic'
              ? variant % 2 === 0
                ? 'pine_range_3x1_01'
                : 'pine_range_3x1_02'
              : variant % 2 === 0
                ? 'broadleaf_range_3x1_01'
                : 'broadleaf_range_3x1_02';
        out.push({
          id: `prop_${propIdx++}`,
          spriteId: sp3Id,
          footprint: '3x1',
          q: eastTile.q,
          r: eastTile.r,
          coveredKeys: [tk, eastKey, east2Key],
          offsetX: 0,
          offsetY: 0,
          drawWFactor: 2.54,
          flipX: false,
          isForest: tile.biome === 'forest',
        });
        spannedTiles.add(tk);
        spannedTiles.add(eastKey);
        spannedTiles.add(east2Key);
        continue;
      }
    }

    let sp2Id: string | null = null;
    if (tile.biome === 'mountain') {
      const mIds =
        tile.temperature === 'arid'
          ? ['mountain_range_wide_03']
          : tile.temperature === 'arctic'
            ? ['mountain_range_wide_04', 'mountain_range_wide_01']
            : ['mountain_range_wide_05', 'mountain_range_wide_02', 'mountain_range_wide_01'];
      sp2Id = mIds[variant % mIds.length];
    } else if (tile.biome === 'desert') {
      if (!hasGreenNeighborTiles(tiles, tile) && !hasGreenNeighborTiles(tiles, eastTile)) {
        sp2Id = variant % 3 === 0 ? 'canyon_arch_02' : 'desert_dunes_02';
      }
    } else if (tile.biome === 'forest') {
      if (
        tile.temperature === 'arctic' ||
        tile.terrainSubType === 'boreal_taiga' ||
        tile.forestSpecies === 'conifer'
      ) {
        sp2Id = 'forest_pine_04';
      } else if (tile.temperature === 'temperate') {
        sp2Id = 'forest_deciduous_04';
      }
    } else if (
      tile.biome === 'hills' &&
      variant % 10 <= 2 &&
      hexNeighbors(tile.q, tile.r).some((n) => tiles[tileKey(n.q, n.r)]?.biome === 'mountain')
    ) {
      sp2Id = variant % 3 === 0 ? 'granite_crag_02' : variant % 2 === 0 ? 'ridge_outcrop_wide_01' : 'ridge_outcrop_wide_02';
    }

    if (sp2Id) {
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: sp2Id,
        footprint: '2x1',
        q: tile.q + 0.5,
        r: tile.r,
        coveredKeys: [tk, eastKey],
        offsetX: 0,
        offsetY: 0,
        drawWFactor: 1.78,
        flipX: false,
        isForest: tile.biome === 'forest',
      });
      spannedTiles.add(tk);
      spannedTiles.add(eastKey);
      assignedIds.set(tk, sp2Id);
      assignedIds.set(eastKey, sp2Id);
    }
  }

  // Pass B: Single-Hex 2.5D Props with 3-Hex Variant Exclusion
  for (const tile of allTiles) {
    const tk = tileKey(tile.q, tile.r);
    const variant = Math.abs(tile.q * 73856093 ^ tile.r * 19349663);
    const flipX = hash2D(tile.q, tile.r, 111) > 0.5;
    const scaleMult = 0.88 + hash2D(tile.q, tile.r, 222) * 0.28;
    const offsetX = (hash2D(tile.q, tile.r, 333) - 0.5) * 6;
    const offsetY = (hash2D(tile.q, tile.r, 444) - 0.5) * 4;

    if (tile.feature === 'natural_wonder' && tile.wonderId) {
      const is2x1 =
        tile.wonderId === 'wonder_mount_celestial' ||
        tile.wonderId === 'wonder_sunken_emerald_canyon' ||
        tile.wonderId === 'wonder_great_sapphire_atoll' ||
        tile.wonderId === 'wonder_crimson_pillar_mesas' ||
        tile.wonderId === 'wonder_petrified_leviathan';
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: tile.wonderId,
        footprint: is2x1 ? '2x1' : '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX: 0,
        offsetY: 0,
        drawWFactor: is2x1 ? 1.82 : 1.15,
        isEmergentWater: tile.biome === 'coast',
      });
      continue;
    }

    if (tile.biome === 'coast') {
      // Note: 'fish' and 'whales' are rendered as multi-entity submerged marine life in Sub-Layer 4A!
      if (tile.resourceProp === 'fish' || tile.resourceProp === 'whales') continue;

      const lat = Math.abs(tile.r / Math.max(1, height - 1) - 0.5) * 2;
      if (variant % 5 === 0) {
        if (tile.shoreline === 'icy_shore' || lat >= 0.72) {
          const spId = pickDeterministicSpriteId(
            [
              'arctic_sea_ice_01',
              'arctic_sea_ice_02',
              'arctic_sea_ice_03',
              'arctic_sea_ice_04',
              'arctic_sea_ice_05',
              'arctic_sea_ice_06',
              'arctic_sea_stack_01',
            ],
            tile,
            assignedIds,
            variant,
            3
          );
          out.push({
            id: `prop_${propIdx++}`,
            spriteId: spId,
            footprint: '1x1',
            q: tile.q,
            r: tile.r,
            coveredKeys: [tk],
            offsetX,
            offsetY,
            drawWFactor: 0.82,
            flipX,
            scaleMult,
            isEmergentWater: true,
          });
        } else if (lat >= 0.38) {
          const spId = pickDeterministicSpriteId(
            ['coastal_rock_outcrops_01', 'coastal_rock_outcrops_02'],
            tile,
            assignedIds,
            variant,
            3
          );
          out.push({
            id: `prop_${propIdx++}`,
            spriteId: spId,
            footprint: '1x1',
            q: tile.q,
            r: tile.r,
            coveredKeys: [tk],
            offsetX,
            offsetY,
            drawWFactor: 0.78,
            flipX,
            scaleMult,
            isEmergentWater: true,
          });
        }
      }
      continue;
    }

    if (tile.biome === 'ocean') continue;

    if (tile.feature === 'ancient_ruins') {
      const rIds =
        tile.temperature === 'arid' || tile.biome === 'desert'
          ? ['ancient_ruins_03', 'ruin_obelisk_ring_01']
          : tile.temperature === 'arctic' || tile.biome === 'tundra'
            ? ['ancient_ruins_tundra_01', 'ruin_obelisk_ring_01']
            : [
                'ruin_temple_courtyard_01',
                'ruin_stone_aqueduct_01',
                'ruin_obelisk_ring_01',
                'ancient_ruins_01',
                'ancient_ruins_02',
                'anomaly_observatory_01',
              ];
      const spId = pickDeterministicSpriteId(rIds, tile, assignedIds, variant, 18);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: 0.92,
        flipX: false,
        scaleMult,
      });
      continue;
    } else if (tile.feature === 'iron' || tile.feature === 'coal' || tile.feature === 'copper') {
      const spId =
        tile.feature === 'iron'
          ? 'resource_iron_01'
          : tile.feature === 'coal'
            ? 'resource_coal_01'
            : 'resource_copper_01';
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: 0.86,
        flipX,
        scaleMult,
      });
      continue;
    } else if (tile.feature === 'fossils' || tile.feature === 'rare_flora' || tile.feature === 'geothermal_vent') {
      const spId = pickDeterministicSpriteId(
        tile.feature === 'fossils'
          ? ['anomaly_fossil_dig_01']
          : tile.feature === 'geothermal_vent'
            ? ['anomaly_ley_monolith_01']
            : ['anomaly_relic_shrine_01', 'anomaly_observatory_01'],
        tile,
        assignedIds,
        variant,
        18
      );
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: 0.90,
        flipX,
        scaleMult,
      });
      continue;
    } else if (tile.resourceProp) {
      // Phase 3: Multi-entity independent groundless herd placement for horses & cattle (NO square fenced pasture tile!)
      if (tile.resourceProp === 'horses' || tile.resourceProp === 'cattle') {
        const singleId = tile.resourceProp === 'horses' ? 'single_horse_01' : 'single_cattle_01';
        const herdCount = 3 + (variant % 2);
        const herdOffsets: Array<[number, number]> = [
          [-13, -5],
          [6, -8],
          [13, 3],
          [-3, 7],
        ];
        const basePhase = hash2D(tile.q, tile.r, 619) * Math.PI * 2;
        for (let hIdx = 0; hIdx < herdCount; hIdx++) {
          const [hx, hy] = herdOffsets[hIdx];
          const jx = (hash2D(tile.q + hIdx, tile.r, 711) - 0.5) * 4;
          const jy = (hash2D(tile.q, tile.r + hIdx, 719) - 0.5) * 3;
          out.push({
            id: `prop_${propIdx++}`,
            spriteId: singleId,
            footprint: '1x1',
            q: tile.q,
            r: tile.r,
            coveredKeys: [tk],
            offsetX: hx + jx,
            offsetY: hy + jy,
            drawWFactor: 0.34 + (hIdx % 2) * 0.04,
            flipX: (variant + hIdx) % 2 === 0,
            scaleMult: 1.0,
            animKind: 'herd',
            animPhase: basePhase + hIdx * 1.65,
          });
        }
        continue;
      }

      const propIdMap: Record<string, string[]> = {
        cave_entrance: ['cave_entrance_01'],
        gold: ['mineral_gold_01'],
        gems: ['mineral_gems_01'],
        stone: ['mineral_stone_01'],
        marble: ['resource_marble_01'],
        iron: ['resource_iron_01'],
        coal: ['resource_coal_01'],
        copper: ['resource_copper_01'],
        wheat: ['resource_wheat_01'],
        spices: ['resource_spices_01'],
        timber: ['resource_timber_01'],
        mystery_package: ['mystery_package_01', 'mystery_package_02', 'mystery_package_03'],
      };
      const pool = propIdMap[tile.resourceProp];
      if (pool) {
        const spId = pool[variant % pool.length];
        out.push({
          id: `prop_${propIdx++}`,
          spriteId: spId,
          footprint: '1x1',
          q: tile.q,
          r: tile.r,
          coveredKeys: [tk],
          offsetX,
          offsetY,
          drawWFactor: 0.86,
          flipX,
          scaleMult,
        });
        continue;
      }
    }

    if (spannedTiles.has(tk)) continue;

    if (tile.biome === 'mountain') {
      const spId = pickDeterministicSpriteId(getBiomeMountainIds(tile), tile, assignedIds, variant, 3);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: 1.12,
        flipX,
        scaleMult,
      });
    } else if (tile.biome === 'hills') {
      // Allow rocky crag sprites ONLY on HILLS tiles directly adjacent to MOUNTAIN ranges
      const bordersMtn = hexNeighbors(tile.q, tile.r).some(
        (n) => tiles[tileKey(n.q, n.r)]?.biome === 'mountain'
      );
      if (bordersMtn && variant % 20 < 7) {
        const spId = pickDeterministicSpriteId(
          [
            'granite_crag_01',
            'ridge_outcrop_01',
            'ridge_outcrop_02',
            'ridge_outcrop_03',
            'ridge_outcrop_04',
            'ridge_outcrop_05',
            'ridge_outcrop_06',
          ],
          tile,
          assignedIds,
          variant,
          3
        );
        out.push({
          id: `prop_${propIdx++}`,
          spriteId: spId,
          footprint: '1x1',
          q: tile.q,
          r: tile.r,
          coveredKeys: [tk],
          offsetX: (hash2D(tile.q, tile.r, 911) - 0.5) * 28,
          offsetY: (hash2D(tile.q, tile.r, 919) - 0.5) * 20,
          drawWFactor: 0.84,
          flipX: false,
          scaleMult,
        });
      }
    } else if (tile.biome === 'forest') {
      const isPerimeter = countMatchingNeighborsTiles(tiles, tile) <= 3;
      const fIds = getBiomeForestIds(tile, isPerimeter);
      const spId = pickDeterministicSpriteId(fIds, tile, assignedIds, variant, 3);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: isPerimeter ? 0.90 : tile.temperature === 'tropical' ? 1.04 : 0.98,
        flipX: false,
        scaleMult: 0.90 + hash2D(tile.q, tile.r, 222) * 0.22,
        isForest: true,
      });
    } else if (tile.biome === 'desert') {
      const isOasis = tile.clusterType === 'oasis' && tile.clusterRole === 'center';
      if (!isOasis && hasGreenNeighborTiles(tiles, tile)) continue;
      if (isOasis) {
        out.push({
          id: `prop_${propIdx++}`,
          spriteId: 'oasis_palm_01',
          footprint: '1x1',
          q: tile.q,
          r: tile.r,
          coveredKeys: [tk],
          offsetX,
          offsetY,
          drawWFactor: 0.92,
          flipX,
          scaleMult,
        });
        continue;
      }
      const isPerimeter = countMatchingNeighborsTiles(tiles, tile) <= 3;
      const dIds = isPerimeter
        ? ['scrub_dunes_01', 'scrub_dunes_02', 'rocky_desert_outcrops_01', 'canyon_arch_01']
        : ['desert_dunes_01', 'desert_dunes_02', 'rocky_desert_outcrops_01', 'canyon_arch_01'];
      const spId = pickDeterministicSpriteId(dIds, tile, assignedIds, variant, 3);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: spId,
        footprint: '1x1',
        q: tile.q,
        r: tile.r,
        coveredKeys: [tk],
        offsetX,
        offsetY,
        drawWFactor: isPerimeter ? 0.86 : 0.94,
        flipX: false,
        scaleMult,
      });
    } else if (tile.biome === 'plains') {
      if (tile.terrainSubType === 'marsh' || tile.shoreline === 'coastal_swamp') {
        out.push({
          id: `prop_${propIdx++}`,
          proceduralKind: 'marsh_reeds',
          proceduralTemp: tile.temperature,
          footprint: '1x1',
          q: tile.q,
          r: tile.r,
          coveredKeys: [tk],
          offsetX: 0,
          offsetY: 0,
          drawWFactor: 0.88,
        });
      } else if (tile.terrainSubType === 'savanna' || tile.temperature === 'arid') {
        out.push({
          id: `prop_${propIdx++}`,
          proceduralKind: 'savanna_acacia',
          proceduralTemp: 'arid',
          footprint: '1x1',
          q: tile.q,
          r: tile.r,
          coveredKeys: [tk],
          offsetX: 0,
          offsetY: 0,
          drawWFactor: 0.88,
        });
      } else if (variant % 5 === 0) {
        // Fix 3: Scatter small, natural groundless copses of 3-6 varied trees across ~20% of open plains/grasslands
        const copseCount = 3 + (variant % 4);
        const copseOffsets: Array<[number, number, number]> = [
          [-11, -6, 0.56],
          [4, -8, 0.68],
          [12, -2, 0.58],
          [-5, 3, 0.72],
          [7, 6, 0.62],
          [-1, -1, 0.64],
        ];
        for (let tIdx = 0; tIdx < copseCount; tIdx++) {
          const [tx, ty, tw] = copseOffsets[tIdx];
          const treeId =
            tile.temperature === 'tropical'
              ? 'single_tree_palm_01'
              : tile.temperature === 'arctic'
                ? 'single_tree_pine_01'
                : (variant + tIdx) % 3 === 0
                  ? 'single_tree_pine_01'
                  : 'single_tree_oak_01';
          out.push({
            id: `prop_${propIdx++}`,
            spriteId: treeId,
            footprint: '1x1',
            q: tile.q,
            r: tile.r,
            coveredKeys: [tk],
            offsetX: tx + (hash2D(tile.q + tIdx, tile.r, 853) - 0.5) * 4,
            offsetY: ty + (hash2D(tile.q, tile.r + tIdx, 859) - 0.5) * 3,
            drawWFactor: tw * 0.68,
            flipX: false,
            scaleMult: 1.0,
            isForest: true,
          });
        }
      }
    }
  }

  // Pass C: Shared-Edge Canopy & Ridge Bridging
  for (const tile of allTiles) {
    if (tile.biome !== 'forest' && tile.biome !== 'mountain') continue;
    const tk = tileKey(tile.q, tile.r);
    for (const n of hexNeighbors(tile.q, tile.r)) {
      const nk = tileKey(n.q, n.r);
      const nt = tiles[nk];
      if (!nt || nt.biome !== tile.biome) continue;
      const pairKey = tk < nk ? `${tk}|${nk}` : `${nk}|${tk}`;
      if (bridgedPairs.has(pairKey)) continue;
      bridgedPairs.add(pairKey);

      const bSeed = Math.abs(tile.q * 31 + tile.r * 17 + nt.q * 13);
      const ids = tile.biome === 'mountain' ? getBiomeMountainIds(tile) : getBiomeForestIds(tile);
      out.push({
        id: `prop_${propIdx++}`,
        spriteId: ids[bSeed % ids.length],
        footprint: '1x1',
        q: (tile.q + nt.q) * 0.5,
        r: (tile.r + nt.r) * 0.5,
        coveredKeys: [tk, nk],
        offsetX: 0,
        offsetY: 0,
        drawWFactor: tile.biome === 'mountain' ? 0.68 : 0.72,
        flipX: false,
        isForest: tile.biome === 'forest',
      });
    }
  }

  return out;
}

/**
 * PHASE 1 & 4:
 * Draws immutable pre-computed WorldRenderProps with an expanded 3.5 * hexSize frustum
 * culling margin (zero pop-in during pan), dynamic Forest Glade clearings, and
 * AmbientEntityAnimator for grazing herds and swimming whales.
 */
export function collectTerrainFeatureDrawables(
  state: GameState,
  visibleList: VisibleTileItem[],
  viewMode: MapViewMode,
  hexSize: number,
  yScale: number,
  cityTiles: Set<string>,
  occupiedTiles: Set<string> = cityTiles,
  timeSec = 0
): YSortedDrawable[] {
  comfyPropAtlas.ensureLoaded();
  proceduralAtlas.ensureInitialized();

  if (!state.renderProps) {
    state.renderProps = buildWorldRenderProps(state.tiles, state.width, state.height);
  }

  // Compute expanded frustum bounding box padded by 3.5 * hexRadius in every direction
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of visibleList) {
    if (item.px < minX) minX = item.px;
    if (item.px > maxX) maxX = item.px;
    if (item.py < minY) minY = item.py;
    if (item.py > maxY) maxY = item.py;
  }
  const pad = hexSize * 3.5;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const out: YSortedDrawable[] = [];
  const isIso = viewMode === 'isometric';
  const baseW = isIso ? hexSize * 1.32 : hexSize * 1.12;

  for (const prop of state.renderProps) {
    if (prop.coveredKeys.some((k) => cityTiles.has(k))) continue;
    const anyExplored = prop.coveredKeys.some((k) => state.tiles[k]?.exploredBy[state.playerCivId]);
    if (!anyExplored) continue;

    const pos = axialToPixel(prop.q, prop.r, viewMode);
    if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) continue;

    const hostTile = state.tiles[prop.coveredKeys[0]];
    if (!hostTile) continue;

    // Dynamic "Forest Glade" clearing around occupied forest hexes
    if (prop.isForest && prop.footprint === '1x1' && prop.coveredKeys.some((k) => occupiedTiles.has(k))) {
      const sp = prop.spriteId ? comfyPropAtlas.getSpriteFromIds([prop.spriteId], 0) : null;
      if (sp) {
        const ringAngles = [Math.PI * 0.18, Math.PI * 0.82, Math.PI * 1.5];
        for (let rIdx = 0; rIdx < ringAngles.length; rIdx++) {
          const ang = ringAngles[rIdx];
          const gx = pos.x + Math.cos(ang) * hexSize * 0.52;
          const gy = pos.y + Math.sin(ang) * hexSize * 0.50 * yScale;
          out.push(
            makeComfySpriteDrawable(sp, gx, gy, baseW * 0.52, yScale, gy, hostTile, {
              flipX: rIdx % 2 === 0,
            })
          );
        }
      }
      continue;
    }

    if (prop.proceduralKind) {
      const variant = Math.abs(Math.round(prop.q) * 73856093 ^ Math.round(prop.r) * 19349663);
      const proc = proceduralAtlas.getFeatureSprite(
        prop.proceduralKind as FeatureSpriteKind,
        variant,
        prop.proceduralTemp ?? hostTile.temperature
      );
      if (proc) {
        out.push(makeProceduralFallbackDrawable(proc, pos.x, pos.y, baseW * prop.drawWFactor, yScale, pos.y));
      }
      continue;
    }

    if (!prop.spriteId) continue;
    const sp = comfyPropAtlas.getSpriteFromIds([prop.spriteId], 0);
    if (!sp) continue;

    // AmbientEntityAnimator: subtle real-time idle animations for herds & whales
    let animDx = 0;
    let animDy = 0;
    let animScaleY = 1;
    let animRot = 0;
    const phase = prop.animPhase ?? 0;

    if (prop.animKind === 'herd') {
      animScaleY = 1 + Math.sin(timeSec * 1.8 + phase) * 0.025;
      animRot = Math.sin(timeSec * 0.9 + phase * 1.7) * 0.032; // ~±1.8 deg grazing dip
      animDx = Math.sin(timeSec * 0.45 + phase) * 2.2;
      animDy = Math.cos(timeSec * 0.38 + phase) * 1.2 * yScale;
    } else if (prop.animKind === 'whale') {
      const tOrb = timeSec * 0.55 + phase;
      animDx = Math.sin(tOrb) * 6.5;
      animDy = Math.sin(tOrb * 2) * 3.0 * yScale;
      animRot = Math.cos(tOrb) * 0.06;
    } else if (prop.isForest && prop.footprint !== '7-hex') {
      // Synchronized gentle wind-sway across neighboring trees
      animRot = Math.sin(timeSec * 1.15 + pos.x * 0.015 + pos.y * 0.01) * 0.014;
    }

    // Strict top-to-bottom (worldY) painter's sort key
    const worldSortY = pos.y + prop.offsetY * yScale + (prop.footprint === '7-hex' ? 4 * yScale : 0);

    out.push(
      makeComfySpriteDrawable(
        sp,
        pos.x,
        pos.y,
        baseW * prop.drawWFactor,
        yScale,
        worldSortY,
        hostTile,
        {
          flipX: prop.flipX,
          scaleMult: prop.scaleMult,
          scaleYMult: animScaleY,
          rotationRad: animRot,
          offsetX: prop.offsetX + animDx,
          offsetY: prop.offsetY * yScale + animDy,
          hslFilter: prop.hslFilter,
          isEmergentWater: prop.isEmergentWater,
        }
      )
    );
  }

  return out;
}

/**
 * PHASE 4:
 * Post-Processing Atmospheric Lighting & Cartographic Fog of War.
 */
export function renderCartographicFog(
  ctx: CanvasRenderingContext2D,
  unexploredEdgeTiles: Array<{ tile: HexTile; px: number; py: number }>,
  hexSize: number,
  zoom: number
) {
  if (unexploredEdgeTiles.length === 0 || zoom <= 0.45) return;
  ctx.save();
  ctx.filter = 'blur(12px)';
  for (const item of unexploredEdgeTiles) {
    ctx.fillStyle = 'rgba(205, 184, 142, 0.90)';
    ctx.beginPath();
    ctx.arc(item.px, item.py, hexSize * 0.96, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  ctx.restore();
}

export function renderAtmosphericPostProcess(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();
  const lightGrad = ctx.createLinearGradient(0, 0, width, height);
  lightGrad.addColorStop(0, 'rgba(255, 244, 214, 0.06)');
  lightGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  lightGrad.addColorStop(1, 'rgba(16, 28, 48, 0.12)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, width, height);

  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.40,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.74
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(22, 16, 10, 0.20)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
