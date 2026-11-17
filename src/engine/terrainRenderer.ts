import { HEX_SIZE, MapViewMode, axialToPixel, tileKey } from './hexMath';
import {
  FeatureSpriteKind,
  ProceduralSprite,
  proceduralAtlas,
} from './proceduralAtlas';
import { BakedWorldTerrain, HEX_EDGE_OFFSETS } from './worldTerrainBaker';
import { GameState, HexTile } from '../types/game';

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

/**
 * Draws the pre-baked world terrain buffer (continuous heightmap, normal-shaded hill relief,
 * earth-tone micro-textures, water bathymetry, underwater reefs, coastlines, spline rivers,
 * and subtle hex grid) in ONE fast drawImage call, then covers unexplored hexes with
 * cartographic parchment and adds subtle animated water shimmer.
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

  // Subtle animated water shimmer & surf glint on explored water tiles
  ctx.save();
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const item of visibleList) {
    if (!item.explored) continue;
    const { tile, px, py } = item;
    if (tile.biome !== 'ocean' && tile.biome !== 'coast') continue;

    const phase = timeSec * 1.6 + tile.q * 0.9 + tile.r * 1.3;
    const alpha = 0.05 + 0.045 * Math.sin(phase);
    ctx.strokeStyle =
      tile.biome === 'coast'
        ? `rgba(195, 226, 232, ${alpha * 1.3})`
        : `rgba(140, 184, 212, ${alpha})`;
    const wx = px + Math.sin(phase * 0.7) * 4;
    const wy = py + Math.cos(phase * 0.5) * 1.8 * yScale;
    ctx.beginPath();
    ctx.moveTo(wx - 9, wy);
    ctx.quadraticCurveTo(wx, wy - 1.6 * yScale, wx + 9, wy);
    ctx.stroke();
  }
  ctx.restore();

  // Mask unexplored tiles cleanly with warm antique cartographic parchment
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
 * PHASE 3:
 * Collects Y-sorted 2.5D procedural features (eroded mountain ridges, fine-scale organic forests,
 * eroded desert dunes, oases, atolls, marshes) + neighbor-aware multi-hex bridging clusters.
 * Note: Hill domes are completely removed—hills are rendered as continuous normal-shaded relief
 * in the baked terrain buffer!
 */
export function collectTerrainFeatureDrawables(
  state: GameState,
  visibleList: VisibleTileItem[],
  viewMode: MapViewMode,
  hexSize: number,
  yScale: number,
  cityTiles: Set<string>
): YSortedDrawable[] {
  proceduralAtlas.ensureInitialized();
  const out: YSortedDrawable[] = [];
  const isIso = viewMode === 'isometric';
  const targetW = isIso ? hexSize * 1.92 : hexSize * 1.45;
  const bridgedPairs = new Set<string>();

  for (const item of visibleList) {
    if (!item.explored) continue;
    const { tile, px, py } = item;
    const tk = tileKey(tile.q, tile.r);
    if (cityTiles.has(tk)) continue;

    const variant = Math.abs(tile.q * 73856093 ^ tile.r * 19349663);

    // Water landmarks: Coral Atoll islets only (submerged reefs are baked into water bathymetry)
    if (tile.biome === 'coast') {
      if (tile.clusterType === 'coral_lagoon' && tile.clusterRole === 'center') {
        const sprite = proceduralAtlas.getFeatureSprite('atoll_islet', variant, 'tropical');
        if (sprite) {
          out.push(makeSpriteDrawable(sprite, px, py, targetW * 0.86, yScale, py));
        }
      } else if (tile.shoreline === 'coastal_swamp' && tile.clusterRole === 'center') {
        const sprite = proceduralAtlas.getFeatureSprite('marsh_reeds', variant, 'tropical');
        if (sprite) {
          out.push(makeSpriteDrawable(sprite, px, py, targetW * 0.85, yScale, py));
        }
      }
      continue;
    }

    if (tile.biome === 'ocean' || tile.biome === 'hills') {
      // Hills & Foothills use continuous normal-shaded heightfield relief (no stamped dome sprites!)
      continue;
    }

    let kind: FeatureSpriteKind | null = null;
    let widthScale = 1.0;

    if (tile.biome === 'mountain') {
      const hasWaterfall = tile.hasRiver || variant % 7 === 0;
      kind = hasWaterfall ? 'mountain_waterfall' : 'mountain_ridge';
      widthScale = 1.15;
    } else if (tile.biome === 'forest') {
      if (tile.temperature === 'tropical') kind = 'jungle_canopy';
      else if (tile.temperature === 'arctic' || tile.terrainSubType === 'boreal_taiga')
        kind = 'pine_forest';
      else kind = variant % 3 === 0 ? 'pine_forest' : 'deciduous_woods';
      widthScale = 1.04;
    } else if (tile.biome === 'desert') {
      if (tile.clusterType === 'oasis' && tile.clusterRole === 'center') {
        kind = 'oasis';
        widthScale = 1.05;
      } else {
        kind = 'desert_dunes';
        widthScale = 0.96;
      }
    } else if (tile.biome === 'plains') {
      if (tile.terrainSubType === 'marsh' || tile.shoreline === 'coastal_swamp') {
        kind = 'marsh_reeds';
        widthScale = 0.90;
      } else if (tile.terrainSubType === 'savanna' || tile.temperature === 'arid') {
        kind = 'savanna_acacia';
        widthScale = 0.92;
      } else if (tile.shoreline === 'rocky_shore') {
        kind = 'rock_outcrops';
        widthScale = 0.85;
      }
    } else if (tile.biome === 'tundra') {
      if (variant % 3 === 0) {
        kind = 'rock_outcrops';
        widthScale = 0.82;
      }
    }

    if (kind) {
      const sp = proceduralAtlas.getFeatureSprite(kind, variant, tile.temperature);
      if (sp) {
        out.push(makeSpriteDrawable(sp, px, py, targetW * widthScale, yScale, py));
      }
    }

    // Neighbor-Aware Multi-Hex Bridging Sub-Clusters for Mountain Ranges & Forests
    if (tile.biome === 'mountain' || tile.biome === 'forest') {
      for (let e = 0; e < 6; e++) {
        const [dq, dr] = HEX_EDGE_OFFSETS[e];
        const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
        if (!nt || !nt.exploredBy[state.playerCivId]) continue;
        if (cityTiles.has(tileKey(nt.q, nt.r))) continue;
        if (nt.biome !== tile.biome) continue;

        const k1 = `${tile.q},${tile.r}`;
        const k2 = `${nt.q},${nt.r}`;
        const pairKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        if (bridgedPairs.has(pairKey)) continue;
        bridgedPairs.add(pairKey);

        const np = axialToPixel(nt.q, nt.r, viewMode);
        const mx = (px + np.x) * 0.5;
        const my = (py + np.y) * 0.5;

        const bridgeKind: FeatureSpriteKind =
          tile.biome === 'mountain'
            ? 'mountain_ridge'
            : tile.temperature === 'tropical'
              ? 'jungle_canopy'
              : tile.temperature === 'arctic'
                ? 'pine_forest'
                : 'deciduous_woods';

        const bridgeSp = proceduralAtlas.getFeatureSprite(
          bridgeKind,
          variant + e * 13,
          tile.temperature
        );
        if (bridgeSp) {
          const bridgeScale = tile.biome === 'mountain' ? 0.72 : 0.64;
          out.push(makeSpriteDrawable(bridgeSp, mx, my, targetW * bridgeScale, yScale, my));
        }
      }
    }
  }

  return out;
}

function makeSpriteDrawable(
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
  // Unified Top-Left Warm Sunlight & Bottom-Right Cool Atmospheric Grading
  const lightGrad = ctx.createLinearGradient(0, 0, width, height);
  lightGrad.addColorStop(0, 'rgba(255, 244, 214, 0.06)');
  lightGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  lightGrad.addColorStop(1, 'rgba(16, 28, 48, 0.12)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle Cartographic Edge Vignette
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
