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
        ? 5
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
            ? 5.5 + rng() * 4.5
            : 3.4 + rng() * 3.8,
      weight: 0.65 + rng() * 0.55,
    });
  }

  const tiles: Record<string, HexTile> = {};
  const landCoords: Array<{ q: number; r: number; col: number; row: number }> = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { q, r } = offsetToAxial(col, row);
      const key = tileKey(q, r);

      // Compute height field
      let elev = 0;
      for (const b of blobs) {
        const dx = col - b.x;
        const dy = row - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < b.radius * 1.8) {
          elev += b.weight * Math.exp(-(dist * dist) / (2 * b.radius * b.radius));
        }
      }

      // Map type shaping
      const nx = col / width - 0.5;
      const ny = row / height - 0.5;
      const centerDist = Math.sqrt(nx * nx + ny * ny);

      if (config.mapType === 'pangaea') {
        elev += Math.max(0, 0.75 - centerDist * 1.45);
      } else if (config.mapType === 'inland_sea') {
        if (centerDist < 0.23) elev -= 0.85;
        else elev += 0.35;
      } else if (config.mapType === 'wild_frontier') {
        elev += 0.25 + (rng() - 0.5) * 0.35;
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

      elev += (rng() - 0.5) * 0.22;

      // Latitude temperature
      const lat = Math.abs(row / (height - 1) - 0.5) * 2; // 0 equator .. 1 poles
      const moisture = rng();

      let biome: BiomeType = 'ocean';
      let temperature: TemperatureZone = 'ocean';

      if (elev < 0.46) {
        biome = 'ocean';
        temperature = 'ocean';
      } else if (elev < 0.58) {
        biome = 'coast';
        temperature = 'ocean';
      } else {
        if (lat > 0.78) {
          temperature = 'arctic';
          biome = elev > 1.18 ? 'mountain' : 'tundra';
        } else if (lat < 0.28) {
          if (moisture < 0.38) {
            temperature = 'arid';
            biome = elev > 1.22 ? 'mountain' : 'desert';
          } else {
            temperature = 'tropical';
            biome = elev > 1.2 ? 'mountain' : elev > 0.96 ? 'hills' : moisture > 0.55 ? 'forest' : 'plains';
          }
        } else {
          if (moisture < 0.22) {
            temperature = 'arid';
            biome = elev > 1.22 ? 'mountain' : 'desert';
          } else {
            temperature = 'temperate';
            biome = elev > 1.2 ? 'mountain' : elev > 0.95 ? 'hills' : moisture > 0.56 ? 'forest' : 'plains';
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
