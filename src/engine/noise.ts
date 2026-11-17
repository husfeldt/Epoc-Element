/**
 * Deterministic 2D gradient / value noise & multi-octave fBm utilities
 * for climate-driven world generation, ground splatting, and procedural textures.
 */

export function hash2D(ix: number, iy: number, seed = 1337): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function grad2D(ix: number, iy: number, dx: number, dy: number, seed: number): number {
  const h = Math.floor(hash2D(ix, iy, seed) * 8);
  switch (h) {
    case 0: return dx + dy;
    case 1: return -dx + dy;
    case 2: return dx - dy;
    case 3: return -dx - dy;
    case 4: return dx * 1.4142;
    case 5: return -dx * 1.4142;
    case 6: return dy * 1.4142;
    default: return -dy * 1.4142;
  }
}

/**
 * Smooth 2D Perlin-style gradient noise returning approximately [-1, 1].
 */
export function noise2D(x: number, y: number, seed = 1337): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = x - x0;
  const sy = y - y0;
  const u = fade(sx);
  const v = fade(sy);

  const n00 = grad2D(x0, y0, sx, sy, seed);
  const n10 = grad2D(x1, y0, sx - 1, sy, seed);
  const n01 = grad2D(x0, y1, sx, sy - 1, seed);
  const n11 = grad2D(x1, y1, sx - 1, sy - 1, seed);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 0.78;
}

/**
 * Multi-octave Fractal Brownian Motion in [0, 1].
 */
export function fbm2D(
  x: number,
  y: number,
  seed = 1337,
  octaves = 4,
  lacunarity = 2.05,
  gain = 0.5
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += amp * (noise2D(x * freq, y * freq, seed + i * 97) * 0.5 + 0.5);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }

  return Math.max(0, Math.min(1, sum / Math.max(1e-6, norm)));
}

/**
 * Ridged multifractal noise in [0, 1] for connected tectonic mountain chains.
 */
export function ridgedNoise2D(
  x: number,
  y: number,
  seed = 4099,
  octaves = 3
): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    const n = noise2D(x * freq, y * freq, seed + i * 131);
    const ridge = 1 - Math.abs(n);
    sum += amp * ridge * ridge;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }

  return Math.max(0, Math.min(1, sum / Math.max(1e-6, norm)));
}

/**
 * Seamless tileable 2D value/gradient noise on [0, period) x [0, period) for OffscreenCanvas textures.
 */
export function tileableNoise2D(
  x: number,
  y: number,
  period: number,
  seed = 7919
): number {
  const x0 = ((Math.floor(x) % period) + period) % period;
  const y0 = ((Math.floor(y) % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const u = fade(fx);
  const v = fade(fy);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

export function tileableFbm2D(
  u: number,
  v: number,
  basePeriod: number,
  seed = 7919,
  octaves = 4
): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = basePeriod;

  for (let i = 0; i < octaves; i++) {
    sum += amp * tileableNoise2D(u * p, v * p, p, seed + i * 61);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / Math.max(1e-6, norm);
}

/**
 * Fast 2D Worley (cellular) noise returning [0, 1] distance to nearest feature point.
 */
export function worley2D(x: number, y: number, seed = 5153): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let minDist2 = 4.0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const px = cx + hash2D(cx, cy, seed);
      const py = cy + hash2D(cx, cy, seed + 17);
      const ddx = px - x;
      const ddy = py - y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < minDist2) minDist2 = d2;
    }
  }

  return Math.min(1, Math.sqrt(minDist2));
}
