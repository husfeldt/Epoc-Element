import { HexTile, TemperatureZone } from '../types/game';
import { fbm2D, hash2D, ridgedNoise2D, worley2D } from './noise';

export type GroundTextureKey =
  | 'deep_ocean'
  | 'shallow_coast'
  | 'lake'
  | 'desert'
  | 'arid_steppe'
  | 'savanna'
  | 'plains'
  | 'grassland'
  | 'tundra'
  | 'snow'
  | 'marsh';

export type FeatureSpriteKind =
  | 'mountain_ridge'
  | 'mountain_waterfall'
  | 'pine_forest'
  | 'deciduous_woods'
  | 'palm_grove'
  | 'savanna_acacia'
  | 'jungle_canopy'
  | 'desert_dunes'
  | 'oasis'
  | 'rock_outcrops'
  | 'atoll_islet'
  | 'marsh_reeds';

export interface ProceduralSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  anchorY: number; // fraction from top where ground contact sits
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function mixRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [
    c1[0] + (c2[0] - c1[0]) * k,
    c1[1] + (c2[1] - c1[1]) * k,
    c1[2] + (c2[2] - c1[2]) * k,
  ];
}

class ProceduralAtlasManager {
  private initialized = false;
  private featureSprites = new Map<string, ProceduralSprite[]>();

  ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    this.buildFeatureAtlas();
  }

  getFeatureSprite(
    kind: FeatureSpriteKind,
    variantSeed: number,
    climate: TemperatureZone = 'temperate'
  ): ProceduralSprite | null {
    this.ensureInitialized();
    const climateKey = `${kind}:${climate}`;
    const list =
      this.featureSprites.get(climateKey) ||
      this.featureSprites.get(`${kind}:temperate`) ||
      this.featureSprites.get(kind);
    if (!list || list.length === 0) return null;
    const idx = Math.abs(variantSeed) % list.length;
    return list[idx];
  }

  private addSprite(key: string, sprite: ProceduralSprite) {
    if (!this.featureSprites.has(key)) this.featureSprites.set(key, []);
    this.featureSprites.get(key)!.push(sprite);
  }

  private buildFeatureAtlas() {
    const climates: TemperatureZone[] = ['temperate', 'arid', 'tropical', 'arctic'];

    // 1. Eroded Geological Mountain Ranges (4 variants per climate + waterfall variants)
    for (const clim of climates) {
      for (let v = 0; v < 4; v++) {
        this.addSprite(`mountain_ridge:${clim}`, this.paintErodedMountain(clim, v, false));
      }
      this.addSprite(`mountain_waterfall:${clim}`, this.paintErodedMountain(clim, 0, true));
      this.addSprite(`mountain_waterfall:${clim}`, this.paintErodedMountain(clim, 2, true));
    }

    // 2. Fine-Scale Multi-Layered Organic Forest Canopies (5 variants each)
    for (let v = 0; v < 5; v++) {
      this.addSprite('pine_forest:temperate', this.paintOrganicPineForest(v, false));
      this.addSprite('pine_forest:arctic', this.paintOrganicPineForest(v, true));
      this.addSprite('deciduous_woods:temperate', this.paintOrganicDeciduousWoods(v));
      this.addSprite('jungle_canopy:tropical', this.paintOrganicJungleCanopy(v));
    }

    for (let v = 0; v < 4; v++) {
      this.addSprite('palm_grove:arid', this.paintPalmGrove(v));
      this.addSprite('palm_grove:tropical', this.paintPalmGrove(v));
      this.addSprite('savanna_acacia:arid', this.paintSavannaAcacia(v));
      this.addSprite('savanna_acacia:temperate', this.paintSavannaAcacia(v));
      this.addSprite('desert_dunes:arid', this.paintErodedDesertDunes(v));
    }

    for (let v = 0; v < 2; v++) {
      this.addSprite('oasis:arid', this.paintNaturalOasis(v));
      this.addSprite('atoll_islet:tropical', this.paintNaturalAtoll(v));
      this.addSprite('atoll_islet:ocean', this.paintNaturalAtoll(v));
    }

    for (let v = 0; v < 3; v++) {
      this.addSprite('rock_outcrops:temperate', this.paintRockOutcrops(v, 'temperate'));
      this.addSprite('rock_outcrops:arid', this.paintRockOutcrops(v, 'arid'));
      this.addSprite('marsh_reeds:temperate', this.paintMarshReeds(v));
      this.addSprite('marsh_reeds:tropical', this.paintMarshReeds(v));
    }
  }

  /**
   * Pixel-level ridged-erosion heightfield mountain synthesis:
   * Jagged multi-ridge crests, radial erosion gullies, stratified rock faces,
   * scree/talus skirts, natural crevice snow accumulation, and top-left sunlight normals.
   */
  private paintErodedMountain(
    climate: TemperatureZone,
    variant: number,
    hasWaterfall: boolean
  ): ProceduralSprite {
    const w = 176;
    const h = 148;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const baseCY = h * 0.68;
    const baseCX = w * 0.5;
    const seed = 4100 + variant * 73 + (climate === 'arid' ? 11 : climate === 'tropical' ? 23 : 0);

    // 2-3 sub-peaks per range segment so mountains form organic ridges
    const peaks =
      variant % 2 === 0
        ? [
            { x: baseCX - 28, y: baseCY + 4, rx: 38, ry: 22, pow: 0.68 },
            { x: baseCX + 26, y: baseCY + 2, rx: 36, ry: 21, pow: 0.72 },
            { x: baseCX - 2, y: baseCY - 6, rx: 48, ry: 28, pow: 1.0 },
          ]
        : [
            { x: baseCX + 28, y: baseCY + 5, rx: 38, ry: 22, pow: 0.65 },
            { x: baseCX - 22, y: baseCY - 3, rx: 44, ry: 25, pow: 0.88 },
            { x: baseCX + 8, y: baseCY - 5, rx: 46, ry: 27, pow: 0.96 },
          ];

    // Build 2D elevation field
    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let baseH = 0;
        for (const p of peaks) {
          const dx = (x - p.x) / p.rx;
          const dy = (y - p.y) / p.ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 1.15) {
            const cone = Math.max(0, 1 - d / 1.15);
            baseH = Math.max(baseH, cone * p.pow);
          }
        }
        if (baseH <= 0.01) continue;

        // Ridged multifractal + radial erosion gullies
        const rNoise = ridgedNoise2D(x * 0.048, y * 0.056, seed, 4);
        const gully = fbm2D(x * 0.11, y * 0.11, seed + 55, 3);
        const hVal = baseH * (0.58 + 0.56 * rNoise - 0.14 * (1 - gully));
        elev[y * w + x] = Math.max(0, hVal);
      }
    }

    // Rock & scree palettes (naturalistic, slightly desaturated satellite earth tones)
    const rockLit: [number, number, number] =
      climate === 'arid'
        ? [168, 118, 82]
        : climate === 'tropical'
          ? [94, 104, 84]
          : climate === 'arctic'
            ? [144, 152, 160]
            : [132, 128, 120];
    const rockDark: [number, number, number] =
      climate === 'arid'
        ? [88, 56, 42]
        : climate === 'tropical'
          ? [42, 52, 44]
          : climate === 'arctic'
            ? [62, 72, 86]
            : [58, 62, 70];
    const screeCol: [number, number, number] =
      climate === 'arid'
        ? [148, 122, 88]
        : climate === 'tropical'
          ? [68, 88, 52]
          : climate === 'arctic'
            ? [116, 124, 130]
            : [96, 102, 76];
    const snowLit: [number, number, number] = [232, 238, 244];
    const snowShadow: [number, number, number] = [148, 168, 192];

    const lx = -0.68;
    const ly = -0.56;
    const lz = 0.48;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const e = elev[idx];
        if (e <= 0.02) continue;

        // Vertical displacement in 2.5D projection: lift pixels upward by elevation!
        // Compute central-difference surface normal
        const gx = (elev[idx + 1] - elev[idx - 1]) * 18.0;
        const gy = (elev[idx + w] - elev[idx - w]) * 18.0;
        const nLen = Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx / nLen;
        const ny = -gy / nLen;
        const nz = 1 / nLen;

        const sunDot = Math.max(0, Math.min(1, nx * lx + ny * ly + nz * lz));
        const slope = Math.sqrt(gx * gx + gy * gy);

        // Stratified rock banding
        const strata = Math.sin(e * 28 + fbm2D(x * 0.08, y * 0.08, seed + 9, 2) * 3.0) * 0.5 + 0.5;
        let rgb = mixRgb(rockDark, rockLit, sunDot * 0.78 + strata * 0.22);

        // Talus / scree & vegetation skirt near base
        if (e < 0.34) {
          const skirtT = Math.max(0, Math.min(1, (0.34 - e) / 0.26));
          rgb = mixRgb(rgb, screeCol, skirtT * 0.85);
        }

        // Natural snow accumulation in high-altitude crevices & sheltered ridges
        const snowThresh = climate === 'arctic' ? 0.36 : climate === 'arid' ? 0.82 : 0.56;
        const creviceBonus = (1 - Math.min(1, slope * 0.35)) * 0.14;
        if (e + creviceBonus > snowThresh) {
          const snowAmt = Math.min(1, (e + creviceBonus - snowThresh) * 3.4);
          const sCol = mixRgb(snowShadow, snowLit, sunDot * 0.85 + 0.15);
          rgb = mixRgb(rgb, sCol, snowAmt);
        }

        // Soft crevice ambient occlusion
        const ao = 0.72 + 0.28 * Math.min(1, e * 1.8);
        rgb = [rgb[0] * ao, rgb[1] * ao, rgb[2] * ao];

        // Project upward for 2.5D relief
        const py = Math.max(0, Math.min(h - 1, Math.round(y - e * 68)));
        const pIdx = (py * w + x) * 4;
        const alpha = e < 0.12 ? Math.round((e / 0.12) * 255) : 255;
        if (alpha > data[pIdx + 3] || py < y) {
          data[pIdx] = clampByte(rgb[0]);
          data[pIdx + 1] = clampByte(rgb[1]);
          data[pIdx + 2] = clampByte(rgb[2]);
          data[pIdx + 3] = Math.max(data[pIdx + 3], alpha);
        }
      }
    }

    // Paint into canvas with grounded contact shadow underneath
    const tmp = makeCanvas(w, h);
    tmp.getContext('2d')!.putImageData(img, 0, 0);

    const shad = ctx.createRadialGradient(baseCX + 8, baseCY + 8, 12, baseCX + 8, baseCY + 8, w * 0.44);
    shad.addColorStop(0, 'rgba(14, 18, 26, 0.36)');
    shad.addColorStop(0.65, 'rgba(14, 18, 26, 0.12)');
    shad.addColorStop(1, 'rgba(14, 18, 26, 0)');
    ctx.fillStyle = shad;
    ctx.beginPath();
    ctx.ellipse(baseCX + 8, baseCY + 8, w * 0.44, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(tmp, 0, 0);

    // Optional eroded canyon waterfall stream
    if (hasWaterfall) {
      ctx.save();
      const wfGrad = ctx.createLinearGradient(baseCX - 2, baseCY - 52, baseCX + 3, baseCY + 8);
      wfGrad.addColorStop(0, 'rgba(218, 236, 245, 0.85)');
      wfGrad.addColorStop(0.6, 'rgba(148, 198, 218, 0.78)');
      wfGrad.addColorStop(1, 'rgba(195, 224, 235, 0.35)');
      ctx.strokeStyle = wfGrad;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseCX - 2, baseCY - 48);
      ctx.quadraticCurveTo(baseCX + 3, baseCY - 20, baseCX + 2, baseCY + 6);
      ctx.stroke();
      ctx.restore();
    }

    return { canvas, width: w, height: h, anchorY: 0.74 };
  }

  /**
   * Fine-scale organic foliage crown stippling (replaces lollipop circles & outlines).
   */
  private paintFoliageCrownStipple(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    darkRgb: [number, number, number],
    midRgb: [number, number, number],
    litRgb: [number, number, number],
    seed: number
  ) {
    // Grounded dappled forest-floor shadow
    ctx.fillStyle = 'rgba(16, 22, 16, 0.24)';
    ctx.beginPath();
    ctx.ellipse(cx + 2.2, cy + radius * 0.75, radius * 1.05, radius * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-pass irregular fractal leaf-cluster stipples (no hard circles or outlines)
    const clusters = 11;
    for (let i = 0; i < clusters; i++) {
      const ang = hash2D(i, 1, seed) * Math.PI * 2;
      const dist = Math.sqrt(hash2D(i, 2, seed)) * radius * 0.72;
      const lx = cx + Math.cos(ang) * dist;
      const ly = cy + Math.sin(ang) * dist * 0.82;
      const lr = radius * (0.28 + hash2D(i, 3, seed) * 0.28);

      // Top-left sunlight factor
      const lightT = Math.max(0, Math.min(1, 0.55 - (lx - cx) / (radius * 1.4) - (ly - cy) / (radius * 1.4)));
      const col =
        lightT < 0.45
          ? mixRgb(darkRgb, midRgb, lightT / 0.45)
          : mixRgb(midRgb, litRgb, (lightT - 0.45) / 0.55);

      ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0.88)`;
      ctx.beginPath();
      ctx.ellipse(
        lx,
        ly,
        lr * 1.15,
        lr * 0.88,
        hash2D(i, 4, seed) * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  private paintOrganicDeciduousWoods(variant: number): ProceduralSprite {
    const w = 152;
    const h = 108;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.72;

    // 32 fine-scale miniature trees (~35% smaller crowns, high density)
    const count = 30 + (variant % 5) * 2;
    const pts: Array<{ x: number; y: number; r: number; hue: number }> = [];
    for (let i = 0; i < count; i++) {
      const u = hash2D(i, variant, 401);
      const v = hash2D(i, variant, 402);
      pts.push({
        x: w * 0.16 + u * w * 0.68,
        y: baseY - 26 + v * 34,
        r: 4.4 + hash2D(i, variant, 403) * 2.6,
        hue: hash2D(i, variant, 404),
      });
    }
    pts.sort((a, b) => a.y - b.y);

    for (let i = 0; i < pts.length; i++) {
      const t = pts[i];
      const dark: [number, number, number] = [30, 48, 28];
      const mid: [number, number, number] =
        t.hue > 0.72 ? [76, 94, 44] : t.hue < 0.25 ? [48, 72, 38] : [60, 84, 42];
      const lit: [number, number, number] =
        t.hue > 0.72 ? [116, 128, 62] : [92, 114, 58];
      this.paintFoliageCrownStipple(ctx, t.x, t.y - t.r * 0.7, t.r, dark, mid, lit, i * 17 + variant);
    }

    return { canvas, width: w, height: h, anchorY: 0.72 };
  }

  private paintOrganicPineForest(variant: number, snowy: boolean): ProceduralSprite {
    const w = 152;
    const h = 110;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.72;

    const count = 34 + (variant % 4) * 2;
    const pts: Array<{ x: number; y: number; s: number }> = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: w * 0.16 + hash2D(i, variant, 301) * w * 0.68,
        y: baseY - 26 + hash2D(i, variant, 302) * 34,
        s: 0.55 + hash2D(i, variant, 303) * 0.32,
      });
    }
    pts.sort((a, b) => a.y - b.y);

    for (let i = 0; i < pts.length; i++) {
      const t = pts[i];
      // Dappled shadow
      ctx.fillStyle = 'rgba(14, 20, 18, 0.26)';
      ctx.beginPath();
      ctx.ellipse(t.x + 2, t.y + 1, 5.5 * t.s, 2.5 * t.s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Irregular multi-tuft conifer silhouette (no flat triangle edges)
      for (let tier = 0; tier < 3; tier++) {
        const ty = t.y - (3.5 + tier * 4.5) * t.s;
        const rx = (6.2 - tier * 1.4) * t.s;
        const ry = (4.2 - tier * 0.5) * t.s;
        const dark: [number, number, number] = snowy ? [34, 52, 46] : [26, 46, 30];
        const mid: [number, number, number] = snowy ? [58, 82, 70] : [42, 68, 42];
        const lit: [number, number, number] = snowy ? [168, 186, 194] : [74, 102, 58];
        this.paintFoliageCrownStipple(ctx, t.x, ty, (rx + ry) * 0.55, dark, mid, lit, i * 31 + tier);
      }
    }

    return { canvas, width: w, height: h, anchorY: 0.72 };
  }

  private paintOrganicJungleCanopy(variant: number): ProceduralSprite {
    const w = 156;
    const h = 112;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.72;

    const count = 36 + (variant % 3) * 3;
    const pts: Array<{ x: number; y: number; r: number; hue: number }> = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: w * 0.14 + hash2D(i, variant, 501) * w * 0.72,
        y: baseY - 28 + hash2D(i, variant, 502) * 36,
        r: 4.8 + hash2D(i, variant, 503) * 2.8,
        hue: hash2D(i, variant, 504),
      });
    }
    pts.sort((a, b) => a.y - b.y);

    for (let i = 0; i < pts.length; i++) {
      const t = pts[i];
      const dark: [number, number, number] = [18, 42, 24];
      const mid: [number, number, number] = t.hue > 0.5 ? [40, 78, 42] : [34, 68, 38];
      const lit: [number, number, number] = [74, 114, 56];
      this.paintFoliageCrownStipple(ctx, t.x, t.y - t.r * 0.75, t.r, dark, mid, lit, i * 23 + variant);
    }

    return { canvas, width: w, height: h, anchorY: 0.72 };
  }

  private paintPalmGrove(variant: number): ProceduralSprite {
    const w = 138;
    const h = 100;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.74;
    for (let i = 0; i < 6; i++) {
      const px = w * 0.28 + hash2D(i, variant, 601) * w * 0.44;
      const py = baseY - 14 + hash2D(i, variant, 602) * 18;
      this.drawFinePalm(ctx, px, py, 0.58 + hash2D(i, variant, 603) * 0.25);
    }
    return { canvas, width: w, height: h, anchorY: 0.74 };
  }

  private drawFinePalm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = 'rgba(20, 22, 18, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 1, 5.5 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6c523c';
    ctx.lineWidth = 2.0 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2.5 * s, y - 9 * s, x + 1.5 * s, y - 17 * s);
    ctx.stroke();

    const topX = x + 1.5 * s;
    const topY = y - 17 * s;
    for (let f = 0; f < 5; f++) {
      const ang = -Math.PI + (f / 4) * Math.PI * 1.4 - 0.2;
      ctx.strokeStyle = f % 2 === 0 ? '#5c8240' : '#3d612d';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(ang) * 6 * s,
        topY + Math.sin(ang) * 3.5 * s - 1.5 * s,
        topX + Math.cos(ang) * 10 * s,
        topY + Math.sin(ang) * 6 * s + 2.5 * s
      );
      ctx.stroke();
    }
  }

  private paintSavannaAcacia(variant: number): ProceduralSprite {
    const w = 138;
    const h = 94;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.74;

    for (let i = 0; i < 6; i++) {
      const x = w * 0.24 + hash2D(i, variant, 701) * w * 0.52;
      const y = baseY - 12 + hash2D(i, variant, 702) * 16;
      ctx.fillStyle = 'rgba(26, 24, 16, 0.20)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 1, 7.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#5c4632';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1, y - 9);
      ctx.stroke();

      this.paintFoliageCrownStipple(
        ctx,
        x - 1,
        y - 10,
        5.8,
        [54, 68, 32],
        [82, 96, 46],
        [114, 122, 62],
        i * 19 + variant
      );
    }
    return { canvas, width: w, height: h, anchorY: 0.74 };
  }

  /**
   * Pixel-synthesized wind-sculpted desert dunes with directional normal shading.
   */
  private paintErodedDesertDunes(variant: number): ProceduralSprite {
    const w = 152;
    const h = 92;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const seed = 6200 + variant * 41;

    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - w * 0.5) / (w * 0.42);
        const dy = (y - h * 0.58) / (h * 0.34);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        const mask = (1 - d * d) ** 1.5;
        const ridge = ridgedNoise2D(x * 0.036 + y * 0.015, y * 0.044, seed, 3);
        const ripple = Math.sin(x * 0.22 + y * 0.14 + fbm2D(x * 0.05, y * 0.05, seed, 2) * 3) * 0.06;
        elev[y * w + x] = mask * (ridge + ripple);
      }
    }

    const sandDark: [number, number, number] = [148, 114, 72];
    const sandMid: [number, number, number] = [194, 158, 106];
    const sandLit: [number, number, number] = [224, 192, 138];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const e = elev[idx];
        if (e <= 0.03) continue;
        const gx = (elev[idx + 1] - elev[idx - 1]) * 14.0;
        const gy = (elev[idx + w] - elev[idx - w]) * 14.0;
        const nLen = Math.sqrt(gx * gx + gy * gy + 1);
        const sunDot = Math.max(0, Math.min(1, (-gx * -0.68 - gy * -0.56 + 0.48) / nLen));
        const rgb =
          sunDot < 0.5
            ? mixRgb(sandDark, sandMid, sunDot * 2)
            : mixRgb(sandMid, sandLit, (sunDot - 0.5) * 2);

        const py = Math.max(0, Math.min(h - 1, Math.round(y - e * 14)));
        const pIdx = (py * w + x) * 4;
        const alpha = Math.min(230, Math.round(Math.min(1, e * 3.5) * 225));
        data[pIdx] = clampByte(rgb[0]);
        data[pIdx + 1] = clampByte(rgb[1]);
        data[pIdx + 2] = clampByte(rgb[2]);
        data[pIdx + 3] = Math.max(data[pIdx + 3], alpha);
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, width: w, height: h, anchorY: 0.70 };
  }

  private paintNaturalOasis(variant: number): ProceduralSprite {
    const w = 152;
    const h = 104;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const cy = h * 0.64;

    const grass = ctx.createRadialGradient(w * 0.5, cy, 6, w * 0.5, cy, 42);
    grass.addColorStop(0, 'rgba(62, 108, 56, 0.85)');
    grass.addColorStop(0.6, 'rgba(92, 114, 58, 0.45)');
    grass.addColorStop(1, 'rgba(92, 114, 58, 0)');
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cy, 42, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    const pool = ctx.createRadialGradient(w * 0.48, cy - 1, 2, w * 0.5, cy, 22);
    pool.addColorStop(0, '#5a9ea4');
    pool.addColorStop(0.75, '#2b6b73');
    pool.addColorStop(1, '#1c4a52');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cy, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    const angles = [0.2, 1.1, 2.0, 2.9, 3.8, 4.7, 5.6];
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i] + variant * 0.3;
      this.drawFinePalm(ctx, w * 0.5 + Math.cos(a) * 28, cy + Math.sin(a) * 13, 0.65);
    }

    return { canvas, width: w, height: h, anchorY: 0.72 };
  }

  private paintRockOutcrops(variant: number, climate: TemperatureZone): ProceduralSprite {
    const w = 132;
    const h = 84;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.74;

    const lit = climate === 'arid' ? '#a67b56' : '#7b848c';
    const dark = climate === 'arid' ? '#5c3f2c' : '#434b54';

    for (let i = 0; i < 6; i++) {
      const rx = w * 0.28 + hash2D(i, variant, 801) * w * 0.44;
      const ry = baseY - 10 + hash2D(i, variant, 802) * 14;
      const rad = 4.5 + hash2D(i, variant, 803) * 5.0;
      ctx.fillStyle = 'rgba(15, 20, 26, 0.22)';
      ctx.beginPath();
      ctx.ellipse(rx + 2, ry + 1.5, rad * 1.1, rad * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createLinearGradient(rx - rad, ry - rad, rx + rad, ry);
      g.addColorStop(0, lit);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx - rad, ry + 1.5);
      ctx.lineTo(rx - rad * 0.55, ry - rad * 0.75);
      ctx.lineTo(rx + rad * 0.35, ry - rad * 0.85);
      ctx.lineTo(rx + rad * 0.9, ry - rad * 0.2);
      ctx.lineTo(rx + rad, ry + 1.5);
      ctx.closePath();
      ctx.fill();
    }

    return { canvas, width: w, height: h, anchorY: 0.74 };
  }

  private paintNaturalAtoll(variant: number): ProceduralSprite {
    const w = 150;
    const h = 96;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const cy = h * 0.62;

    const lag = ctx.createRadialGradient(w * 0.5, cy, 4, w * 0.5, cy, 38);
    lag.addColorStop(0, 'rgba(68, 146, 152, 0.65)');
    lag.addColorStop(0.65, 'rgba(42, 108, 122, 0.35)');
    lag.addColorStop(1, 'rgba(42, 108, 122, 0)');
    ctx.fillStyle = lag;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cy, 38, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(216, 200, 162, 0.92)';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cy, 22, 10, 0, 0.25 + variant * 0.4, Math.PI * 1.55 + variant * 0.4);
    ctx.stroke();

    this.drawFinePalm(ctx, w * 0.38, cy - 3, 0.52);
    this.drawFinePalm(ctx, w * 0.54, cy - 8, 0.48);

    return { canvas, width: w, height: h, anchorY: 0.68 };
  }

  private paintMarshReeds(variant: number): ProceduralSprite {
    const w = 140;
    const h = 88;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    const baseY = h * 0.72;

    ctx.fillStyle = 'rgba(34, 78, 76, 0.38)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, baseY - 6, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 20; i++) {
      const rx = w * 0.24 + hash2D(i, variant, 1001) * w * 0.52;
      const ry = baseY - 14 + hash2D(i, variant, 1002) * 18;
      ctx.strokeStyle = i % 2 === 0 ? '#3b5e30' : '#586e34';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (hash2D(i, variant, 1003) - 0.5) * 3.5, ry - 7);
      ctx.stroke();
    }

    return { canvas, width: w, height: h, anchorY: 0.72 };
  }
}

export const proceduralAtlas = new ProceduralAtlasManager();

export function sampleMicroTexture(x: number, y: number, seed: number): number {
  const n = fbm2D(x * 0.14, y * 0.14, seed, 3);
  const w = worley2D(x * 0.18, y * 0.18, seed + 77);
  return n * 0.65 + (1 - w) * 0.35;
}

export function resolveGroundTextureKey(tile: HexTile): GroundTextureKey {
  if (tile.terrainSubType) {
    switch (tile.terrainSubType) {
      case 'deep_ocean':
        return 'deep_ocean';
      case 'shallow_coast':
        return 'shallow_coast';
      case 'lake':
        return 'lake';
      case 'desert':
        return 'desert';
      case 'arid_steppe':
        return 'arid_steppe';
      case 'savanna':
        return 'savanna';
      case 'grassland':
      case 'lush_forest':
      case 'jungle':
        return 'grassland';
      case 'tundra':
      case 'boreal_taiga':
        return 'tundra';
      case 'snow':
        return 'snow';
      case 'marsh':
        return 'marsh';
      case 'foothills':
      case 'hills':
      case 'mountain_peak':
        if (tile.temperature === 'arid') return 'arid_steppe';
        if (tile.temperature === 'arctic') return 'tundra';
        return tile.temperature === 'tropical' ? 'grassland' : 'plains';
      default:
        return 'plains';
    }
  }

  if (tile.biome === 'ocean') return 'deep_ocean';
  if (tile.biome === 'coast') return tile.isLake ? 'lake' : 'shallow_coast';
  if (tile.biome === 'desert') return 'desert';
  if (tile.biome === 'tundra') return 'tundra';
  if (tile.biome === 'forest') return tile.temperature === 'arctic' ? 'tundra' : 'grassland';
  if (tile.biome === 'hills' || tile.biome === 'mountain') {
    if (tile.temperature === 'arid') return 'arid_steppe';
    if (tile.temperature === 'arctic') return 'tundra';
    return 'plains';
  }
  return tile.temperature === 'arid' ? 'savanna' : 'grassland';
}
