import {
  HexTile,
  ImprovementType,
  ShorelineType,
  TemperatureZone,
  UnitDef,
  UnitState,
} from '../types/game';
import { hexNeighbors, tileKey } from './hexMath';

export type AtlasSlotId =
  | 'tropical'
  | 'temperate'
  | 'arid'
  | 'arctic'
  | 'transitions'
  | 'desert_hills_transitions'
  | 'specialty_clusters'
  | 'coastal_shores'
  | 'infrastructure'
  | 'units';

export type SliceMode = 'grid' | 'tropical_columns';

export interface AtlasSlotMeta {
  id: AtlasSlotId;
  src: string;
  cols: number;
  rows: number;
  sliceMode: SliceMode;
}

export interface SlicedSprite {
  canvas: HTMLCanvasElement;
  dioramaCanvas?: HTMLCanvasElement;
  width: number;
  height: number;
  dioramaHeight?: number;
  col: number;
  row: number;
}

export interface LoadedAtlas {
  slot: AtlasSlotId;
  cols: number;
  rows: number;
  sliceMode: SliceMode;
  sprites: SlicedSprite[];
  byCol: Map<number, SlicedSprite[]>;
  byCoord: Map<string, SlicedSprite>;
}

const PREMADE_ATLASES: AtlasSlotMeta[] = [
  {
    id: 'tropical',
    src: '/assets/aistudio/image_badc2470.png',
    cols: 14,
    rows: 9,
    sliceMode: 'tropical_columns',
  },
  {
    id: 'temperate',
    src: '/src/assets/images/sheet_temperate_tiles_1794774960541.jpg',
    cols: 8,
    rows: 4,
    sliceMode: 'grid',
  },
  {
    id: 'arid',
    src: '/src/assets/images/sheet_arid_tiles_1794774961083.jpg',
    cols: 7,
    rows: 4,
    sliceMode: 'grid',
  },
  {
    id: 'arctic',
    src: '/src/assets/images/sheet_arctic_tiles_1794774960839.jpg',
    cols: 6,
    rows: 4,
    sliceMode: 'grid',
  },
  {
    id: 'transitions',
    src: '/src/assets/images/sheet_biome_transitions_1794850485941.jpg',
    cols: 6,
    rows: 4,
    sliceMode: 'grid',
  },
  {
    id: 'desert_hills_transitions',
    src: '/src/assets/images/sheet_desert_grass_hills_transitions.jpg',
    cols: 4,
    rows: 2,
    sliceMode: 'grid',
  },
  {
    id: 'specialty_clusters',
    src: '/src/assets/images/sheet_specialty_hex_tiles.jpg',
    cols: 4,
    rows: 2,
    sliceMode: 'grid',
  },
  {
    id: 'coastal_shores',
    src: '/src/assets/images/sheet_coastal_shores.jpg',
    cols: 4,
    rows: 2,
    sliceMode: 'grid',
  },
  {
    id: 'infrastructure',
    src: '/src/assets/images/sheet_infrastructure_tiles_1794774964417.jpg',
    cols: 6,
    rows: 4,
    sliceMode: 'grid',
  },
  {
    id: 'units',
    src: '/src/assets/images/sheet_strategy_units_1794774964695.jpg',
    cols: 6,
    rows: 4,
    sliceMode: 'grid',
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function isBackgroundPixel(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return lum > 228 && maxC - minC < 20;
}

function chromaKeyAndTightCrop(
  srcCanvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  preserveInteriorWhite = false
): HTMLCanvasElement | null {
  const w = Math.max(1, Math.floor(sw));
  const h = Math.max(1, Math.floor(sh));
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const ctx = temp.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  if (preserveInteriorWhite) {
    // Border-connected flood fill so interior white sandbars, surf foam, and snow slopes stay solid
    const isBgCand = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a < 16) {
          isBgCand[y * w + x] = 1;
          continue;
        }
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        if (lum > 224 && sat < 22) {
          isBgCand[y * w + x] = 1;
        }
      }
    }

    const bgMask = new Uint8Array(w * h);
    const q = new Int32Array(w * h);
    let qHead = 0;
    let qTail = 0;
    const pushIfCand = (x: number, y: number) => {
      const p = y * w + x;
      if (!bgMask[p] && isBgCand[p]) {
        bgMask[p] = 1;
        q[qTail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      pushIfCand(x, 0);
      pushIfCand(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      pushIfCand(0, y);
      pushIfCand(w - 1, y);
    }

    while (qHead < qTail) {
      const p = q[qHead++];
      const py = Math.floor(p / w);
      const px = p - py * w;
      if (px > 0) pushIfCand(px - 1, py);
      if (px < w - 1) pushIfCand(px + 1, py);
      if (py > 0) pushIfCand(px, py - 1);
      if (py < h - 1) pushIfCand(px, py + 1);
    }

    const colInk = new Int32Array(w);
    const rowInk = new Int32Array(h);

    for (let y = 0; y < h; y++) {
      const inCanopyZone = y < h * 0.34;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const idx = p * 4;
        if (bgMask[p]) {
          data[idx + 3] = 0;
          continue;
        }
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        const lum = r * 0.299 + g * 0.587 + b * 0.114;

        // Clear trapped pure-white sky holes between upper tree fronds/branches
        if (inCanopyZone && lum > 244 && sat < 10) {
          data[idx + 3] = 0;
          continue;
        }

        // Soften 1px anti-aliased halo directly adjacent to exterior background
        const touchesBg =
          (x > 0 && bgMask[p - 1]) ||
          (x < w - 1 && bgMask[p + 1]) ||
          (y > 0 && bgMask[p - w]) ||
          (y < h - 1 && bgMask[p + w]);
        if (touchesBg && lum > 208 && sat < 24) {
          const t = Math.max(0, Math.min(1, (228 - lum) / 20));
          data[idx + 3] = Math.round(data[idx + 3] * t);
        }

        if (data[idx + 3] > 48) {
          if (y >= h * 0.18 && y <= h * 0.85) {
            colInk[x]++;
          }
          rowInk[y]++;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const minColInk = Math.max(12, Math.round(h * 0.05));
    let minX = w;
    let maxX = -1;
    for (let x = 0; x < w; x++) {
      if (colInk[x] >= minColInk) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      if (rowInk[y] >= 4) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return null;
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    if (cw < 16 || ch < 16) return null;

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(temp, minX, minY, cw, ch, 0, 0, cw, ch);
    return out;
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a < 10) {
        data[idx + 3] = 0;
        continue;
      }

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC - minC;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;

      if (lum > 236 && sat < 20) {
        data[idx + 3] = 0;
      } else if (lum > 210 && sat < 22) {
        const t = (236 - lum) / 26;
        data[idx + 3] = Math.round(a * Math.max(0, Math.min(1, t * t)));
        if (data[idx + 3] > 32) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const pad = 1;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);

  if (cw < 16 || ch < 16) return null;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.drawImage(temp, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

function resolveSpriteSurfaceGeometry(
  slotId: AtlasSlotId,
  col: number,
  row: number
): { cliffRatio: number; surfHRatio: number } {
  if (slotId === 'desert_hills_transitions') {
    return { cliffRatio: 0.25, surfHRatio: 0.81 };
  }
  if (slotId === 'coastal_shores') {
    if (row === 1 && (col === 0 || col === 2 || col === 3)) {
      return { cliffRatio: 0.33, surfHRatio: 0.54 };
    }
    return { cliffRatio: 0.27, surfHRatio: 0.58 };
  }
  if (slotId === 'specialty_clusters') {
    if (row === 1 && (col === 0 || col === 1)) {
      return { cliffRatio: 0.15, surfHRatio: 0.74 };
    }
    return { cliffRatio: 0.21, surfHRatio: 0.72 };
  }
  if (slotId === 'temperate') {
    return { cliffRatio: 0.25, surfHRatio: 0.72 };
  }
  if (slotId === 'arid') {
    return { cliffRatio: 0.19, surfHRatio: 0.72 };
  }
  if (slotId === 'arctic') {
    return { cliffRatio: 0.15, surfHRatio: 0.68 };
  }
  if (slotId === 'transitions') {
    return { cliffRatio: 0.14, surfHRatio: 0.70 };
  }
  if (slotId === 'infrastructure') {
    return { cliffRatio: 0.15, surfHRatio: 0.68 };
  }
  return { cliffRatio: 0.22, surfHRatio: 0.68 };
}

/**
 * Strips the 3D underground/underwater cliff skirt from an isometric tile block and
 * maps its base surface directly into the exact 6-sided pointy-top hexagon geometry
 * of the game grid (ISO_Y_SCALE = 0.56), while preserving 3D vertical headroom above
 * the top hex edges for mountain peaks, forest canopies, palms, and city spires.
 */
function buildSeamlessDioramaSprite(
  raw: HTMLCanvasElement,
  slotId: AtlasSlotId = 'temperate',
  col = 0,
  row = 0
): {
  canvas: HTMLCanvasElement;
  height: number;
} {
  const rw = raw.width;
  const rh = raw.height;
  const rctx = raw.getContext('2d', { willReadFrequently: true });
  if (!rctx) return { canvas: raw, height: rh };

  const rawData = rctx.getImageData(0, 0, rw, rh).data;
  const { cliffRatio, surfHRatio } = resolveSpriteSurfaceGeometry(slotId, col, row);

  // Target game-grid pointy-top hexagon dimensions for width W = rw (ISO_Y_SCALE = 0.56)
  const W = rw;
  const hexH = Math.max(16, Math.round(W * ((2 * 0.56) / Math.sqrt(3)))); // 0.64663 * W
  const headroom = Math.round(W * 0.54);
  const outH = headroom + hexH;

  const surfBot0 = Math.min(rh - 2, rh - rw * cliffRatio);
  const surfTop0 = Math.max(0, surfBot0 - rw * surfHRatio);
  const slopeTop = 0.232 * rw;
  const slopeBot = 0.232 * rw;
  const centerX = Math.floor(rw / 2);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) return { canvas: raw, height: rh };

  const outImg = ctx.createImageData(W, outH);
  const outData = outImg.data;
  const halfW = (W - 1) * 0.5;

  for (let xOut = 0; xOut < W; xOut++) {
    const nx = Math.abs(xOut - halfW) / Math.max(1, halfW);
    const nxClamped = Math.min(0.93, nx);
    const sgn = xOut < halfW ? -1 : 1;
    let baseXSrc = Math.round(halfW + sgn * nxClamped * halfW);
    baseXSrc = Math.max(0, Math.min(rw - 1, baseXSrc));

    // Exact top and bottom y of the 6-sided pointy-top hexagon at normalized column nx
    const tTop = headroom + nx * (0.25 * hexH);
    const tBot = headroom + hexH - nx * (0.25 * hexH);

    // Smooth geometric source top and bottom (never jumps between adjacent columns)
    const sTop = surfTop0 + nxClamped * slopeTop;
    const sBot = surfBot0 - nxClamped * slopeBot;

    // Gentle 2.5px side feather at the extreme left/right vertical hex edges
    const sideFeather = nx > 0.965 ? Math.max(0.25, (1.0 - nx) / 0.035) : 1.0;

    for (let yOut = 0; yOut < outH; yOut++) {
      if (yOut > tBot) {
        continue;
      }

      if (yOut >= tTop) {
        const t = (yOut - tTop) / Math.max(1, tBot - tTop);
        const ySrc = sTop + t * (sBot - sTop);
        const yi = Math.max(0, Math.min(rh - 1, Math.round(ySrc)));

        let xs = baseXSrc;
        let steps = 0;
        while (xs !== centerX && rawData[(yi * rw + xs) * 4 + 3] < 96 && steps < 14) {
          xs += xs < centerX ? 1 : -1;
          steps++;
        }

        const srcIdx = (yi * rw + xs) * 4;
        const a = rawData[srcIdx + 3];
        if (a === 0) continue;

        // Soft 3px feather along bottom hex edges so tiles sit seamlessly on the terrain plane
        const botDist = tBot - yOut;
        const botFeather = botDist < 3.0 ? Math.max(0.2, botDist / 3.0) : 1.0;

        const dstIdx = (yOut * W + xOut) * 4;
        outData[dstIdx] = rawData[srcIdx];
        outData[dstIdx + 1] = rawData[srcIdx + 1];
        outData[dstIdx + 2] = rawData[srcIdx + 2];
        outData[dstIdx + 3] = Math.round(a * sideFeather * botFeather);
      } else {
        // 3D vertical headroom above top hex edges (mountains, trees, palms, city spires)
        const ySrc = sTop - (tTop - yOut);
        const yi = Math.round(ySrc);
        if (yi >= 0 && yi < rh) {
          const srcIdx = (yi * rw + baseXSrc) * 4;
          const a = rawData[srcIdx + 3];
          if (a > 64) {
            const dstIdx = (yOut * W + xOut) * 4;
            outData[dstIdx] = rawData[srcIdx];
            outData[dstIdx + 1] = rawData[srcIdx + 1];
            outData[dstIdx + 2] = rawData[srcIdx + 2];
            outData[dstIdx + 3] = Math.round(a * sideFeather);
          }
        }
      }
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return { canvas: out, height: outH };
}

function sliceGridSheet(
  srcCanvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  buildDiorama: boolean,
  slotId: AtlasSlotId = 'temperate'
): SlicedSprite[] {
  const cellW = srcCanvas.width / cols;
  const cellH = srcCanvas.height / rows;
  const sprites: SlicedSprite[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = Math.floor(col * cellW);
      const sy = Math.floor(row * cellH);
      const sw = Math.floor((col + 1) * cellW) - sx;
      const sh = Math.floor((row + 1) * cellH) - sy;
      const cropped = chromaKeyAndTightCrop(srcCanvas, sx, sy, sw, sh, buildDiorama);
      if (cropped) {
        const diorama = buildDiorama ? buildSeamlessDioramaSprite(cropped, slotId, col, row) : null;
        sprites.push({
          canvas: cropped,
          dioramaCanvas: diorama?.canvas,
          width: cropped.width,
          height: cropped.height,
          dioramaHeight: diorama?.height,
          col,
          row,
        });
      }
    }
  }
  return sprites;
}

/**
 * Connected-component BFS + valley splitting for staggered column sheets (image_badc2470.png).
 * Guarantees each tropical hex block is extracted as ONE single tile rather than stacked pairs.
 */
function sliceTropicalColumnSheet(
  srcCanvas: HTMLCanvasElement,
  expectedCols = 12
): SlicedSprite[] {
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const data = ctx.getImageData(0, 0, W, H).data;

  // Build strict foreground mask to separate touching faint shadows cleanly
  const fg = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] > 20 && !isBackgroundPixel(data[i], data[i + 1], data[i + 2])) {
      fg[p] = 1;
    }
  }

  // Find column split X coordinates near minimum vertical whitespace
  const colInk = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let count = 0;
    for (let y = 0; y < H; y += 2) {
      if (fg[y * W + x]) count++;
    }
    colInk[x] = count;
  }

  const colSplits: number[] = [0];
  const approxColW = W / expectedCols;
  for (let c = 1; c < expectedCols; c++) {
    const center = Math.round(c * approxColW);
    const searchRad = Math.round(approxColW * 0.2);
    let bestX = center;
    let bestVal = Infinity;
    for (let x = Math.max(1, center - searchRad); x <= Math.min(W - 2, center + searchRad); x++) {
      const score = colInk[x] + colInk[x - 1] * 0.5 + colInk[x + 1] * 0.5;
      if (score < bestVal) {
        bestVal = score;
        bestX = x;
      }
    }
    colSplits.push(bestX);
  }
  colSplits.push(W);

  const sprites: SlicedSprite[] = [];
  const singleTileMaxH = Math.round(H / 7.3); // ~105px for 9 staggered rows in 768px image

  for (let col = 0; col < expectedCols; col++) {
    const x0 = colSplits[col];
    const x1 = colSplits[col + 1];
    const bandW = x1 - x0;
    if (bandW < 18) continue;

    // 4-connected BFS within column band [x0, x1)
    const visited = new Uint8Array(bandW * H);
    const qx = new Int32Array(bandW * H);
    const qy = new Int32Array(bandW * H);
    const components: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];

    for (let y = 0; y < H; y++) {
      for (let lx = 0; lx < bandW; lx++) {
        const vIdx = y * bandW + lx;
        if (visited[vIdx] || !fg[y * W + (x0 + lx)]) continue;

        let head = 0;
        let tail = 0;
        qx[tail] = lx;
        qy[tail] = y;
        tail++;
        visited[vIdx] = 1;

        let minX = lx;
        let maxX = lx;
        let minY = y;
        let maxY = y;
        let area = 0;

        while (head < tail) {
          const cx = qx[head];
          const cy = qy[head];
          head++;
          area++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= bandW || ny < 0 || ny >= H) continue;
            const nIdx = ny * bandW + nx;
            if (!visited[nIdx] && fg[ny * W + (x0 + nx)]) {
              visited[nIdx] = 1;
              qx[tail] = nx;
              qy[tail] = ny;
              tail++;
            }
          }
        }

        if (area >= 220 && maxX - minX >= 28 && maxY - minY >= 24) {
          components.push({
            minX: x0 + minX,
            maxX: x0 + maxX,
            minY,
            maxY,
          });
        }
      }
    }

    components.sort((a, b) => a.minY - b.minY);

    // Subdivide any vertically touching components cleanly
    const finalBoxes: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
    for (const box of components) {
      const boxH = box.maxY - box.minY + 1;
      if (boxH > singleTileMaxH) {
        const count = Math.max(2, Math.round(boxH / 84));
        let curTop = box.minY;
        for (let k = 1; k < count; k++) {
          const targetY = box.minY + Math.round((boxH * k) / count);
          let bestY = targetY;
          let bestInk = Infinity;
          for (let y = Math.max(curTop + 28, targetY - 16); y <= Math.min(box.maxY - 28, targetY + 16); y++) {
            let ink = 0;
            for (let x = box.minX; x <= box.maxX; x++) {
              if (fg[y * W + x]) ink++;
            }
            if (ink < bestInk) {
              bestInk = ink;
              bestY = y;
            }
          }
          finalBoxes.push({ minX: box.minX, maxX: box.maxX, minY: curTop, maxY: bestY - 1 });
          curTop = bestY + 1;
        }
        finalBoxes.push({ minX: box.minX, maxX: box.maxX, minY: curTop, maxY: box.maxY });
      } else {
        finalBoxes.push(box);
      }
    }

    finalBoxes.forEach((box, rowIdx) => {
      const sx = Math.max(0, box.minX - 2);
      const sy = Math.max(0, box.minY - 2);
      const sw = Math.min(W - sx, box.maxX - box.minX + 5);
      const sh = Math.min(H - sy, box.maxY - box.minY + 5);
      const cropped = chromaKeyAndTightCrop(srcCanvas, sx, sy, sw, sh, true);
      if (cropped) {
        const diorama = buildSeamlessDioramaSprite(cropped, 'tropical', col, rowIdx);
        sprites.push({
          canvas: cropped,
          dioramaCanvas: diorama.canvas,
          width: cropped.width,
          height: cropped.height,
          dioramaHeight: diorama.height,
          col,
          row: rowIdx,
        });
      }
    });
  }

  return sprites;
}

async function buildLoadedAtlas(meta: AtlasSlotMeta): Promise<LoadedAtlas> {
  const img = await loadImage(meta.src);
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth || img.width;
  srcCanvas.height = img.naturalHeight || img.height;
  const sctx = srcCanvas.getContext('2d');
  if (sctx) {
    sctx.drawImage(img, 0, 0);
  }

  const isTileOrInfra = meta.id !== 'units';
  const sprites =
    meta.sliceMode === 'tropical_columns'
      ? sliceTropicalColumnSheet(srcCanvas, meta.cols)
      : sliceGridSheet(srcCanvas, meta.cols, meta.rows, isTileOrInfra, meta.id);

  const byCol = new Map<number, SlicedSprite[]>();
  const byCoord = new Map<string, SlicedSprite>();
  for (const sp of sprites) {
    byCoord.set(`${sp.col},${sp.row}`, sp);
    if (!byCol.has(sp.col)) byCol.set(sp.col, []);
    byCol.get(sp.col)!.push(sp);
  }

  return {
    slot: meta.id,
    cols: meta.cols,
    rows: meta.rows,
    sliceMode: meta.sliceMode,
    sprites,
    byCol,
    byCoord,
  };
}

class SpriteAtlasRegistry {
  private atlases = new Map<AtlasSlotId, LoadedAtlas>();
  private loadingPromise: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  async ensureLoaded(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = (async () => {
      await Promise.all(
        PREMADE_ATLASES.map(async (meta) => {
          try {
            const loaded = await buildLoadedAtlas(meta);
            this.atlases.set(meta.id, loaded);
          } catch (err) {
            console.warn(`Failed loading atlas ${meta.id}:`, err);
          }
        })
      );
      this.notify();
    })();
    return this.loadingPromise;
  }

  getAtlas(slot: AtlasSlotId): LoadedAtlas | undefined {
    return this.atlases.get(slot);
  }
}

export const spriteAtlas = new SpriteAtlasRegistry();

function tileHash(q: number, r: number): number {
  const n = Math.imul(q * 374761393 + r * 668265263, 1274126177);
  return Math.abs((n ^ (n >>> 13)) >>> 0);
}

function pickFromCols(
  atlas: LoadedAtlas | undefined,
  cols: number[],
  hash: number
): SlicedSprite | null {
  if (!atlas || atlas.sprites.length === 0) return null;
  const pool: SlicedSprite[] = [];
  for (const c of cols) {
    const list = atlas.byCol.get(c);
    if (list) pool.push(...list);
  }
  if (pool.length === 0) {
    return atlas.sprites[hash % atlas.sprites.length];
  }
  return pool[hash % pool.length];
}

function pickFromGridSlice(
  atlas: LoadedAtlas | undefined,
  row: number,
  colStart: number,
  colEndInclusive: number,
  hash: number
): SlicedSprite | null {
  if (!atlas || atlas.sprites.length === 0) return null;
  const pool: SlicedSprite[] = [];
  for (let c = colStart; c <= colEndInclusive; c++) {
    const sp = atlas.byCoord.get(`${c},${row}`);
    if (sp) pool.push(sp);
  }
  if (pool.length === 0) return atlas.sprites[hash % atlas.sprites.length];
  return pool[hash % pool.length];
}

function resolveZoneAtlasId(zone: TemperatureZone): AtlasSlotId {
  if (zone === 'tropical') return 'tropical';
  if (zone === 'arid') return 'arid';
  if (zone === 'arctic') return 'arctic';
  return 'temperate';
}

function pickTransitionCoords(
  atlas: LoadedAtlas | undefined,
  coords: Array<[number, number]>,
  hash: number
): SlicedSprite | null {
  if (!atlas) return null;
  const pool: SlicedSprite[] = [];
  for (const [c, r] of coords) {
    const sp = atlas.byCoord.get(`${c},${r}`);
    if (sp) pool.push(sp);
  }
  if (pool.length === 0) return null;
  return pool[hash % pool.length];
}

export function isBiomeTransitionTile(
  tile: HexTile,
  allTiles?: Record<string, HexTile>
): boolean {
  if (!allTiles) return false;
  if (tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'mountain') return false;
  if (tile.clusterType) return true;
  const neighbors = hexNeighbors(tile.q, tile.r)
    .map((n) => allTiles[tileKey(n.q, n.r)])
    .filter((nt): nt is HexTile => Boolean(nt && nt.biome !== 'ocean' && nt.biome !== 'coast'));

  // Only plains/tundra bordering desert or arctic/temperate boundaries need 3D transition props
  if (tile.biome === 'plains') {
    return neighbors.some((nt) => nt.biome === 'desert' || nt.temperature === 'arid');
  }
  return neighbors.some(
    (nt) => nt.biome !== tile.biome || nt.temperature !== tile.temperature
  );
}

export function isHighSovereignPeak(
  tile: HexTile,
  allTiles?: Record<string, HexTile>
): boolean {
  if (tile.biome !== 'mountain') return false;
  if (tile.clusterRole === 'center') return true;
  if (tile.clusterRole === 'inner_ring') return false;
  if (!allTiles) return true;
  const mtnNeighbors = hexNeighbors(tile.q, tile.r)
    .map((n) => allTiles[tileKey(n.q, n.r)])
    .filter((nt): nt is HexTile => Boolean(nt && nt.biome === 'mountain'));
  if (mtnNeighbors.length === 0) return true;
  const myScore = tile.elevation * 1000 + (tileHash(tile.q, tile.r) % 100);
  return mtnNeighbors.every(
    (nt) => myScore >= nt.elevation * 1000 + (tileHash(nt.q, nt.r) % 100)
  );
}

export function isOasisCenterTile(
  tile: HexTile,
  allTiles?: Record<string, HexTile>
): boolean {
  if (tile.biome !== 'desert') return false;
  if (tile.clusterType === 'oasis' && tile.clusterRole === 'center') return true;
  if (tile.clusterType === 'oasis' && tile.clusterRole === 'inner_ring') return false;
  const hash = tileHash(tile.q, tile.r);
  if (tile.hasRiver && allTiles) {
    const desertNeighbors = hexNeighbors(tile.q, tile.r).filter(
      (n) => allTiles[tileKey(n.q, n.r)]?.biome === 'desert'
    ).length;
    if (desertNeighbors >= 4) return true;
  }
  return hash % 13 === 0 && tile.feature === 'none';
}

export function resolveTileShoreline(
  tile: HexTile,
  allTiles?: Record<string, HexTile>,
  mapHeight = 22
): ShorelineType {
  if (tile.shoreline && tile.shoreline !== 'none') return tile.shoreline;
  if (!allTiles) return 'sandy_beach';

  const nTiles = hexNeighbors(tile.q, tile.r)
    .map((n) => allTiles[tileKey(n.q, n.r)])
    .filter((nt): nt is HexTile => Boolean(nt));

  const hasWaterNeighbor = nTiles.some((nt) => nt.biome === 'coast' || nt.biome === 'ocean');
  const hasLandNeighbor = nTiles.some((nt) => nt.biome !== 'coast' && nt.biome !== 'ocean');

  if (tile.biome !== 'coast' && !hasWaterNeighbor) return 'none';
  if (tile.biome === 'coast' && !hasLandNeighbor && !tile.clusterType) return 'none';

  // Check if an adjacent coast/land neighbor already has an explicit shoreline
  const explicitNeighbor = nTiles.find((nt) => nt.shoreline && nt.shoreline !== 'none');
  if (explicitNeighbor?.shoreline) return explicitNeighbor.shoreline;

  const lat = Math.abs(tile.r / Math.max(1, mapHeight - 1) - 0.5) * 2;
  const landNeighbors =
    tile.biome === 'coast'
      ? nTiles.filter((nt) => nt.biome !== 'coast' && nt.biome !== 'ocean')
      : [tile];

  if (
    lat >= 0.74 ||
    tile.temperature === 'arctic' ||
    landNeighbors.some((l) => l.temperature === 'arctic' || l.biome === 'tundra')
  ) {
    return 'icy_shore';
  }

  const hasRiverMouth =
    tile.hasRiver ||
    tile.riverEdges?.some(Boolean) ||
    landNeighbors.some((l) => l.hasRiver || l.riverEdges?.some(Boolean));
  if (hasRiverMouth) {
    return 'coastal_swamp';
  }

  if (landNeighbors.some((l) => l.biome === 'mountain' || (l.biome === 'hills' && l.elevation > 0.62))) {
    return 'high_cliffs';
  }
  if (landNeighbors.some((l) => l.biome === 'hills')) {
    return 'rocky_shore';
  }

  const hash = tileHash(tile.q, tile.r);
  if (lat < 0.34 && (hash % 4 === 0 || tile.clusterType === 'coral_lagoon')) {
    return 'coral_reef';
  }
  if (landNeighbors.some((l) => l.biome === 'forest') && hash % 3 === 0) {
    return 'coastal_swamp';
  }
  if (hash % 5 === 0 && !landNeighbors.some((l) => l.biome === 'desert')) {
    return 'rocky_shore';
  }
  return 'sandy_beach';
}

export function getTerrainTileSprite(
  tile: HexTile,
  _hasAdjacentLand: boolean,
  allTiles?: Record<string, HexTile>
): SlicedSprite | null {
  const hash = tileHash(tile.q, tile.r);
  const slotId = resolveZoneAtlasId(tile.temperature);
  const atlas = spriteAtlas.getAtlas(slotId) || spriteAtlas.getAtlas('temperate');
  const transAtlas = spriteAtlas.getAtlas('transitions');
  const dhAtlas = spriteAtlas.getAtlas('desert_hills_transitions');
  const specAtlas = spriteAtlas.getAtlas('specialty_clusters');
  const coastAtlas = spriteAtlas.getAtlas('coastal_shores');
  const tempAtlas = spriteAtlas.getAtlas('temperate');
  const aridAtlas = spriteAtlas.getAtlas('arid');

  // 0a. Dedicated Shoreline & Coastal Cluster Tiles (Atolls, Coral Reefs, Swamp Deltas, Sea Cliffs, Icy Fjords)
  if (tile.biome === 'coast') {
    const shore = resolveTileShoreline(tile, allTiles);
    if (tile.clusterType === 'coral_lagoon' || shore === 'coral_reef') {
      if (tile.clusterRole === 'center') {
        const sp = pickTransitionCoords(coastAtlas, [[2, 1]], hash);
        if (sp) return sp;
      }
      if (tile.clusterRole === 'inner_ring' || hash % 2 === 0) {
        const sp = pickTransitionCoords(coastAtlas, [[0, 1]], hash);
        if (sp) return sp;
      }
    }
    if (
      (tile.clusterType === 'coastal_swamp_delta' && tile.clusterRole === 'center') ||
      (shore === 'coastal_swamp' && tile.riverEdges?.some(Boolean))
    ) {
      const sp = pickTransitionCoords(coastAtlas, [[3, 1]], hash);
      if (sp) return sp;
    }
    if (
      (tile.clusterType === 'icy_fjord' || shore === 'icy_shore') &&
      (tile.clusterRole === 'center' || hash % 3 === 0)
    ) {
      const sp = pickTransitionCoords(coastAtlas, [[1, 1]], hash);
      if (sp) return sp;
    }
    return null;
  }

  // 0a-land: Coastal Swamp Delta & High Cliff Headland Cluster Land Tiles
  if (tile.biome !== 'ocean' && tile.biome !== 'mountain') {
    const shore = resolveTileShoreline(tile, allTiles);
    if (tile.clusterType === 'coastal_swamp_delta' || shore === 'coastal_swamp') {
      if (tile.biome === 'plains' || tile.biome === 'forest') {
        const sp =
          tile.hasRiver
            ? pickTransitionCoords(coastAtlas, [[3, 1], [3, 0]], hash)
            : pickTransitionCoords(coastAtlas, [[3, 0]], hash);
        if (sp) return sp;
      }
    }
    if (
      (tile.clusterType === 'cliff_headland' || shore === 'high_cliffs') &&
      tile.biome === 'hills'
    ) {
      const sp = pickTransitionCoords(coastAtlas, [[2, 0]], hash);
      if (sp) return sp;
    }
    if (shore === 'rocky_shore' && tile.biome === 'hills' && hash % 2 === 0) {
      const sp = pickTransitionCoords(coastAtlas, [[1, 0]], hash);
      if (sp) return sp;
    }
  }

  // 0. Dedicated Multi-Tile Mountain Massif & Tropical Mountain Sprites
  if (tile.biome === 'mountain') {
    const isApex = isHighSovereignPeak(tile, allTiles);
    if (tile.temperature === 'tropical') {
      const sp = isApex
        ? pickTransitionCoords(specAtlas, [[0, 0]], hash)
        : pickTransitionCoords(specAtlas, [[1, 0], [0, 0]], hash);
      if (sp) return sp;
    }
    if (tile.temperature === 'arid') {
      if (aridAtlas) {
        const sp = isApex
          ? pickTransitionCoords(aridAtlas, [[5, 2], [6, 2]], hash)
          : pickTransitionCoords(aridAtlas, [[3, 2], [4, 2]], hash);
        if (sp) return sp;
      }
    }
    // Temperate & Arctic Mountains (Sovereign Peak vs Companion Sub-Peak)
    const sp = isApex
      ? pickTransitionCoords(specAtlas, [[2, 1]], hash) ||
        pickTransitionCoords(tempAtlas, [[6, 2], [7, 2]], hash)
      : pickTransitionCoords(specAtlas, [[3, 1]], hash) ||
        pickTransitionCoords(tempAtlas, [[4, 2], [5, 2]], hash);
    if (sp) return sp;
  }

  // 0b. Dedicated Multi-Tile Desert Oasis Cluster (Oasis Heart + 6 Surrounding Oasis Rim Dune Tiles)
  if (tile.biome === 'desert' && allTiles) {
    if (isOasisCenterTile(tile, allTiles)) {
      const oasisSp =
        pickTransitionCoords(specAtlas, [[0, 1]], hash) ||
        pickTransitionCoords(aridAtlas, [[4, 1], [5, 1], [6, 1]], hash);
      if (oasisSp) return oasisSp;
    }
    const bordersOasisCenter =
      (tile.clusterType === 'oasis' && tile.clusterRole === 'inner_ring') ||
      hexNeighbors(tile.q, tile.r).some((n) => {
        const nt = allTiles[tileKey(n.q, n.r)];
        return nt && isOasisCenterTile(nt, allTiles);
      });
    if (bordersOasisCenter) {
      const rimSp =
        pickTransitionCoords(specAtlas, [[1, 1]], hash) ||
        pickTransitionCoords(aridAtlas, [[0, 1], [1, 1], [2, 1]], hash);
      if (rimSp) return rimSp;
    }
  }

  // 0c. High-Resolution Tropical Hills & Rainforest Canopy (replaces blurry low-res tropical sheet)
  if (tile.temperature === 'tropical') {
    if (tile.biome === 'hills') {
      const sp =
        pickTransitionCoords(specAtlas, [[2, 0]], hash) ||
        pickTransitionCoords(transAtlas, [[4, 1], [2, 3]], hash);
      if (sp) return sp;
    }
    if (tile.biome === 'forest') {
      const sp =
        pickTransitionCoords(specAtlas, [[3, 0]], hash) ||
        pickTransitionCoords(transAtlas, [[1, 1], [2, 1]], hash);
      if (sp) return sp;
    }
  }

  // Neighbor-aware biome & climate transition sprite selection
  if (allTiles && tile.biome !== 'ocean' && tile.biome !== 'mountain') {
    const neighborEntries = hexNeighbors(tile.q, tile.r)
      .map((n) => ({
        dq: n.q - tile.q,
        dr: n.r - tile.r,
        t: allTiles[tileKey(n.q, n.r)],
      }))
      .filter(
        (item): item is { dq: number; dr: number; t: HexTile } =>
          Boolean(item.t && item.t.biome !== 'ocean' && item.t.biome !== 'coast')
      );

    const hasDesertNeighbor = neighborEntries.some(
      (n) => n.t.biome === 'desert' || n.t.temperature === 'arid'
    );
    const hasGreenHillsNeighbor = neighborEntries.some(
      (n) => n.t.biome === 'hills' && n.t.temperature !== 'arid' && n.t.temperature !== 'arctic'
    );
    const hasGreenLandNeighbor = neighborEntries.some(
      (n) =>
        (n.t.biome === 'plains' || n.t.biome === 'forest' || n.t.biome === 'hills') &&
        n.t.temperature !== 'arid' &&
        n.t.temperature !== 'arctic'
    );
    const hasForestNeighbor = neighborEntries.some((n) => n.t.biome === 'forest');
    const hasPlainsNeighbor = neighborEntries.some((n) => n.t.biome === 'plains');
    const hasMountainNeighbor = neighborEntries.some((n) => n.t.biome === 'mountain');
    const hasArcticNeighbor = neighborEntries.some(
      (n) => n.t.biome === 'tundra' || n.t.temperature === 'arctic'
    );
    const hasTemperateNeighbor = neighborEntries.some((n) => n.t.temperature === 'temperate');

    // 1. Desert <-> Grass Hills / Green Land Transition
    if (tile.biome === 'desert' && (hasGreenHillsNeighbor || hasGreenLandNeighbor)) {
      if (tile.hasRiver) {
        const rivSp =
          pickTransitionCoords(dhAtlas, [[2, 1]], hash) ||
          pickTransitionCoords(transAtlas, [[4, 0], [5, 0]], hash);
        if (rivSp) return rivSp;
      }
      const greenVecX = neighborEntries
        .filter(
          (n) =>
            n.t.biome === 'hills' ||
            n.t.biome === 'plains' ||
            n.t.biome === 'forest'
        )
        .reduce((acc, n) => acc + (n.dq + n.dr * 0.5), 0);
      const greenVecY = neighborEntries
        .filter(
          (n) =>
            n.t.biome === 'hills' ||
            n.t.biome === 'plains' ||
            n.t.biome === 'forest'
        )
        .reduce((acc, n) => acc + n.dr, 0);

      if (hasGreenHillsNeighbor) {
        const sp =
          greenVecX >= 0
            ? pickTransitionCoords(dhAtlas, [[0, 0], [3, 1], [1, 1]], hash)
            : greenVecY < 0
              ? pickTransitionCoords(dhAtlas, [[3, 0], [1, 0], [1, 1]], hash)
              : pickTransitionCoords(dhAtlas, [[1, 0], [3, 0], [3, 1]], hash);
        if (sp) return sp;
      }

      const sp =
        pickTransitionCoords(
          dhAtlas,
          greenVecX >= 0
            ? [[0, 0], [3, 1], [1, 1]]
            : [[1, 0], [3, 0], [1, 1]],
          hash
        ) ||
        pickTransitionCoords(
          transAtlas,
          [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
          ],
          hash
        );
      if (sp) return sp;
    }

    // 2. Hills bordering Desert / Arid (or Arid Hills bordering Green Land/Forest)
    if (
      tile.biome === 'hills' &&
      ((tile.temperature !== 'arid' && hasDesertNeighbor) ||
        (tile.temperature === 'arid' && hasGreenLandNeighbor))
    ) {
      if (tile.hasRiver) {
        const rivSp =
          pickTransitionCoords(dhAtlas, [[2, 1]], hash) ||
          pickTransitionCoords(transAtlas, [[3, 3]], hash);
        if (rivSp) return rivSp;
      }
      if (hasForestNeighbor) {
        const fSp =
          pickTransitionCoords(transAtlas, [[4, 1], [3, 0]], hash) ||
          pickTransitionCoords(dhAtlas, [[3, 1], [1, 1]], hash);
        if (fSp) return fSp;
      }
      const desertVecX = neighborEntries
        .filter((n) => n.t.biome === 'desert' || n.t.temperature === 'arid')
        .reduce((acc, n) => acc + (n.dq + n.dr * 0.5), 0);

      const sp =
        pickTransitionCoords(
          dhAtlas,
          desertVecX <= 0
            ? [
                [0, 0],
                [3, 1],
                [1, 1],
              ]
            : [
                [1, 0],
                [3, 0],
                [1, 1],
              ],
          hash
        ) ||
        pickTransitionCoords(
          transAtlas,
          [
            [3, 0],
            [4, 3],
            [2, 3],
          ],
          hash
        );
      if (sp) return sp;
    }

    // 3. Mountain Massif Foothill Cluster (Hills bordering Mountain)
    if (tile.biome === 'hills' && (tile.clusterRole === 'outer_ring' || hasMountainNeighbor)) {
      if (tile.temperature === 'tropical') {
        const sp = pickTransitionCoords(specAtlas, [[2, 0]], hash);
        if (sp) return sp;
      } else if (tile.temperature === 'arctic') {
        const sp = pickTransitionCoords(transAtlas, [[2, 2]], hash);
        if (sp) return sp;
      } else if (tile.temperature === 'temperate') {
        const sp =
          pickTransitionCoords(transAtlas, [[4, 2], [4, 1]], hash) ||
          pickTransitionCoords(specAtlas, [[3, 1]], hash);
        if (sp) return sp;
      }
    }

    // 4. Grass Hills bordering Forest
    if (tile.biome === 'hills' && tile.temperature === 'temperate') {
      if (hasForestNeighbor && hasPlainsNeighbor) {
        const fSp = pickTransitionCoords(transAtlas, [[4, 1], [2, 3]], hash);
        if (fSp) return fSp;
      }
    }

    // 5. Savanna / Steppe Plains bordering Desert
    if (tile.biome === 'plains' && hasDesertNeighbor) {
      const sp =
        pickTransitionCoords(dhAtlas, [[1, 1], [3, 0]], hash) ||
        pickTransitionCoords(transAtlas, [[0, 0], [2, 0], [5, 1], [0, 3]], hash);
      if (sp) return sp;
    }

    // 6. Woodland / Forest Edge bordering Plains or Desert
    if (tile.biome === 'forest') {
      const sameForestCount = neighborEntries.filter((n) => n.t.biome === 'forest').length;
      if (hasDesertNeighbor) {
        const sp =
          pickTransitionCoords(transAtlas, [[5, 1], [0, 1]], hash) ||
          pickTransitionCoords(dhAtlas, [[1, 1]], hash);
        if (sp) return sp;
      }
      if (hasArcticNeighbor && tile.temperature !== 'arctic') {
        const sp = pickTransitionCoords(transAtlas, [[1, 2], [5, 3]], hash);
        if (sp) return sp;
      }
      if (sameForestCount <= 2 && hasPlainsNeighbor) {
        const sp =
          tile.temperature === 'tropical'
            ? pickTransitionCoords(transAtlas, [[1, 1], [2, 1]], hash)
            : tile.temperature === 'arctic'
              ? pickTransitionCoords(transAtlas, [[1, 2], [5, 3]], hash)
              : pickTransitionCoords(transAtlas, [[0, 1], [4, 1]], hash);
        if (sp) return sp;
      }
    }

    // 7. Tundra / Arctic bordering Temperate
    if ((tile.biome === 'tundra' || tile.temperature === 'arctic') && hasTemperateNeighbor) {
      const sp =
        tile.biome === 'hills'
          ? pickTransitionCoords(transAtlas, [[2, 2], [0, 2]], hash)
          : pickTransitionCoords(transAtlas, [[0, 2], [1, 2]], hash);
      if (sp) return sp;
    }
  }

  if (!atlas) return null;

  if (slotId === 'tropical') {
    if (tile.biome === 'ocean') {
      return pickFromCols(atlas, [6, 7], hash);
    }
    if (tile.biome === 'mountain') {
      return (
        pickTransitionCoords(specAtlas, [[0, 0], [1, 0]], hash) ||
        pickTransitionCoords(tempAtlas, [[4, 2], [5, 2]], hash)
      );
    }
    if (tile.biome === 'hills') {
      return (
        pickTransitionCoords(specAtlas, [[2, 0]], hash) ||
        pickTransitionCoords(transAtlas, [[4, 1], [2, 3]], hash)
      );
    }
    if (tile.feature === 'ancient_ruins') {
      return atlas.byCoord.get('9,2') || atlas.byCoord.get('9,4') || pickTransitionCoords(specAtlas, [[3, 0]], hash);
    }
    if (tile.biome === 'forest') {
      return (
        pickTransitionCoords(specAtlas, [[3, 0]], hash) ||
        pickTransitionCoords(transAtlas, [[1, 1], [2, 1]], hash)
      );
    }
    return pickTransitionCoords(transAtlas, [[2, 1], [0, 1]], hash) || pickFromCols(atlas, [0], hash);
  }

  const cols = atlas.cols;
  const half = Math.max(1, Math.floor(cols / 2));

  if (tile.biome === 'ocean') {
    return pickFromGridSlice(atlas, 3, Math.max(0, cols - 2), cols - 1, hash);
  }
  if (tile.biome === 'mountain') {
    return pickFromGridSlice(atlas, 2, half, cols - 1, hash);
  }
  if (tile.biome === 'hills') {
    return pickFromGridSlice(atlas, 2, 0, Math.max(0, half - 1), hash);
  }
  if (tile.biome === 'forest') {
    if (slotId === 'arid') {
      return tile.feature !== 'none' || tile.hasRiver
        ? pickFromGridSlice(atlas, 1, half, cols - 1, hash)
        : pickFromGridSlice(atlas, 1, 0, Math.max(0, half - 1), hash);
    }
    return pickFromGridSlice(atlas, 1, 0, cols - 1, hash);
  }
  if (slotId === 'arid' && (tile.feature !== 'none' || hash % 7 === 0)) {
    return pickFromGridSlice(atlas, 1, half, cols - 1, hash);
  }
  return pickFromGridSlice(atlas, 0, 0, cols - 1, hash);
}

export function getInfrastructureSprite(
  kind: 'city' | ImprovementType,
  ageIndex: number,
  q: number,
  r: number,
  _isCoastalCity = false
): SlicedSprite | null {
  const atlas = spriteAtlas.getAtlas('infrastructure');
  if (!atlas) return null;
  const hash = tileHash(q, r);
  const cols = atlas.cols;
  const half = Math.max(1, Math.floor(cols / 2));

  if (kind === 'city') {
    const eraCol =
      ageIndex <= 0
        ? 0
        : ageIndex <= 2
          ? 1
          : ageIndex <= 5
            ? 2
            : ageIndex === 6
              ? 3
              : ageIndex === 7
                ? 4
                : 5;
    return atlas.byCoord.get(`${Math.min(eraCol, cols - 1)},0`) || pickFromGridSlice(atlas, 0, 0, cols - 1, hash);
  }

  switch (kind) {
    case 'farm':
      return pickFromGridSlice(atlas, 1, 0, Math.max(0, half - 1), hash);
    case 'lumber_mill':
      return pickFromGridSlice(atlas, 1, half, cols - 1, hash);
    case 'mine':
      return pickFromGridSlice(atlas, 2, 0, Math.max(0, half - 1), hash);
    case 'quarry':
      return pickFromGridSlice(atlas, 2, half, cols - 1, hash);
    case 'trade_post':
      return pickFromGridSlice(atlas, 3, 0, Math.min(1, cols - 1), hash);
    case 'fort':
      return pickFromGridSlice(atlas, 3, Math.min(2, cols - 1), Math.min(3, cols - 1), hash);
    default:
      return null;
  }
}

const UNIT_COORD_MAP: Record<string, [number, number]> = {
  settler: [0, 0],
  worker: [1, 0],
  scout: [2, 0],
  explorer: [3, 0],
  warrior: [0, 1],
  spearman: [1, 1],
  swordsman: [2, 1],
  pikeman: [3, 1],
  musketman: [4, 1],
  rifleman: [5, 1],
  slinger: [0, 2],
  archer: [0, 2],
  crossbowman: [1, 2],
  horseman: [2, 2],
  knight: [2, 2],
  tank: [3, 2],
  catapult: [4, 2],
  cannon: [5, 2],
  artillery: [5, 2],
  caravel: [1, 3],
  frigate: [2, 3],
  ironclad: [3, 3],
  battleship: [4, 3],
};

export function getUnitMiniatureSprite(
  unit: UnitState,
  def: UnitDef
): SlicedSprite | null {
  const atlas = spriteAtlas.getAtlas('units');
  if (!atlas) return null;

  if (unit.civId === 'barbarians') {
    if (def.role === 'naval') {
      return atlas.byCoord.get('5,3') || atlas.byCoord.get('0,3') || null;
    }
    if (def.id === 'swordsman' || def.id === 'pikeman' || def.id === 'knight') {
      return atlas.byCoord.get('5,0') || atlas.byCoord.get('4,0') || null;
    }
    return atlas.byCoord.get('4,0') || null;
  }

  const coord = UNIT_COORD_MAP[def.id];
  if (coord) {
    const clampedC = Math.min(coord[0], atlas.cols - 1);
    const clampedR = Math.min(coord[1], atlas.rows - 1);
    const hit = atlas.byCoord.get(`${clampedC},${clampedR}`);
    if (hit) return hit;
  }

  const fallbackByRole: Record<UnitDef['role'], [number, number]> = {
    settler: [0, 0],
    worker: [1, 0],
    scout: [2, 0],
    explorer: [3, 0],
    melee: [1, 1],
    ranged: [0, 2],
    cavalry: [2, 2],
    siege: [4, 2],
    naval: [1, 3],
  };
  const fb = fallbackByRole[def.role] || [0, 1];
  return atlas.byCoord.get(`${Math.min(fb[0], atlas.cols - 1)},${Math.min(fb[1], atlas.rows - 1)}`) || null;
}
