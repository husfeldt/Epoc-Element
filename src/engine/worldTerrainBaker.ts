import { HEX_SIZE, HEX_SQRT3, MapViewMode, axialRound, axialToPixel, getViewYScale, tileKey } from './hexMath';
import { fbm2D, hash2D, ridgedNoise2D, worley2D } from './noise';
import { GroundTextureKey, resolveGroundTextureKey } from './proceduralAtlas';
import { resolveTileShoreline } from './spriteAtlas';
import { GameState, HexTile, ShorelineType } from '../types/game';

export const HEX_EDGE_OFFSETS: Array<[number, number]> = [
  [1, 0],   // 0: E
  [0, 1],   // 1: SE
  [-1, 1],  // 2: SW
  [-1, 0],  // 3: W
  [0, -1],  // 4: NW
  [1, -1],  // 5: NE
];

export interface CoastPolyline {
  points: Array<{ x: number; y: number }>;
  closed: boolean;
  shoreType: ShorelineType;
}

export interface BakedWorldTerrain {
  canvas: HTMLCanvasElement;
  waterColumnCanvas: HTMLCanvasElement;
  minX: number;
  minY: number;
  worldW: number;
  worldH: number;
  scale: number;
  gameId: string;
  viewMode: MapViewMode;
  coastPolylines: CoastPolyline[];
  lakePolylines: Array<Array<{ x: number; y: number }>>;
  riverPolylines: Array<Array<{ x: number; y: number }>>;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function mixRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    c1[0] + (c2[0] - c1[0]) * k,
    c1[1] + (c2[1] - c1[1]) * k,
    c1[2] + (c2[2] - c1[2]) * k,
  ];
}

const EARTH_PALETTES: Record<
  GroundTextureKey,
  { dark: [number, number, number]; mid: [number, number, number]; lit: [number, number, number] }
> = {
  deep_ocean: {
    dark: [14, 30, 50],
    mid: [19, 42, 68],
    lit: [26, 56, 86],
  },
  shallow_coast: {
    dark: [26, 70, 88],
    mid: [40, 96, 112],
    lit: [68, 128, 130],
  },
  lake: {
    dark: [24, 64, 86],
    mid: [34, 86, 110],
    lit: [54, 112, 134],
  },
  desert: {
    dark: [146, 116, 76],
    mid: [182, 148, 100],
    lit: [208, 176, 124],
  },
  arid_steppe: {
    dark: [122, 106, 72],
    mid: [148, 130, 88],
    lit: [172, 152, 106],
  },
  savanna: {
    dark: [102, 106, 58],
    mid: [130, 132, 72],
    lit: [158, 152, 88],
  },
  plains: {
    dark: [84, 100, 56],
    mid: [110, 124, 70],
    lit: [138, 144, 86],
  },
  grassland: {
    dark: [62, 86, 46],
    mid: [80, 108, 56],
    lit: [104, 130, 70],
  },
  tundra: {
    dark: [84, 92, 86],
    mid: [108, 114, 104],
    lit: [132, 136, 124],
  },
  snow: {
    dark: [164, 180, 196],
    mid: [196, 208, 220],
    lit: [222, 230, 238],
  },
  marsh: {
    dark: [46, 68, 48],
    mid: [62, 86, 56],
    lit: [78, 104, 66],
  },
};

function getTileBaseReliefHeight(tile: HexTile): number {
  if (tile.biome === 'ocean') return -0.68;
  if (tile.biome === 'coast') return tile.isLake ? -0.25 : -0.22;
  if (tile.biome === 'mountain') return 0.94;
  if (tile.biome === 'hills') return tile.terrainSubType === 'foothills' ? 0.58 : 0.78;
  return 0.16 + (tile.elevation ?? 0.4) * 0.12;
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

/**
 * Traces all Land <-> Water edges into continuous polylines and applies
 * 3 iterations of Chaikin corner-cutting smoothing for organic bays & peninsulas.
 */
function buildSmoothedCoastlines(
  state: GameState,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
): CoastPolyline[] {
  interface Seg {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    shore: ShorelineType;
    used: boolean;
  }

  const segs: Seg[] = [];
  const ptKey = (x: number, y: number) => `${Math.round(x * 4)},${Math.round(y * 4)}`;
  const startMap = new Map<string, number[]>();

  for (const tile of allTiles) {
    if (tile.biome === 'ocean' || tile.biome === 'coast') continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const pts = getHexCorners(px, py, HEX_SIZE, yScale);

    for (let e = 0; e < 6; e++) {
      const [dq, dr] = HEX_EDGE_OFFSETS[e];
      const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
      if (!nt || (nt.biome !== 'ocean' && nt.biome !== 'coast')) continue;

      const pA = pts[e];
      const pB = pts[(e + 1) % 6];
      const shore: ShorelineType =
        nt.shoreline && nt.shoreline !== 'none'
          ? nt.shoreline
          : resolveTileShoreline(tile, state.tiles, state.height);

      const idx = segs.length;
      segs.push({ ax: pA.x, ay: pA.y, bx: pB.x, by: pB.y, shore, used: false });
      const kA = ptKey(pA.x, pA.y);
      if (!startMap.has(kA)) startMap.set(kA, []);
      startMap.get(kA)!.push(idx);
    }
  }

  const polylines: CoastPolyline[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].used) continue;
    segs[i].used = true;
    const rawPts: Array<{ x: number; y: number }> = [
      { x: segs[i].ax, y: segs[i].ay },
      { x: segs[i].bx, y: segs[i].by },
    ];
    const shoreType = segs[i].shore;
    let curKey = ptKey(segs[i].bx, segs[i].by);
    const firstKey = ptKey(segs[i].ax, segs[i].ay);
    let closed = false;

    for (let step = 0; step < 500; step++) {
      if (curKey === firstKey && rawPts.length > 2) {
        closed = true;
        break;
      }
      const nextList = startMap.get(curKey);
      const nextIdx = nextList?.find((idx) => !segs[idx].used);
      if (nextIdx === undefined) break;
      segs[nextIdx].used = true;
      rawPts.push({ x: segs[nextIdx].bx, y: segs[nextIdx].by });
      curKey = ptKey(segs[nextIdx].bx, segs[nextIdx].by);
    }

    // Apply 3 iterations of Chaikin corner-cutting smoothing
    let pts = rawPts;
    if (closed && pts.length > 1) {
      pts = pts.slice(0, -1);
    }
    for (let iter = 0; iter < 3 && pts.length >= 3; iter++) {
      const next: Array<{ x: number; y: number }> = [];
      const n = pts.length;
      if (!closed) next.push(pts[0]);
      const limit = closed ? n : n - 1;
      for (let j = 0; j < limit; j++) {
        const p0 = pts[j];
        const p1 = pts[(j + 1) % n];
        next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
        next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
      }
      if (!closed) next.push(pts[n - 1]);
      pts = next;
    }

    polylines.push({ points: pts, closed, shoreType });
  }

  return polylines;
}

/**
 * PHASE 3: Unified Multi-Hex Lake Contours
 * Extracts the outer boundary edge loop of contiguous isLake hexes (ignoring internal shared edges)
 * and smooths each lake into a single organic polygon with 3 iterations of Chaikin corner-cutting.
 */
function buildSmoothedLakePolylines(
  state: GameState,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
): Array<Array<{ x: number; y: number }>> {
  interface Seg {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    used: boolean;
  }
  const segs: Seg[] = [];
  for (const tile of allTiles) {
    if (!tile.isLake) continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const corners = getHexCorners(px, py, HEX_SIZE, yScale);
    for (let e = 0; e < 6; e++) {
      const [dq, dr] = HEX_EDGE_OFFSETS[e];
      const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
      if (!nt || !nt.isLake) {
        const pA = corners[e];
        const pB = corners[(e + 1) % 6];
        segs.push({ ax: pA.x, ay: pA.y, bx: pB.x, by: pB.y, used: false });
      }
    }
  }

  const ptKey = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
  const startMap = new Map<string, number[]>();
  for (let i = 0; i < segs.length; i++) {
    const k = ptKey(segs[i].ax, segs[i].ay);
    const list = startMap.get(k);
    if (list) list.push(i);
    else startMap.set(k, [i]);
  }

  const lakePolys: Array<Array<{ x: number; y: number }>> = [];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].used) continue;
    segs[i].used = true;
    const rawPts: Array<{ x: number; y: number }> = [
      { x: segs[i].ax, y: segs[i].ay },
      { x: segs[i].bx, y: segs[i].by },
    ];
    const firstKey = ptKey(segs[i].ax, segs[i].ay);
    let curKey = ptKey(segs[i].bx, segs[i].by);
    let closed = false;

    for (let step = 0; step < 300; step++) {
      if (curKey === firstKey && rawPts.length > 2) {
        closed = true;
        break;
      }
      const nextIdx = startMap.get(curKey)?.find((idx) => !segs[idx].used);
      if (nextIdx === undefined) break;
      segs[nextIdx].used = true;
      rawPts.push({ x: segs[nextIdx].bx, y: segs[nextIdx].by });
      curKey = ptKey(segs[nextIdx].bx, segs[nextIdx].by);
    }

    let pts = closed && rawPts.length > 1 ? rawPts.slice(0, -1) : rawPts;
    for (let iter = 0; iter < 3 && pts.length >= 3; iter++) {
      const next: Array<{ x: number; y: number }> = [];
      const n = pts.length;
      const limit = closed ? n : n - 1;
      if (!closed) next.push(pts[0]);
      for (let j = 0; j < limit; j++) {
        const p0 = pts[j];
        const p1 = pts[(j + 1) % n];
        next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
        next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
      }
      if (!closed) next.push(pts[n - 1]);
      pts = next;
    }
    if (pts.length >= 3) lakePolys.push(pts);
  }
  return lakePolys;
}

/**
 * 2-pass Chamfer Distance Transform (in pixel units) from land mask.
 * Runs in <8ms on the baked world buffer to provide exact coastalDistance for bathymetry.
 */
function computeWaterDistanceField(
  isLandMask: Uint8Array,
  bufW: number,
  bufH: number
): Float32Array {
  const INF = 1e6;
  const dist = new Float32Array(bufW * bufH);
  for (let i = 0; i < dist.length; i++) {
    dist[i] = isLandMask[i] ? 0 : INF;
  }

  const D1 = 1.0;
  const D2 = 1.4142;

  // Forward pass
  for (let y = 1; y < bufH - 1; y++) {
    const row = y * bufW;
    for (let x = 1; x < bufW - 1; x++) {
      const i = row + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (dist[i - 1] + D1 < d) d = dist[i - 1] + D1;
      if (dist[i - bufW] + D1 < d) d = dist[i - bufW] + D1;
      if (dist[i - bufW - 1] + D2 < d) d = dist[i - bufW - 1] + D2;
      if (dist[i - bufW + 1] + D2 < d) d = dist[i - bufW + 1] + D2;
      dist[i] = d;
    }
  }

  // Backward pass
  for (let y = bufH - 2; y >= 1; y--) {
    const row = y * bufW;
    for (let x = bufW - 2; x >= 1; x--) {
      const i = row + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (dist[i + 1] + D1 < d) d = dist[i + 1] + D1;
      if (dist[i + bufW] + D1 < d) d = dist[i + bufW] + D1;
      if (dist[i + bufW + 1] + D2 < d) d = dist[i + bufW + 1] + D2;
      if (dist[i + bufW - 1] + D2 < d) d = dist[i + bufW - 1] + D2;
      dist[i] = d;
    }
  }

  return dist;
}

export function bakeWorldTerrain(
  state: GameState,
  viewMode: MapViewMode
): BakedWorldTerrain {
  const yScale = getViewYScale(viewMode);
  const allTiles = Object.values(state.tiles);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const t of allTiles) {
    const p = axialToPixel(t.q, t.r, viewMode);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = HEX_SIZE * 2.2;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const worldW = Math.ceil(maxX - minX);
  const worldH = Math.ceil(maxY - minY);
  const scale = worldW * worldH > 3_400_000 ? 0.75 : 1.0;
  const bufW = Math.max(64, Math.round(worldW * scale));
  const bufH = Math.max(64, Math.round(worldH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext('2d')!;

  // Build Chaikin-smoothed coastline & unified lake contours first
  const coastPolylines = buildSmoothedCoastlines(state, allTiles, viewMode, yScale);
  const lakePolylines = buildSmoothedLakePolylines(state, allTiles, viewMode, yScale);

  // Rasterize smoothed land mask onto an offscreen canvas so coastalDistance follows the Chaikin contour!
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = bufW;
  maskCanvas.height = bufH;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, bufW, bufH);
  mctx.save();
  mctx.scale(scale, scale);
  mctx.translate(-minX, -minY);
  mctx.fillStyle = '#ffffff';
  for (const tile of allTiles) {
    if (tile.biome === 'ocean' || tile.biome === 'coast') continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const pts = getHexCorners(px, py, HEX_SIZE + 0.5, yScale);
    mctx.beginPath();
    mctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) mctx.lineTo(pts[i].x, pts[i].y);
    mctx.closePath();
    mctx.fill();
  }
  // Fill inside closed Chaikin islands & soften edges
  for (const poly of coastPolylines) {
    if (!poly.closed || poly.points.length < 3) continue;
    mctx.beginPath();
    mctx.moveTo(poly.points[0].x, poly.points[0].y);
    for (let i = 1; i < poly.points.length; i++) {
      mctx.lineTo(poly.points[i].x, poly.points[i].y);
    }
    mctx.closePath();
    mctx.fill();
  }
  mctx.restore();

  const maskData = mctx.getImageData(0, 0, bufW, bufH).data;
  const isLandMask = new Uint8Array(bufW * bufH);
  for (let i = 0; i < isLandMask.length; i++) {
    isLandMask[i] = maskData[i * 4] > 128 ? 1 : 0;
  }
  const waterDistPx = computeWaterDistanceField(isLandMask, bufW, bufH);

  const img = ctx.createImageData(bufW, bufH);
  const data = img.data;
  const waterColumnCanvas = document.createElement('canvas');
  waterColumnCanvas.width = bufW;
  waterColumnCanvas.height = bufH;
  const waterCtx = waterColumnCanvas.getContext('2d')!;
  const waterImg = waterCtx.createImageData(bufW, bufH);
  const waterData = waterImg.data;
  const heightField = new Float32Array(bufW * bufH);
  const pixelTileIdx = new Int32Array(bufW * bufH);

  type TileBakeMeta = {
    tile: HexTile;
    gKey: GroundTextureKey;
    baseH: number;
    isCoral: boolean;
    px: number;
    py: number;
  };
  const tileMeta = new Map<string, TileBakeMeta>();
  for (const t of allTiles) {
    const p = axialToPixel(t.q, t.r, viewMode);
    const shore = t.shoreline ?? resolveTileShoreline(t, state.tiles, state.height);
    tileMeta.set(tileKey(t.q, t.r), {
      tile: t,
      gKey: resolveGroundTextureKey(t),
      baseH: getTileBaseReliefHeight(t),
      isCoral: t.biome === 'coast' && shore === 'coral_reef',
      px: p.x,
      py: p.y,
    });
  }

  const invScale = 1 / scale;
  const invHexDist = 1 / (HEX_SIZE * HEX_SQRT3);

  for (let by = 0; by < bufH; by++) {
    const wy = minY + by * invScale;
    const unscaledY = wy / yScale;

    for (let bx = 0; bx < bufW; bx++) {
      const wx = minX + bx * invScale;
      const fq = ((HEX_SQRT3 / 3) * wx - (1 / 3) * unscaledY) / HEX_SIZE;
      const fr = ((2 / 3) * unscaledY) / HEX_SIZE;
      const rounded = axialRound(fq, fr);
      const idx = by * bufW + bx;

      if (!tileMeta.has(tileKey(rounded.q, rounded.r))) {
        heightField[idx] = -0.6;
        pixelTileIdx[idx] = -2;
        data[idx * 4 + 3] = 0;
        continue;
      }

      const cq = Math.round(fq);
      const cr = Math.round(fr);

      let totalW = 0;
      let blendedH = 0;
      let bestScore = -1e9;
      let bestMeta: TileBakeMeta | null = null;
      let secondMeta: TileBakeMeta | null = null;
      let secondScore = -1e9;

      const splatNoise = fbm2D(wx * 0.028, wy * 0.028, 3191, 3) - 0.5;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          if (dq + dr < -1 || dq + dr > 1) continue;
          const meta = tileMeta.get(tileKey(cq + dq, cr + dr));
          if (!meta) continue;

          const dx = wx - meta.px;
          const dy = (wy - meta.py) / yScale;
          const dist = Math.sqrt(dx * dx + dy * dy) * invHexDist;

          const w = Math.max(0, 1.2 - dist);
          const w2 = w * w;
          totalW += w2;
          blendedH += meta.baseH * w2;

          const isWater = meta.tile.biome === 'ocean' || meta.tile.biome === 'coast';
          const score =
            (1 - dist) +
            splatNoise * (isWater ? 0.12 : 0.44) +
            (meta.tile.biome === 'hills' ? 0.05 : 0);

          if (score > bestScore) {
            secondScore = bestScore;
            secondMeta = bestMeta;
            bestScore = score;
            bestMeta = meta;
          } else if (score > secondScore) {
            secondScore = score;
            secondMeta = meta;
          }
        }
      }

      if (!bestMeta || totalW <= 0) {
        heightField[idx] = -0.6;
        pixelTileIdx[idx] = -2;
        data[idx * 4 + 3] = 0;
        continue;
      }

      const avgH = blendedH / totalW;
      const ridge = ridgedNoise2D(wx * 0.017, wy * 0.017, 4721, 3);
      const detailFbm = fbm2D(wx * 0.045, wy * 0.045, 5987, 3);
      const isHillOrMtn =
        bestMeta.tile.biome === 'hills' || bestMeta.tile.biome === 'mountain';
      const reliefAmp = isHillOrMtn ? 0.64 : bestMeta.tile.biome === 'ocean' ? 0.02 : 0.075;
      const finalH = avgH + (ridge * 0.72 + detailFbm * 0.28 - 0.35) * reliefAmp;
      heightField[idx] = finalH;

      const microFbm = fbm2D(wx * 0.09, wy * 0.09, 7103, 3);
      const cell = worley2D(wx * 0.12, wy * 0.12, 8317);
      const grain = microFbm * 0.65 + (1 - cell) * 0.35;

      const pal = EARTH_PALETTES[bestMeta.gKey];
      let rgb =
        grain < 0.48
          ? mixRgb(pal.dark, pal.mid, grain / 0.48)
          : mixRgb(pal.mid, pal.lit, (grain - 0.48) / 0.52);

      // Height-based noise transition between adjacent land biomes
      if (
        secondMeta &&
        secondMeta.gKey !== bestMeta.gKey &&
        bestMeta.tile.biome !== 'ocean' &&
        bestMeta.tile.biome !== 'coast' &&
        secondMeta.tile.biome !== 'ocean' &&
        secondMeta.tile.biome !== 'coast'
      ) {
        const diff = bestScore - secondScore;
        if (diff < 0.18) {
          const blendT = (0.18 - diff) / 0.36;
          const pal2 = EARTH_PALETTES[secondMeta.gKey];
          const rgb2 = mixRgb(pal2.dark, pal2.lit, grain);
          rgb = mixRgb(rgb, rgb2, blendT);
        }
      }

      // Climate-Matched Multi-Band Water Bathymetry split into:
      // - Sub-Layer 4A Seabed (baked.canvas)
      // - Sub-Layer 4B Translucent Water Column Absorption (baked.waterColumnCanvas)
      const isWaterPixel =
        bestMeta.tile.biome === 'ocean' || bestMeta.tile.biome === 'coast';
      let waterColRgb: [number, number, number] = [0, 0, 0];
      let waterColAlpha = 0;

      if (isWaterPixel) {
        const dCoast = waterDistPx[idx] * invScale;
        const shore = bestMeta.tile.shoreline ?? 'sandy_beach';
        const isArcticWater = shore === 'icy_shore';
        const isTropicalWater = bestMeta.isCoral || shore === 'sandy_beach';

        const shoreEdgeCol: [number, number, number] = isArcticWater
          ? [132, 146, 158]
          : isTropicalWater
            ? [206, 192, 148]
            : [172, 158, 126];
        const shallowSeabed: [number, number, number] = isArcticWater
          ? [94, 108, 118]
          : isTropicalWater
            ? [178, 166, 128]
            : [128, 122, 98];
        const midSeabed: [number, number, number] = isArcticWater
          ? [46, 62, 74]
          : [64, 82, 78];
        const deepSeabed: [number, number, number] = [18, 28, 40];

        const shallowWater: [number, number, number] = isArcticWater
          ? [38, 74, 102]
          : isTropicalWater
            ? [32, 128, 138]
            : [32, 98, 118];
        const midWater: [number, number, number] = isArcticWater
          ? [20, 48, 76]
          : [18, 58, 92];
        const deepWater: [number, number, number] = [12, 28, 54];

        if (dCoast < 14) {
          const t = dCoast / 14;
          rgb = mixRgb(shoreEdgeCol, shallowSeabed, t * t);
          waterColRgb = shallowWater;
          waterColAlpha = 70 + t * 65;
        } else if (dCoast < 58) {
          const t = (dCoast - 14) / 44;
          rgb = mixRgb(shallowSeabed, midSeabed, t);
          waterColRgb = mixRgb(shallowWater, midWater, t);
          waterColAlpha = 135 + t * 52;

          const sandbarNoise = fbm2D(wx * 0.042, wy * 0.042, 9241, 3);
          const shelfPatch = worley2D(wx * 0.08, wy * 0.08, 9511);
          if (bestMeta.isCoral && sandbarNoise > 0.50) {
            const reefTone: [number, number, number] =
              shelfPatch > 0.48 ? [116, 126, 86] : [82, 134, 120];
            rgb = mixRgb(rgb, reefTone, (sandbarNoise - 0.50) * 1.35);
          } else if (sandbarNoise > 0.57) {
            rgb = mixRgb(rgb, isArcticWater ? [88, 108, 122] : [142, 146, 118], (sandbarNoise - 0.57) * 1.15);
          } else if (shelfPatch < 0.34) {
            rgb = mixRgb(rgb, [34, 62, 72], (0.34 - shelfPatch) * 1.0);
          }
        } else {
          const t = Math.min(1, (dCoast - 55) / 55);
          const wave = Math.sin(wx * 0.055 + wy * 0.025 + microFbm * 4.2) * 0.5 + 0.5;
          rgb = mixRgb(midSeabed, deepSeabed, t);
          const deepCol = mixRgb(deepWater, [20, 46, 78], wave * 0.5 + grain * 0.5);
          waterColRgb = mixRgb(midWater, deepCol, t);
          waterColAlpha = 187 + t * 38;
        }
      } else if (bestMeta.gKey === 'desert') {
        const duneWave = Math.sin(wx * 0.08 + wy * 0.04 + ridge * 5.0) * 0.5 + 0.5;
        rgb = mixRgb(pal.dark, pal.lit, duneWave * 0.6 + grain * 0.4);
      } else if (
        bestMeta.gKey === 'plains' ||
        bestMeta.gKey === 'grassland' ||
        bestMeta.gKey === 'savanna' ||
        bestMeta.gKey === 'arid_steppe'
      ) {
        // Large-scale macro-tonal meadow variation across 8-15 hex regions (replaces wavy felt ripples)
        const macroMeadow = fbm2D(wx * 0.0085, wy * 0.0085, 6529, 3);
        if (bestMeta.gKey === 'grassland' || bestMeta.gKey === 'plains') {
          if (macroMeadow > 0.56) {
            // Warm golden-green pasture belt
            rgb = mixRgb(rgb, [126, 136, 70], Math.min(0.45, (macroMeadow - 0.56) * 1.4));
          } else if (macroMeadow < 0.42) {
            // Lush emerald valley zone
            rgb = mixRgb(rgb, [64, 106, 50], Math.min(0.42, (0.42 - macroMeadow) * 1.3));
          }
        } else {
          // Drier sage-olive steppe zone
          rgb = mixRgb(rgb, [120, 122, 74], Math.abs(macroMeadow - 0.5) * 0.55);
        }

        const soilVar = fbm2D(wx * 0.045, wy * 0.045, 6607, 2);
        const clover = worley2D(wx * 0.17, wy * 0.17, 6619);
        if (soilVar > 0.62) {
          rgb = mixRgb(rgb, [132, 118, 78], (soilVar - 0.62) * 0.55);
        } else if (clover < 0.22 && (bestMeta.gKey === 'grassland' || bestMeta.gKey === 'plains')) {
          rgb = mixRgb(rgb, [124, 140, 74], (0.22 - clover) * 0.75);
        }
      }

      // Fertile green floodplain tinting on tiles bordering meandering rivers
      if (!isWaterPixel && bestMeta.tile.hasRiver) {
        rgb = mixRgb(rgb, [74, 118, 56], 0.24);
      }

      pixelTileIdx[idx] = isWaterPixel
        ? -1
        : bestMeta.tile.temperature === 'arid'
          ? 1
          : bestMeta.tile.temperature === 'arctic'
            ? 2
            : 0;

      const p4 = idx * 4;
      data[p4] = clampByte(rgb[0]);
      data[p4 + 1] = clampByte(rgb[1]);
      data[p4 + 2] = clampByte(rgb[2]);
      data[p4 + 3] = 255;

      waterData[p4] = clampByte(waterColRgb[0]);
      waterData[p4 + 1] = clampByte(waterColRgb[1]);
      waterData[p4 + 2] = clampByte(waterColRgb[2]);
      waterData[p4 + 3] = clampByte(waterColAlpha);
    }
  }

  // Pass 2: Per-pixel normal shading (top-left sunlight), crevice AO & slope rock blending
  const lx = -0.68;
  const ly = -0.56;
  const lz = 0.48;

  for (let by = 1; by < bufH - 1; by++) {
    for (let bx = 1; bx < bufW - 1; bx++) {
      const idx = by * bufW + bx;
      const kind = pixelTileIdx[idx];
      if (kind === -2) continue;

      const p4 = idx * 4;
      const gx = (heightField[idx + 1] - heightField[idx - 1]) * 12.0;
      const gy = (heightField[idx + bufW] - heightField[idx - bufW]) * 12.0;
      const nLen = Math.sqrt(gx * gx + gy * gy + 1);
      const sunDot = (-gx * lx - gy * ly + lz) / nLen;
      const slope = Math.sqrt(gx * gx + gy * gy);

      if (kind >= 0) {
        const shade = 0.66 + Math.max(0, Math.min(1, sunDot)) * 0.62;
        const ao = 0.85 + Math.min(0.15, Math.max(-0.14, heightField[idx] * 0.26));
        let r = data[p4] * shade * ao;
        let g = data[p4 + 1] * shade * ao;
        let b = data[p4 + 2] * shade * ao;

        if (slope > 0.62) {
          const rockT = Math.min(0.68, (slope - 0.62) * 0.58);
          const rockCol =
            kind === 1
              ? [132, 102, 74]
              : kind === 2
                ? [112, 118, 126]
                : [108, 104, 92];
          r = r * (1 - rockT) + rockCol[0] * shade * rockT;
          g = g * (1 - rockT) + rockCol[1] * shade * rockT;
          b = b * (1 - rockT) + rockCol[2] * shade * rockT;
        }

        data[p4] = clampByte(r);
        data[p4 + 1] = clampByte(g);
        data[p4 + 2] = clampByte(b);
      } else {
        const waterShade = 0.94 + Math.max(0, Math.min(1, sunDot)) * 0.14;
        data[p4] = clampByte(data[p4] * waterShade);
        data[p4 + 1] = clampByte(data[p4 + 1] * waterShade);
        data[p4 + 2] = clampByte(data[p4 + 2] * waterShade);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  waterCtx.putImageData(waterImg, 0, 0);

  // Pass 3: Draw Chaikin-smoothed coastline edges, spline rivers, and faint land-only hex grid
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  drawSmoothedCoastlineContours(ctx, coastPolylines);
  const riverPolylines = drawBakedSplineRivers(ctx, state, allTiles, viewMode, yScale);

  ctx.restore();

  return {
    canvas,
    waterColumnCanvas,
    minX,
    minY,
    worldW,
    worldH,
    scale,
    gameId: state.id,
    viewMode,
    coastPolylines,
    lakePolylines,
    riverPolylines,
  };
}

function drawSmoothedCoastlineContours(
  ctx: CanvasRenderingContext2D,
  polylines: CoastPolyline[]
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const poly of polylines) {
    if (poly.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(poly.points[0].x, poly.points[0].y);
    for (let i = 1; i < poly.points.length; i++) {
      ctx.lineTo(poly.points[i].x, poly.points[i].y);
    }
    if (poly.closed) ctx.closePath();

    if (poly.shoreType === 'high_cliffs') {
      ctx.strokeStyle = 'rgba(64, 70, 78, 0.78)';
      ctx.lineWidth = 4.4;
      ctx.stroke();
    } else if (poly.shoreType === 'icy_shore') {
      ctx.strokeStyle = 'rgba(206, 224, 238, 0.80)';
      ctx.lineWidth = 3.4;
      ctx.stroke();
    } else if (poly.shoreType === 'sandy_beach' || poly.shoreType === 'coral_reef') {
      ctx.strokeStyle = 'rgba(216, 198, 152, 0.62)';
      ctx.lineWidth = 4.5;
      ctx.stroke();
    } else {
      // Temperate pebble / tan cove shoreline contour
      ctx.strokeStyle = 'rgba(164, 152, 122, 0.54)';
      ctx.lineWidth = 3.8;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function evalCatmullRom(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function drawBakedSplineRivers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
): Array<Array<{ x: number; y: number }>> {
  const riverPolylines: Array<Array<{ x: number; y: number }>> = [];

  // Build ordered vertex chains from state.rivers (continuous vertex graph) or fallback to state.riverPaths
  const rawVertexChains: Array<Array<{ x: number; y: number }>> = [];
  if (state.rivers && state.rivers.length > 0) {
    for (const rChain of state.rivers) {
      if (rChain.length >= 2) {
        rawVertexChains.push(rChain.map((pt) => ({ x: pt.x, y: pt.y * yScale })));
      }
    }
  } else if (state.riverPaths && state.riverPaths.length > 0) {
    for (const pathNodes of state.riverPaths) {
      if (pathNodes.length < 2) continue;
      const chain: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < pathNodes.length; i++) {
        const node = pathNodes[i];
        const { x: px, y: py } = axialToPixel(node.q, node.r, viewMode);
        const corners = getHexCorners(px, py, HEX_SIZE, yScale);
        const pA = corners[node.edge];
        const pB = corners[(node.edge + 1) % 6];
        if (i === 0) {
          chain.push(pA, pB);
        } else {
          const last = chain[chain.length - 1];
          const dA = Math.hypot(pA.x - last.x, pA.y - last.y);
          const dB = Math.hypot(pB.x - last.x, pB.y - last.y);
          chain.push(dA <= dB ? pB : pA);
        }
      }
      rawVertexChains.push(chain);
    }
  }

  if (rawVertexChains.length > 0) {
    for (let rIdx = 0; rIdx < rawVertexChains.length; rIdx++) {
      const baseChain = rawVertexChains[rIdx];
      if (baseChain.length < 2) continue;

      // Smooth macro-curves using 2 iterations of Chaikin corner-cutting (no per-edge zig-zags)
      let smoothPts: Array<{ x: number; y: number }> = baseChain;
      for (let iter = 0; iter < 2; iter++) {
        const nextPts: Array<{ x: number; y: number }> = [smoothPts[0]];
        for (let i = 0; i < smoothPts.length - 1; i++) {
          const p0 = smoothPts[i];
          const p1 = smoothPts[i + 1];
          nextPts.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
          nextPts.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
        }
        nextPts.push(smoothPts[smoothPts.length - 1]);
        smoothPts = nextPts;
      }

      riverPolylines.push(smoothPts);
    }
    return riverPolylines;
  }

  // Fallback for older saved games without riverPaths
  const drawnEdges = new Set<string>();
  for (const tile of allTiles) {
    if (!tile.riverEdges || !tile.riverEdges.some(Boolean)) continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const hexPts = getHexCorners(px, py, HEX_SIZE, yScale);

    for (let e = 0; e < 6; e++) {
      if (!tile.riverEdges[e]) continue;
      const [dq, dr] = HEX_EDGE_OFFSETS[e];
      const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];

      const k1 = `${tile.q},${tile.r}`;
      const k2 = `${tile.q + dq},${tile.r + dr}`;
      const edgeId = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (drawnEdges.has(edgeId)) continue;
      drawnEdges.add(edgeId);

      const pA = hexPts[e];
      const pB = hexPts[(e + 1) % 6];
      const mx = (pA.x + pB.x) * 0.5;
      const my = (pA.y + pB.y) * 0.5;
      const nearSea = nt?.biome === 'coast' || nt?.biome === 'ocean' || tile.biome === 'coast';
      const baseWidth = nearSea ? 6.2 : 3.6;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(44, 62, 42, 0.44)';
      ctx.lineWidth = baseWidth + 2.4;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(mx, my, pB.x, pB.y);
      ctx.stroke();

      ctx.strokeStyle = '#2d6c88';
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(mx, my, pB.x, pB.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  return riverPolylines;
}

function drawBakedSubtleLandGrid(
  ctx: CanvasRenderingContext2D,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(18, 22, 16, 0.08)';
  ctx.lineWidth = 0.65;
  for (const tile of allTiles) {
    // Never draw grid lines on water tiles so oceans remain continuous
    if (tile.biome === 'ocean' || tile.biome === 'coast') continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const pts = getHexCorners(px, py, HEX_SIZE, yScale);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
