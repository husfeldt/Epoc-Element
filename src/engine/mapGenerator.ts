import {
  BarbarianCamp,
  BarbarianUnit,
  BiomeType,
  CityState,
  CivState,
  GameConfig,
  GameState,
  HexTile,
  NaturalFeatureType,
  ShorelineType,
  TemperatureZone,
  UnitState,
} from '../types/game';
import { hexDistance, hexInRange, hexNeighbors, tileKey } from './hexMath';

const AI_CIV_PRESETS: Array<{
  id: string;
  name: string;
  leaderName: string;
  capitalName: string;
  color: string;
  accentColor: string;
  personality: CivState['personality'];
}> = [
  {
    id: 'ai_aurelia',
    name: 'Aurelian Republic',
    leaderName: 'Consul Valeria',
    capitalName: 'Aurelia',
    color: '#ef4444',
    accentColor: '#fca5a5',
    personality: 'militarist',
  },
  {
    id: 'ai_solaris',
    name: 'Solaris League',
    leaderName: 'Archon Cassian',
    capitalName: 'Heliopolis',
    color: '#a855f7',
    accentColor: '#d8b4fe',
    personality: 'scholar',
  },
  {
    id: 'ai_verdant',
    name: 'Verdant Crown',
    leaderName: 'Queen Isolde',
    capitalName: 'Sylvanor',
    color: '#10b981',
    accentColor: '#6ee7b7',
    personality: 'expansionist',
  },
  {
    id: 'ai_obsidian',
    name: 'Obsidian Khanate',
    leaderName: 'Khagan Temur',
    capitalName: 'Karakor',
    color: '#f97316',
    accentColor: '#fdba74',
    personality: 'militarist',
  },
  {
    id: 'ai_maritime',
    name: 'Thalassian Guild',
    leaderName: 'Doge Lorenzo',
    capitalName: 'Port Vesper',
    color: '#06b6d4',
    accentColor: '#67e8f9',
    personality: 'mercantile',
  },
];

const WONDER_NAMES = [
  'Prism Falls',
  'Mount Aether',
  'Whispering Monoliths',
  'Aurora Spire',
  'Sunken Caldera',
  'Glass Canyon',
];

const BARB_TRIBE_NAMES = [
  'Ashwood Folk',
  'Steppe Wanderers',
  'River Kin',
  'Frostborn Clan',
  'Dune Keepers',
  'Ironclaw Raiders',
  'Redfang Horde',
  'Stormhowl Band',
  'Cragstalkers',
  'Bonehelm Tribe',
];

function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDimensions(size: GameConfig['mapSize']): { width: number; height: number } {
  if (size === 'small') return { width: 26, height: 18 };
  if (size === 'large') return { width: 42, height: 28 };
  return { width: 34, height: 22 };
}

function offsetToAxial(col: number, row: number): { q: number; r: number } {
  const q = col - Math.floor(row / 2);
  const r = row;
  return { q, r };
}

export function generateWorld(config: GameConfig): GameState {
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const rng = createRng(seed);
  const { width, height } = getDimensions(config.mapSize);

  // Smooth multi-octave noise blobs for organic landmasses
  const blobCount =
    config.mapType === 'archipelago'
      ? 22
      : config.mapType === 'pangaea'
        ? 6
        : config.mapType === 'inland_sea'
          ? 12
          : 11;

  const blobs: Array<{ x: number; y: number; radius: number; weight: number }> = [];
  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      x: (0.12 + rng() * 0.76) * width,
      y: (0.12 + rng() * 0.76) * height,
      radius:
        config.mapType === 'archipelago'
          ? 2.2 + rng() * 2.5
          : config.mapType === 'pangaea'
            ? 5.8 + rng() * 4.8
            : 3.6 + rng() * 4.0,
      weight: 0.65 + rng() * 0.55,
    });
  }

  // Large regional moisture basins so forests, deserts, and plains form expansive contiguous landscapes
  const moistureBlobs: Array<{ x: number; y: number; radius: number; delta: number }> = [];
  const moistureBlobCount = 14;
  for (let i = 0; i < moistureBlobCount; i++) {
    moistureBlobs.push({
      x: rng() * width,
      y: rng() * height,
      radius: 4.8 + rng() * 6.5,
      delta: (i % 2 === 0 ? 1 : -1) * (0.38 + rng() * 0.35),
    });
  }

  // Coherent tectonic hill/mountain ridges for natural upland chains and foothills
  const ridgeSeeds: Array<{
    x: number;
    y: number;
    cosA: number;
    sinA: number;
    len: number;
    width: number;
    strength: number;
  }> = [];
  const ridgeCount = config.mapSize === 'large' ? 7 : config.mapSize === 'medium' ? 5 : 4;
  for (let i = 0; i < ridgeCount; i++) {
    const ang = rng() * Math.PI;
    ridgeSeeds.push({
      x: (0.18 + rng() * 0.64) * width,
      y: (0.18 + rng() * 0.64) * height,
      cosA: Math.cos(ang),
      sinA: Math.sin(ang),
      len: 4.5 + rng() * 5.5,
      width: 1.6 + rng() * 1.2,
      strength: 0.28 + rng() * 0.22,
    });
  }

  const latPhase = rng() * Math.PI * 2;
  const lonFreq = 2.0 + rng() * 0.8;

  const tiles: Record<string, HexTile> = {};
  const landCoords: Array<{ q: number; r: number; col: number; row: number }> = [];
  const moistureMap = new Map<string, number>();
  const latMap = new Map<string, number>();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { q, r } = offsetToAxial(col, row);
      const key = tileKey(q, r);

      // Compute smooth height field
      let elev = 0;
      for (const b of blobs) {
        const dx = col - b.x;
        const dy = row - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < b.radius * 1.85) {
          elev += b.weight * Math.exp(-(dist * dist) / (2 * b.radius * b.radius));
        }
      }

      // Add coherent tectonic ridge elevation so hills & mountains form connected chains
      for (const rg of ridgeSeeds) {
        const dx = col - rg.x;
        const dy = row - rg.y;
        const along = dx * rg.cosA + dy * rg.sinA;
        const perp = -dx * rg.sinA + dy * rg.cosA;
        if (Math.abs(along) < rg.len * 1.4 && Math.abs(perp) < rg.width * 2.5) {
          const alongFall = Math.exp(-(along * along) / (2 * rg.len * rg.len));
          const perpFall = Math.exp(-(perp * perp) / (2 * rg.width * rg.width));
          elev += rg.strength * alongFall * perpFall;
        }
      }

      // Map type shaping
      const nx = col / width - 0.5;
      const ny = row / height - 0.5;
      const centerDist = Math.sqrt(nx * nx + ny * ny);

      if (config.mapType === 'pangaea') {
        elev += Math.max(0, 0.78 - centerDist * 1.42);
      } else if (config.mapType === 'inland_sea') {
        if (centerDist < 0.23) elev -= 0.85;
        else elev += 0.35;
      } else if (config.mapType === 'wild_frontier') {
        elev += 0.26 + (rng() - 0.5) * 0.14;
      } else if (config.mapType === 'archipelago') {
        elev -= 0.12;
      }

      // Edge ocean falloff
      const edgeX = Math.min(col, width - 1 - col) / (width * 0.14);
      const edgeY = Math.min(row, height - 1 - row) / (height * 0.14);
      const edgeFactor = Math.min(1, Math.min(edgeX, edgeY));
      if (config.mapType !== 'inland_sea') {
        elev *= 0.35 + 0.65 * edgeFactor;
      }

      // Subtle micro-relief without breaking regional land coherence
      elev += (rng() - 0.5) * 0.07;

      // Smooth regional moisture field (0..1)
      let moisture = 0.52;
      for (const mb of moistureBlobs) {
        const dx = col - mb.x;
        const dy = row - mb.y;
        const d2 = dx * dx + dy * dy;
        moisture += mb.delta * Math.exp(-d2 / (2 * mb.radius * mb.radius));
      }
      moisture += (rng() - 0.5) * 0.06;
      moisture = Math.max(0.02, Math.min(0.98, moisture));
      moistureMap.set(key, moisture);

      // Latitude climate zone (0 = equator at center, 1 = north/south poles) with gentle organic contour
      const baseLat = Math.abs(row / Math.max(1, height - 1) - 0.5) * 2;
      const latWave = Math.sin((col / width) * Math.PI * lonFreq + latPhase) * 0.04;
      const effLat = Math.max(0, Math.min(1, baseLat + latWave));
      latMap.set(key, effLat);

      let biome: BiomeType = 'ocean';
      let temperature: TemperatureZone = 'ocean';

      if (elev < 0.46) {
        biome = 'ocean';
        temperature = 'ocean';
      } else if (elev < 0.57) {
        biome = 'coast';
        temperature = 'ocean';
      } else {
        // Strict latitude-respecting climate zones with large regional moisture basins:
        // 1. Polar / Arctic Zone (High latitudes near top & bottom poles)
        if (effLat >= 0.75) {
          temperature = 'arctic';
          if (elev > 1.24) {
            biome = 'mountain';
          } else if (elev > 0.96) {
            biome = 'hills';
          } else if (effLat < 0.84 && moisture > 0.55) {
            biome = 'forest'; // Sub-arctic snowy taiga forest belt
          } else {
            biome = 'tundra';
          }
        }
        // 2. Temperate Zone (Mid-latitudes: sweeping forests, grasslands, and rolling green hills)
        else if (effLat >= 0.38) {
          temperature = 'temperate';
          if (elev > 1.24) {
            biome = 'mountain';
          } else if (elev > 0.93) {
            biome = 'hills';
          } else if (moisture >= 0.51) {
            biome = 'forest';
          } else {
            biome = 'plains';
          }
        }
        // 3. Subtropical / Horse-Latitude Belt (Large contiguous deserts, arid mesas, or savanna/grass hills)
        else if (effLat >= 0.17) {
          if (moisture < 0.47) {
            temperature = 'arid';
            if (elev > 1.25) {
              biome = 'mountain';
            } else if (elev > 0.95) {
              biome = 'hills';
            } else {
              biome = 'desert';
            }
          } else if (moisture < 0.62) {
            // Smooth transition belt (grassland / grassy hills connecting desert to temperate/tropical)
            temperature = effLat >= 0.26 ? 'temperate' : 'arid';
            if (elev > 1.24) {
              biome = 'mountain';
            } else if (elev > 0.91) {
              biome = 'hills';
            } else {
              biome = 'plains';
            }
          } else {
            temperature = effLat < 0.25 ? 'tropical' : 'temperate';
            if (elev > 1.24) {
              biome = 'mountain';
            } else if (elev > 0.94) {
              biome = 'hills';
            } else {
              biome = 'forest';
            }
          }
        }
        // 4. Equatorial / Tropical Zone (Lush rainforests, tropical highlands, or dry equatorial basins)
        else {
          if (moisture < 0.30) {
            temperature = 'arid';
            biome = elev > 1.24 ? 'mountain' : elev > 0.95 ? 'hills' : 'desert';
          } else {
            temperature = 'tropical';
            if (elev > 1.24) {
              biome = 'mountain';
            } else if (elev > 0.94) {
              biome = 'hills';
            } else if (moisture >= 0.46) {
              biome = 'forest';
            } else {
              biome = 'plains';
            }
          }
        }
      }

      let feature: NaturalFeatureType = 'none';
      if (biome !== 'ocean' && biome !== 'coast' && biome !== 'mountain') {
        const fRoll = rng();
        if (fRoll < 0.035) feature = 'coal';
        else if (fRoll < 0.068) feature = 'iron';
        else if (fRoll < 0.098) feature = 'copper';
        else if (fRoll < 0.14) feature = 'rare_flora';
        else if (fRoll < 0.17) feature = 'fossils';
        else if (fRoll < 0.205) feature = 'ancient_ruins';
        else if (fRoll < 0.222) feature = 'geothermal_vent';
      }

      tiles[key] = {
        q,
        r,
        biome,
        temperature,
        elevation: Math.max(0, Math.min(1, elev / 1.4)),
        feature,
        featureSurveyed: false,
        improvement: 'none',
        improvementDamaged: false,
        hasRoad: false,
        hasRiver: false,
        riverEdges: [false, false, false, false, false, false],
        ownerCityId: null,
        ownerCivId: null,
        exploredBy: {},
        visibleTo: {},
      };

      if (biome !== 'ocean' && biome !== 'coast' && biome !== 'mountain') {
        landCoords.push({ q, r, col, row });
      }
    }
  }

  // Regional Biome Clustering & Climate Transition Smoothing (2 cellular-automata passes)
  // Consolidates scattered single tiles into large forests, expansive deserts, broad grasslands,
  // and ensures smooth foothills/transitions between desert and grass hills.
  for (let pass = 0; pass < 2; pass++) {
    const updates: Array<{ key: string; biome: BiomeType; temperature: TemperatureZone }> = [];
    for (const c of landCoords) {
      const k = tileKey(c.q, c.r);
      const tile = tiles[k];
      if (!tile || tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'mountain') {
        continue;
      }
      const effLat = latMap.get(k) ?? 0.5;
      const landNeighbors = hexNeighbors(tile.q, tile.r)
        .map((n) => tiles[tileKey(n.q, n.r)])
        .filter(
          (nt): nt is HexTile =>
            Boolean(nt && nt.biome !== 'ocean' && nt.biome !== 'coast' && nt.biome !== 'mountain')
        );

      if (landNeighbors.length < 2) continue;

      const sameBiomeCount = landNeighbors.filter((nt) => nt.biome === tile.biome).length;
      if (sameBiomeCount <= 1) {
        const counts = new Map<BiomeType, { count: number; temp: TemperatureZone }>();
        for (const nt of landNeighbors) {
          // Respect climate latitude constraints when clustering
          if (nt.biome === 'tundra' && effLat < 0.68) continue;
          if (nt.biome === 'desert' && effLat > 0.44) continue;
          const prev = counts.get(nt.biome);
          counts.set(nt.biome, {
            count: (prev?.count ?? 0) + 1,
            temp: nt.temperature,
          });
        }
        let bestBiome: BiomeType | null = null;
        let bestTemp: TemperatureZone = tile.temperature;
        let bestCount = 0;
        for (const [bType, info] of counts.entries()) {
          if (info.count > bestCount) {
            bestCount = info.count;
            bestBiome = bType;
            bestTemp = info.temp;
          }
        }
        if (bestBiome && bestCount >= 3) {
          updates.push({ key: k, biome: bestBiome, temperature: bestTemp });
        }
      }
    }
    for (const u of updates) {
      tiles[u.key].biome = u.biome;
      tiles[u.key].temperature = u.temperature;
    }
  }

  // Foothill & Ecotone Pass:
  // 1) Mountain ranges naturally step down through hills before flat plains/desert.
  // 2) Where arid desert meets temperate forest, place a natural grass-hills / steppe transition buffer.
  for (const c of landCoords) {
    const k = tileKey(c.q, c.r);
    const tile = tiles[k];
    if (!tile || tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'mountain') {
      continue;
    }
    const nTiles = hexNeighbors(tile.q, tile.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((nt): nt is HexTile => Boolean(nt));

    const mtnCount = nTiles.filter((nt) => nt.biome === 'mountain').length;
    if (mtnCount >= 2 && (tile.biome === 'plains' || tile.biome === 'desert')) {
      tile.biome = 'hills';
    }

    // Smooth transition between desert and dense temperate forest -> grassy hills or savanna plains
    if (tile.biome === 'desert') {
      const hasTemperateForest = nTiles.some(
        (nt) => nt.biome === 'forest' && nt.temperature === 'temperate'
      );
      const hasGrassHills = nTiles.some(
        (nt) => nt.biome === 'hills' && nt.temperature === 'temperate'
      );
      if (hasTemperateForest && !hasGrassHills) {
        tile.biome = 'hills';
        tile.temperature = 'temperate';
      }
    }
  }

  // Stamp Pre-Made Multi-Tile Landscape Clusters:
  // A) Sovereign Mountain Massifs (High Sovereign Peak + Smaller Companion Mountains + Ring of Foothills)
  const massifTarget = config.mapSize === 'large' ? 6 : config.mapSize === 'medium' ? 4 : 3;
  const uplandCandidates = Object.values(tiles).filter(
    (t) =>
      (t.biome === 'mountain' || (t.biome === 'hills' && t.elevation > 0.72)) &&
      hexNeighbors(t.q, t.r).every((n) => {
        const nt = tiles[tileKey(n.q, n.r)];
        return nt && nt.biome !== 'ocean' && nt.biome !== 'coast';
      })
  );
  const massifCenters: HexTile[] = [];
  for (let tries = 0; tries < 80 && massifCenters.length < massifTarget; tries++) {
    const cand = uplandCandidates[Math.floor(rng() * uplandCandidates.length)];
    if (!cand) break;
    if (massifCenters.some((m) => hexDistance(m.q, m.r, cand.q, cand.r) < 6)) continue;
    massifCenters.push(cand);

    cand.biome = 'mountain';
    cand.elevation = 0.98;
    cand.feature = 'none';
    cand.clusterType = 'mountain_massif';
    cand.clusterRole = 'center';

    const ring1 = hexNeighbors(cand.q, cand.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter(
        (nt): nt is HexTile => Boolean(nt && nt.biome !== 'ocean' && nt.biome !== 'coast')
      );

    // 2 adjacent tiles become smaller companion mountains; remaining ring-1 become foothills
    const subPeakCount = Math.min(2, Math.max(1, Math.floor(ring1.length * 0.35)));
    ring1.forEach((nt, idx) => {
      if (idx < subPeakCount) {
        nt.biome = 'mountain';
        nt.elevation = 0.84;
        nt.feature = 'none';
        nt.clusterType = 'mountain_massif';
        nt.clusterRole = 'inner_ring';
      } else {
        nt.biome = 'hills';
        nt.elevation = Math.max(nt.elevation, 0.68);
        nt.clusterType = 'mountain_massif';
        nt.clusterRole = 'outer_ring';
      }
    });

    // Ensure outer foothills wrap around the companion mountains too
    for (const sub of ring1.slice(0, subPeakCount)) {
      for (const n2 of hexNeighbors(sub.q, sub.r)) {
        const nt2 = tiles[tileKey(n2.q, n2.r)];
        if (
          nt2 &&
          nt2.biome !== 'ocean' &&
          nt2.biome !== 'coast' &&
          nt2.biome !== 'mountain' &&
          !nt2.clusterType
        ) {
          nt2.biome = 'hills';
          nt2.clusterType = 'mountain_massif';
          nt2.clusterRole = 'outer_ring';
        }
      }
    }
  }

  // Also organize any natural mountain tiles into coherent peak -> sub-peak -> foothill clusters
  for (const tile of Object.values(tiles)) {
    if (tile.biome !== 'mountain') continue;
    const nTiles = hexNeighbors(tile.q, tile.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((nt): nt is HexTile => Boolean(nt));

    if (!tile.clusterType) {
      const hasHigherMtnNeighbor = nTiles.some(
        (nt) => nt.biome === 'mountain' && (nt.clusterRole === 'center' || nt.elevation > tile.elevation)
      );
      tile.clusterType = 'mountain_massif';
      tile.clusterRole = hasHigherMtnNeighbor ? 'inner_ring' : 'center';
    }

    for (const nt of nTiles) {
      if (nt.biome === 'plains' || nt.biome === 'desert' || nt.biome === 'tundra') {
        nt.biome = 'hills';
        if (!nt.clusterType) {
          nt.clusterType = 'mountain_massif';
          nt.clusterRole = 'outer_ring';
        }
      } else if (nt.biome === 'hills' && !nt.clusterType) {
        nt.clusterType = 'mountain_massif';
        nt.clusterRole = 'outer_ring';
      }
    }
  }

  // B) Stamp Multi-Tile Desert Oasis Clusters (7-hex pattern: Oasis Heart surrounded by 6 Desert Dune tiles)
  const oasisTarget = config.mapSize === 'large' ? 4 : config.mapSize === 'medium' ? 3 : 2;
  const desertInteriorCandidates = Object.values(tiles).filter((t) => {
    if (t.biome !== 'desert' || t.clusterType) return false;
    const nTiles = hexNeighbors(t.q, t.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((nt): nt is HexTile => Boolean(nt));
    if (nTiles.length < 6) return false;
    const aridNeighbors = nTiles.filter(
      (nt) => nt.biome === 'desert' || (nt.biome === 'hills' && nt.temperature === 'arid')
    );
    return aridNeighbors.length >= 5;
  });

  const oasisCenters: HexTile[] = [];
  for (let tries = 0; tries < 70 && oasisCenters.length < oasisTarget; tries++) {
    const cand = desertInteriorCandidates[Math.floor(rng() * desertInteriorCandidates.length)];
    if (!cand) break;
    if (oasisCenters.some((o) => hexDistance(o.q, o.r, cand.q, cand.r) < 6)) continue;
    oasisCenters.push(cand);

    cand.biome = 'desert';
    cand.temperature = 'arid';
    cand.hasRiver = true; // Oasis spring water (+1 Food, +1 Gold)
    cand.clusterType = 'oasis';
    cand.clusterRole = 'center';

    for (const n of hexNeighbors(cand.q, cand.r)) {
      const nt = tiles[tileKey(n.q, n.r)];
      if (nt && nt.biome !== 'ocean' && nt.biome !== 'coast' && nt.biome !== 'mountain') {
        nt.biome = 'desert';
        nt.temperature = 'arid';
        nt.clusterType = 'oasis';
        nt.clusterRole = 'inner_ring';
      }
    }
  }

  // EnsurelandCoords stays accurate after cluster stamping
  landCoords.length = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { q, r } = offsetToAxial(col, row);
      const t = tiles[tileKey(q, r)];
      if (t && t.biome !== 'ocean' && t.biome !== 'coast' && t.biome !== 'mountain') {
        landCoords.push({ q, r, col, row });
      }
    }
  }

  // Smooth coastline: any ocean hex adjacent to land becomes coast
  for (const tile of Object.values(tiles)) {
    if (tile.biome === 'ocean') {
      const hasLandNeighbor = hexNeighbors(tile.q, tile.r).some((n) => {
        const nt = tiles[tileKey(n.q, n.r)];
        return nt && nt.biome !== 'ocean' && nt.biome !== 'coast';
      });
      if (hasLandNeighbor) {
        tile.biome = 'coast';
      }
    }
  }

  // Generate winding downhill rivers from highlands/mountains to coast
  generateRivers(tiles, rng, config.mapSize);

  // Generate multi-tile coastal clusters & diverse shoreline types (sandy beaches, rocky shores, high cliffs, coastal swamps, coral reefs, icy shores)
  generateShorelinesAndCoastalClusters(tiles, height, rng, config.mapSize);

  // Place 2-4 Natural Wonders on scenic land tiles
  const wonderCount = config.mapSize === 'large' ? 4 : config.mapSize === 'medium' ? 3 : 2;
  const wonderPool = [...WONDER_NAMES].sort(() => rng() - 0.5);
  let placedWonders = 0;
  for (let i = 0; i < 60 && placedWonders < wonderCount; i++) {
    const pick = landCoords[Math.floor(rng() * landCoords.length)];
    if (!pick) break;
    const t = tiles[tileKey(pick.q, pick.r)];
    if (t.feature === 'none') {
      t.feature = 'natural_wonder';
      t.wonderName = wonderPool[placedWonders];
      placedWonders++;
    }
  }

  // Compute connected passable land regions via BFS so starting units are never trapped
  const isPassableLand = (t: HexTile) =>
    t.biome !== 'ocean' && t.biome !== 'coast' && t.biome !== 'mountain';

  const regionSizeMap = new Map<string, number>();
  const visitedRegion = new Set<string>();
  const regions: HexTile[][] = [];

  for (const c of landCoords) {
    const startK = tileKey(c.q, c.r);
    if (visitedRegion.has(startK)) continue;
    const startT = tiles[startK];
    if (!startT || !isPassableLand(startT)) continue;

    const queue: HexTile[] = [startT];
    const component: HexTile[] = [];
    visitedRegion.add(startK);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const n of hexNeighbors(cur.q, cur.r)) {
        const nk = tileKey(n.q, n.r);
        if (visitedRegion.has(nk)) continue;
        const nt = tiles[nk];
        if (nt && isPassableLand(nt)) {
          visitedRegion.add(nk);
          queue.push(nt);
        }
      }
    }

    regions.push(component);
    for (const member of component) {
      regionSizeMap.set(tileKey(member.q, member.r), component.length);
    }
  }

  const minFairRegion = config.mapType === 'archipelago' ? 18 : 40;
  const largeLand = landCoords.filter((c) => {
    const k = tileKey(c.q, c.r);
    const t = tiles[k];
    const size = regionSizeMap.get(k) ?? 0;
    const passableNeighbors = hexNeighbors(t.q, t.r).filter((n) => {
      const nt = tiles[tileKey(n.q, n.r)];
      return nt && isPassableLand(nt);
    }).length;
    return size >= minFairRegion && passableNeighbors >= 4;
  });

  // Fallback to largest connected region if map is very fragmented
  regions.sort((a, b) => b.length - a.length);
  const largestRegionCoords = (regions[0] ?? []).map((t) => ({ q: t.q, r: t.r }));

  // Pick well-spaced starting positions for Player + AI Civilizations
  const totalCivs = 1 + config.aiCount;
  const startTiles: HexTile[] = [];
  const preferredLand = largeLand.filter((c) => {
    const t = tiles[tileKey(c.q, c.r)];
    return t.biome === 'plains' || t.biome === 'forest' || t.biome === 'hills';
  });
  const candidates =
    preferredLand.length >= totalCivs * 3
      ? preferredLand
      : largeLand.length >= totalCivs
        ? largeLand
        : largestRegionCoords.length >= totalCivs
          ? largestRegionCoords
          : landCoords;

  for (let cIdx = 0; cIdx < totalCivs; cIdx++) {
    let bestTile: HexTile | null = null;
    let bestScore = -1;
    for (let tries = 0; tries < 110; tries++) {
      const cand = candidates[Math.floor(rng() * candidates.length)];
      if (!cand) continue;
      const tile = tiles[tileKey(cand.q, cand.r)];
      const minDist =
        startTiles.length === 0
          ? 999
          : Math.min(...startTiles.map((st) => hexDistance(st.q, st.r, tile.q, tile.r)));
      const regBonus = Math.min(80, regionSizeMap.get(tileKey(tile.q, tile.r)) ?? 0) * 0.08;
      const score = minDist + regBonus;
      if (score > bestScore && minDist >= 4) {
        bestScore = score;
        bestTile = tile;
      }
    }
    if (!bestTile && candidates.length > 0) {
      const cand = candidates[Math.floor(rng() * candidates.length)];
      bestTile = tiles[tileKey(cand.q, cand.r)];
    }
    if (bestTile) {
      startTiles.push(bestTile);
      // Guarantee surrounding 1-ring is never blocked by impassable mountain walls
      for (const n of hexNeighbors(bestTile.q, bestTile.r)) {
        const nt = tiles[tileKey(n.q, n.r)];
        if (nt && nt.biome === 'mountain') {
          nt.biome = 'hills';
        }
      }
    }
  }

  const civs: Record<string, CivState> = {};
  const cities: Record<string, CityState> = {};
  const units: Record<string, UnitState> = {};

  const playerCivId = 'player';
  const allCivIds = [playerCivId, ...AI_CIV_PRESETS.slice(0, config.aiCount).map((p) => p.id)];

  const createRelations = (selfId: string) => {
    const rel: CivState['relations'] = {};
    for (const otherId of allCivIds) {
      if (otherId !== selfId) {
        rel[otherId] = {
          status: 'unmet',
          opinion: 0,
          tradeRouteActive: false,
          truceTurns: 0,
          lastContactTurn: 0,
        };
      }
    }
    return rel;
  };

  civs[playerCivId] = {
    id: playerCivId,
    name: config.civName.trim() || 'Terran Vanguard',
    leaderName: config.playerName.trim() || 'Commander',
    color: '#38bdf8',
    accentColor: '#bae6fd',
    isHuman: true,
    isEliminated: false,
    personality: 'scholar',
    gold: 80,
    researchPoints: 0,
    ageIndex: 0,
    domainFocus: 'matter',
    unlockedCore: [],
    coreProgress: {},
    unlockedInventions: [],
    inventionPity: {},
    earlyInventions: [],
    discoveredZones: [],
    discoveredWonders: [],
    crossedOcean: false,
    relations: createRelations(playerCivId),
  };

  AI_CIV_PRESETS.slice(0, config.aiCount).forEach((preset) => {
    civs[preset.id] = {
      id: preset.id,
      name: preset.name,
      leaderName: preset.leaderName,
      color: preset.color,
      accentColor: preset.accentColor,
      isHuman: false,
      isEliminated: false,
      personality: preset.personality,
      gold: config.difficulty === 'sovereign' ? 110 : 80,
      researchPoints: 0,
      ageIndex: 0,
      domainFocus: preset.personality === 'scholar' ? 'physics' : 'matter',
      unlockedCore: [],
      coreProgress: {},
      unlockedInventions: [],
      inventionPity: {},
      earlyInventions: [],
      discoveredZones: [],
      discoveredWonders: [],
      crossedOcean: false,
      relations: createRelations(preset.id),
    };
  });

  // Create starting capital cities + Warrior + Scout + Worker
  allCivIds.forEach((civId, idx) => {
    const st = startTiles[idx] ?? tiles[tileKey(landCoords[0].q, landCoords[0].r)];
    st.feature = 'none';
    st.biome = st.biome === 'desert' || st.biome === 'tundra' ? 'plains' : st.biome;
    if (!civs[civId].discoveredZones.includes(st.temperature)) {
      civs[civId].discoveredZones.push(st.temperature);
    }

    const cityId = `city_${civId}_capital`;
    const capitalName =
      civId === playerCivId
        ? `${config.civName.trim().split(' ')[0] || 'Nova'} Prime`
        : AI_CIV_PRESETS.find((p) => p.id === civId)?.capitalName || 'Capital';

    const territory = hexInRange(st.q, st.r, 1).filter((c) => tiles[tileKey(c.q, c.r)]);
    const workedTiles: string[] = [];
    for (const c of territory) {
      const k = tileKey(c.q, c.r);
      tiles[k].ownerCityId = cityId;
      tiles[k].ownerCivId = civId;
      workedTiles.push(k);
    }

    cities[cityId] = {
      id: cityId,
      name: capitalName,
      civId,
      q: st.q,
      r: st.r,
      isCapital: true,
      population: 2,
      foodStored: 0,
      foodNeeded: 20,
      hp: 100,
      maxHp: 100,
      buildings: [],
      producing: { type: 'unit', id: 'warrior', progress: 0, cost: 35 },
      workedTiles,
    };

    // Spawn starting Warrior on capital, Scout & Worker on nearby land
    const neighbors = hexNeighbors(st.q, st.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((t) => t && t.biome !== 'ocean' && t.biome !== 'coast' && t.biome !== 'mountain');

    const warriorId = `u_${civId}_warrior_0`;
    units[warriorId] = {
      id: warriorId,
      defId: 'warrior',
      civId,
      q: st.q,
      r: st.r,
      hp: 100,
      maxHp: 100,
      movesLeft: 2,
      xp: 0,
      level: 1,
      promotions: [],
      pendingPromotion: false,
      fortified: false,
      hasActed: false,
    };

    const scoutTile = neighbors[0] ?? st;
    const scoutId = `u_${civId}_scout_0`;
    units[scoutId] = {
      id: scoutId,
      defId: 'scout',
      civId,
      q: scoutTile.q,
      r: scoutTile.r,
      hp: 80,
      maxHp: 80,
      movesLeft: 3,
      xp: 0,
      level: 1,
      promotions: [],
      pendingPromotion: false,
      fortified: false,
      hasActed: false,
    };

    const workerTile = neighbors[1] ?? neighbors[0] ?? st;
    const workerId = `u_${civId}_worker_0`;
    units[workerId] = {
      id: workerId,
      defId: 'worker',
      civId,
      q: workerTile.q,
      r: workerTile.r,
      hp: 60,
      maxHp: 60,
      movesLeft: 2,
      xp: 0,
      level: 1,
      promotions: [],
      pendingPromotion: false,
      fortified: false,
      hasActed: false,
    };
  });

  // Spawn Peaceful & Aggressive Barbarian Camps away from capitals
  const barbarianCamps: Record<string, BarbarianCamp> = {};
  const barbarianUnits: Record<string, BarbarianUnit> = {};
  const campTarget = config.mapSize === 'large' ? 10 : config.mapSize === 'medium' ? 7 : 5;
  let campsPlaced = 0;

  for (let tries = 0; tries < 140 && campsPlaced < campTarget; tries++) {
    const cand = landCoords[Math.floor(rng() * landCoords.length)];
    if (!cand) continue;
    const t = tiles[tileKey(cand.q, cand.r)];
    if (t.ownerCityId || t.feature === 'natural_wonder') continue;
    const tooCloseToStart = startTiles.some((st) => hexDistance(st.q, st.r, t.q, t.r) < 5);
    const tooCloseToCamp = Object.values(barbarianCamps).some(
      (c) => hexDistance(c.q, c.r, t.q, t.r) < 4
    );
    if (tooCloseToStart || tooCloseToCamp) continue;

    const disposition = campsPlaced % 2 === 0 ? 'aggressive' : 'peaceful';
    const campId = `camp_${campsPlaced}`;
    const nameList =
      disposition === 'peaceful' ? BARB_TRIBE_NAMES.slice(0, 5) : BARB_TRIBE_NAMES.slice(5);
    const campName = nameList[campsPlaced % nameList.length];

    barbarianCamps[campId] = {
      id: campId,
      name: campName,
      q: t.q,
      r: t.r,
      disposition,
      hp: 70,
      maxHp: 70,
      attitude: disposition === 'peaceful' ? 35 : -50,
      tradedThisTurn: false,
      spawnCooldown: 3,
    };

    const barbUnitId = `bu_${campsPlaced}_0`;
    barbarianUnits[barbUnitId] = {
      id: barbUnitId,
      campId,
      disposition,
      name: disposition === 'peaceful' ? 'Tribal Watch' : 'Barbarian Raider',
      q: t.q,
      r: t.r,
      hp: 80,
      maxHp: 80,
      attack: disposition === 'peaceful' ? 9 : 13,
      defense: 11,
      movesLeft: 2,
    };

    campsPlaced++;
  }

  const state: GameState = {
    id: `game_${Date.now()}`,
    config,
    turn: 1,
    width,
    height,
    tiles,
    civs,
    cities,
    units,
    barbarianCamps,
    barbarianUnits,
    playerCivId,
    winnerCivId: null,
    activeEvent: null,
    notices: [
      {
        id: 'welcome_1',
        turn: 1,
        title: 'A Veiled World Awaits',
        detail:
          'Send Scouts to reveal hidden terrain, survey flora and minerals for Core Knowledge, and defend your capital.',
        kind: 'event',
      },
    ],
    recentCombats: [],
    seed,
  };

  return state;
}

// Edge index 0..5 -> axial neighbor offset (matches HexMapCanvas corner angles -30..330)
const EDGE_OFFSETS: Array<[number, number]> = [
  [1, 0],   // 0: E
  [0, 1],   // 1: SE
  [-1, 1],  // 2: SW
  [-1, 0],  // 3: W
  [0, -1],  // 4: NW
  [1, -1],  // 5: NE
];

function generateRivers(
  tiles: Record<string, HexTile>,
  rng: () => number,
  mapSize: GameConfig['mapSize']
) {
  const sources = Object.values(tiles).filter(
    (t) =>
      (t.biome === 'mountain' || t.biome === 'hills') &&
      t.temperature !== 'arid' &&
      !hexNeighbors(t.q, t.r).some((n) => {
        const nt = tiles[tileKey(n.q, n.r)];
        return nt && (nt.biome === 'coast' || nt.biome === 'ocean');
      })
  );

  const targetRivers = mapSize === 'large' ? 11 : mapSize === 'medium' ? 8 : 5;
  const shuffled = [...sources].sort(() => rng() - 0.5);
  let created = 0;

  for (const src of shuffled) {
    if (created >= targetRivers) break;
    if (src.hasRiver) continue;

    // Pick initial edge between src and a land neighbor
    let curTile = src;
    let curEdge = Math.floor(rng() * 6);
    const [dq, dr] = EDGE_OFFSETS[curEdge];
    const firstNeighbor = tiles[tileKey(curTile.q + dq, curTile.r + dr)];
    if (!firstNeighbor || firstNeighbor.biome === 'ocean' || firstNeighbor.biome === 'coast') {
      continue;
    }

    let steps = 0;
    let reachedSea = false;
    while (steps < 16) {
      const [ndq, ndr] = EDGE_OFFSETS[curEdge];
      const oppTile = tiles[tileKey(curTile.q + ndq, curTile.r + ndr)];
      if (!oppTile) break;

      const curIsWater = curTile.biome === 'coast' || curTile.biome === 'ocean';
      const oppIsWater = oppTile.biome === 'coast' || oppTile.biome === 'ocean';

      if (curIsWater && oppIsWater) {
        reachedSea = true;
        break;
      }

      if (!curTile.riverEdges) curTile.riverEdges = [false, false, false, false, false, false];
      if (!oppTile.riverEdges) oppTile.riverEdges = [false, false, false, false, false, false];

      if (curTile.riverEdges[curEdge]) {
        // Merged into another river
        reachedSea = true;
        break;
      }

      curTile.riverEdges[curEdge] = true;
      oppTile.riverEdges[(curEdge + 3) % 6] = true;
      if (!curIsWater) curTile.hasRiver = true;
      if (!oppIsWater) oppTile.hasRiver = true;

      if (curIsWater || oppIsWater) {
        reachedSea = true;
        break;
      }

      // Advance along endpoint corner (curEdge + 1) % 6 -> two candidate outgoing edges
      const optA = { tile: curTile, edge: (curEdge + 1) % 6 };
      const optB = { tile: oppTile, edge: (curEdge + 2) % 6 };

      const scoreCandidate = (cand: { tile: HexTile; edge: number }) => {
        const [cdq, cdr] = EDGE_OFFSETS[cand.edge];
        const other = tiles[tileKey(cand.tile.q + cdq, cand.tile.r + cdr)];
        if (!other) return -999;
        if (cand.tile.riverEdges?.[cand.edge]) return -50;
        const avgElev = (cand.tile.elevation + other.elevation) * 0.5;
        const waterBonus =
          other.biome === 'coast' ||
          other.biome === 'ocean' ||
          cand.tile.biome === 'coast' ||
          cand.tile.biome === 'ocean'
            ? 2.0
            : 0;
        return waterBonus - avgElev + (rng() - 0.5) * 0.28;
      };

      const sA = scoreCandidate(optA);
      const sB = scoreCandidate(optB);
      const chosen = sA >= sB ? optA : optB;
      curTile = chosen.tile;
      curEdge = chosen.edge;
      steps++;
    }

    if (reachedSea || steps >= 4) {
      created++;
    }
  }
}

function generateShorelinesAndCoastalClusters(
  tiles: Record<string, HexTile>,
  height: number,
  rng: () => number,
  mapSize: GameConfig['mapSize']
) {
  const coastTiles = Object.values(tiles).filter((t) => t.biome === 'coast');

  // 1. Stamp Multi-Tile Coral Reef Lagoon & Atoll Clusters in warm coastal waters
  const warmCoastCandidates = coastTiles.filter((t) => {
    const lat = Math.abs(t.r / Math.max(1, height - 1) - 0.5) * 2;
    return lat < 0.38;
  });
  const coralClusterTarget = mapSize === 'large' ? 4 : mapSize === 'medium' ? 3 : 2;
  const coralCenters: HexTile[] = [];

  for (let tries = 0; tries < 60 && coralCenters.length < coralClusterTarget; tries++) {
    const cand = warmCoastCandidates[Math.floor(rng() * warmCoastCandidates.length)];
    if (!cand) break;
    if (coralCenters.some((c) => hexDistance(c.q, c.r, cand.q, cand.r) < 5)) continue;
    coralCenters.push(cand);

    cand.shoreline = 'coral_reef';
    cand.clusterType = 'coral_lagoon';
    cand.clusterRole = 'center';

    for (const n of hexNeighbors(cand.q, cand.r)) {
      const nt = tiles[tileKey(n.q, n.r)];
      if (!nt) continue;
      if (nt.biome === 'coast') {
        nt.shoreline = 'coral_reef';
        nt.clusterType = 'coral_lagoon';
        nt.clusterRole = 'inner_ring';
      } else if (nt.biome === 'plains' || nt.biome === 'desert') {
        nt.shoreline = 'sandy_beach';
      }
    }
  }

  // 2. Stamp Multi-Tile River Delta & Coastal Mangrove Swamp Clusters
  for (const ct of coastTiles) {
    if (ct.clusterType) continue;
    const lat = Math.abs(ct.r / Math.max(1, height - 1) - 0.5) * 2;
    if (lat >= 0.72) continue;

    const nTiles = hexNeighbors(ct.q, ct.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((nt): nt is HexTile => Boolean(nt));

    const hasRiverMouth =
      ct.riverEdges?.some(Boolean) ||
      nTiles.some((nt) => nt.biome !== 'ocean' && nt.biome !== 'coast' && nt.hasRiver);

    if (hasRiverMouth) {
      ct.shoreline = 'coastal_swamp';
      ct.clusterType = 'coastal_swamp_delta';
      ct.clusterRole = 'center';

      for (const nt of nTiles) {
        if (nt.biome === 'coast' && !nt.clusterType) {
          nt.shoreline = 'coastal_swamp';
          nt.clusterType = 'coastal_swamp_delta';
          nt.clusterRole = 'inner_ring';
        } else if (nt.biome === 'plains' || nt.biome === 'forest') {
          nt.shoreline = 'coastal_swamp';
          if (!nt.clusterType) {
            nt.clusterType = 'coastal_swamp_delta';
            nt.clusterRole = 'outer_ring';
          }
        }
      }
    }
  }

  // 3. Stamp Multi-Tile High Sea Cliff Headland Clusters & Arctic Icy Fjord Clusters,
  // and classify all remaining coastal water & coastal land tiles!
  for (const ct of coastTiles) {
    const lat = Math.abs(ct.r / Math.max(1, height - 1) - 0.5) * 2;
    const landNeighbors = hexNeighbors(ct.q, ct.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter(
        (nt): nt is HexTile => Boolean(nt && nt.biome !== 'ocean' && nt.biome !== 'coast')
      );

    if (lat >= 0.74 || landNeighbors.some((nt) => nt.temperature === 'arctic' || nt.biome === 'tundra')) {
      ct.shoreline = 'icy_shore';
      if (!ct.clusterType) {
        ct.clusterType = 'icy_fjord';
        ct.clusterRole = 'center';
      }
      for (const l of landNeighbors) {
        if (!l.shoreline) l.shoreline = 'icy_shore';
      }
      continue;
    }

    if (ct.shoreline) continue;

    const hasMtnOrHighHill = landNeighbors.some(
      (nt) => nt.biome === 'mountain' || nt.biome === 'hills'
    );
    const hasForest = landNeighbors.some((nt) => nt.biome === 'forest');
    const hasDesertOrPlains = landNeighbors.some(
      (nt) => nt.biome === 'desert' || nt.biome === 'plains'
    );

    if (hasMtnOrHighHill) {
      const isHighCliff =
        landNeighbors.some((nt) => nt.biome === 'mountain' || nt.elevation > 0.64) ||
        rng() < 0.58;
      ct.shoreline = isHighCliff ? 'high_cliffs' : 'rocky_shore';
      ct.clusterType = 'cliff_headland';
      ct.clusterRole = isHighCliff ? 'center' : 'inner_ring';
      for (const l of landNeighbors) {
        if (l.biome === 'hills' || l.biome === 'mountain') {
          l.shoreline = isHighCliff ? 'high_cliffs' : 'rocky_shore';
        }
      }
    } else if (hasForest && lat < 0.34 && rng() < 0.48) {
      ct.shoreline = 'coastal_swamp';
      ct.clusterType = 'coastal_swamp_delta';
      ct.clusterRole = 'inner_ring';
      for (const l of landNeighbors) {
        if (!l.shoreline) l.shoreline = 'coastal_swamp';
      }
    } else if (hasDesertOrPlains) {
      if (lat < 0.32 && rng() < 0.28) {
        ct.shoreline = 'coral_reef';
      } else {
        ct.shoreline = 'sandy_beach';
      }
      for (const l of landNeighbors) {
        if (!l.shoreline) l.shoreline = 'sandy_beach';
      }
    } else {
      ct.shoreline = rng() < 0.55 ? 'rocky_shore' : 'sandy_beach';
      for (const l of landNeighbors) {
        if (!l.shoreline) l.shoreline = ct.shoreline;
      }
    }
  }

  // 4. Smooth shoreline stretches along adjacent coast tiles so beaches, cliffs, swamps, and reefs form multi-tile bays
  for (const ct of coastTiles) {
    if (ct.clusterType) continue;
    const coastNeighbors = hexNeighbors(ct.q, ct.r)
      .map((n) => tiles[tileKey(n.q, n.r)])
      .filter((nt): nt is HexTile => Boolean(nt && nt.biome === 'coast' && nt.shoreline));
    if (coastNeighbors.length >= 2) {
      const same = coastNeighbors.filter((nt) => nt.shoreline === ct.shoreline).length;
      if (same === 0) {
        ct.shoreline = coastNeighbors[0].shoreline;
      }
    }
  }
}
