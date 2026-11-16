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
  sh: number
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

/**
 * Strips the bottom isometric soil cliff skirt from a tight-cropped 3D hex block
 * and gently feathers the lower hex diamond perimeter so the 3D trees/hills/mountains/
 * buildings sit seamlessly on the mathematically aligned connected terrain layer.
 */
function buildSeamlessDioramaSprite(raw: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  height: number;
} {
  const w = raw.width;
  const h = raw.height;
  const rctx = raw.getContext('2d', { willReadFrequently: true });
  let detectedCliff = Math.round(w * 0.21);

  if (rctx) {
    const rawData = rctx.getImageData(0, 0, w, h).data;
    const measureSideSpan = (sx: number) => {
      const x = Math.max(0, Math.min(w - 1, sx));
      let topY = -1;
      let botY = -1;
      for (let y = Math.round(h * 0.15); y < h; y++) {
        const a = rawData[(y * w + x) * 4 + 3];
        if (a > 64) {
          if (topY === -1) topY = y;
          botY = y;
        }
      }
      return topY !== -1 && botY > topY ? botY - topY : 0;
    };
    const leftSpan = measureSideSpan(Math.round(w * 0.035));
    const rightSpan = measureSideSpan(Math.round(w * 0.965));
    const avgSpan = (leftSpan + rightSpan) * 0.5;
    if (avgSpan > w * 0.11 && avgSpan < w * 0.34) {
      detectedCliff = Math.round(avgSpan * 0.96);
    }
  }

  const cliffCut = Math.max(8, Math.min(Math.round(w * 0.29), detectedCliff));
  const surfaceBottomY = Math.max(Math.round(h * 0.52), h - cliffCut);
  const outH = Math.min(h, surfaceBottomY + 1);
  // Mathematical semi-height of the pointy-top isometric hex diamond
  const hexSemiH = (w / Math.sqrt(3)) * 0.56;
  const hexCenterY = outH - hexSemiH;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = outH;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { canvas: raw, height: h };

  ctx.drawImage(raw, 0, 0, w, outH, 0, 0, w, outH);
  const imgData = ctx.getImageData(0, 0, w, outH);
  const data = imgData.data;

  const halfW = w * 0.5;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a === 0) continue;

      // Normalized offset from top hex diamond center
      const nx = Math.abs(x - halfW) / Math.max(1, halfW); // 0 at center, 1 at left/right corner
      // Bottom V-edge of the isometric hex diamond: at nx=0 -> y = outH - 1; at nx=1 -> y = outH - 1 - hexSemiH * 0.5
      const bottomHexEdgeY = outH - 1 - nx * (hexSemiH * 0.52);

      if (y > bottomHexEdgeY) {
        // Below the top surface's bottom rim -> soil cliff wall -> erase cleanly!
        data[idx + 3] = 0;
        continue;
      }

      // Softly feather the lower & side hex perimeter so adjacent tile terrains connect smoothly
      // over the cross-blended ground plane with zero hard block borders.
      const dy = y - hexCenterY;
      const hexDist = Math.max(nx, nx * 0.5 + Math.abs(dy) / Math.max(1, hexSemiH));
      if (dy > -hexSemiH * 0.28 && hexDist > 0.72) {
        const edgeFade = Math.max(0, Math.min(1, (0.97 - hexDist) / 0.25));
        data[idx + 3] = Math.round(a * edgeFade * edgeFade);
      } else if (hexDist > 0.88 && y > hexCenterY - hexSemiH * 0.75) {
        const rimFade = Math.max(0, Math.min(1, (0.99 - hexDist) / 0.11));
        data[idx + 3] = Math.round(a * rimFade);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas: out, height: outH };
}

function sliceGridSheet(
  srcCanvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  buildDiorama: boolean
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
      const cropped = chromaKeyAndTightCrop(srcCanvas, sx, sy, sw, sh);
      if (cropped) {
        const diorama = buildDiorama ? buildSeamlessDioramaSprite(cropped) : null;
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
      const cropped = chromaKeyAndTightCrop(srcCanvas, sx, sy, sw, sh);
      if (cropped) {
        const diorama = buildSeamlessDioramaSprite(cropped);
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
      : sliceGridSheet(srcCanvas, meta.cols, meta.rows, isTileOrInfra);

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
