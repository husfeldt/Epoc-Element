import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { UNIT_DEFS } from '../data/registries';
import {
  HEX_SIZE,
  HEX_SQRT3,
  MapViewMode,
  axialToPixel,
  getViewYScale,
  pixelToAxial,
  tileKey,
} from '../engine/hexMath';
import {
  SlicedSprite,
  getInfrastructureSprite,
  getTerrainTileSprite,
  getUnitMiniatureSprite,
  spriteAtlas,
} from '../engine/spriteAtlas';
import { getTilePurchaseCost, previewCombat } from '../engine/turnEngine';
import {
  BiomeType,
  CityState,
  CombatAnimation,
  GameState,
  HexTile,
  UnitDef,
  UnitState,
} from '../types/game';

interface HexMapCanvasProps {
  state: GameState;
  viewMode: MapViewMode;
  onToggleViewMode: () => void;
  selectedUnitId: string | null;
  selectedCityId: string | null;
  selectedTileKey: string | null;
  reachableHexes: Map<string, { cost: number; parent: string | null }>;
  attackableKeys: Set<string>;
  buyTileModeCityId: string | null;
  purchasableKeys: Set<string>;
  cameraTarget: { q: number; r: number; trigger: number } | null;
  onHexClick: (q: number, r: number) => void;
  onHexHover: (tile: HexTile | null) => void;
}

const TERRAIN_TEXTURE_PATHS = {
  plains: '/src/assets/images/civ_terrain_plains_1794765601101.jpg',
  desert: '/src/assets/images/civ_terrain_desert_1794765601580.jpg',
  tundra: '/src/assets/images/civ_terrain_tundra_1794765602052.jpg',
  forest: '/src/assets/images/civ_terrain_forest_1794765602534.jpg',
  ocean: '/src/assets/images/civ_terrain_ocean_1794765603100.jpg',
};

type TextureKey = keyof typeof TERRAIN_TEXTURE_PATHS;

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

function drawHexPath(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// Matches pointy-top hex edge indices 0..5 from getHexCorners
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

const BATTLE_FX_DURATION_MS = 850;

export const HexMapCanvas: React.FC<HexMapCanvasProps> = ({
  state,
  viewMode,
  onToggleViewMode,
  selectedUnitId,
  selectedCityId,
  selectedTileKey,
  reachableHexes,
  attackableKeys,
  buyTileModeCityId,
  purchasableKeys,
  cameraTarget,
  onHexClick,
  onHexHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1.08 });
  const prevViewModeRef = useRef<MapViewMode>(viewMode);
  const texturesRef = useRef<Partial<Record<TextureKey, HTMLImageElement>>>({});
  const [texturesReady, setTexturesReady] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  // Track transient active combat VFX (stops cleanly once finished)
  const activeCombatsRef = useRef<CombatAnimation[]>([]);
  const seenCombatIdsRef = useRef<Set<string>>(new Set());

  const dragRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({ dragging: false, moved: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hoverKeyRef = useRef<string | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(108);

  useEffect(() => {
    let mounted = true;
    (Object.keys(TERRAIN_TEXTURE_PATHS) as TextureKey[]).forEach((key) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!mounted) return;
        texturesRef.current[key] = img;
        setTexturesReady((v) => v + 1);
      };
      img.src = TERRAIN_TEXTURE_PATHS[key];
    });

    spriteAtlas.ensureLoaded();
    const unsub = spriteAtlas.subscribe(() => {
      if (mounted) setRenderTick((v) => v + 1);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Register incoming combat bursts and run one-shot RAF loop until effects finish
  useEffect(() => {
    if (!state.recentCombats || state.recentCombats.length === 0) return;
    const now = Date.now();
    let added = false;
    for (const c of state.recentCombats) {
      if (!seenCombatIdsRef.current.has(c.id)) {
        seenCombatIdsRef.current.add(c.id);
        activeCombatsRef.current.push({ ...c, timestamp: now });
        added = true;
      }
    }
    if (!added) return;

    let rafId = 0;
    const step = () => {
      const tNow = Date.now();
      activeCombatsRef.current = activeCombatsRef.current.filter(
        (c) => tNow - c.timestamp < BATTLE_FX_DURATION_MS
      );
      setRenderTick((v) => v + 1);
      if (activeCombatsRef.current.length > 0) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [state.recentCombats]);

  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      const prevScale = getViewYScale(prevViewModeRef.current);
      const nextScale = getViewYScale(viewMode);
      cameraRef.current.y = cameraRef.current.y * (nextScale / prevScale);
      prevViewModeRef.current = viewMode;
      setRenderTick((v) => v + 1);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!cameraTarget) return;
    const p = axialToPixel(cameraTarget.q, cameraTarget.r, viewMode);
    cameraRef.current.x = p.x;
    cameraRef.current.y = p.y;
    setRenderTick((v) => v + 1);
  }, [cameraTarget, viewMode]);

  const adjustZoom = useCallback((delta: number) => {
    const next = Math.max(0.42, Math.min(2.3, cameraRef.current.zoom + delta));
    cameraRef.current.zoom = next;
    setZoomDisplay(Math.round(next * 100));
    setRenderTick((v) => v + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = 45 / cameraRef.current.zoom;
      let moved = false;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        cameraRef.current.y -= step;
        moved = true;
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        cameraRef.current.y += step;
        moved = true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        cameraRef.current.x -= step;
        moved = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        cameraRef.current.x += step;
        moved = true;
      }
      if (e.key === '=' || e.key === '+') adjustZoom(0.18);
      if (e.key === '-') adjustZoom(-0.18);
      if (moved) setRenderTick((v) => v + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjustZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => setRenderTick((v) => v + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Main High-Detail Cartographic + Aligned 3D Terrain & Visual Combat Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (
      canvas.width !== Math.floor(rect.width * dpr) ||
      canvas.height !== Math.floor(rect.height * dpr)
    ) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    const W = rect.width;
    const H = rect.height;
    const cam = cameraRef.current;
    const yScale = getViewYScale(viewMode);
    const isIso = viewMode === 'isometric';

    const patterns: Partial<Record<TextureKey, CanvasPattern>> = {};
    (Object.keys(TERRAIN_TEXTURE_PATHS) as TextureKey[]).forEach((key) => {
      const img = texturesRef.current[key];
      if (!img) return;
      const pat = ctx.createPattern(img, 'repeat');
      if (pat) {
        const mat = new DOMMatrix();
        mat.scaleSelf(0.24, 0.24 * yScale);
        pat.setTransform(mat);
        patterns[key] = pat;
      }
    });

    ctx.save();
    ctx.scale(dpr, dpr);

    // Warm antique cartographic parchment backdrop
    const bgGrad = ctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      80,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.85
    );
    bgGrad.addColorStop(0, '#d8c59e');
    bgGrad.addColorStop(1, '#baa376');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    drawParchmentGridAndCompass(ctx, W, H, cam);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const viewHalfW = W / 2 / cam.zoom + HEX_SIZE * 3.5;
    const viewHalfH = H / 2 / cam.zoom + HEX_SIZE * 4.0;
    const playerCivId = state.playerCivId;

    const visibleList: Array<{
      tile: HexTile;
      px: number;
      py: number;
      explored: boolean;
      visible: boolean;
    }> = [];

    for (const tile of Object.values(state.tiles)) {
      const { x: px, y: py } = axialToPixel(tile.q, tile.r, viewMode);
      if (
        px < cam.x - viewHalfW ||
        px > cam.x + viewHalfW ||
        py < cam.y - viewHalfH ||
        py > cam.y + viewHalfH
      ) {
        continue;
      }
      visibleList.push({
        tile,
        px,
        py,
        explored: Boolean(tile.exploredBy[playerCivId]),
        visible: Boolean(tile.visibleTo[playerCivId]),
      });
    }
    visibleList.sort((a, b) => a.py - b.py || a.px - b.px);

    const cityByTile = new Map<string, CityState>();
    for (const city of Object.values(state.cities)) {
      cityByTile.set(tileKey(city.q, city.r), city);
    }

    const unexploredEdgeTiles: Array<{ tile: HexTile; px: number; py: number }> = [];
    const hexDrawWidth = HEX_SIZE * HEX_SQRT3 * 0.995;
    const playerAge = state.civs[playerCivId]?.ageIndex ?? 0;

    // PASS 1: Seamless Connected Ground & Neighbor-Blended Biomes (Exact Hex Alignment)
    for (const item of visibleList) {
      const { tile, px, py, explored } = item;
      if (!explored) {
        const bordersExplored = NEIGHBOR_OFFSETS.some(([dq, dr]) => {
          const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
          return nt && nt.exploredBy[playerCivId];
        });
        if (bordersExplored) {
          unexploredEdgeTiles.push({ tile, px, py });
        }
        continue;
      }

      const isWater = tile.biome === 'ocean' || tile.biome === 'coast';
      const groundPts = getHexCorners(px, py, HEX_SIZE + 1.35, yScale);
      const exactPts = getHexCorners(px, py, HEX_SIZE, yScale);

      if (isWater) {
        drawHexPath(ctx, groundPts);
        if (patterns.ocean) {
          ctx.fillStyle = patterns.ocean;
          ctx.fill();
          ctx.fillStyle =
            tile.biome === 'coast' ? 'rgba(42, 134, 158, 0.34)' : 'rgba(14, 34, 54, 0.48)';
          ctx.fill();
        } else {
          ctx.fillStyle = tile.biome === 'coast' ? '#2c5f76' : '#183347';
          ctx.fill();
        }

        // Shallow turquoise lagoon glow along any coastal edge bordering land
        if (tile.biome === 'coast') {
          ctx.save();
          drawHexPath(ctx, groundPts);
          ctx.clip();
          for (let e = 0; e < 6; e++) {
            const [dq, dr] = NEIGHBOR_OFFSETS[e];
            const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
            if (nt && nt.biome !== 'ocean' && nt.biome !== 'coast') {
              const pA = exactPts[e];
              const pB = exactPts[(e + 1) % 6];
              const mx = (pA.x + pB.x) * 0.5;
              const my = (pA.y + pB.y) * 0.5;
              const grad = ctx.createLinearGradient(mx, my, px, py);
              grad.addColorStop(0, 'rgba(103, 232, 249, 0.34)');
              grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.10)');
              grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
              ctx.fillStyle = grad;
              ctx.fillRect(px - HEX_SIZE * 1.1, py - HEX_SIZE * yScale * 1.1, HEX_SIZE * 2.2, HEX_SIZE * yScale * 2.2);
            }
          }
          ctx.restore();
        }
        drawPolarIceIfArctic(ctx, state, tile, px, py, isIso);
        continue;
      }

      // Land ground fill using continuous tiled terrain texture + climate palette wash
      const texKey: TextureKey =
        tile.biome === 'desert'
          ? 'desert'
          : tile.biome === 'tundra'
            ? 'tundra'
            : tile.biome === 'forest'
              ? 'forest'
              : 'plains';

      ctx.save();
      drawHexPath(ctx, groundPts);
      ctx.clip();

      if (patterns[texKey]) {
        ctx.fillStyle = patterns[texKey]!;
        ctx.fill();
      } else {
        ctx.fillStyle = getBaseBiomeColor(tile);
        ctx.fill();
      }

      const wash = getCivClimateWash(tile.biome, tile.temperature);
      if (wash) {
        ctx.fillStyle = wash;
        ctx.fill();
      }

      // Side-to-side biome transition feathering across shared hex edges!
      for (let e = 0; e < 6; e++) {
        const [dq, dr] = NEIGHBOR_OFFSETS[e];
        const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
        if (!nt || !nt.exploredBy[playerCivId]) continue;
        if (nt.biome === 'ocean' || nt.biome === 'coast') continue;
        if (nt.biome !== tile.biome || nt.temperature !== tile.temperature) {
          const neighborTone = getBiomeBlendTint(nt);
          if (!neighborTone) continue;
          const pA = exactPts[e];
          const pB = exactPts[(e + 1) % 6];
          const mx = (pA.x + pB.x) * 0.5;
          const my = (pA.y + pB.y) * 0.5;
          const ix = mx + (px - mx) * 0.48;
          const iy = my + (py - my) * 0.48;
          const bGrad = ctx.createLinearGradient(mx, my, ix, iy);
          bGrad.addColorStop(0, neighborTone);
          bGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.lineTo(px, py);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Subtle directional relief shading for hills & mountains
      if (tile.biome === 'hills' || tile.biome === 'mountain') {
        const relGrad = ctx.createLinearGradient(
          px - HEX_SIZE * 0.6,
          py - HEX_SIZE * yScale * 0.6,
          px + HEX_SIZE * 0.6,
          py + HEX_SIZE * yScale * 0.6
        );
        relGrad.addColorStop(0, 'rgba(255, 250, 230, 0.14)');
        relGrad.addColorStop(1, 'rgba(15, 23, 42, 0.22)');
        ctx.fillStyle = relGrad;
        ctx.fillRect(px - HEX_SIZE, py - HEX_SIZE * yScale, HEX_SIZE * 2, HEX_SIZE * yScale * 2);
      }

      ctx.restore();

      // Subtle hairline cartographic hex boundary
      drawHexPath(ctx, exactPts);
      ctx.strokeStyle = 'rgba(28, 30, 20, 0.15)';
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Coastline cliffs & crashing white surf ONLY on edges meeting water
      for (let e = 0; e < 6; e++) {
        const [dq, dr] = NEIGHBOR_OFFSETS[e];
        const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
        if (nt && (nt.biome === 'ocean' || nt.biome === 'coast')) {
          const pA = exactPts[e];
          const pB = exactPts[(e + 1) % 6];
          // White surf outside shoreline
          ctx.strokeStyle = 'rgba(224, 247, 255, 0.62)';
          ctx.lineWidth = 3.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();

          // Warm rocky coastal cliff lip (thicker on front-facing edges 0,1,2 in isometric view)
          const cliffDepth = isIso && (e === 0 || e === 1 || e === 2) ? 5.5 : 2.6;
          ctx.fillStyle = tile.temperature === 'arid' ? '#9c6e46' : tile.temperature === 'arctic' ? '#64748b' : '#71563b';
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.lineTo(pB.x, pB.y + cliffDepth);
          ctx.lineTo(pA.x, pA.y + cliffDepth);
          ctx.closePath();
          ctx.fill();

          // Sandy beach highlight
          ctx.strokeStyle = tile.temperature === 'arctic' ? 'rgba(226, 232, 240, 0.7)' : 'rgba(232, 208, 152, 0.78)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
      }
    }

    // PASS 2: Rivers & Neighbor-Connected Roads (drawn directly on aligned ground plane)
    for (const item of visibleList) {
      if (!item.explored) continue;
      const { tile, px, py } = item;
      const hexPts = getHexCorners(px, py, HEX_SIZE, yScale);

      if (tile.riverEdges && tile.riverEdges.some(Boolean)) {
        drawTileRivers(ctx, tile, hexPts);
      }

      if (tile.hasRoad) {
        drawConnectedRoad(ctx, state, cityByTile, tile, px, py, viewMode);
      }
    }

    // PASS 3: Cliff-Trimmed, Edge-Feathered 3D Biome Dioramas, Improvements & Cities (Back-to-Front)
    for (const item of visibleList) {
      if (!item.explored) continue;
      const { tile, px, py } = item;
      const cityOnTile = cityByTile.get(tileKey(tile.q, tile.r));
      const hasAdjLand = NEIGHBOR_OFFSETS.some(([dq, dr]) => {
        const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
        return nt && nt.biome !== 'ocean' && nt.biome !== 'coast';
      });

      let dioramaSprite: SlicedSprite | null = null;
      const shouldDrawTerrainDiorama =
        tile.biome === 'forest' ||
        tile.biome === 'hills' ||
        tile.biome === 'mountain' ||
        tile.feature === 'ancient_ruins' ||
        tile.feature === 'natural_wonder' ||
        (tile.temperature === 'tropical' &&
          (tile.biome === 'plains' || tile.biome === 'coast')) ||
        tile.biome === 'desert';

      if (cityOnTile) {
        const cityCiv = state.civs[cityOnTile.civId];
        dioramaSprite = getInfrastructureSprite(
          'city',
          cityCiv?.ageIndex ?? 0,
          tile.q,
          tile.r,
          hasAdjLand
        );
      } else if (tile.improvement !== 'none' && tile.improvement !== 'road') {
        dioramaSprite = getInfrastructureSprite(tile.improvement, playerAge, tile.q, tile.r);
      } else if (shouldDrawTerrainDiorama) {
        dioramaSprite = getTerrainTileSprite(tile, hasAdjLand);
      }

      if (isIso && dioramaSprite && dioramaSprite.dioramaCanvas) {
        const scale = hexDrawWidth / dioramaSprite.width;
        const drawH = (dioramaSprite.dioramaHeight ?? dioramaSprite.height) * scale;
        const bottomDiamondY = py + HEX_SIZE * yScale;
        const drawX = px - hexDrawWidth / 2;
        const drawY = bottomDiamondY - drawH;
        ctx.drawImage(dioramaSprite.dioramaCanvas, drawX, drawY, hexDrawWidth, drawH);

        if (tile.improvementDamaged && tile.improvement !== 'none') {
          drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE * 0.78, yScale));
          ctx.fillStyle = 'rgba(220, 38, 38, 0.34)';
          ctx.fill();
        }
      } else {
        // Top-Down crisp miniature fallback + vector detail
        if (dioramaSprite && dioramaSprite.dioramaCanvas && !isIso) {
          const w = HEX_SIZE * 1.38;
          const h = w * ((dioramaSprite.dioramaHeight ?? dioramaSprite.height) / dioramaSprite.width);
          ctx.drawImage(dioramaSprite.dioramaCanvas, px - w / 2, py - h / 2, w, h);
        } else {
          if (tile.biome === 'forest' || tile.biome === 'hills' || tile.biome === 'mountain' || tile.biome === 'desert') {
            drawCiv3DBiomeProps(ctx, tile, px, py, isIso);
          }
          if (tile.improvement !== 'none' && tile.improvement !== 'road') {
            drawImprovement(ctx, tile, px, py, isIso);
          }
        }
      }

      if (tile.feature !== 'none') {
        drawNaturalFeature(ctx, tile, px, py);
      }

      if (!item.visible) {
        drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE + 0.6, yScale));
        ctx.fillStyle = 'rgba(38, 32, 22, 0.38)';
        ctx.fill();
      }
    }

    // PASS 4: Continuous Outer Empire Borders (Exact Hex Alignment)
    for (const item of visibleList) {
      const ownerCivId = item.tile.ownerCivId;
      if (!item.explored || !ownerCivId) continue;
      const { tile, px, py } = item;
      const civ = state.civs[ownerCivId];
      if (!civ) continue;
      const pts = getHexCorners(px, py, HEX_SIZE - 1.2, yScale);

      for (let e = 0; e < 6; e++) {
        const [dq, dr] = NEIGHBOR_OFFSETS[e];
        const nt = state.tiles[tileKey(tile.q + dq, tile.r + dr)];
        if (!nt || nt.ownerCivId !== ownerCivId) {
          const pA = pts[e];
          const pB = pts[(e + 1) % 6];
          ctx.strokeStyle = civ.color;
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 250, 235, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
      }
    }

    // PASS 5: Tactical Highlights (Movement Range, Attack Targets, Buy Tile, Hover)
    for (const item of visibleList) {
      if (!item.explored) continue;
      const { tile, px, py } = item;
      const k = tileKey(tile.q, tile.r);

      if (reachableHexes.has(k)) {
        drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE - 2.8, yScale));
        ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      if (attackableKeys.has(k)) {
        drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE - 2.8, yScale));
        ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.8;
        ctx.stroke();
      }
      if (buyTileModeCityId && purchasableKeys.has(k)) {
        const city = state.cities[buyTileModeCityId];
        drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE - 2.8, yScale));
        ctx.fillStyle = 'rgba(234, 179, 8, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        if (city) {
          const cost = getTilePurchaseCost(city, tile);
          ctx.fillStyle = '#fef08a';
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${cost}g`, px, py + 4);
        }
      }
      if (selectedTileKey === k || hoverKeyRef.current === k) {
        drawHexPath(ctx, getHexCorners(px, py, HEX_SIZE - 1.2, yScale));
        ctx.strokeStyle = selectedTileKey === k ? '#fbbf24' : 'rgba(255,255,255,0.88)';
        ctx.lineWidth = selectedTileKey === k ? 2.6 : 1.7;
        ctx.stroke();
      }
    }

    // Movement Path Preview
    if (selectedUnitId && hoverKeyRef.current && reachableHexes.has(hoverKeyRef.current)) {
      const unit = state.units[selectedUnitId];
      if (unit) {
        const pathKeys: string[] = [];
        let cur: string | null = hoverKeyRef.current;
        while (cur) {
          pathKeys.push(cur);
          cur = reachableHexes.get(cur)?.parent ?? null;
        }
        pathKeys.reverse();
        if (pathKeys.length >= 2) {
          ctx.save();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          pathKeys.forEach((pk, idx) => {
            const [pq, pr] = pk.split(',').map(Number);
            const pos = axialToPixel(pq, pr, viewMode);
            if (idx === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
          });
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // PASS 6: Soft Blurred Parchment Frontier Cloud
    if (unexploredEdgeTiles.length > 0 && cam.zoom > 0.55) {
      ctx.save();
      ctx.filter = 'blur(11px)';
      for (const item of unexploredEdgeTiles) {
        ctx.fillStyle = 'rgba(216, 197, 158, 0.85)';
        ctx.beginPath();
        ctx.arc(item.px, item.py, HEX_SIZE * 0.92, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = 'none';
      ctx.restore();
    }

    // PASS 7: Barbarian Camps & City Banners
    for (const camp of Object.values(state.barbarianCamps)) {
      const tile = state.tiles[tileKey(camp.q, camp.r)];
      if (!tile?.exploredBy[playerCivId]) continue;
      const { x: px, y: py } = axialToPixel(camp.q, camp.r, viewMode);
      drawBarbarianCamp(ctx, camp.disposition === 'peaceful', camp.name, px, py);
    }

    for (const city of Object.values(state.cities)) {
      const tile = state.tiles[tileKey(city.q, city.r)];
      if (!tile?.exploredBy[playerCivId]) continue;
      const { x: px, y: py } = axialToPixel(city.q, city.r, viewMode);
      const civ = state.civs[city.civId];
      const hasCoastalWater = NEIGHBOR_OFFSETS.some(([dq, dr]) => {
        const nt = state.tiles[tileKey(city.q + dq, city.r + dr)];
        return nt && (nt.biome === 'coast' || nt.biome === 'ocean');
      });
      draw3DCitadel(
        ctx,
        city,
        civ.color,
        civ.ageIndex,
        selectedCityId === city.id,
        hasCoastalWater,
        Boolean(spriteAtlas.getAtlas('infrastructure') && isIso),
        px,
        py
      );
    }

    // PASS 8: 3D Strategy Unit Miniatures + Floating Civ Pins
    const sortedBarbUnits = Object.values(state.barbarianUnits).sort(
      (a, b) => a.r - b.r || a.q - b.q
    );
    for (const bu of sortedBarbUnits) {
      const tile = state.tiles[tileKey(bu.q, bu.r)];
      if (!tile?.visibleTo[playerCivId]) continue;
      const { x: px, y: py } = axialToPixel(bu.q, bu.r, viewMode);
      drawBarbarianMiniature(ctx, bu.disposition === 'peaceful', bu.hp, bu.maxHp, px, py);
    }

    const sortedUnits = Object.values(state.units).sort((a, b) => a.r - b.r || a.q - b.q);
    for (const unit of sortedUnits) {
      const tile = state.tiles[tileKey(unit.q, unit.r)];
      if (unit.civId !== playerCivId && !tile?.visibleTo[playerCivId]) continue;
      const { x: px, y: py } = axialToPixel(unit.q, unit.r, viewMode);
      const civ = state.civs[unit.civId];
      const def = UNIT_DEFS[unit.defId];
      drawIllustratedUnit(ctx, unit, def, civ.color, selectedUnitId === unit.id, px, py);
    }

    // PASS 9: Hover Tactical Combat Odds Preview
    if (selectedUnitId && hoverKeyRef.current && attackableKeys.has(hoverKeyRef.current)) {
      const ht = state.tiles[hoverKeyRef.current];
      if (ht) {
        const forecast = previewCombat(state, selectedUnitId, ht.q, ht.r);
        if (forecast) {
          const { x: tx, y: ty } = axialToPixel(ht.q, ht.r, viewMode);
          drawCombatForecastReticle(ctx, tx, ty, forecast);
        }
      }
    }

    // PASS 10: One-Shot Visual Battle FX (Slashes, Arrows, Cannon Fire, Shockwaves & Floating Damage)
    if (activeCombatsRef.current.length > 0) {
      const tNow = Date.now();
      for (const fx of activeCombatsRef.current) {
        const progress = Math.min(1, Math.max(0, (tNow - fx.timestamp) / BATTLE_FX_DURATION_MS));
        const fromPos = axialToPixel(fx.fromQ, fx.fromR, viewMode);
        const toPos = axialToPixel(fx.toQ, fx.toR, viewMode);
        drawCombatFxEffect(ctx, fx, fromPos.x, fromPos.y, toPos.x, toPos.y, progress);
      }
    }

    ctx.restore();
    ctx.restore();
  }, [
    state,
    viewMode,
    texturesReady,
    renderTick,
    selectedUnitId,
    selectedCityId,
    selectedTileKey,
    reachableHexes,
    attackableKeys,
    buyTileModeCityId,
    purchasableKeys,
  ]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    return {
      wx: (sx - rect.width / 2) / cam.zoom + cam.x,
      wy: (sy - rect.height / 2) / cam.zoom + cam.y,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: cameraRef.current.x,
      camStartY: cameraRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragging) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
      cameraRef.current.x = dragRef.current.camStartX - dx / cameraRef.current.zoom;
      cameraRef.current.y = dragRef.current.camStartY - dy / cameraRef.current.zoom;
      setRenderTick((v) => v + 1);
      return;
    }

    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    const { q, r } = pixelToAxial(wx, wy, viewMode);
    const k = tileKey(q, r);
    if (hoverKeyRef.current !== k) {
      hoverKeyRef.current = k;
      onHexHover(state.tiles[k] ?? null);
      setRenderTick((v) => v + 1);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (!wasMoved) {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const { q, r } = pixelToAxial(wx, wy, viewMode);
      if (state.tiles[tileKey(q, r)]) onHexClick(q, r);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const prevZoom = cameraRef.current.zoom;
    const nextZoom = Math.max(0.42, Math.min(2.3, prevZoom * factor));

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left - rect.width / 2;
      const sy = e.clientY - rect.top - rect.height / 2;
      cameraRef.current.x += sx * (1 / prevZoom - 1 / nextZoom);
      cameraRef.current.y += sy * (1 / prevZoom - 1 / nextZoom);
    }
    cameraRef.current.zoom = nextZoom;
    setZoomDisplay(Math.round(nextZoom * 100));
    setRenderTick((v) => v + 1);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Camera View Mode & Zoom Controls */}
      <div className="absolute bottom-24 right-4 flex items-center gap-2">
        <button
          onClick={onToggleViewMode}
          className="px-3 py-1.5 bg-[#0d1a24]/92 hover:bg-[#162a39] backdrop-blur-md border border-[#b89758]/40 rounded-lg text-xs font-medium text-[#f8f3e6] flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
          title="Toggle Isometric / Top-Down Camera"
        >
          <Layers className="w-3.5 h-3.5 text-[#e6c983]" />
          <span>{viewMode === 'isometric' ? 'Isometric View' : 'Top-Down View'}</span>
        </button>

        <div className="flex items-center gap-1 bg-[#0d1a24]/92 backdrop-blur-md border border-[#b89758]/40 rounded-lg p-1 shadow-lg">
          <button
            onClick={() => adjustZoom(-0.2)}
            className="px-2.5 py-1 text-xs font-medium text-[#f8f3e6] hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            -
          </button>
          <span className="px-2 text-xs font-mono-tabular text-[#e6c983] min-w-[46px] text-center">
            {zoomDisplay}%
          </span>
          <button
            onClick={() => adjustZoom(0.2)}
            className="px-2.5 py-1 text-xs font-medium text-[#f8f3e6] hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PARCHMENT CARTOGRAPHY & CONNECTED TERRAIN HELPERS ---

function getBaseBiomeColor(tile: HexTile): string {
  if (tile.biome === 'desert') return '#dfb96b';
  if (tile.biome === 'tundra') return '#c5d3de';
  if (tile.biome === 'forest') {
    if (tile.temperature === 'tropical') return '#235e32';
    if (tile.temperature === 'arctic') return '#34534a';
    return '#365f32';
  }
  if (tile.biome === 'hills') {
    if (tile.temperature === 'arid') return '#ba814c';
    if (tile.temperature === 'arctic') return '#9ab0bf';
    return '#6b8e42';
  }
  if (tile.biome === 'mountain') {
    return tile.temperature === 'arid' ? '#916044' : '#657584';
  }
  if (tile.temperature === 'tropical') return '#458a3c';
  if (tile.temperature === 'arid') return '#b89b56';
  if (tile.temperature === 'arctic') return '#9cb5ae';
  return '#6d9442';
}

function getBiomeBlendTint(tile: HexTile): string | null {
  if (tile.biome === 'desert') return 'rgba(226, 189, 108, 0.72)';
  if (tile.biome === 'tundra') return 'rgba(202, 218, 228, 0.72)';
  if (tile.biome === 'forest') {
    return tile.temperature === 'tropical'
      ? 'rgba(26, 98, 48, 0.62)'
      : 'rgba(50, 94, 46, 0.58)';
  }
  if (tile.biome === 'plains') {
    if (tile.temperature === 'tropical') return 'rgba(64, 144, 62, 0.55)';
    if (tile.temperature === 'arid') return 'rgba(188, 156, 86, 0.62)';
    return 'rgba(110, 148, 66, 0.52)';
  }
  if (tile.biome === 'hills') {
    return tile.temperature === 'arid'
      ? 'rgba(182, 120, 68, 0.58)'
      : 'rgba(108, 134, 64, 0.50)';
  }
  return null;
}

function drawConnectedRoad(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cityByTile: Map<string, CityState>,
  tile: HexTile,
  px: number,
  py: number,
  viewMode: MapViewMode
) {
  const connectedPoints: Array<{ x: number; y: number }> = [];
  for (const [dq, dr] of NEIGHBOR_OFFSETS) {
    const nk = tileKey(tile.q + dq, tile.r + dr);
    const nt = state.tiles[nk];
    if (nt && (nt.hasRoad || cityByTile.has(nk))) {
      const np = axialToPixel(nt.q, nt.r, viewMode);
      connectedPoints.push({ x: (px + np.x) * 0.5, y: (py + np.y) * 0.5 });
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawPaths = () => {
    ctx.beginPath();
    if (connectedPoints.length === 0) {
      ctx.moveTo(px - 14, py + 4);
      ctx.quadraticCurveTo(px, py - 2, px + 14, py - 4);
    } else {
      for (const edgePt of connectedPoints) {
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(
          (px + edgePt.x) * 0.5 + ((tile.q + tile.r) % 2 === 0 ? 3 : -3),
          (py + edgePt.y) * 0.5,
          edgePt.x,
          edgePt.y
        );
      }
    }
  };

  ctx.strokeStyle = '#6c5238';
  ctx.lineWidth = 5.4;
  drawPaths();
  ctx.stroke();

  ctx.strokeStyle = '#e0d0b0';
  ctx.lineWidth = 2.6;
  drawPaths();
  ctx.stroke();

  // Central cobble junction
  ctx.fillStyle = '#e0d0b0';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCombatForecastReticle(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  forecast: { estDamage: number; estCounter: number; kind: string; targetName: string }
) {
  ctx.save();
  // Crosshair corners
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(tx, ty - 2, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Pill forecast label above target
  const text =
    forecast.estCounter > 0
      ? `⚔ -${forecast.estDamage} HP  (↩ -${forecast.estCounter})`
      : `🎯 -${forecast.estDamage} HP`;
  ctx.font = '700 11px "JetBrains Mono", monospace';
  const w = Math.max(108, ctx.measureText(text).width + 18);
  const bx = tx - w / 2;
  const by = ty - 48;

  ctx.fillStyle = 'rgba(15, 10, 14, 0.94)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, 22, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fecaca';
  ctx.textAlign = 'center';
  ctx.fillText(text, tx, by + 15);
  ctx.restore();
}

function drawCombatFxEffect(
  ctx: CanvasRenderingContext2D,
  fx: CombatAnimation,
  fx0: number,
  fy0: number,
  tx: number,
  ty: number,
  p: number
) {
  ctx.save();
  const kind = fx.kind ?? 'melee';
  const easeOut = 1 - Math.pow(1 - p, 3);

  if (kind === 'ranged' || kind === 'siege' || kind === 'naval') {
    // Projectile arc from attacker to target during first 45% of animation
    if (p < 0.5) {
      const flight = Math.min(1, p / 0.45);
      const px = fx0 + (tx - fx0) * flight;
      const arcHeight = kind === 'ranged' ? 28 : 42;
      const py = fy0 + (ty - fy0) * flight - Math.sin(flight * Math.PI) * arcHeight;

      if (kind === 'ranged') {
        const angle = Math.atan2(ty - fy0, tx - fx0);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // Fiery cannonball / catapult boulder + ember trail
        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.beginPath();
        ctx.arc(px - (tx - fx0) * 0.05, py + 4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Impact burst at target once projectile lands
    if (p >= 0.38) {
      const imp = (p - 0.38) / 0.62;
      const radius = (kind === 'siege' || kind === 'naval' ? 36 : 24) * imp;
      ctx.strokeStyle = `rgba(251, 146, 60, ${1 - imp})`;
      ctx.lineWidth = 3.2 * (1 - imp * 0.6);
      ctx.beginPath();
      ctx.arc(tx, ty - 4, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (kind !== 'ranged' && imp < 0.7) {
        ctx.fillStyle = `rgba(249, 115, 22, ${(1 - imp) * 0.65})`;
        ctx.beginPath();
        ctx.arc(tx, ty - 6, 16 * (1 - imp * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Melee steel slash arcs & shockwave!
    const slashAlpha = Math.max(0, 1 - p * 1.25);
    if (slashAlpha > 0) {
      ctx.strokeStyle = `rgba(255, 248, 220, ${slashAlpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(tx, ty - 4, 22, -Math.PI * 0.75 + p * 0.4, Math.PI * 0.15 + p * 0.4);
      ctx.stroke();

      ctx.strokeStyle = `rgba(251, 191, 36, ${slashAlpha})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(tx, ty - 4, 18, Math.PI * 0.25 - p * 0.4, Math.PI * 1.15 - p * 0.4);
      ctx.stroke();
    }

    // Expanding shockwave ring
    ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - p) * 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(tx, ty + 2, 28 * easeOut, 16 * easeOut, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (kind === 'capture') {
      ctx.strokeStyle = `rgba(230, 201, 131, ${1 - p})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 44 * easeOut, 26 * easeOut, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Floating -HP damage badge above defender
  const dmgAlpha = p < 0.75 ? 1 : (1 - p) / 0.25;
  const floatY = ty - 22 - easeOut * 24;
  ctx.font = '800 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.strokeStyle = `rgba(10, 12, 18, ${dmgAlpha})`;
  ctx.lineWidth = 4;
  ctx.strokeText(`-${fx.damage}`, tx, floatY);
  ctx.fillStyle = `rgba(254, 202, 202, ${dmgAlpha})`;
  ctx.fillText(`-${fx.damage}`, tx, floatY);

  // Floating counter-damage if melee clash
  if (fx.counterDamage && fx.counterDamage > 0 && p > 0.18) {
    const cp = (p - 0.18) / 0.82;
    const cAlpha = cp < 0.75 ? 1 : (1 - cp) / 0.25;
    const cY = fy0 - 18 - cp * 20;
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.strokeStyle = `rgba(10, 12, 18, ${cAlpha})`;
    ctx.lineWidth = 3.5;
    ctx.strokeText(`-${fx.counterDamage}`, fx0, cY);
    ctx.fillStyle = `rgba(253, 224, 71, ${cAlpha})`;
    ctx.fillText(`-${fx.counterDamage}`, fx0, cY);
  }

  ctx.restore();
}

function drawParchmentGridAndCompass(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cam: { x: number; y: number; zoom: number }
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(110, 88, 52, 0.2)';
  ctx.lineWidth = 1;
  const spacing = 140;
  const offX = ((-cam.x * cam.zoom * 0.25) % spacing + spacing) % spacing;
  const offY = ((-cam.y * cam.zoom * 0.25) % spacing + spacing) % spacing;

  for (let x = offX; x < W; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = offY; y < H; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const cx = 86;
  const cy = 128;
  ctx.strokeStyle = 'rgba(92, 72, 42, 0.45)';
  ctx.fillStyle = 'rgba(92, 72, 42, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const tx = cx + Math.cos(ang) * 38;
    const ty = cy + Math.sin(ang) * 38;
    const lx = cx + Math.cos(ang + 0.35) * 9;
    const ly = cy + Math.sin(ang + 0.35) * 9;
    const rx = cx + Math.cos(ang - 0.35) * 9;
    const ry = cy + Math.sin(ang - 0.35) * 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(lx, ly);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(rx, ry);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.font = '700 13px "Cinzel", serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - 44);
  ctx.restore();
}

function getCivClimateWash(biome: BiomeType, temp: HexTile['temperature']): string | null {
  if (biome === 'desert') return 'rgba(245, 208, 120, 0.25)';
  if (biome === 'tundra') return 'rgba(220, 232, 240, 0.22)';
  if (biome === 'plains') {
    if (temp === 'tropical') return 'rgba(34, 150, 75, 0.22)';
    if (temp === 'arid') return 'rgba(195, 165, 85, 0.26)';
    if (temp === 'arctic') return 'rgba(180, 200, 195, 0.28)';
    return 'rgba(115, 165, 65, 0.16)';
  }
  if (biome === 'forest') {
    if (temp === 'tropical') return 'rgba(16, 110, 58, 0.25)';
    if (temp === 'arctic') return 'rgba(165, 190, 195, 0.24)';
    return 'rgba(32, 75, 38, 0.20)';
  }
  if (biome === 'hills') {
    if (temp === 'arid') return 'rgba(190, 130, 65, 0.28)';
    if (temp === 'arctic') return 'rgba(185, 205, 215, 0.28)';
    return 'rgba(120, 145, 65, 0.18)';
  }
  if (biome === 'mountain') {
    return temp === 'arid' ? 'rgba(155, 105, 70, 0.28)' : 'rgba(95, 112, 128, 0.28)';
  }
  return null;
}

function drawPolarIceIfArctic(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  tile: HexTile,
  px: number,
  cy: number,
  isIso: boolean
) {
  const nearPole = tile.r <= 2 || tile.r >= state.height - 3;
  if (nearPole && Math.abs((tile.q * 13 + tile.r * 7) % 5) <= 1) {
    const h = isIso ? 0.72 : 1;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.moveTo(px - 10, cy + 2 * h);
    ctx.lineTo(px - 2, cy - 6 * h);
    ctx.lineTo(px + 10, cy - 2 * h);
    ctx.lineTo(px + 5, cy + 6 * h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTileRivers(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  pts: Array<{ x: number; y: number }>
) {
  if (!tile.riverEdges) return;
  ctx.save();
  for (let e = 0; e < 6; e++) {
    if (!tile.riverEdges[e]) continue;
    const a = pts[e];
    const b = pts[(e + 1) % 6];
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const cx = mx + ((tile.q + e) % 2 === 0 ? 4 : -4);
    const cy = my + ((tile.r + e) % 2 === 0 ? 2.5 : -2.5);

    ctx.strokeStyle = 'rgba(84, 72, 48, 0.65)';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = '#38768f';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCiv3DBiomeProps(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  px: number,
  cy: number,
  isIso: boolean
) {
  const hash = Math.abs((tile.q * 73 + tile.r * 139) % 10);
  const v = isIso ? 0.85 : 1.0;

  if (tile.biome === 'mountain') {
    ctx.fillStyle = 'rgba(28, 32, 36, 0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 4, cy + 7 * v, 27, 11 * v, 0, 0, Math.PI * 2);
    ctx.fill();

    const litRock = tile.temperature === 'arid' ? '#c2835b' : '#8b99a8';
    const darkRock = tile.temperature === 'arid' ? '#6b3e26' : '#414c59';

    drawRidgePeak(ctx, px - 14, cy + 6 * v, 14, 21 * v, litRock, darkRock, tile.temperature !== 'arid');
    drawRidgePeak(ctx, px + 14, cy + 7 * v, 13, 19 * v, litRock, darkRock, tile.temperature !== 'arid');
    drawRidgePeak(ctx, px, cy + 9 * v, 21, 35 * v, litRock, darkRock, true);
  } else if (tile.biome === 'hills') {
    if (tile.temperature === 'arid') {
      const mesas = [
        { dx: -9, dy: 2, w: 13, h: 9 * v },
        { dx: 8, dy: 5, w: 12, h: 8 * v },
        { dx: 0, dy: -4, w: 15, h: 11 * v },
      ];
      for (const m of mesas) {
        const mx = px + m.dx;
        const my = cy + m.dy * v;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(mx + 2, my + 2, m.w, 4 * v, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9a5b32';
        ctx.beginPath();
        ctx.moveTo(mx - m.w, my + 2);
        ctx.lineTo(mx - m.w * 0.65, my - m.h);
        ctx.lineTo(mx + m.w * 0.65, my - m.h);
        ctx.lineTo(mx + m.w, my + 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#d99e62';
        ctx.beginPath();
        ctx.ellipse(mx, my - m.h, m.w * 0.65, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const mounds = [
        { dx: -9, dy: 0, rx: 14, ry: 9 * v },
        { dx: 9, dy: 3, rx: 13, ry: 8 * v },
        { dx: 0, dy: 7, rx: 16, ry: 9 * v },
      ];
      const lit =
        tile.temperature === 'arctic'
          ? '#dce6ee'
          : tile.temperature === 'tropical'
            ? '#64b85e'
            : '#8fb851';
      const mid =
        tile.temperature === 'arctic'
          ? '#879ea3'
          : tile.temperature === 'tropical'
            ? '#347d3b'
            : '#5f8732';
      const dark =
        tile.temperature === 'arctic'
          ? '#4b5f66'
          : tile.temperature === 'tropical'
            ? '#1e4d26'
            : '#3d591f';

      for (const m of mounds) {
        const mx = px + m.dx;
        const my = cy + m.dy * v;
        const g = ctx.createLinearGradient(mx - m.rx, my - m.ry, mx + m.rx, my);
        g.addColorStop(0, lit);
        g.addColorStop(0.55, mid);
        g.addColorStop(1, dark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(mx, my, m.rx, m.ry, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (tile.biome === 'forest') {
    const cluster = [
      { dx: -16, dy: -7, s: 0.78 },
      { dx: -5, dy: -11, s: 0.85 },
      { dx: 7, dy: -10, s: 0.8 },
      { dx: 16, dy: -5, s: 0.75 },
      { dx: -13, dy: 0, s: 0.88 },
      { dx: -2, dy: -3, s: 0.95 },
      { dx: 10, dy: -1, s: 0.88 },
      { dx: -14, dy: 8, s: 0.82 },
      { dx: -3, dy: 6, s: 0.92 },
      { dx: 9, dy: 7, s: 0.85 },
      { dx: 17, dy: 4, s: 0.78 },
    ];
    for (const sp of cluster) {
      const tx = px + sp.dx;
      const ty = cy + sp.dy * v;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(tx + 2, ty + 2, 5.2 * sp.s, 2.5 * sp.s * v, 0, 0, Math.PI * 2);
      ctx.fill();

      if (tile.temperature === 'arctic') {
        ctx.fillStyle = '#1f4236';
        ctx.beginPath();
        ctx.moveTo(tx - 5.5 * sp.s, ty + 1);
        ctx.lineTo(tx, ty - 12 * sp.s * v);
        ctx.lineTo(tx + 5.5 * sp.s, ty + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#edf2f7';
        ctx.beginPath();
        ctx.moveTo(tx - 3.2 * sp.s, ty - 5 * sp.s * v);
        ctx.lineTo(tx, ty - 12 * sp.s * v);
        ctx.lineTo(tx + 3.2 * sp.s, ty - 5 * sp.s * v);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = tile.temperature === 'tropical' ? '#174f2b' : '#245229';
        ctx.beginPath();
        ctx.arc(tx + 1, ty - 4 * sp.s * v, 5.4 * sp.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle =
          tile.temperature === 'tropical'
            ? '#2ca857'
            : tile.temperature === 'arid'
              ? '#7b8c3b'
              : '#4a853c';
        ctx.beginPath();
        ctx.arc(tx - 1, ty - 5.5 * sp.s * v, 4.2 * sp.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (tile.biome === 'desert' && hash === 2 && tile.feature === 'none') {
    ctx.fillStyle = '#2d7a8f';
    ctx.beginPath();
    ctx.ellipse(px, cy + 1, 8.5, 4.5 * v, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e8a3c';
    ctx.beginPath();
    ctx.arc(px - 7, cy - 1, 3.2, 0, Math.PI * 2);
    ctx.arc(px + 8, cy + 2, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRidgePeak(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  halfW: number,
  height: number,
  litColor: string,
  darkColor: string,
  snowCap: boolean
) {
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(bx - halfW, by);
  ctx.lineTo(bx, by - height);
  ctx.lineTo(bx + halfW, by);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = litColor;
  ctx.beginPath();
  ctx.moveTo(bx - halfW, by);
  ctx.lineTo(bx, by - height);
  ctx.lineTo(bx + 2, by);
  ctx.closePath();
  ctx.fill();

  if (snowCap) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(bx - halfW * 0.44, by - height * 0.56);
    ctx.lineTo(bx, by - height);
    ctx.lineTo(bx + halfW * 0.44, by - height * 0.52);
    ctx.lineTo(bx + 3, by - height * 0.45);
    ctx.lineTo(bx - 2, by - height * 0.58);
    ctx.closePath();
    ctx.fill();
  }
}

function drawImprovement(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  px: number,
  cy: number,
  isIso: boolean
) {
  const v = isIso ? 0.78 : 1;
  if (tile.improvement === 'farm') {
    const plots = [
      { dx: -14, dy: -6, w: 12, h: 7 * v, c1: '#7fa646', c2: '#5f8530' },
      { dx: 2, dy: -5, w: 12, h: 7 * v, c1: '#c9b458', c2: '#9e8a38' },
      { dx: -11, dy: 4, w: 13, h: 7 * v, c1: '#b89f48', c2: '#8a742c' },
      { dx: 4, dy: 4, w: 12, h: 7 * v, c1: '#6e963d', c2: '#4e7326' },
    ];
    for (const p of plots) {
      ctx.fillStyle = tile.improvementDamaged ? '#6b4226' : p.c1;
      ctx.fillRect(px + p.dx, cy + p.dy, p.w, p.h);
      ctx.strokeStyle = tile.improvementDamaged ? '#452310' : p.c2;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + p.dx, cy + p.dy, p.w, p.h);
    }
    ctx.fillStyle = '#e2d7c1';
    ctx.fillRect(px - 2, cy - 2, 5, 4);
    ctx.fillStyle = '#993b2e';
    ctx.fillRect(px - 3, cy - 4, 7, 2.5);
  } else if (tile.improvement === 'mine') {
    ctx.fillStyle = tile.improvementDamaged ? '#451a03' : '#2c3540';
    ctx.fillRect(px - 9, cy, 18, 9);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(px - 4, cy + 2, 8, 5);
  } else if (tile.improvement === 'lumber_mill') {
    ctx.fillStyle = '#7c3f1c';
    ctx.fillRect(px - 9, cy, 18, 8);
    ctx.fillStyle = '#c48f4d';
    ctx.fillRect(px - 6, cy - 3, 12, 4);
  } else if (tile.improvement === 'quarry') {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(px - 8, cy + 1, 16, 7);
  } else if (tile.improvement === 'trade_post') {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px - 7, cy - 1, 14, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px - 8, cy - 3, 16, 3);
  } else if (tile.improvement === 'fort') {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px - 10, cy - 2, 20, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px - 12, cy - 5, 5, 5);
    ctx.fillRect(px + 7, cy - 5, 5, 5);
  }

  if (tile.improvementDamaged) {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
    ctx.beginPath();
    ctx.arc(px + 12, cy - 5, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNaturalFeature(
  ctx: CanvasRenderingContext2D,
  tile: HexTile,
  px: number,
  cy: number
) {
  ctx.save();
  if (tile.feature === 'natural_wonder') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.beginPath();
    ctx.arc(px, cy - 3, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(px, cy - 15);
    ctx.lineTo(px + 6, cy - 3);
    ctx.lineTo(px, cy + 6);
    ctx.lineTo(px - 6, cy - 3);
    ctx.closePath();
    ctx.fill();
  } else {
    const badgeColor =
      tile.feature === 'coal'
        ? '#1e293b'
        : tile.feature === 'iron'
          ? '#94a3b8'
          : tile.feature === 'copper'
            ? '#d97706'
            : tile.feature === 'rare_flora'
              ? '#34d399'
              : tile.feature === 'fossils'
                ? '#fde68a'
                : tile.feature === 'geothermal_vent'
                  ? '#f97316'
                  : '#c084fc';

    ctx.fillStyle = badgeColor;
    ctx.strokeStyle = tile.featureSurveyed ? 'rgba(255,255,255,0.4)' : '#fef08a';
    ctx.lineWidth = tile.featureSurveyed ? 1 : 1.8;
    ctx.beginPath();
    ctx.arc(px + 14, cy + 6, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function draw3DCitadel(
  ctx: CanvasRenderingContext2D,
  city: CityState,
  civColor: string,
  ageIndex: number,
  selected: boolean,
  hasCoastalWater: boolean,
  using3DSpriteBlock: boolean,
  px: number,
  cy: number
) {
  ctx.save();
  if (selected) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(px, cy + 2, 26, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!using3DSpriteBlock) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(px + 3, cy + 6, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hasCoastalWater) {
      ctx.fillStyle = '#78502b';
      ctx.fillRect(px - 22, cy + 4, 10, 3);
      ctx.fillRect(px - 20, cy + 4, 2, 7);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(px - 19, cy + 4);
      ctx.lineTo(px - 19, cy - 3);
      ctx.lineTo(px - 14, cy + 2);
      ctx.closePath();
      ctx.fill();
    }

    if (city.buildings.includes('walls')) {
      ctx.strokeStyle = '#d6cfc2';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(px, cy + 1, 20, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const towerH = 18 + Math.min(8, ageIndex);
    ctx.fillStyle = '#e5dfd3';
    ctx.fillRect(px - 4, cy - towerH + 4, 11, towerH);
    ctx.fillStyle = civColor;
    ctx.beginPath();
    ctx.moveTo(px - 5, cy - towerH + 4);
    ctx.lineTo(px + 1.5, cy - towerH - 4);
    ctx.lineTo(px + 8, cy - towerH + 4);
    ctx.closePath();
    ctx.fill();
  } else if (city.buildings.includes('walls')) {
    ctx.strokeStyle = civColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(px, cy + 2, 24, 13.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Brass-framed City Banner
  const label = `${city.isCapital ? '★ ' : ''}${city.name}`;
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  const tw = ctx.measureText(label).width;
  const pillW = tw + 30;
  ctx.fillStyle = 'rgba(13, 26, 36, 0.94)';
  ctx.strokeStyle = civColor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(px - pillW / 2, cy + 11, pillW, 18, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8f3e6';
  ctx.textAlign = 'left';
  ctx.fillText(label, px - pillW / 2 + 6, cy + 23);

  ctx.fillStyle = '#e6c983';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${city.population}`, px + pillW / 2 - 6, cy + 23);

  if (city.hp < city.maxHp) {
    const barY = using3DSpriteBlock ? cy - 28 : cy - 26;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 16, barY, 32, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(px - 16, barY, 32 * (city.hp / city.maxHp), 4);
  }
  ctx.restore();
}

function drawIllustratedUnit(
  ctx: CanvasRenderingContext2D,
  unit: UnitState,
  def: UnitDef,
  civColor: string,
  selected: boolean,
  px: number,
  cy: number
) {
  const uy = cy - 2;
  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(px, cy + 6.5, 13, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = selected ? '#fbbf24' : civColor;
  ctx.lineWidth = selected ? 2.8 : 2.1;
  ctx.beginPath();
  ctx.ellipse(px, cy + 6, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  const unitSprite = getUnitMiniatureSprite(unit, def);
  let pinY = uy - 22;

  if (unitSprite) {
    const targetH =
      def.role === 'naval' || def.id === 'tank' || def.role === 'siege' || def.role === 'settler'
        ? 40
        : 38;
    const drawW = targetH * (unitSprite.width / unitSprite.height);
    const drawX = px - drawW / 2;
    const drawY = cy + 8 - targetH;
    ctx.drawImage(unitSprite.canvas, drawX, drawY, drawW, targetH);
    pinY = drawY - 6;
  } else {
    drawPersonTorso(ctx, px, uy, civColor, '#cbd5e1');
  }

  // Civ VI Style Teardrop Pin Badge
  const pinX = px;
  ctx.fillStyle = civColor;
  ctx.strokeStyle = selected ? '#fbbf24' : '#f8f3e6';
  ctx.lineWidth = selected ? 2.2 : 1.5;
  ctx.beginPath();
  ctx.arc(pinX, pinY, 7.5, Math.PI * 0.75, Math.PI * 0.25);
  ctx.lineTo(pinX, pinY + 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(pinX, pinY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (unit.movesLeft > 0 && !unit.task) {
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(pinX + 8, pinY - 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (unit.pendingPromotion) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', pinX - 10, pinY - 4);
  }

  if (unit.hp < unit.maxHp) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 11, pinY - 12, 22, 3);
    ctx.fillStyle = unit.hp / unit.maxHp > 0.45 ? '#22c55e' : '#ef4444';
    ctx.fillRect(px - 11, pinY - 12, 22 * (unit.hp / unit.maxHp), 3);
  }
  ctx.restore();
}

function drawPersonTorso(
  ctx: CanvasRenderingContext2D,
  px: number,
  uy: number,
  tunicColor: string,
  helmColor: string
) {
  ctx.fillStyle = tunicColor;
  ctx.beginPath();
  ctx.moveTo(px - 4.5, uy + 5);
  ctx.lineTo(px - 3.5, uy - 5);
  ctx.lineTo(px + 3.5, uy - 5);
  ctx.lineTo(px + 4.5, uy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = helmColor;
  ctx.beginPath();
  ctx.arc(px, uy - 7.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBarbarianCamp(
  ctx: CanvasRenderingContext2D,
  peaceful: boolean,
  name: string,
  px: number,
  cy: number
) {
  ctx.save();
  ctx.fillStyle = peaceful ? '#0f766e' : '#7f1d1d';
  ctx.strokeStyle = peaceful ? '#5eead4' : '#f87171';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(px - 12, cy + 6);
  ctx.lineTo(px, cy - 11);
  ctx.lineTo(px + 12, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const label = `${peaceful ? 'Peaceful: ' : 'Raider: '}${name}`;
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2.5;
  ctx.strokeText(label, px, cy + 18);
  ctx.fillStyle = peaceful ? '#0f766e' : '#991b1b';
  ctx.fillText(label, px, cy + 18);
  ctx.restore();
}

function drawBarbarianMiniature(
  ctx: CanvasRenderingContext2D,
  peaceful: boolean,
  hp: number,
  maxHp: number,
  px: number,
  cy: number
) {
  const uy = cy - 2;
  ctx.save();
  const atlas = spriteAtlas.getAtlas('units');
  const barbSprite = atlas?.byCoord.get(peaceful ? '4,0' : '5,0');

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(px, cy + 6.5, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = peaceful ? '#2dd4bf' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, cy + 6, 14, 6.2, 0, 0, Math.PI * 2);
  ctx.stroke();

  let topY = uy - 16;
  if (barbSprite) {
    const targetH = 38;
    const drawW = targetH * (barbSprite.width / barbSprite.height);
    const drawY = cy + 8 - targetH;
    ctx.drawImage(barbSprite.canvas, px - drawW / 2, drawY, drawW, targetH);
    topY = drawY - 5;
  } else {
    drawPersonTorso(ctx, px, uy, peaceful ? '#0d9488' : '#b91c1c', '#e2e8f0');
  }

  if (hp < maxHp) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 10, topY, 20, 3);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(px - 10, topY, 20 * (hp / maxHp), 3);
  }
  ctx.restore();
}
