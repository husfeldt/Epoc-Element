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
  TerrainSubType,
  UnitState,
} from '../types/game';
import {
  HEX_SIZE,
  axialToPixel,
  hexDistance,
  hexInRange,
  hexNeighbors,
  tileKey,
} from './hexMath';
import { fbm2D, ridgedNoise2D } from './noise';
import { buildWorldRenderProps } from './terrainRenderer';

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
  if (size === 'small') return { width: 40, height: 26 };
  if (size === 'large') return { width: 72, height: 46 };
  if (size === 'huge') return { width: 90, height: 58 };
  return { width: 56, height: 36 };
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

  // Multi-octave Simplex/Perlin Elevation, Moisture, and Temperature fields
  const elevSeed = seed * 3 + 17;
  const ridgeSeed = seed * 5 + 31;
  const moistSeed = seed * 7 + 53;
  const tempSeed = seed * 11 + 79;

  // Map-type macro shaping + domain-warped fBm continents & tectonic ridges (15-30+ hex macro-clusters)
  const elevScale =
    config.mapType === 'archipelago'
      ? 0.078
      : config.mapType === 'pangaea'
        ? 0.040
        : 0.050;

  const tiles: Record<string, HexTile> = {};
  const landCoords: Array<{ q: number; r: number; col: number; row: number }> = [];
  const moistureMap = new Map<string, number>();
  const latMap = new Map<string, number>();
  const rawElevMap = new Map<string, number>();

  // Pass 1: Domain-Warped Continuous Elevation & Latitude Temperature fields
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { q, r } = offsetToAxial(col, row);
      const key = tileKey(q, r);

      // Low-frequency domain warp for organic continents & macro climate basins
      const warpX = (fbm2D(col * 0.024, row * 0.024, elevSeed + 101, 2) - 0.5) * 7.5;
      const warpY = (fbm2D(col * 0.024, row * 0.024, elevSeed + 202, 2) - 0.5) * 7.5;
      const wx = (col + warpX) * elevScale;
      const wy = (row + warpY) * elevScale;

      let elev = fbm2D(wx, wy, elevSeed, 4, 2.05, 0.52) * 1.15;
      const ridge = ridgedNoise2D(wx * 1.15, wy * 1.15, ridgeSeed, 3);

      // Tectonic ridges boost highland chains where base continent is already above sea level
      if (elev > 0.48 && ridge > 0.52) {
        elev += (ridge - 0.52) * 1.15;
      } else {
        elev += ridge * 0.14;
      }

      const nx = col / width - 0.5;
      const ny = row / height - 0.5;
      const centerDist = Math.sqrt(nx * nx + ny * ny);

      if (config.mapType === 'pangaea') {
        elev += Math.max(0, 0.44 - centerDist * 0.92);
      } else if (config.mapType === 'inland_sea') {
        if (centerDist < 0.24) elev -= 0.55;
        else elev += 0.22;
      } else if (config.mapType === 'wild_frontier') {
        elev += 0.18;
      } else if (config.mapType === 'archipelago') {
        elev -= 0.09;
      }

      // Edge ocean falloff
      const edgeX = Math.min(col, width - 1 - col) / (width * 0.14);
      const edgeY = Math.min(row, height - 1 - row) / (height * 0.14);
      const edgeFactor = Math.min(1, Math.min(edgeX, edgeY));
      if (config.mapType !== 'inland_sea') {
        elev *= 0.32 + 0.68 * edgeFactor;
      }

      rawElevMap.set(key, elev);

      // Domain-warped Latitude temperature cooling toward poles (0 = equator, 1 = poles)
      const baseLat = Math.abs(row / Math.max(1, height - 1) - 0.5) * 2;
      const tWarpX = (fbm2D(col * 0.022, row * 0.022, tempSeed + 31, 2) - 0.5) * 6.0;
      const tWarpY = (fbm2D(col * 0.022, row * 0.022, tempSeed + 67, 2) - 0.5) * 6.0;
      const tempNoise = (fbm2D((col + tWarpX) * 0.028, (row + tWarpY) * 0.028, tempSeed, 3) - 0.5) * 0.14;
      const effLat = Math.max(0, Math.min(1, baseLat + tempNoise));
      latMap.set(key, effLat);
    }
  }

  // Pass 2: Domain-Warped Macro-Scale Moisture field with orographic rain-shadow drying behind mountain chains
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { q, r } = offsetToAxial(col, row);
      const key = tileKey(q, r);
      const elev = rawElevMap.get(key) ?? 0.4;

      const mWarpX = (fbm2D(col * 0.020, row * 0.020, moistSeed + 41, 2) - 0.5) * 7.0;
      const mWarpY = (fbm2D(col * 0.020, row * 0.020, moistSeed + 83, 2) - 0.5) * 7.0;
      let moisture = fbm2D((col + mWarpX) * 0.024, (row + mWarpY) * 0.024, moistSeed, 4, 2.0, 0.52);

      // Check prevailing windward (west/northwest) neighbors for mountain rain-shadow
      let mountainBarrier = 0;
      for (let d = 1; d <= 3; d++) {
        const wCol = col - d;
        if (wCol >= 0) {
          const wAxial = offsetToAxial(wCol, row);
          const wElev = rawElevMap.get(tileKey(wAxial.q, wAxial.r)) ?? 0;
          if (wElev > 0.94) {
            mountainBarrier += (4 - d) * 0.075;
          }
        }
      }
      // Coastal humidity bonus when near ocean/water
      let coastalHumid = 0;
      for (const n of hexNeighbors(q, r)) {
        const nElev = rawElevMap.get(tileKey(n.q, n.r));
        if (nElev !== undefined && nElev < 0.52) {
          coastalHumid += 0.035;
        }
      }

      moisture = Math.max(
        0.02,
        Math.min(0.98, moisture + coastalHumid - Math.min(0.32, mountainBarrier))
      );
      moistureMap.set(key, moisture);

      const effLat = latMap.get(key) ?? 0.5;
      let biome: BiomeType = 'ocean';
      let temperature: TemperatureZone = 'ocean';

      if (elev < 0.48) {
        biome = 'ocean';
        temperature = 'ocean';
      } else if (elev < 0.56) {
        biome = 'coast';
        temperature = 'ocean';
      } else {
        // Climate & Elevation classification
        if (effLat >= 0.76) {
          temperature = 'arctic';
          if (elev > 0.99) {
            biome = 'mountain';
          } else if (elev > 0.82) {
            biome = 'hills';
          } else if (effLat < 0.85 && moisture > 0.44) {
            biome = 'forest'; // Boreal taiga belt
          } else {
            biome = 'tundra';
          }
        } else if (effLat >= 0.38) {
          temperature = 'temperate';
          if (elev > 0.99) {
            biome = 'mountain';
          } else if (elev > 0.81) {
            biome = 'hills';
          } else if (moisture >= 0.43) {
            biome = 'forest';
          } else {
            biome = 'plains';
          }
        } else if (effLat >= 0.17) {
          if (moisture < 0.42) {
            temperature = 'arid';
            biome = elev > 1.0 ? 'mountain' : elev > 0.83 ? 'hills' : 'desert';
          } else if (moisture < 0.50) {
            temperature = effLat >= 0.27 ? 'temperate' : 'arid';
            biome = elev > 0.99 ? 'mountain' : elev > 0.81 ? 'hills' : 'plains';
          } else {
            temperature = effLat < 0.25 ? 'tropical' : 'temperate';
            biome = elev > 0.99 ? 'mountain' : elev > 0.82 ? 'hills' : 'forest';
          }
        } else {
          if (moisture < 0.30) {
            temperature = 'arid';
            biome = elev > 1.0 ? 'mountain' : elev > 0.83 ? 'hills' : 'desert';
          } else {
            temperature = 'tropical';
            if (elev > 0.99) {
              biome = 'mountain';
            } else if (elev > 0.82) {
              biome = 'hills';
            } else if (moisture >= 0.41) {
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
        if (biome === 'hills') {
          if (fRoll < 0.045) feature = 'coal';
          else if (fRoll < 0.090) feature = 'iron';
          else if (fRoll < 0.130) feature = 'copper';
          else if (fRoll < 0.155) feature = 'geothermal_vent';
        } else {
          if (fRoll < 0.040) feature = 'rare_flora';
          else if (fRoll < 0.068) feature = 'fossils';
          else if (fRoll < 0.092) feature = 'ancient_ruins';
        }
      }

      // Low-frequency Forest Species Noise Field (8-18 hex regional conifer vs. broadleaf belts)
      const speciesNoise = fbm2D(col * 0.032, row * 0.032, seed * 13 + 97, 3);
      const forestSpecies: HexTile['forestSpecies'] =
        temperature === 'tropical'
          ? 'tropical'
          : temperature === 'arctic' || effLat >= 0.66 || speciesNoise < 0.48
            ? 'conifer'
            : 'broadleaf';

      tiles[key] = {
        q,
        r,
        biome,
        temperature,
        forestSpecies,
        elevation: Math.max(0, Math.min(1, elev / 1.35)),
        moisture,
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

  // Regional Biome Clustering & Climate Transition Smoothing (3 cellular-automata passes)
  // Consolidates scattered single tiles into large 15-30+ hex forests, expansive deserts, broad grasslands,
  // and ensures smooth foothills/transitions between desert and grass hills.
  for (let pass = 0; pass < 3; pass++) {
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

  // Minimum-Region Pruning Pass: absorb isolated 1-2 hex land biome pockets
  // (e.g. a lone desert or swamp/forest hex surrounded by temperate plains) into their majority neighbor biome.
  {
    const visited = new Set<string>();
    for (const c of landCoords) {
      const startKey = tileKey(c.q, c.r);
      if (visited.has(startKey)) continue;
      const startTile = tiles[startKey];
      if (
        !startTile ||
        startTile.biome === 'ocean' ||
        startTile.biome === 'coast' ||
        startTile.biome === 'mountain'
      ) {
        continue;
      }

      // Flood-fill connected component of same biome
      const targetBiome = startTile.biome;
      const component: string[] = [];
      const queue: string[] = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const curKey = queue.pop()!;
        component.push(curKey);
        const curTile = tiles[curKey];
        for (const n of hexNeighbors(curTile.q, curTile.r)) {
          const nk = tileKey(n.q, n.r);
          if (visited.has(nk)) continue;
          const nt = tiles[nk];
          if (nt && nt.biome === targetBiome) {
            visited.add(nk);
            queue.push(nk);
          }
        }
      }

      if (component.length <= 3) {
        const neighborCounts = new Map<BiomeType, { count: number; temp: TemperatureZone }>();
        for (const compKey of component) {
          const ct = tiles[compKey];
          const effLat = latMap.get(compKey) ?? 0.5;
          for (const n of hexNeighbors(ct.q, ct.r)) {
            const nt = tiles[tileKey(n.q, n.r)];
            if (
              !nt ||
              nt.biome === 'ocean' ||
              nt.biome === 'coast' ||
              nt.biome === 'mountain' ||
              nt.biome === targetBiome
            ) {
              continue;
            }
            if (nt.biome === 'tundra' && effLat < 0.65) continue;
            if (nt.biome === 'desert' && effLat > 0.45) continue;
            const prev = neighborCounts.get(nt.biome);
            neighborCounts.set(nt.biome, {
              count: (prev?.count ?? 0) + 1,
              temp: nt.temperature,
            });
          }
        }
        let bestBiome: BiomeType | null = null;
        let bestTemp: TemperatureZone = startTile.temperature;
        let bestCount = 0;
        for (const [bType, info] of neighborCounts.entries()) {
          if (info.count > bestCount) {
            bestCount = info.count;
            bestBiome = bType;
            bestTemp = info.temp;
          }
        }
        if (bestBiome) {
          for (const compKey of component) {
            tiles[compKey].biome = bestBiome;
            tiles[compKey].temperature = bestTemp;
          }
        }
      }
    }
  }

  // Strict Latitude/Temperature Banding Validator (separate Tropical palms from Arctic snow pines by >=4-6 temperate hexes)
  for (const c of landCoords) {
    const k = tileKey(c.q, c.r);
    const tile = tiles[k];
    if (!tile || tile.biome === 'ocean' || tile.biome === 'coast') continue;
    const effLat = latMap.get(k) ?? 0.5;
    if (tile.temperature === 'tropical' && effLat >= 0.34) {
      tile.temperature = 'temperate';
      tile.forestSpecies = 'broadleaf';
    } else if (tile.temperature === 'arctic' && effLat < 0.62) {
      tile.temperature = 'temperate';
      tile.forestSpecies = 'conifer';
    }
    if (tile.temperature === 'tropical') {
      const nearArctic = hexInRange(tile.q, tile.r, 4).some((rc) => {
        const rt = tiles[tileKey(rc.q, rc.r)];
        return rt && rt.temperature === 'arctic';
      });
      if (nearArctic) {
        tile.temperature = 'temperate';
        tile.forestSpecies = 'broadleaf';
      }
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

  // Mountain Pass Carving: ensure connected tectonic mountain chains have navigable passes every 5-7 hexes
  {
    const mtnVisited = new Set<string>();
    for (const tile of Object.values(tiles)) {
      const startKey = tileKey(tile.q, tile.r);
      if (tile.biome !== 'mountain' || mtnVisited.has(startKey)) continue;
      const chain: HexTile[] = [];
      const qStack: HexTile[] = [tile];
      mtnVisited.add(startKey);
      while (qStack.length > 0) {
        const cur = qStack.pop()!;
        chain.push(cur);
        for (const n of hexNeighbors(cur.q, cur.r)) {
          const nk = tileKey(n.q, n.r);
          if (mtnVisited.has(nk)) continue;
          const nt = tiles[nk];
          if (nt && nt.biome === 'mountain') {
            mtnVisited.add(nk);
            qStack.push(nt);
          }
        }
      }
      if (chain.length >= 6) {
        for (let idx = 5; idx < chain.length; idx += 6) {
          const passTile = chain[idx];
          const nList = hexNeighbors(passTile.q, passTile.r)
            .map((n) => tiles[tileKey(n.q, n.r)])
            .filter((nt): nt is HexTile => Boolean(nt));
          const passableNeighbors = nList.filter(
            (nt) => nt.biome !== 'mountain' && nt.biome !== 'ocean' && nt.biome !== 'coast'
          ).length;
          if (passableNeighbors >= 2) {
            passTile.biome = 'hills';
            passTile.elevation = Math.min(passTile.elevation, 0.72);
            passTile.clusterRole = 'outer_ring';
          }
        }
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

  // Water & Coastline Hierarchy:
  // 1) DEEP_OCEAN can NEVER directly border any land tile. Convert water within 1-2 hexes of land to SHALLOW_COAST.
  const isLandTile = (t: HexTile | undefined) =>
    Boolean(t && t.biome !== 'ocean' && t.biome !== 'coast');

  for (const tile of Object.values(tiles)) {
    if (tile.biome === 'ocean') {
      const dist1Land = hexNeighbors(tile.q, tile.r).some((n) =>
        isLandTile(tiles[tileKey(n.q, n.r)])
      );
      if (dist1Land) {
        tile.biome = 'coast';
      }
    }
  }
  // Second ring (2 tiles from land) forms natural shallow shelf bays
  for (const tile of Object.values(tiles)) {
    if (tile.biome === 'ocean') {
      const adjCoastBorderingLand = hexNeighbors(tile.q, tile.r).some((n) => {
        const nt = tiles[tileKey(n.q, n.r)];
        if (!nt || nt.biome !== 'coast') return false;
        return hexNeighbors(nt.q, nt.r).some((n2) => isLandTile(tiles[tileKey(n2.q, n2.r)]));
      });
      if (adjCoastBorderingLand && tile.elevation > 0.25) {
        tile.biome = 'coast';
      }
    }
  }

  // Detect enclosed inland lakes (small connected water components <= 7 hexes not touching map border)
  const visitedWater = new Set<string>();
  for (const tile of Object.values(tiles)) {
    if (tile.biome !== 'ocean' && tile.biome !== 'coast') continue;
    const sk = tileKey(tile.q, tile.r);
    if (visitedWater.has(sk)) continue;
    const comp: HexTile[] = [];
    const wq: HexTile[] = [tile];
    visitedWater.add(sk);
    let touchesEdge = false;
    while (wq.length > 0) {
      const cur = wq.shift()!;
      comp.push(cur);
      const nbs = hexNeighbors(cur.q, cur.r);
      if (nbs.some((n) => !tiles[tileKey(n.q, n.r)])) {
        touchesEdge = true;
      }
      for (const n of nbs) {
        const nk = tileKey(n.q, n.r);
        const nt = tiles[nk];
        if (nt && (nt.biome === 'ocean' || nt.biome === 'coast') && !visitedWater.has(nk)) {
          visitedWater.add(nk);
          wq.push(nt);
        }
      }
    }
    if (!touchesEdge && comp.length <= 7) {
      for (const wt of comp) {
        wt.biome = 'coast';
        wt.isLake = true;
      }
    }
  }

  // Gradual Biome Transition Matrix (No abrupt desert-to-jungle or tundra-to-temperate jumps)
  for (let pass = 0; pass < 2; pass++) {
    for (const tile of Object.values(tiles)) {
      if (tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'mountain') continue;
      const nTiles = hexNeighbors(tile.q, tile.r)
        .map((n) => tiles[tileKey(n.q, n.r)])
        .filter((nt): nt is HexTile => Boolean(nt && isLandTile(nt)));

      if (tile.biome === 'desert') {
        const bordersLush = nTiles.some(
          (nt) => nt.biome === 'forest' && (nt.temperature === 'tropical' || nt.temperature === 'temperate')
        );
        if (bordersLush) {
          tile.biome = 'plains'; // Savanna / Arid Steppe buffer
          tile.temperature = 'arid';
          tile.terrainSubType = 'savanna';
        }
      } else if (tile.biome === 'tundra') {
        const bordersWarm = nTiles.some(
          (nt) =>
            (nt.biome === 'plains' && nt.temperature !== 'arctic') ||
            nt.biome === 'desert' ||
            nt.temperature === 'tropical'
        );
        if (bordersWarm) {
          tile.biome = 'forest'; // Boreal Taiga buffer
          tile.temperature = 'arctic';
          tile.terrainSubType = 'boreal_taiga';
        }
      }
    }
  }

  // Guarantee 2-5 hex contiguous inland freshwater lakes before river routing
  {
    const existingLakes = Object.values(tiles).filter((t) => t.isLake).length;
    const targetLakes =
      config.mapSize === 'huge' ? 5 : config.mapSize === 'large' ? 4 : config.mapSize === 'medium' ? 3 : 2;
    if (existingLakes < targetLakes * 2) {
      const lakeCenters = Object.values(tiles).filter(
        (t) =>
          (t.biome === 'plains' || t.biome === 'forest') &&
          t.temperature !== 'arid' &&
          t.elevation < 0.62 &&
          t.feature === 'none' &&
          hexInRange(t.q, t.r, 3).every((c) => {
            const nt = tiles[tileKey(c.q, c.r)];
            return nt && nt.biome !== 'ocean' && nt.biome !== 'coast';
          })
      );
      let lakesCreated = 0;
      for (let tries = 0; tries < 80 && lakesCreated < targetLakes; tries++) {
        const center = lakeCenters[Math.floor(rng() * lakeCenters.length)];
        if (!center || center.isLake) continue;
        center.biome = 'coast';
        center.temperature = 'ocean';
        center.isLake = true;
        center.shoreline = 'sandy_beach';
        center.elevation = 0.25;
        const nList = hexNeighbors(center.q, center.r)
          .map((n) => tiles[tileKey(n.q, n.r)])
          .filter((nt): nt is HexTile => Boolean(nt && nt.biome !== 'mountain' && nt.feature === 'none'));
        const lakeSize = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < Math.min(lakeSize, nList.length); k++) {
          nList[k].biome = 'coast';
          nList[k].temperature = 'ocean';
          nList[k].isLake = true;
          nList[k].shoreline = 'sandy_beach';
          nList[k].elevation = 0.25;
        }
        lakesCreated++;
      }
    }
  }

  // Phase 4: Flood-Fill Lake Classification (< 16 contiguous enclosed water tiles -> Freshwater LAKE)
  {
    const waterVisited = new Set<string>();
    const edgeKeys = new Set<string>();
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
          const ax = offsetToAxial(col, row);
          edgeKeys.add(tileKey(ax.q, ax.r));
        }
      }
    }

    for (const tile of Object.values(tiles)) {
      const startKey = tileKey(tile.q, tile.r);
      if (waterVisited.has(startKey)) continue;
      if (tile.biome !== 'ocean' && tile.biome !== 'coast') continue;

      const comp: HexTile[] = [];
      const queue: HexTile[] = [tile];
      waterVisited.add(startKey);
      let touchesBorder = edgeKeys.has(startKey);

      while (queue.length > 0) {
        const cur = queue.pop()!;
        comp.push(cur);
        for (const n of hexNeighbors(cur.q, cur.r)) {
          const nk = tileKey(n.q, n.r);
          if (waterVisited.has(nk)) continue;
          const nt = tiles[nk];
          if (nt && (nt.biome === 'ocean' || nt.biome === 'coast')) {
            waterVisited.add(nk);
            if (edgeKeys.has(nk)) touchesBorder = true;
            queue.push(nt);
          }
        }
      }

      const isEnclosedLake = !touchesBorder && comp.length < 16;
      for (const wt of comp) {
        wt.isLake = isEnclosedLake;
        if (isEnclosedLake) {
          wt.biome = 'coast';
          wt.temperature = 'ocean';
          wt.shoreline = 'sandy_beach';
        }
      }
    }
  }

  // Generate continuous source-to-sea meandering rivers via hex-vertex Priority-Flood graph
  const { riverPaths, rivers } = generateRivers(tiles, rng, config.mapSize);

  // Generate multi-tile coastal clusters & diverse shoreline types (sandy beaches, rocky shores, high cliffs, coastal swamps, coral reefs, icy shores)
  generateShorelinesAndCoastalClusters(tiles, height, rng, config.mapSize);

  // Assign deterministic terrainSubType & 6-neighbor coastBitmask (0..63) for every tile
  finalizeTileRenderMetadata(tiles, height);

  // Phase 3: Place 4-8 Unique Natural Wonders & Ancient World Wonders (at most once each, >=12 hexes apart)
  const WONDER_CATALOG: Array<{
    id: string;
    name: string;
    desc: string;
    match: (t: HexTile) => boolean;
  }> = [
    {
      id: 'wonder_mount_celestial',
      name: 'Mount Celestial',
      desc: 'Sacred twin-peak alpine massif with glacial waterfalls (+3 Gold, +3 Science).',
      match: (t) => t.biome === 'hills' || t.biome === 'mountain',
    },
    {
      id: 'wonder_sunken_emerald_canyon',
      name: 'The Sunken Emerald Canyon',
      desc: 'Terraced gorge carved with turquoise river pools (+3 Gold, +3 Science).',
      match: (t) => (t.biome === 'plains' || t.biome === 'hills') && t.temperature !== 'arctic',
    },
    {
      id: 'wonder_great_sapphire_atoll',
      name: 'The Great Sapphire Atoll',
      desc: 'Vibrant circular coral lagoon reef in tropical shallows (+3 Gold, +3 Science).',
      match: (t) => t.biome === 'coast' && t.temperature !== 'arctic' && !t.isLake,
    },
    {
      id: 'wonder_crimson_pillar_mesas',
      name: 'Crimson Pillar Mesas',
      desc: 'Monumental red-rock desert spires and natural stone arch (+3 Gold, +3 Science).',
      match: (t) => t.biome === 'desert' || (t.biome === 'hills' && t.temperature === 'arid'),
    },
    {
      id: 'wonder_overgrown_sun_ziggurat',
      name: 'The Overgrown Sun Ziggurat',
      desc: 'Ancient stepped stone pyramid reclaimed by jungle vines (+3 Gold, +3 Science).',
      match: (t) => t.biome === 'forest' && t.temperature === 'tropical',
    },
    {
      id: 'wonder_colossus_of_the_coast',
      name: 'Colossus of the Coast',
      desc: 'Weathered ancient giant stone statue overlooking a coastal bay (+3 Gold, +3 Science).',
      match: (t) =>
        t.biome !== 'ocean' &&
        t.biome !== 'coast' &&
        t.biome !== 'mountain' &&
        hexNeighbors(t.q, t.r).some((n) => tiles[tileKey(n.q, n.r)]?.biome === 'coast'),
    },
    {
      id: 'wonder_astral_monolith_ring',
      name: 'The Astral Monolith Ring',
      desc: 'Ancient standing stone circle aligned to the stars (+3 Gold, +3 Science).',
      match: (t) =>
        (t.biome === 'hills' || t.biome === 'plains') && t.temperature === 'temperate',
    },
    {
      id: 'wonder_petrified_leviathan',
      name: 'The Petrified Leviathan',
      desc: 'Colossal fossilized ridge half-buried in arid steppe (+3 Gold, +3 Science).',
      match: (t) => t.biome === 'desert' || (t.biome === 'plains' && t.temperature === 'arid'),
    },
  ];

  const wonderTarget = config.mapSize === 'large' ? 8 : config.mapSize === 'medium' ? 6 : 4;
  const shuffledWonders = [...WONDER_CATALOG].sort(() => rng() - 0.5);
  const placedWonderCoords: HexTile[] = [];
  const allTileList = Object.values(tiles);

  for (const wDef of shuffledWonders) {
    if (placedWonderCoords.length >= wonderTarget) break;
    const candidates = allTileList.filter(
      (t) =>
        t.feature === 'none' &&
        !t.resourceProp &&
        wDef.match(t) &&
        placedWonderCoords.every((pw) => hexDistance(pw.q, pw.r, t.q, t.r) >= 12)
    );
    const fallbackCandidates =
      candidates.length > 0
        ? candidates
        : allTileList.filter(
            (t) =>
              t.feature === 'none' &&
              t.biome !== 'ocean' &&
              t.biome !== 'coast' &&
              t.biome !== 'mountain' &&
              placedWonderCoords.every((pw) => hexDistance(pw.q, pw.r, t.q, t.r) >= 12)
          );
    if (fallbackCandidates.length === 0) continue;
    const pick = fallbackCandidates[Math.floor(rng() * fallbackCandidates.length)];
    pick.feature = 'natural_wonder';
    pick.wonderId = wDef.id;
    pick.wonderName = wDef.name;
    pick.wonderDesc = wDef.desc;
    placedWonderCoords.push(pick);
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

  for (let tries = 0; tries < 220 && campsPlaced < campTarget; tries++) {
    const cand = landCoords[Math.floor(rng() * landCoords.length)];
    if (!cand) continue;
    const t = tiles[tileKey(cand.q, cand.r)];
    if (t.ownerCityId || t.feature === 'natural_wonder' || t.biome === 'mountain') continue;

    // Frontier-only placement: hills, tundra, arid steppe, or forest perimeter
    const isForestEdge =
      t.biome === 'forest' &&
      hexNeighbors(t.q, t.r).some((n) => {
        const nt = tiles[tileKey(n.q, n.r)];
        return nt && nt.biome !== 'forest';
      });
    const isFrontier =
      t.biome === 'hills' ||
      t.biome === 'tundra' ||
      t.temperature === 'arid' ||
      isForestEdge;
    if (!isFrontier && tries < 160) continue;

    const tooCloseToStart = startTiles.some((st) => hexDistance(st.q, st.r, t.q, t.r) < 6);
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
    riverPaths,
    rivers,
    renderProps: buildWorldRenderProps(tiles, width, height),
    seed,
  };

  if (config.revealAllMap) {
    for (const t of Object.values(tiles)) {
      t.exploredBy[playerCivId] = true;
      t.visibleTo[playerCivId] = true;
    }
  }

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
): {
  riverPaths: Array<Array<{ q: number; r: number; edge: number }>>;
  rivers: Array<Array<{ x: number; y: number; width: number; flow: number }>>;
} {
  const waterTargets = Object.values(tiles).filter(
    (t) => t.biome === 'coast' || t.biome === 'ocean' || Boolean(t.isLake)
  );
  if (waterTargets.length === 0) return { riverPaths: [], rivers: [] };

  // 1. Priority-Flood / BFS Hydrological Distance & Depression-Breached Elevation Potential
  const waterDistMap = new Map<string, number>();
  const bfsQueue: HexTile[] = [];
  for (const wt of waterTargets) {
    const wk = tileKey(wt.q, wt.r);
    waterDistMap.set(wk, 0);
    bfsQueue.push(wt);
  }
  let qHead = 0;
  while (qHead < bfsQueue.length) {
    const cur = bfsQueue[qHead++];
    const curD = waterDistMap.get(tileKey(cur.q, cur.r)) ?? 0;
    for (const n of hexNeighbors(cur.q, cur.r)) {
      const nk = tileKey(n.q, n.r);
      const nt = tiles[nk];
      if (!nt || waterDistMap.has(nk)) continue;
      waterDistMap.set(nk, curD + 1);
      bfsQueue.push(nt);
    }
  }

  // 2. Build Hex-Vertex Graph across all tiles so rivers flow vertex-to-vertex without ever reversing
  interface VertexEdgeLink {
    toKey: string;
    tileA: HexTile;
    tileB?: HexTile;
    edgeA: number;
  }
  interface HexVertexNode {
    key: string;
    x: number;
    y: number;
    touchingTiles: HexTile[];
    isWaterVertex: boolean;
     isPureOcean: boolean;
    waterDist: number;
    potential: number;
    links: VertexEdgeLink[];
  }

  const vertices = new Map<string, HexVertexNode>();
  const getCornerPos = (px: number, py: number, cIdx: number) => {
    const angle = (Math.PI / 180) * (60 * cIdx - 30);
    const vx = px + HEX_SIZE * Math.cos(angle);
    const vy = py + HEX_SIZE * Math.sin(angle);
    const key = `${Math.round(vx * 2)},${Math.round(vy * 2)}`;
    return { key, x: vx, y: vy };
  };

  const ensureVertex = (key: string, x: number, y: number): HexVertexNode => {
    let v = vertices.get(key);
    if (!v) {
      v = {
        key,
        x,
        y,
        touchingTiles: [],
        isWaterVertex: false,
        isPureOcean: false,
        waterDist: 999,
        potential: 999,
        links: [],
      };
      vertices.set(key, v);
    }
    return v;
  };

  for (const t of Object.values(tiles)) {
    const { x: px, y: py } = axialToPixel(t.q, t.r, 'topdown');
    const cNodes: HexVertexNode[] = [];
    for (let c = 0; c < 6; c++) {
      const cp = getCornerPos(px, py, c);
      const vn = ensureVertex(cp.key, cp.x, cp.y);
      if (!vn.touchingTiles.includes(t)) {
        vn.touchingTiles.push(t);
      }
      cNodes.push(vn);
    }
    for (let e = 0; e < 6; e++) {
      const vA = cNodes[e];
      const vB = cNodes[(e + 1) % 6];
      const [dq, dr] = EDGE_OFFSETS[e];
      const opp = tiles[tileKey(t.q + dq, t.r + dr)];
      if (!vA.links.some((l) => l.toKey === vB.key)) {
        vA.links.push({ toKey: vB.key, tileA: t, tileB: opp, edgeA: e });
      }
      if (!vB.links.some((l) => l.toKey === vA.key)) {
        vB.links.push({ toKey: vA.key, tileA: t, tileB: opp, edgeA: e });
      }
    }
  }

  for (const v of vertices.values()) {
    let minD = 999;
    let sumElev = 0;
    let waterCount = 0;
    for (const tt of v.touchingTiles) {
      const d = waterDistMap.get(tileKey(tt.q, tt.r)) ?? 99;
      if (d < minD) minD = d;
      sumElev += tt.elevation;
      if (tt.biome === 'coast' || tt.biome === 'ocean' || Boolean(tt.isLake)) {
        waterCount++;
      }
    }
    const avgElev = sumElev / Math.max(1, v.touchingTiles.length);
    v.waterDist = minD;
    v.isWaterVertex = waterCount > 0;
    v.isPureOcean = waterCount === v.touchingTiles.length;
    v.potential = minD * 1.35 + avgElev * 0.9;
  }

  // 3. Collect high-ground river spring tiles (mountains, hills, or inland highlands >=2 hexes from water)
  let sources = Object.values(tiles).filter(
    (t) =>
      (t.biome === 'mountain' || t.biome === 'hills') &&
      (waterDistMap.get(tileKey(t.q, t.r)) ?? 0) >= 2
  );
  if (sources.length < 8) {
    const extra = Object.values(tiles).filter(
      (t) =>
        t.biome !== 'ocean' &&
        t.biome !== 'coast' &&
        (waterDistMap.get(tileKey(t.q, t.r)) ?? 0) >= 2
    );
    sources = [...sources, ...extra];
  }

  const targetRivers =
    mapSize === 'huge' ? 14 : mapSize === 'large' ? 11 : mapSize === 'medium' ? 8 : 6;
  const shuffled = [...sources].sort((a, b) => b.elevation - a.elevation + (rng() - 0.5) * 0.35);

  const riverPaths: Array<Array<{ q: number; r: number; edge: number }>> = [];
  const rivers: Array<Array<{ x: number; y: number; width: number; flow: number }>> = [];
  const globalRiverVertices = new Set<string>();
  const usedSpringTiles = new Set<string>();

  for (const src of shuffled) {
    if (rivers.length >= targetRivers) break;
    const srcKey = tileKey(src.q, src.r);
    if (src.hasRiver || usedSpringTiles.has(srcKey)) continue;
    // Space springs at least 3 hexes apart
    let tooClose = false;
    for (const uk of usedSpringTiles) {
      const [uq, ur] = uk.split(',').map(Number);
      if (hexDistance(src.q, src.r, uq, ur) < 3) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const { x: px, y: py } = axialToPixel(src.q, src.r, 'topdown');
    let startV: HexVertexNode | null = null;
    for (let c = 0; c < 6; c++) {
      const cp = getCornerPos(px, py, c);
      const vn = vertices.get(cp.key);
      if (vn && !vn.isWaterVertex && (!startV || vn.potential > startV.potential)) {
        startV = vn;
      }
    }
    if (!startV) continue;

    const vChain: HexVertexNode[] = [startV];
    const eChain: VertexEdgeLink[] = [];
    const visitedV = new Set<string>([startV.key]);
    let curV = startV;
    let reachedMouth = false;

    for (let step = 0; step < 80; step++) {
      let bestLink: VertexEdgeLink | null = null;
      let bestNextV: HexVertexNode | null = null;
      let bestScore = Infinity;

      for (const link of curV.links) {
        if (visitedV.has(link.toKey)) continue;
        const candV = vertices.get(link.toKey);
        if (!candV || candV.isPureOcean) continue;

        // Strong downhill pull toward water + depression breaching
        let score = candV.potential + (rng() - 0.5) * 0.28;
        if (candV.isWaterVertex) score -= 50;
        else if (globalRiverVertices.has(candV.key)) score -= 25;

        if (score < bestScore) {
          bestScore = score;
          bestLink = link;
          bestNextV = candV;
        }
      }

      if (!bestLink || !bestNextV) break;

      visitedV.add(bestNextV.key);
      vChain.push(bestNextV);
      eChain.push(bestLink);
      curV = bestNextV;

      if (curV.isWaterVertex || globalRiverVertices.has(curV.key)) {
        reachedMouth = eChain.length >= 2;
        break;
      }
    }

    if (reachedMouth && vChain.length >= 3) {
      usedSpringTiles.add(srcKey);
      const pathNodes: Array<{ q: number; r: number; edge: number }> = [];
      for (const seg of eChain) {
        if (!seg.tileA.riverEdges) seg.tileA.riverEdges = [false, false, false, false, false, false];
        seg.tileA.riverEdges[seg.edgeA] = true;
        if (seg.tileA.biome !== 'coast' && seg.tileA.biome !== 'ocean') seg.tileA.hasRiver = true;
        if (seg.tileB) {
          if (!seg.tileB.riverEdges) seg.tileB.riverEdges = [false, false, false, false, false, false];
          seg.tileB.riverEdges[(seg.edgeA + 3) % 6] = true;
          if (seg.tileB.biome !== 'coast' && seg.tileB.biome !== 'ocean') seg.tileB.hasRiver = true;
        }
        pathNodes.push({ q: seg.tileA.q, r: seg.tileA.r, edge: seg.edgeA });
      }
      riverPaths.push(pathNodes);

      const riverCoords: Array<{ x: number; y: number; width: number; flow: number }> = [];
      for (let i = 0; i < vChain.length; i++) {
        const vn = vChain[i];
        globalRiverVertices.add(vn.key);
        const t = i / Math.max(1, vChain.length - 1);
        riverCoords.push({
          x: vn.x,
          y: vn.y,
          width: 2.5 + Math.pow(t, 1.15) * 9.5,
          flow: 1 + i,
        });
      }
      rivers.push(riverCoords);
    }
  }

  return { riverPaths, rivers };
}

function generateShorelinesAndCoastalClusters(
  tiles: Record<string, HexTile>,
  height: number,
  rng: () => number,
  mapSize: GameConfig['mapSize']
) {
  const coastTiles = Object.values(tiles).filter((t) => t.biome === 'coast');

  // 1. Stamp Multi-Tile Coral Reef Lagoon & Atoll Clusters in warm coastal waters adjacent to land
  const warmCoastCandidates = coastTiles.filter((t) => {
    if (t.isLake) return false;
    const lat = Math.abs(t.r / Math.max(1, height - 1) - 0.5) * 2;
    if (lat >= 0.38) return false;
    return hexNeighbors(t.q, t.r).some((n) => {
      const nt = tiles[tileKey(n.q, n.r)];
      return nt && nt.biome !== 'ocean' && nt.biome !== 'coast';
    });
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

function finalizeTileRenderMetadata(tiles: Record<string, HexTile>, height: number) {
  for (const tile of Object.values(tiles)) {
    // 6-bit neighbor mask (bits 0..5 correspond to EDGE_OFFSETS 0..5):
    // For land tiles: bit i = 1 if neighbor i is water (ocean or coast).
    // For water tiles: bit i = 1 if neighbor i is land.
    const isWater = tile.biome === 'ocean' || tile.biome === 'coast';
    let mask = 0;
    for (let e = 0; e < 6; e++) {
      const [dq, dr] = EDGE_OFFSETS[e];
      const nt = tiles[tileKey(tile.q + dq, tile.r + dr)];
      if (!nt) continue;
      const nIsWater = nt.biome === 'ocean' || nt.biome === 'coast';
      if (isWater ? !nIsWater : nIsWater) {
        mask |= 1 << e;
      }
    }
    tile.coastBitmask = mask;

    // Assign rich TerrainSubType for continuous ground splatting & 2.5D feature selection
    let sub: TerrainSubType = 'plains';
    if (tile.biome === 'ocean') {
      sub = 'deep_ocean';
    } else if (tile.biome === 'coast') {
      sub = tile.isLake ? 'lake' : 'shallow_coast';
    } else if (tile.biome === 'mountain') {
      sub = 'mountain_peak';
    } else if (tile.biome === 'hills') {
      sub = tile.clusterRole === 'outer_ring' ? 'foothills' : 'hills';
    } else if (tile.biome === 'tundra') {
      const lat = Math.abs(tile.r / Math.max(1, height - 1) - 0.5) * 2;
      sub = lat >= 0.84 || tile.elevation > 0.62 ? 'snow' : 'tundra';
    } else if (tile.biome === 'desert') {
      const m = tile.moisture ?? 0.25;
      sub = m > 0.34 ? 'arid_steppe' : 'desert';
    } else if (tile.biome === 'forest') {
      if (tile.temperature === 'tropical') sub = 'jungle';
      else if (tile.temperature === 'arctic') sub = 'boreal_taiga';
      else sub = 'lush_forest';
    } else if (tile.biome === 'plains') {
      if (
        tile.shoreline === 'coastal_swamp' &&
        tile.elevation < 0.54 &&
        (tile.moisture ?? 0.5) > 0.55
      ) {
        sub = 'marsh';
      } else if (tile.temperature === 'arid') {
        sub = 'savanna';
      } else if ((tile.moisture ?? 0.5) >= 0.45 && tile.temperature === 'temperate') {
        sub = 'grassland';
      } else {
        sub = 'plains';
      }
    }
    tile.terrainSubType = sub;

    // Assign natural 2.5D resource, coastal marine & mystery package props
    if (!tile.resourceProp && tile.feature === 'none') {
      const h = Math.abs(Math.sin(tile.q * 12.9898 + tile.r * 78.233) * 43758.5453) % 1;
      const bordersMtn = hexNeighbors(tile.q, tile.r).some((n) => tiles[tileKey(n.q, n.r)]?.biome === 'mountain');
      const hasNearbyProp = hexInRange(tile.q, tile.r, 2).some((c) => {
        const nt = tiles[tileKey(c.q, c.r)];
        return nt && (nt.resourceProp || nt.feature === 'ancient_ruins');
      });
      if (!hasNearbyProp) {
        const isMoistOrRiver = (tile.moisture ?? 0.4) >= 0.44 || tile.hasRiver;
        if (tile.biome === 'coast' && !tile.isLake) {
          if (h < 0.045) tile.resourceProp = 'fish';
          else if (h < 0.068) tile.resourceProp = 'whales';
        } else if (tile.biome === 'hills' && bordersMtn) {
          if (h < 0.025) tile.resourceProp = 'cave_entrance';
          else if (h < 0.050) tile.resourceProp = 'iron';
          else if (h < 0.072) tile.resourceProp = 'coal';
          else if (h < 0.092) tile.resourceProp = 'copper';
          else if (h < 0.112) tile.resourceProp = 'gold';
          else if (h < 0.128) tile.resourceProp = 'gems';
          else if (h < 0.145) tile.resourceProp = 'marble';
          else if (h < 0.165) tile.resourceProp = 'stone';
        } else if (tile.biome === 'plains' && tile.terrainSubType !== 'marsh' && isMoistOrRiver) {
          if (h < 0.035) tile.resourceProp = 'horses';
          else if (h < 0.070) tile.resourceProp = 'cattle';
          else if (h < 0.110) tile.resourceProp = 'wheat';
          else if (h > 0.965 && !tile.ownerCityId) tile.resourceProp = 'mystery_package';
        } else if (tile.biome === 'forest') {
          if (tile.temperature === 'tropical' && ((tile.moisture ?? 0.5) >= 0.50 || tile.hasRiver) && h < 0.065) {
            tile.resourceProp = 'spices';
          } else if (h < 0.045) {
            tile.resourceProp = 'timber';
          } else if (h > 0.965 && !tile.ownerCityId) {
            tile.resourceProp = 'mystery_package';
          }
        } else if ((tile.biome === 'desert' || tile.biome === 'tundra') && h > 0.960 && !tile.ownerCityId) {
          tile.resourceProp = 'mystery_package';
        }
      }
    }
  }

  // Enforce >=10-hex minimum spacing between any two anomaly, ruin, or mystery landmarks
  const keptLandmarks: HexTile[] = [];
  for (const tile of Object.values(tiles)) {
    const isAnomaly =
      tile.feature === 'ancient_ruins' ||
      tile.feature === 'fossils' ||
      tile.feature === 'rare_flora' ||
      tile.feature === 'geothermal_vent';
    const isMystery = tile.resourceProp === 'mystery_package';
    if (!isAnomaly && !isMystery) continue;

    if (keptLandmarks.some((r) => hexDistance(r.q, r.r, tile.q, tile.r) < 10)) {
      if (isAnomaly) tile.feature = 'none';
      if (isMystery) tile.resourceProp = undefined;
    } else {
      keptLandmarks.push(tile);
    }
  }
}
