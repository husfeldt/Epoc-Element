import { HEX_SIZE, HEX_SQRT3, MapViewMode, axialToPixel, getViewYScale, tileKey } from './hexMath';
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

export interface BakedWorldTerrain {
  canvas: HTMLCanvasElement;
  minX: number;
  minY: number;
  worldW: number;
  worldH: number;
  scale: number;
  gameId: string;
  viewMode: MapViewMode;
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

// Naturalistic, slightly desaturated satellite/cartographic earth-tone palettes
const EARTH_PALETTES: Record<
  GroundTextureKey,
  { dark: [number, number, number]; mid: [number, number, number]; lit: [number, number, number]; rock: [number, number, number] }
> = {
  deep_ocean: {
    dark: [14, 30, 50],
    mid: [20, 44, 70],
    lit: [28, 58, 88],
    rock: [18, 38, 60],
  },
  shallow_coast: {
    dark: [26, 68, 86],
    mid: [38, 92, 108],
    lit: [68, 126, 128],
    rock: [98, 118, 104],
  },
  lake: {
    dark: [24, 64, 86],
    mid: [34, 86, 110],
    lit: [54, 112, 134],
    rock: [64, 96, 104],
  },
  desert: {
    dark: [144, 114, 74],
    mid: [182, 148, 98],
    lit: [210, 178, 124],
    rock: [132, 102, 74],
  },
  arid_steppe: {
    dark: [124, 106, 72],
    mid: [152, 132, 88],
    lit: [176, 156, 106],
    rock: [122, 94, 68],
  },
  savanna: {
    dark: [104, 108, 58],
    mid: [134, 134, 72],
    lit: [162, 156, 90],
    rock: [116, 102, 74],
  },
  plains: {
    dark: [86, 102, 56],
    mid: [114, 126, 70],
    lit: [142, 148, 86],
    rock: [108, 104, 86],
  },
  grassland: {
    dark: [62, 86, 46],
    mid: [82, 110, 58],
    lit: [106, 132, 72],
    rock: [96, 100, 82],
  },
  tundra: {
    dark: [84, 92, 86],
    mid: [108, 114, 104],
    lit: [134, 138, 126],
    rock: [98, 102, 104],
  },
  snow: {
    dark: [164, 180, 196],
    mid: [198, 210, 222],
    lit: [224, 232, 240],
    rock: [118, 126, 136],
  },
  marsh: {
    dark: [46, 68, 48],
    mid: [62, 88, 56],
    lit: [78, 108, 66],
    rock: [56, 82, 74],
  },
};

function getTileBaseReliefHeight(tile: HexTile): number {
  if (tile.biome === 'ocean') return -0.68;
  if (tile.biome === 'coast') return tile.isLake ? -0.25 : -0.22;
  if (tile.biome === 'mountain') return 0.92;
  if (tile.biome === 'hills') return tile.terrainSubType === 'foothills' ? 0.56 : 0.74;
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
 * Pre-renders the entire world's continuous heightfield, normal-shaded hill relief,
 * height-based noise splatting, photorealistic earth-tone micro-textures, water bathymetry,
 * underwater coral reefs, 6-neighbor coastlines, spline rivers, and subtle hex grid
 * onto a cached offscreen canvas ONCE per map load / viewMode change.
 */
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
  // Keep baked buffer crisp while bounding memory for large top-down maps
  const scale = worldW * worldH > 3_400_000 ? 0.75 : 1.0;
  const bufW = Math.max(64, Math.round(worldW * scale));
  const bufH = Math.max(64, Math.round(worldH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(bufW, bufH);
  const data = img.data;

  // Heightfield & biome buffers for normal-shaded terrain relief
  const heightField = new Float32Array(bufW * bufH);
  const pixelTileIdx = new Int32Array(bufW * bufH);

  // Build quick lookup from axial (q, r) to tile & base info
  const tileMeta = new Map<
    string,
    { tile: HexTile; gKey: GroundTextureKey; baseH: number; isCoral: boolean; px: number; py: number }
  >();
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

  // Pass 1: Continuous Heightfield + Height-Based Noise Splatting & Micro-Texture
  const invScale = 1 / scale;
  const invHexDist = 1 / (HEX_SIZE * HEX_SQRT3);

  for (let by = 0; by < bufH; by++) {
    const wy = minY + by * invScale;
    const unscaledY = wy / yScale;

    for (let bx = 0; bx < bufW; bx++) {
      const wx = minX + bx * invScale;

      // Exact fractional axial coordinates in O(1)
      const fq = ((HEX_SQRT3 / 3) * wx - (1 / 3) * unscaledY) / HEX_SIZE;
      const fr = ((2 / 3) * unscaledY) / HEX_SIZE;
      const cq = Math.round(fq);
      const cr = Math.round(fr);

      // Gather up to 4 nearest hexes around (cq, cr)
      let totalW = 0;
      let blendedH = 0;
      let bestScore = -1e9;
      type TileBakeMeta = {
        tile: HexTile;
        gKey: GroundTextureKey;
        baseH: number;
        isCoral: boolean;
        px: number;
        py: number;
      };
      let bestMeta: TileBakeMeta | null = null;
      let secondMeta: TileBakeMeta | null = null;
      let secondScore = -1e9;
      let landDistMin = 999;

      // Shared world-space perturbation noise for organic height-based hex splatting
      const splatNoise = fbm2D(wx * 0.028, wy * 0.028, 3191, 3) - 0.5;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          if (dq + dr < -1 || dq + dr > 1) continue;
          const meta = tileMeta.get(tileKey(cq + dq, cr + dr));
          if (!meta) continue;

          const dx = wx - meta.px;
          const dy = (wy - meta.py) / yScale;
          const dist = Math.sqrt(dx * dx + dy * dy) * invHexDist;

          if (meta.tile.biome !== 'ocean' && meta.tile.biome !== 'coast') {
            if (dist < landDistMin) landDistMin = dist;
          }

          // Smooth elevation interpolation weight
          const w = Math.max(0, 1.18 - dist);
          const w2 = w * w;
          totalW += w2;
          blendedH += meta.baseH * w2;

          // Height-based noise splatting score for organic biome transitions
          const isWater = meta.tile.biome === 'ocean' || meta.tile.biome === 'coast';
          const score =
            (1 - dist) +
            splatNoise * (isWater ? 0.14 : 0.42) +
            (meta.tile.biome === 'hills' ? 0.06 : 0);

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

      const idx = by * bufW + bx;
      if (!bestMeta || totalW <= 0) {
        heightField[idx] = -0.6;
        pixelTileIdx[idx] = 0;
        const p4 = idx * 4;
        data[p4] = 16;
        data[p4 + 1] = 34;
        data[p4 + 2] = 56;
        data[p4 + 3] = 255;
        continue;
      }

      const avgH = blendedH / totalW;
      // Continuous multi-octave Ridged Multifractal + fBm relief for natural hills & valleys
      const ridge = ridgedNoise2D(wx * 0.017, wy * 0.017, 4721, 3);
      const detailFbm = fbm2D(wx * 0.045, wy * 0.045, 5987, 3);
      const isHillOrMtn =
        bestMeta.tile.biome === 'hills' || bestMeta.tile.biome === 'mountain';
      const reliefAmp = isHillOrMtn ? 0.58 : bestMeta.tile.biome === 'ocean' ? 0.03 : 0.16;
      const finalH = avgH + (ridge * 0.7 + detailFbm * 0.3 - 0.35) * reliefAmp;
      heightField[idx] = finalH;

      // Multi-scale cellular (Worley) + Perlin micro-texture
      const microFbm = fbm2D(wx * 0.09, wy * 0.09, 7103, 3);
      const cell = worley2D(wx * 0.12, wy * 0.12, 8317);
      const grain = microFbm * 0.65 + (1 - cell) * 0.35;

      const pal = EARTH_PALETTES[bestMeta.gKey];
      let rgb =
        grain < 0.48
          ? mixRgb(pal.dark, pal.mid, grain / 0.48)
          : mixRgb(pal.mid, pal.lit, (grain - 0.48) / 0.52);

      // Height-based transition blend with second-nearest land biome
      if (
        secondMeta &&
        secondMeta.gKey !== bestMeta.gKey &&
        bestMeta.tile.biome !== 'ocean' &&
        bestMeta.tile.biome !== 'coast' &&
        secondMeta.tile.biome !== 'ocean' &&
        secondMeta.tile.biome !== 'coast'
      ) {
        const diff = bestScore - secondScore;
        if (diff < 0.16) {
          const blendT = (0.16 - diff) / 0.32;
          const pal2 = EARTH_PALETTES[secondMeta.gKey];
          const rgb2 = mixRgb(pal2.dark, pal2.lit, grain);
          rgb = mixRgb(rgb, rgb2, blendT);
        }
      }

      // Natural Water Bathymetry & Subtle Underwater Reef Seabed Mottling
      if (bestMeta.tile.biome === 'coast' || bestMeta.tile.biome === 'ocean') {
        if (bestMeta.tile.biome === 'coast' && landDistMin < 1.15) {
          // Depth-driven absorption from shoreline sand/pebble shallows -> muted coastal teal
          const depthT = Math.max(0, Math.min(1, (landDistMin - 0.42) / 0.68));
          const shallowSand: [number, number, number] = [108, 128, 114];
          const coastalTeal: [number, number, number] = [34, 84, 98];
          rgb = mixRgb(shallowSand, coastalTeal, depthT);

          // Subtle organic underwater reef mottling (muted olive, ochre, faint turquoise)
          if (bestMeta.isCoral && depthT > 0.12 && depthT < 0.85) {
            const reefMask = fbm2D(wx * 0.065, wy * 0.065, 9241, 3);
            if (reefMask > 0.54) {
              const reefTone: [number, number, number] =
                cell > 0.52 ? [96, 108, 72] : [62, 116, 112];
              rgb = mixRgb(rgb, reefTone, (reefMask - 0.54) * 1.45);
            }
          }
        } else if (bestMeta.tile.biome === 'ocean') {
          // Subtle wind-wave ripple variation in Prussian/navy-slate deep ocean
          const wave = Math.sin(wx * 0.06 + wy * 0.03 + microFbm * 4.0) * 0.5 + 0.5;
          rgb = mixRgb(pal.dark, pal.lit, wave * 0.55 + grain * 0.45);
        }
      } else if (bestMeta.gKey === 'desert') {
        // Wind-sculpted dune ripple shading
        const duneWave = Math.sin(wx * 0.08 + wy * 0.04 + ridge * 5.0) * 0.5 + 0.5;
        rgb = mixRgb(pal.dark, pal.lit, duneWave * 0.6 + grain * 0.4);
      }

      // Store rock palette hint in pixelTileIdx for Pass 2 normal/slope shading
      pixelTileIdx[idx] =
        bestMeta.tile.biome === 'ocean' || bestMeta.tile.biome === 'coast'
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
    }
  }

  // Pass 2: Per-Pixel Normal Shading (Top-Left Sun), Crevice AO & Slope Rock Blending
  const lx = -0.68;
  const ly = -0.56;
  const lz = 0.48;

  for (let by = 1; by < bufH - 1; by++) {
    for (let bx = 1; bx < bufW - 1; bx++) {
      const idx = by * bufW + bx;
      const p4 = idx * 4;
      const gx = (heightField[idx + 1] - heightField[idx - 1]) * 11.5;
      const gy = (heightField[idx + bufW] - heightField[idx - bufW]) * 11.5;
      const nLen = Math.sqrt(gx * gx + gy * gy + 1);
      const sunDot = (-gx * lx - gy * ly + lz) / nLen;
      const slope = Math.sqrt(gx * gx + gy * gy);

      const kind = pixelTileIdx[idx];
      if (kind >= 0) {
        // Land relief: directional sunlight + crevice AO + exposed rock on steep slopes
        const shade = 0.68 + Math.max(0, Math.min(1, sunDot)) * 0.58;
        const ao = 0.86 + Math.min(0.14, Math.max(-0.12, heightField[idx] * 0.25));
        let r = data[p4] * shade * ao;
        let g = data[p4 + 1] * shade * ao;
        let b = data[p4 + 2] * shade * ao;

        if (slope > 0.65) {
          const rockT = Math.min(0.65, (slope - 0.65) * 0.55);
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
        // Subtle water surface normal sheen
        const waterShade = 0.92 + Math.max(0, Math.min(1, sunDot)) * 0.16;
        data[p4] = clampByte(data[p4] * waterShade);
        data[p4 + 1] = clampByte(data[p4 + 1] * waterShade);
        data[p4 + 2] = clampByte(data[p4 + 2] * waterShade);
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  // Pass 3: Transform to world coordinates and draw 6-neighbor coastlines, spline rivers, and subtle hex grid
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  drawBakedCoastlinesAndBeaches(ctx, state, allTiles, viewMode, yScale);
  drawBakedSplineRivers(ctx, state, allTiles, viewMode, yScale);
  drawBakedSubtleGrid(ctx, allTiles, viewMode, yScale);

  ctx.restore();

  return {
    canvas,
    minX,
    minY,
    worldW,
    worldH,
    scale,
    gameId: state.id,
    viewMode,
  };
}

function drawBakedCoastlinesAndBeaches(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
) {
  const isIso = viewMode === 'isometric';

  for (const tile of allTiles) {
    if (tile.biome === 'ocean' || tile.biome === 'coast') continue;
    const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
    const exactPts = getHexCorners(px, py, HEX_SIZE, yScale);

    for (let e = 0; e < 6; e++) {
      const [dq, dr] = HEX_EDGE_OFFSETS[e];
      const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
      if (!nt || (nt.biome !== 'ocean' && nt.biome !== 'coast')) continue;

      const pA = exactPts[e];
      const pB = exactPts[(e + 1) % 6];
      const mx = (pA.x + pB.x) * 0.5;
      const my = (pA.y + pB.y) * 0.5;
      const inX = px - mx;
      const inY = py - my;
      const outX = -inX;
      const outY = -inY;

      const shore: ShorelineType =
        nt.shoreline && nt.shoreline !== 'none'
          ? nt.shoreline
          : resolveTileShoreline(tile, state.tiles, state.height);

      const curveShift = (hash2D(tile.q + e, tile.r - e, 333) - 0.5) * 0.16;
      const ctrlX = mx + inX * curveShift;
      const ctrlY = my + inY * curveShift;

      ctx.save();
      if (shore === 'sandy_beach' || shore === 'coral_reef') {
        const sandGrad = ctx.createLinearGradient(mx, my, mx + inX * 0.34, my + inY * 0.34);
        sandGrad.addColorStop(0, 'rgba(212, 192, 146, 0.88)');
        sandGrad.addColorStop(0.6, 'rgba(196, 174, 126, 0.38)');
        sandGrad.addColorStop(1, 'rgba(196, 174, 126, 0)');
        ctx.fillStyle = sandGrad;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, pB.x, pB.y);
        ctx.lineTo(pB.x + inX * 0.34, pB.y + inY * 0.34);
        ctx.lineTo(pA.x + inX * 0.34, pA.y + inY * 0.34);
        ctx.closePath();
        ctx.fill();

        // Delicate irregular white surf foam
        ctx.strokeStyle = 'rgba(235, 242, 244, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pA.x + outX * 0.05, pA.y + outY * 0.05);
        ctx.quadraticCurveTo(ctrlX + outX * 0.08, ctrlY + outY * 0.08, pB.x + outX * 0.05, pB.y + outY * 0.05);
        ctx.stroke();
      } else if (shore === 'high_cliffs') {
        const cliffDepth = isIso && (e === 0 || e === 1 || e === 2) ? 7.5 : 3.8;
        ctx.fillStyle = tile.temperature === 'arid' ? '#7a492c' : '#4a525c';
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, pB.x, pB.y);
        ctx.lineTo(pB.x, pB.y + cliffDepth);
        ctx.lineTo(pA.x, pA.y + cliffDepth);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(225, 234, 240, 0.62)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y + cliffDepth);
        ctx.lineTo(pB.x, pB.y + cliffDepth);
        ctx.stroke();
      } else if (shore === 'rocky_shore') {
        ctx.strokeStyle = 'rgba(218, 226, 232, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, pB.x, pB.y);
        ctx.stroke();
      } else if (shore === 'icy_shore') {
        ctx.strokeStyle = 'rgba(226, 236, 244, 0.72)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawBakedSplineRivers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
) {
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

      const nearSea =
        nt?.biome === 'coast' ||
        nt?.biome === 'ocean' ||
        tile.biome === 'coast' ||
        tile.elevation < 0.46;
      const baseWidth = nearSea ? 5.6 : 3.8;

      const jitter = (hash2D(tile.q + e, tile.r - e, 909) - 0.5) * 6.5;
      const nx = -(pB.y - pA.y);
      const ny = pB.x - pA.x;
      const nLen = Math.hypot(nx, ny) || 1;
      const cx = mx + (nx / nLen) * jitter;
      const cy = my + (ny / nLen) * jitter;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(44, 62, 42, 0.50)';
      ctx.lineWidth = baseWidth + 2.6;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(cx, cy, pB.x, pB.y);
      ctx.stroke();

      ctx.strokeStyle = '#2d6c88';
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(cx, cy, pB.x, pB.y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(176, 212, 224, 0.45)';
      ctx.lineWidth = Math.max(1.0, baseWidth * 0.25);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(cx - 0.6, cy - 0.6, pB.x, pB.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawBakedSubtleGrid(
  ctx: CanvasRenderingContext2D,
  allTiles: HexTile[],
  viewMode: MapViewMode,
  yScale: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(18, 22, 16, 0.11)';
  ctx.lineWidth = 0.7;
  for (const tile of allTiles) {
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
