import {
  BUILDING_DEFS,
  CORE_KNOWLEDGE_NODES,
  INVENTIONS,
  SKILL_PROMOTIONS,
  UNIT_DEFS,
} from '../data/registries';
import {
  BarbarianUnit,
  CityState,
  CivState,
  CoreDomain,
  ExplorationEvent,
  GameState,
  HexTile,
  ImprovementType,
  ToastNotice,
  UnitState,
} from '../types/game';
import { hexDistance, hexInRange, hexNeighbors, parseTileKey, tileKey } from './hexMath';
import { getPacingResearchFactor, processCivResearchTurn } from './researchEngine';

const SAVE_STORAGE_KEY = 'epoch_element_autosave_v1';

export function saveGameToLocalStorage(state: GameState) {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function loadGameFromLocalStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function updateVisibility(state: GameState) {
  // Reset current visibility
  for (const tile of Object.values(state.tiles)) {
    tile.visibleTo = {};
  }

  // Cities reveal radius 2
  for (const city of Object.values(state.cities)) {
    for (const coord of hexInRange(city.q, city.r, 2)) {
      const tile = state.tiles[tileKey(coord.q, coord.r)];
      if (tile) {
        tile.exploredBy[city.civId] = true;
        tile.visibleTo[city.civId] = true;
      }
    }
  }

  // Units reveal based on sight + hills/promotions
  for (const unit of Object.values(state.units)) {
    const def = UNIT_DEFS[unit.defId];
    let sight = def.sight;
    if (unit.promotions.includes('pathfinder') || unit.promotions.includes('seafarer')) {
      sight += 1;
    }
    const standingTile = state.tiles[tileKey(unit.q, unit.r)];
    if (standingTile?.biome === 'hills') sight += 1;

    for (const coord of hexInRange(unit.q, unit.r, sight)) {
      const tile = state.tiles[tileKey(coord.q, coord.r)];
      if (!tile) continue;
      const wasExplored = Boolean(tile.exploredBy[unit.civId]);
      tile.exploredBy[unit.civId] = true;
      tile.visibleTo[unit.civId] = true;

      if (!wasExplored) {
        onTileFirstExplored(state, unit.civId, tile);
      }
    }
  }

  // Check diplomatic first contact by visibility
  for (const civId of Object.keys(state.civs)) {
    const civ = state.civs[civId];
    if (civ.isEliminated) continue;
    for (const otherUnit of Object.values(state.units)) {
      if (otherUnit.civId === civId) continue;
      const t = state.tiles[tileKey(otherUnit.q, otherUnit.r)];
      if (t?.visibleTo[civId]) {
        meetCivilization(state, civId, otherUnit.civId);
      }
    }
    for (const otherCity of Object.values(state.cities)) {
      if (otherCity.civId === civId) continue;
      const t = state.tiles[tileKey(otherCity.q, otherCity.r)];
      if (t?.visibleTo[civId]) {
        meetCivilization(state, civId, otherCity.civId);
      }
    }
  }
}

function meetCivilization(state: GameState, civA: string, civB: string) {
  const a = state.civs[civA];
  const b = state.civs[civB];
  if (!a || !b || a.isEliminated || b.isEliminated) return;
  if (a.relations[civB]?.status === 'unmet') {
    a.relations[civB].status = 'peace';
    a.relations[civB].lastContactTurn = state.turn;
    b.relations[civA].status = 'peace';
    b.relations[civA].lastContactTurn = state.turn;
    if (a.isHuman) {
      state.notices.unshift({
        id: `meet_${civB}_${state.turn}`,
        turn: state.turn,
        title: `Contacted ${b.name}`,
        detail: `${b.leaderName} greets your scouts. Diplomacy and Trade Routes are now open.`,
        kind: 'diplomacy',
      });
    }
  }
}

function onTileFirstExplored(state: GameState, civId: string, tile: HexTile) {
  const civ = state.civs[civId];
  if (!civ) return;

  // Temperature zone discovery
  if (tile.temperature !== 'ocean' && !civ.discoveredZones.includes(tile.temperature)) {
    civ.discoveredZones.push(tile.temperature);
    if (civ.isHuman) {
      state.notices.unshift({
        id: `zone_${tile.temperature}_${state.turn}`,
        turn: state.turn,
        title: `New Climate Zone: ${tile.temperature.toUpperCase()}`,
        detail: 'Adapting to unfamiliar climates accelerates Core Knowledge & Inventions.',
        kind: 'event',
        q: tile.q,
        r: tile.r,
      });
    }
  }

  // Ocean crossing tracking
  if (tile.biome === 'ocean' && !civ.crossedOcean) {
    civ.crossedOcean = true;
    if (civ.isHuman) {
      state.notices.unshift({
        id: `ocean_${state.turn}`,
        turn: state.turn,
        title: 'Deep Ocean Charted',
        detail: 'Venturing into open ocean waters grants a permanent +20% discovery multiplier.',
        kind: 'event',
        q: tile.q,
        r: tile.r,
      });
    }
  }

  // Natural Wonder discovery
  if (
    tile.feature === 'natural_wonder' &&
    tile.wonderName &&
    !civ.discoveredWonders.includes(tile.wonderName)
  ) {
    civ.discoveredWonders.push(tile.wonderName);
    civ.researchPoints += 12;
    if (civ.isHuman) {
      state.notices.unshift({
        id: `wonder_${tile.wonderName}_${state.turn}`,
        turn: state.turn,
        title: `Natural Wonder: ${tile.wonderName}`,
        detail: '+12 Research and permanent +16% Invention breakthrough multiplier.',
        kind: 'event',
        q: tile.q,
        r: tile.r,
      });
    }
  }
}

export function getUnitEffectiveStats(unit: UnitState, tile?: HexTile) {
  const def = UNIT_DEFS[unit.defId];
  let attack = def.attack;
  let defense = def.defense;
  let siegeBonus = 0;
  let surveyBonus = 1;

  for (const pid of unit.promotions) {
    const p = SKILL_PROMOTIONS.find((sp) => sp.id === pid);
    if (!p) continue;
    if (p.attackBonus) attack += p.attackBonus;
    if (p.defenseBonus) defense += p.defenseBonus;
    if (p.siegeBonus) siegeBonus += p.siegeBonus;
    if (p.surveyBonus) surveyBonus += p.surveyBonus;
  }

  if (tile) {
    if (tile.biome === 'forest') defense = Math.round(defense * 1.25);
    if (tile.biome === 'hills') defense = Math.round(defense * 1.3);
    if (tile.improvement === 'fort' && !tile.improvementDamaged) defense = Math.round(defense * 1.45);
  }

  return { attack, defense, siegeBonus, surveyBonus };
}

export function awardUnitXp(unit: UnitState, amount: number) {
  unit.xp += amount;
  const threshold = unit.level * 25;
  if (unit.xp >= threshold) {
    unit.level += 1;
    unit.pendingPromotion = true;
  }
}

export function applyPromotion(state: GameState, unitId: string, promotionId: string): GameState {
  const unit = state.units[unitId];
  if (!unit || !unit.pendingPromotion || unit.promotions.includes(promotionId)) return state;
  unit.promotions.push(promotionId);
  unit.pendingPromotion = false;
  unit.hp = Math.min(unit.maxHp, unit.hp + 20);
  return { ...state };
}

export function getTileYields(tile: HexTile): {
  food: number;
  prod: number;
  gold: number;
  research: number;
} {
  let food = 1;
  let prod = 1;
  let gold = 0;
  let research = 0;

  switch (tile.biome) {
    case 'plains':
      food = 2;
      prod = 1;
      break;
    case 'forest':
      food = 1;
      prod = 2;
      break;
    case 'hills':
      food = 1;
      prod = 3;
      break;
    case 'desert':
      food = 0;
      prod = 1;
      gold = 1;
      break;
    case 'tundra':
      food = 1;
      prod = 1;
      break;
    case 'coast':
      food = 2;
      prod = 0;
      gold = 2;
      break;
    case 'ocean':
      food = 1;
      prod = 0;
      gold = 1;
      break;
    case 'mountain':
      food = 0;
      prod = 1;
      research = 1;
      break;
  }

  if (tile.hasRiver) {
    food += 1;
    gold += 1;
  }

  if (tile.feature === 'rare_flora') research += 1;
  if (tile.feature === 'geothermal_vent') {
    prod += 1;
    research += 1;
  }
  if (tile.feature === 'natural_wonder') {
    gold += 3;
    research += 3;
  }

  if (tile.improvement !== 'none' && !tile.improvementDamaged) {
    if (tile.improvement === 'farm') food += 2;
    if (tile.improvement === 'mine') prod += 3;
    if (tile.improvement === 'lumber_mill') prod += 2;
    if (tile.improvement === 'quarry') {
      prod += 2;
      gold += 1;
    }
    if (tile.improvement === 'trade_post') gold += 3;
  }

  return { food, prod, gold, research };
}

export function getCityYields(state: GameState, city: CityState) {
  let food = 2;
  let prod = 2;
  let gold = 3;
  let research = 2 + Math.floor(city.population * 0.7);
  let upkeep = 0;

  // Sort worked tiles by value up to population + 1
  const ownedTiles = Object.values(state.tiles).filter((t) => t.ownerCityId === city.id);
  const scored = ownedTiles
    .map((t) => ({ t, y: getTileYields(t) }))
    .sort((a, b) => b.y.food + b.y.prod + b.y.gold - (a.y.food + a.y.prod + a.y.gold));

  const worked = scored.slice(0, Math.min(scored.length, city.population + 1));
  for (const item of worked) {
    food += item.y.food;
    prod += item.y.prod;
    gold += item.y.gold;
    research += item.y.research;
  }

  for (const bId of city.buildings) {
    const b = BUILDING_DEFS[bId];
    if (!b) continue;
    if (b.foodYield) food += b.foodYield;
    if (b.prodYield) prod += b.prodYield;
    if (b.goldYield) gold += b.goldYield;
    if (b.researchYield) research += b.researchYield;
    upkeep += b.upkeep;
  }

  const civ = state.civs[city.civId];
  if (civ?.unlockedInventions.includes('steam_engine')) {
    prod = Math.round(prod * 1.15);
  }

  const foodConsumed = city.population * 2;
  const netFood = food - foodConsumed;

  return { food, netFood, prod, gold, upkeep, research };
}

export function getCivEconomySummary(state: GameState, civId: string) {
  const civCities = Object.values(state.cities).filter((c) => c.civId === civId);
  const civUnits = Object.values(state.units).filter((u) => u.civId === civId);
  const civ = state.civs[civId];

  let grossGold = 0;
  let buildingUpkeep = 0;
  let researchPerTurn = 0;

  for (const city of civCities) {
    const cy = getCityYields(state, city);
    grossGold += cy.gold;
    buildingUpkeep += cy.upkeep;
    researchPerTurn += cy.research;
  }

  let unitUpkeep = 0;
  for (const unit of civUnits) {
    unitUpkeep += UNIT_DEFS[unit.defId]?.upkeep ?? 0;
  }

  const tradeRoutes = Object.values(civ.relations).filter((r) => r.tradeRouteActive).length;
  const tradeGold = tradeRoutes * 6;
  const totalUpkeep = buildingUpkeep + unitUpkeep;
  const netGold = grossGold + tradeGold - totalUpkeep;

  return {
    grossGold,
    tradeGold,
    buildingUpkeep,
    unitUpkeep,
    totalUpkeep,
    netGold,
    researchPerTurn: Math.max(2, researchPerTurn),
  };
}

export function getTilePurchaseCost(city: CityState, tile: HexTile): number {
  const dist = hexDistance(city.q, city.r, tile.q, tile.r);
  let cost = 25 + dist * 12;
  if (tile.feature !== 'none') cost += 12;
  return cost;
}

export function getPurchasableTilesForCity(state: GameState, cityId: string): HexTile[] {
  const city = state.cities[cityId];
  if (!city) return [];
  const owned = Object.values(state.tiles).filter((t) => t.ownerCityId === cityId);
  const resultMap = new Map<string, HexTile>();

  for (const ot of owned) {
    for (const n of hexNeighbors(ot.q, ot.r)) {
      const k = tileKey(n.q, n.r);
      const nt = state.tiles[k];
      if (!nt || nt.ownerCityId) continue;
      if (hexDistance(city.q, city.r, nt.q, nt.r) <= 3) {
        resultMap.set(k, nt);
      }
    }
  }
  return Array.from(resultMap.values());
}

export function buyTileForCity(state: GameState, cityId: string, q: number, r: number): GameState {
  const city = state.cities[cityId];
  const tile = state.tiles[tileKey(q, r)];
  if (!city || !tile || tile.ownerCityId) return state;
  const civ = state.civs[city.civId];
  const cost = getTilePurchaseCost(city, tile);
  if (civ.gold < cost) return state;

  civ.gold -= cost;
  tile.ownerCityId = city.id;
  tile.ownerCivId = civ.id;
  city.workedTiles.push(tileKey(q, r));
  return { ...state };
}

export function moveUnitTo(state: GameState, unitId: string, targetQ: number, targetR: number, cost: number): GameState {
  const unit = state.units[unitId];
  if (!unit) return state;

  unit.q = targetQ;
  unit.r = targetR;
  unit.movesLeft = Math.max(0, unit.movesLeft - cost);
  unit.fortified = false;
  unit.task = undefined;

  updateVisibility(state);

  // Trigger exploration event if stepping onto ancient ruins or unsurveyed special feature as player
  const tile = state.tiles[tileKey(targetQ, targetR)];
  const def = UNIT_DEFS[unit.defId];
  if (
    tile &&
    unit.civId === state.playerCivId &&
    !state.activeEvent &&
    tile.feature !== 'none' &&
    !tile.featureSurveyed &&
    (def.role === 'scout' || def.role === 'explorer')
  ) {
    // Auto-hint or event chance on ruins
    if (tile.feature === 'ancient_ruins') {
      triggerExplorationEvent(state, tile, unit);
    }
  }

  // Check if stepping onto empty enemy/barbarian camp
  const campOnTile = Object.values(state.barbarianCamps).find(
    (c) => c.q === targetQ && c.r === targetR
  );
  if (campOnTile) {
    const defender = Object.values(state.barbarianUnits).find(
      (bu) => bu.q === targetQ && bu.r === targetR
    );
    if (!defender) {
      delete state.barbarianCamps[campOnTile.id];
      state.civs[unit.civId].gold += 30;
      if (unit.civId === state.playerCivId) {
        state.notices.unshift({
          id: `camp_clear_${state.turn}_${targetQ}`,
          turn: state.turn,
          title: `Cleared ${campOnTile.name}`,
          detail: 'Recovered 30 Gold from the abandoned encampment.',
          kind: 'combat',
          q: targetQ,
          r: targetR,
        });
      }
    }
  }

  return { ...state };
}

export function surveyTileFeature(state: GameState, unitId: string): GameState {
  const unit = state.units[unitId];
  if (!unit || unit.movesLeft <= 0) return state;
  const tile = state.tiles[tileKey(unit.q, unit.r)];
  if (!tile || tile.feature === 'none' || tile.featureSurveyed) return state;

  const civ = state.civs[unit.civId];
  const { surveyBonus } = getUnitEffectiveStats(unit, tile);
  tile.featureSurveyed = true;
  unit.movesLeft = 0;
  unit.hasActed = true;

  awardUnitXp(unit, 15);

  // Find eligible Core Knowledge nodes boosted by this feature, or boost active focus
  const matchingCore = CORE_KNOWLEDGE_NODES.filter(
    (n) =>
      !civ.unlockedCore.includes(n.id) &&
      n.dependencies.every((d) => civ.unlockedCore.includes(d)) &&
      n.boostedByFeatures?.includes(tile.feature)
  );

  const targetNode =
    matchingCore[0] ??
    CORE_KNOWLEDGE_NODES.find(
      (n) =>
        !civ.unlockedCore.includes(n.id) &&
        n.dependencies.every((d) => civ.unlockedCore.includes(d)) &&
        n.domain === civ.domainFocus
    ) ??
    CORE_KNOWLEDGE_NODES.find(
      (n) =>
        !civ.unlockedCore.includes(n.id) &&
        n.dependencies.every((d) => civ.unlockedCore.includes(d))
    );

  const sparkPct = Math.round(48 * surveyBonus);
  if (targetNode) {
    civ.coreProgress[targetNode.id] = (civ.coreProgress[targetNode.id] ?? 0) + sparkPct;
    if (civ.coreProgress[targetNode.id] >= 100) {
      civ.coreProgress[targetNode.id] = 100;
      civ.unlockedCore.push(targetNode.id);
      if (civ.isHuman) {
        state.notices.unshift({
          id: `survey_core_${targetNode.id}_${state.turn}`,
          turn: state.turn,
          title: `Field Breakthrough: ${targetNode.name}`,
          detail: `Surveying ${tile.feature.replace('_', ' ')} unlocked ${targetNode.name}!`,
          kind: 'core',
          q: tile.q,
          r: tile.r,
        });
      }
    } else if (civ.isHuman) {
      state.notices.unshift({
        id: `survey_${state.turn}_${tile.q}`,
        turn: state.turn,
        title: `Specimen Cataloged (${tile.feature.replace('_', ' ')})`,
        detail: `+${sparkPct}% progress toward ${targetNode.name} and +15 Unit XP.`,
        kind: 'event',
        q: tile.q,
        r: tile.r,
      });
    }
  } else {
    civ.researchPoints += 15;
  }

  return { ...state };
}

function triggerExplorationEvent(state: GameState, tile: HexTile, unit: UnitState) {
  tile.featureSurveyed = true;
  const events: Array<() => ExplorationEvent> = [
    () => ({
      id: `evt_ruins_${state.turn}`,
      title: 'Subterranean Vault Discovered',
      subtitle: 'Ancient Ruins Expedition',
      narrative:
        'Your scouts unearth weathered stone tablets alongside rusted crucibles and geometric brass astrolabes.',
      q: tile.q,
      r: tile.r,
      unitId: unit.id,
      choices: [
        {
          label: 'Decipher the scientific diagrams',
          description: 'Gain an instant Core Knowledge spark in your focused domain.',
          effect: { instantCoreSpark: true, xp: 15 },
        },
        {
          label: 'Salvage ceremonial bullion',
          description: '+45 Gold to treasury & +10 XP for the expedition.',
          effect: { gold: 45, xp: 10 },
        },
      ],
    }),
    () => ({
      id: `evt_flora_${state.turn}`,
      title: 'Botanical Sanctuary Found',
      subtitle: 'Rare Ecological Anomaly',
      narrative:
        'Sheltered within a misted hollow grow luminous medicinal herbs and resilient wild grains unseen elsewhere.',
      q: tile.q,
      r: tile.r,
      unitId: unit.id,
      choices: [
        {
          label: 'Send live cuttings to scholars',
          description: 'Boost Earth & Biology Core Knowledge + +10 Research.',
          effect: { coreBoostDomain: 'life', research: 10, xp: 12 },
        },
        {
          label: 'Harvest restorative tonics',
          description: 'Heal unit +35 HP and strengthen nearest city population.',
          effect: { heal: 35, population: 1 },
        },
      ],
    }),
  ];

  const chosen = events[Math.floor(Math.random() * events.length)]();
  state.activeEvent = chosen;
}

export function resolveExplorationEventChoice(state: GameState, choiceIdx: number): GameState {
  const evt = state.activeEvent;
  if (!evt) return state;
  const choice = evt.choices[choiceIdx];
  if (!choice) return state;

  const civ = state.civs[state.playerCivId];
  const { effect } = choice;

  if (effect.gold) civ.gold += effect.gold;
  if (effect.research) civ.researchPoints += effect.research;
  if (effect.xp && evt.unitId && state.units[evt.unitId]) {
    awardUnitXp(state.units[evt.unitId], effect.xp);
  }
  if (effect.heal && evt.unitId && state.units[evt.unitId]) {
    const u = state.units[evt.unitId];
    u.hp = Math.min(u.maxHp, u.hp + effect.heal);
  }
  if (effect.population) {
    const firstCity = Object.values(state.cities).find((c) => c.civId === civ.id);
    if (firstCity) firstCity.population += effect.population;
  }
  if (effect.instantCoreSpark || effect.coreBoostDomain) {
    const dom: CoreDomain = effect.coreBoostDomain ?? civ.domainFocus;
    const node =
      CORE_KNOWLEDGE_NODES.find(
        (n) =>
          !civ.unlockedCore.includes(n.id) &&
          n.dependencies.every((d) => civ.unlockedCore.includes(d)) &&
          n.domain === dom
      ) ??
      CORE_KNOWLEDGE_NODES.find(
        (n) =>
          !civ.unlockedCore.includes(n.id) &&
          n.dependencies.every((d) => civ.unlockedCore.includes(d))
      );
    if (node) {
      civ.coreProgress[node.id] = (civ.coreProgress[node.id] ?? 0) + 65;
      if (civ.coreProgress[node.id] >= 100) {
        civ.coreProgress[node.id] = 100;
        civ.unlockedCore.push(node.id);
      }
    }
  }

  state.activeEvent = null;
  return { ...state };
}

export function foundCityWithSettler(state: GameState, unitId: string, customName?: string): GameState {
  const unit = state.units[unitId];
  if (!unit || UNIT_DEFS[unit.defId].role !== 'settler') return state;
  const tile = state.tiles[tileKey(unit.q, unit.r)];
  if (!tile || tile.biome === 'ocean' || tile.biome === 'coast' || tile.biome === 'mountain') {
    return state;
  }

  // Ensure minimum distance 2 from other cities
  const tooClose = Object.values(state.cities).some(
    (c) => hexDistance(c.q, c.r, unit.q, unit.r) < 3
  );
  if (tooClose) return state;

  const civ = state.civs[unit.civId];
  const existingCount = Object.values(state.cities).filter((c) => c.civId === unit.civId).length;
  const cityId = `city_${unit.civId}_${state.turn}_${existingCount}`;
  const cityName = customName || `${civ.name.split(' ')[0]} Haven ${existingCount + 1}`;

  const territory = hexInRange(unit.q, unit.r, 1).filter((c) => {
    const t = state.tiles[tileKey(c.q, c.r)];
    return t && !t.ownerCityId;
  });

  const workedTiles: string[] = [];
  for (const c of territory) {
    const k = tileKey(c.q, c.r);
    state.tiles[k].ownerCityId = cityId;
    state.tiles[k].ownerCivId = unit.civId;
    workedTiles.push(k);
  }

  state.cities[cityId] = {
    id: cityId,
    name: cityName,
    civId: unit.civId,
    q: unit.q,
    r: unit.r,
    isCapital: false,
    population: 1,
    foodStored: 0,
    foodNeeded: 18,
    hp: 85,
    maxHp: 85,
    buildings: [],
    producing: { type: 'building', id: 'granary', progress: 0, cost: 45 },
    workedTiles,
  };

  delete state.units[unitId];
  updateVisibility(state);
  return { ...state };
}

export function startWorkerTask(
  state: GameState,
  unitId: string,
  taskType: 'build' | 'repair',
  improvement?: ImprovementType
): GameState {
  const unit = state.units[unitId];
  if (!unit || UNIT_DEFS[unit.defId].role !== 'worker' || unit.movesLeft <= 0) return state;
  const tile = state.tiles[tileKey(unit.q, unit.r)];
  if (!tile) return state;

  if (taskType === 'repair') {
    if (!tile.improvementDamaged) return state;
    unit.task = { type: 'repair', turnsLeft: 1 };
    unit.movesLeft = 0;
    return { ...state };
  }

  if (taskType === 'build' && improvement) {
    unit.task = { type: 'build', improvement, turnsLeft: improvement === 'road' ? 1 : 2 };
    unit.movesLeft = 0;
  }

  return { ...state };
}

export function previewCombat(
  state: GameState,
  attackerId: string,
  targetQ: number,
  targetR: number
): { estDamage: number; estCounter: number; kind: 'melee' | 'ranged' | 'siege' | 'naval'; targetName: string } | null {
  const attacker = state.units[attackerId];
  if (!attacker) return null;
  const atkDef = UNIT_DEFS[attacker.defId];
  const atkTile = state.tiles[tileKey(attacker.q, attacker.r)];
  const defTile = state.tiles[tileKey(targetQ, targetR)];
  if (!defTile) return null;
  const atkStats = getUnitEffectiveStats(attacker, atkTile);
  const kind: 'melee' | 'ranged' | 'siege' | 'naval' =
    atkDef.role === 'naval'
      ? 'naval'
      : atkDef.role === 'siege'
        ? 'siege'
        : atkDef.range > 1
          ? 'ranged'
          : 'melee';

  const enemyUnit = Object.values(state.units).find(
    (u) => u.q === targetQ && u.r === targetR && u.civId !== attacker.civId
  );
  if (enemyUnit) {
    const defStats = getUnitEffectiveStats(enemyUnit, defTile);
    const estDamage = Math.max(8, Math.round((atkStats.attack / Math.max(6, defStats.defense)) * 28));
    const estCounter =
      atkDef.range === 1 && enemyUnit.hp > estDamage
        ? Math.max(5, Math.round((defStats.defense / Math.max(6, atkStats.attack)) * 18))
        : 0;
    return { estDamage, estCounter, kind, targetName: UNIT_DEFS[enemyUnit.defId].name };
  }

  const barbUnit = Object.values(state.barbarianUnits).find(
    (bu) => bu.q === targetQ && bu.r === targetR
  );
  if (barbUnit) {
    const estDamage = Math.max(10, Math.round((atkStats.attack / Math.max(6, barbUnit.defense)) * 30));
    const estCounter =
      atkDef.range === 1 && barbUnit.hp > estDamage
        ? Math.max(4, Math.round((barbUnit.attack / Math.max(6, atkStats.defense)) * 16))
        : 0;
    return { estDamage, estCounter, kind, targetName: barbUnit.name };
  }

  const enemyCity = Object.values(state.cities).find(
    (c) => c.q === targetQ && c.r === targetR && c.civId !== attacker.civId
  );
  if (enemyCity) {
    let cityDef = 16 + enemyCity.population * 2;
    if (enemyCity.buildings.includes('walls')) cityDef += 12;
    const effectiveAtk = atkStats.attack + (atkDef.role === 'siege' ? 14 : 0) + atkStats.siegeBonus;
    const estDamage = Math.max(10, Math.round((effectiveAtk / Math.max(10, cityDef)) * 30));
    const estCounter =
      atkDef.range === 1 && enemyCity.hp > estDamage
        ? Math.max(6, Math.round((cityDef / Math.max(8, atkStats.defense)) * 16))
        : 0;
    return { estDamage, estCounter, kind, targetName: enemyCity.name };
  }

  return null;
}

export function resolveCombat(state: GameState, attackerId: string, targetQ: number, targetR: number): GameState {
  const attacker = state.units[attackerId];
  if (!attacker || attacker.movesLeft <= 0 || attacker.hasActed) return state;

  const atkDef = UNIT_DEFS[attacker.defId];
  const dist = hexDistance(attacker.q, attacker.r, targetQ, targetR);
  if (dist > atkDef.range || dist < 1) return state;

  const atkTile = state.tiles[tileKey(attacker.q, attacker.r)];
  const defTile = state.tiles[tileKey(targetQ, targetR)];
  if (!defTile) return state;

  const atkStats = getUnitEffectiveStats(attacker, atkTile);
  const combatKind: 'melee' | 'ranged' | 'siege' | 'naval' =
    atkDef.role === 'naval'
      ? 'naval'
      : atkDef.role === 'siege'
        ? 'siege'
        : atkDef.range > 1
          ? 'ranged'
          : 'melee';

  // Check enemy unit on tile
  const enemyUnit = Object.values(state.units).find(
    (u) => u.q === targetQ && u.r === targetR && u.civId !== attacker.civId
  );

  // Check barbarian unit on tile
  const barbUnit = Object.values(state.barbarianUnits).find(
    (bu) => bu.q === targetQ && bu.r === targetR
  );

  // Check enemy city on tile
  const enemyCity = Object.values(state.cities).find(
    (c) => c.q === targetQ && c.r === targetR && c.civId !== attacker.civId
  );

  // Check barbarian camp
  const barbCamp = Object.values(state.barbarianCamps).find(
    (c) => c.q === targetQ && c.r === targetR
  );

  attacker.movesLeft = 0;
  attacker.hasActed = true;
  attacker.fortified = false;

  if (enemyUnit) {
    const rel = state.civs[attacker.civId].relations[enemyUnit.civId];
    if (rel && rel.status !== 'war') {
      declareWar(state, attacker.civId, enemyUnit.civId);
    }

    const defStats = getUnitEffectiveStats(enemyUnit, defTile);
    const dmgToDef = Math.max(
      8,
      Math.round((atkStats.attack / Math.max(6, defStats.defense)) * 28 * (0.85 + Math.random() * 0.3))
    );
    enemyUnit.hp -= dmgToDef;

    if (defTile.improvement !== 'none' && !defTile.improvementDamaged && Math.random() < 0.45) {
      defTile.improvementDamaged = true;
    }

    let counterDmg = 0;
    if (atkDef.range === 1 && enemyUnit.hp > 0) {
      counterDmg = Math.max(
        5,
        Math.round((defStats.defense / Math.max(6, atkStats.attack)) * 18)
      );
      attacker.hp -= counterDmg;
    }

    state.recentCombats.push({
      id: `cmb_${Date.now()}_${Math.random()}`,
      fromQ: attacker.q,
      fromR: attacker.r,
      toQ: targetQ,
      toR: targetR,
      damage: dmgToDef,
      counterDamage: counterDmg,
      kind: combatKind,
      timestamp: Date.now(),
    });

    awardUnitXp(attacker, 12);
    if (enemyUnit.hp <= 0) {
      delete state.units[enemyUnit.id];
      awardUnitXp(attacker, 10);
      if (atkDef.range === 1 && !enemyCity) {
        attacker.q = targetQ;
        attacker.r = targetR;
      }
    } else {
      awardUnitXp(enemyUnit, 6);
    }

    if (attacker.hp <= 0) {
      delete state.units[attacker.id];
    }
  } else if (barbUnit) {
    const camp = state.barbarianCamps[barbUnit.campId];
    if (camp && camp.disposition === 'peaceful') {
      camp.disposition = 'aggressive';
      barbUnit.disposition = 'aggressive';
    }
    const dmg = Math.max(
      10,
      Math.round((atkStats.attack / Math.max(6, barbUnit.defense)) * 30 * (0.9 + Math.random() * 0.25))
    );
    barbUnit.hp -= dmg;

    let counterDmg = 0;
    if (atkDef.range === 1 && barbUnit.hp > 0) {
      counterDmg = Math.max(4, Math.round((barbUnit.attack / Math.max(6, atkStats.defense)) * 16));
      attacker.hp -= counterDmg;
    }

    state.recentCombats.push({
      id: `cmb_${Date.now()}_${Math.random()}`,
      fromQ: attacker.q,
      fromR: attacker.r,
      toQ: targetQ,
      toR: targetR,
      damage: dmg,
      counterDamage: counterDmg,
      kind: combatKind,
      timestamp: Date.now(),
    });

    awardUnitXp(attacker, 12);
    if (barbUnit.hp <= 0) {
      delete state.barbarianUnits[barbUnit.id];
      awardUnitXp(attacker, 10);
      if (atkDef.range === 1 && barbCamp) {
        delete state.barbarianCamps[barbCamp.id];
        state.civs[attacker.civId].gold += 35;
        if (attacker.civId === state.playerCivId) {
          state.notices.unshift({
            id: `barb_clear_${state.turn}_${targetQ}`,
            turn: state.turn,
            title: `Defeated ${barbCamp.name}`,
            detail: 'Plundered +35 Gold from the barbarian camp.',
            kind: 'combat',
            q: targetQ,
            r: targetR,
          });
        }
      }
      if (atkDef.range === 1) {
        attacker.q = targetQ;
        attacker.r = targetR;
      }
    }
    if (attacker.hp <= 0) delete state.units[attacker.id];
  } else if (enemyCity) {
    const rel = state.civs[attacker.civId].relations[enemyCity.civId];
    if (rel && rel.status !== 'war') {
      declareWar(state, attacker.civId, enemyCity.civId);
    }

    let cityDef = 16 + enemyCity.population * 2;
    if (enemyCity.buildings.includes('walls')) cityDef += 12;

    const effectiveAtk = atkStats.attack + (atkDef.role === 'siege' ? 14 : 0) + atkStats.siegeBonus;
    const dmg = Math.max(10, Math.round((effectiveAtk / Math.max(10, cityDef)) * 30));
    enemyCity.hp -= dmg;

    let counterDmg = 0;
    if (atkDef.range === 1 && enemyCity.hp > 0) {
      counterDmg = Math.max(6, Math.round((cityDef / Math.max(8, atkStats.defense)) * 16));
      attacker.hp -= counterDmg;
    }

    const captured = enemyCity.hp <= 0;
    state.recentCombats.push({
      id: `cmb_${Date.now()}_${Math.random()}`,
      fromQ: attacker.q,
      fromR: attacker.r,
      toQ: targetQ,
      toR: targetR,
      damage: dmg,
      counterDamage: counterDmg,
      kind: captured ? 'capture' : combatKind === 'melee' ? 'siege' : combatKind,
      capturedCityName: captured ? enemyCity.name : undefined,
      timestamp: Date.now(),
    });

    awardUnitXp(attacker, 14);

    if (captured) {
      captureCity(state, enemyCity, attacker.civId);
      if (atkDef.range === 1 && attacker.hp > 0) {
        attacker.q = targetQ;
        attacker.r = targetR;
      }
    }
    if (attacker.hp <= 0) delete state.units[attacker.id];
  }

  updateVisibility(state);
  checkConquestVictory(state);
  return { ...state };
}

function captureCity(state: GameState, city: CityState, newOwnerId: string) {
  const oldOwnerId = city.civId;
  city.civId = newOwnerId;
  city.hp = Math.round(city.maxHp * 0.5);
  city.population = Math.max(1, city.population - 1);

  for (const tile of Object.values(state.tiles)) {
    if (tile.ownerCityId === city.id) {
      tile.ownerCivId = newOwnerId;
    }
  }

  // Check if oldOwner has any cities remaining
  const remainingCities = Object.values(state.cities).filter((c) => c.civId === oldOwnerId);
  if (remainingCities.length === 0) {
    state.civs[oldOwnerId].isEliminated = true;
    // Remove units of eliminated civ
    for (const u of Object.values(state.units)) {
      if (u.civId === oldOwnerId) delete state.units[u.id];
    }
    state.notices.unshift({
      id: `elim_${oldOwnerId}_${state.turn}`,
      turn: state.turn,
      title: `${state.civs[oldOwnerId].name} Conquered!`,
      detail: `${state.civs[newOwnerId].name} has eliminated a rival empire.`,
      kind: 'combat',
      q: city.q,
      r: city.r,
    });
  } else {
    state.notices.unshift({
      id: `cap_${city.id}_${state.turn}`,
      turn: state.turn,
      title: `${city.name} Captured`,
      detail: `${state.civs[newOwnerId].name} seized ${city.name}.`,
      kind: 'combat',
      q: city.q,
      r: city.r,
    });
  }
}

export function checkConquestVictory(state: GameState) {
  const aliveCivs = Object.values(state.civs).filter((c) => !c.isEliminated);
  if (aliveCivs.length === 1) {
    state.winnerCivId = aliveCivs[0].id;
  } else if (state.civs[state.playerCivId].isEliminated) {
    // Player defeated -> mark strongest AI or special defeated flag
    const topAi = aliveCivs[0];
    if (topAi) state.winnerCivId = topAi.id;
  }
}

// DIPLOMACY ACTIONS
export function declareWar(state: GameState, civA: string, civB: string): GameState {
  const a = state.civs[civA];
  const b = state.civs[civB];
  if (!a || !b) return state;
  a.relations[civB] = {
    status: 'war',
    opinion: -85,
    tradeRouteActive: false,
    truceTurns: 0,
    lastContactTurn: state.turn,
  };
  b.relations[civA] = {
    status: 'war',
    opinion: -85,
    tradeRouteActive: false,
    truceTurns: 0,
    lastContactTurn: state.turn,
  };
  state.notices.unshift({
    id: `war_${civA}_${civB}_${state.turn}`,
    turn: state.turn,
    title: `War Declared: ${a.name} vs ${b.name}`,
    detail: 'All active trade routes and treaties between both powers are severed.',
    kind: 'diplomacy',
  });
  return { ...state };
}

export function makePeace(state: GameState, civA: string, civB: string, tributeGold = 0): GameState {
  const a = state.civs[civA];
  const b = state.civs[civB];
  if (!a || !b) return state;
  if (tributeGold > 0 && a.gold < tributeGold) return state;
  a.gold -= tributeGold;
  b.gold += tributeGold;
  a.relations[civB].status = 'peace';
  a.relations[civB].opinion = Math.max(-20, a.relations[civB].opinion + 35);
  a.relations[civB].truceTurns = 8;
  b.relations[civA].status = 'peace';
  b.relations[civA].opinion = Math.max(-20, b.relations[civA].opinion + 35);
  b.relations[civA].truceTurns = 8;
  return { ...state };
}

export function establishTradeRoute(state: GameState, civA: string, civB: string): GameState {
  const a = state.civs[civA];
  const b = state.civs[civB];
  if (!a || !b) return state;
  if (a.relations[civB].status === 'war' || a.relations[civB].status === 'unmet') return state;
  if (a.gold < 30) return state;
  a.gold -= 30;
  a.relations[civB].tradeRouteActive = true;
  a.relations[civB].opinion = Math.min(100, a.relations[civB].opinion + 15);
  b.relations[civA].tradeRouteActive = true;
  b.relations[civA].opinion = Math.min(100, b.relations[civA].opinion + 15);
  return { ...state };
}

export function toggleOpenBorders(state: GameState, civA: string, civB: string): GameState {
  const a = state.civs[civA];
  const b = state.civs[civB];
  if (!a || !b || a.relations[civB].status === 'war') return state;
  const next = a.relations[civB].status === 'open_borders' ? 'peace' : 'open_borders';
  a.relations[civB].status = next;
  b.relations[civA].status = next;
  a.relations[civB].opinion = Math.min(100, a.relations[civB].opinion + 10);
  return { ...state };
}

export function tradeWithPeacefulBarbarians(state: GameState, campId: string): GameState {
  const camp = state.barbarianCamps[campId];
  const player = state.civs[state.playerCivId];
  if (!camp || camp.disposition !== 'peaceful' || camp.tradedThisTurn || player.gold < 20) {
    return state;
  }
  player.gold -= 20;
  camp.tradedThisTurn = true;
  camp.attitude = Math.min(100, camp.attitude + 20);

  // Peaceful tribes share local survival / botanical / mineral lore!
  const eligible = CORE_KNOWLEDGE_NODES.filter(
    (n) =>
      !player.unlockedCore.includes(n.id) &&
      n.dependencies.every((d) => player.unlockedCore.includes(d))
  );
  if (eligible.length > 0) {
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    player.coreProgress[pick.id] = (player.coreProgress[pick.id] ?? 0) + 35;
    if (player.coreProgress[pick.id] >= 100) {
      player.coreProgress[pick.id] = 100;
      player.unlockedCore.push(pick.id);
    }
    state.notices.unshift({
      id: `barb_trade_${state.turn}_${camp.id}`,
      turn: state.turn,
      title: `Traded with ${camp.name}`,
      detail: `Exchanged 20 Gold for local lore (+35% progress on ${pick.name}).`,
      kind: 'diplomacy',
      q: camp.q,
      r: camp.r,
    });
  } else {
    player.researchPoints += 12;
  }

  return { ...state };
}

export function getAvailableUnitsForCity(civ: CivState): string[] {
  return Object.values(UNIT_DEFS)
    .filter((u) => {
      if (civ.ageIndex < u.minAge) return false;
      if (u.requiredInvention && !civ.unlockedInventions.includes(u.requiredInvention)) return false;
      if (u.requiredCore && !u.requiredCore.every((c) => civ.unlockedCore.includes(c))) return false;
      return true;
    })
    .map((u) => u.id);
}

export function getAvailableBuildingsForCity(civ: CivState, city: CityState): string[] {
  return Object.values(BUILDING_DEFS)
    .filter((b) => {
      if (city.buildings.includes(b.id)) return false;
      if (b.requiredInvention && !civ.unlockedInventions.includes(b.requiredInvention)) return false;
      if (b.requiredCore && !b.requiredCore.every((c) => civ.unlockedCore.includes(c))) return false;
      return true;
    })
    .map((b) => b.id);
}

export function endTurn(state: GameState): GameState {
  state.recentCombats = [];
  const pacingProd = getPacingResearchFactor(state.config.pacing);

  // 1. Process all active Civilizations (Cities, Economy, Workers, Healing, Research)
  for (const civ of Object.values(state.civs)) {
    if (civ.isEliminated) continue;
    const econ = getCivEconomySummary(state, civ.id);
    civ.gold += econ.netGold;
    if (civ.gold < 0) civ.gold = 0;

    // Cities
    const civCities = Object.values(state.cities).filter((c) => c.civId === civ.id);
    for (const city of civCities) {
      const cy = getCityYields(state, city);
      city.hp = Math.min(city.maxHp, city.hp + 6);
      city.foodStored += cy.netFood;

      if (city.foodStored >= city.foodNeeded) {
        city.foodStored -= city.foodNeeded;
        city.population += 1;
        city.foodNeeded = Math.round(city.foodNeeded * 1.35);
        // Auto-expand border by 1 tile if available
        const purchasable = getPurchasableTilesForCity(state, city.id);
        if (purchasable.length > 0) {
          const best = purchasable[Math.floor(Math.random() * purchasable.length)];
          best.ownerCityId = city.id;
          best.ownerCivId = civ.id;
          city.workedTiles.push(tileKey(best.q, best.r));
        }
      } else if (city.foodStored < 0) {
        city.foodStored = 0;
        if (city.population > 1) city.population -= 1;
      }

      // Production
      if (city.producing) {
        city.producing.progress += Math.round(cy.prod * pacingProd);
        if (city.producing.progress >= city.producing.cost) {
          if (city.producing.type === 'building') {
            city.buildings.push(city.producing.id);
            if (city.producing.id === 'walls') {
              city.maxHp += 40;
              city.hp += 40;
            }
            if (civ.isHuman) {
              state.notices.unshift({
                id: `bld_${city.id}_${state.turn}`,
                turn: state.turn,
                title: `${city.name}: Built ${BUILDING_DEFS[city.producing.id].name}`,
                detail: BUILDING_DEFS[city.producing.id].description,
                kind: 'city',
                q: city.q,
                r: city.r,
              });
            }
            city.producing = null;
          } else {
            const uDef = UNIT_DEFS[city.producing.id];
            // Find city tile or free neighbor
            const occupied = (q: number, r: number) =>
              Object.values(state.units).some((u) => u.q === q && u.r === r);
            let spawnQ = city.q;
            let spawnR = city.r;
            if (uDef.role === 'naval' || occupied(spawnQ, spawnR)) {
              const spot = hexNeighbors(city.q, city.r)
                .map((n) => state.tiles[tileKey(n.q, n.r)])
                .find((t) => {
                  if (!t || occupied(t.q, t.r)) return false;
                  if (uDef.role === 'naval') return t.biome === 'coast' || t.biome === 'ocean';
                  return t.biome !== 'ocean' && t.biome !== 'coast' && t.biome !== 'mountain';
                });
              if (spot) {
                spawnQ = spot.q;
                spawnR = spot.r;
              }
            }
            const newUnitId = `u_${civ.id}_${state.turn}_${Math.random().toString(36).slice(2, 6)}`;
            const startXp = city.buildings.includes('barracks') ? 15 : 0;
            state.units[newUnitId] = {
              id: newUnitId,
              defId: uDef.id,
              civId: civ.id,
              q: spawnQ,
              r: spawnR,
              hp: uDef.maxHp,
              maxHp: uDef.maxHp,
              movesLeft: uDef.moves,
              xp: startXp,
              level: 1,
              promotions: [],
              pendingPromotion: false,
              fortified: false,
              hasActed: false,
            };
            if (civ.isHuman) {
              state.notices.unshift({
                id: `unit_${newUnitId}`,
                turn: state.turn,
                title: `${city.name}: Trained ${uDef.name}`,
                detail: uDef.description,
                kind: 'city',
                q: spawnQ,
                r: spawnR,
              });
            }
            city.producing = null;
          }
        }
      }
    }

    // Research & Emergent Breakthroughs
    const techNotices = processCivResearchTurn(state, civ.id, econ.researchPerTurn);
    for (const n of techNotices) {
      state.notices.unshift(n);
    }

    // AI Civ Decisions
    if (!civ.isHuman) {
      runAiCivTurn(state, civ.id);
    }

    // Decrement truces
    for (const rel of Object.values(civ.relations)) {
      if (rel.truceTurns > 0) rel.truceTurns--;
    }
  }

  // 2. Refresh all units, process worker tasks & healing
  const sanitationActive = (civId: string) =>
    state.civs[civId]?.unlockedInventions.includes('sanitation_vaccines');

  for (const unit of Object.values(state.units)) {
    const def = UNIT_DEFS[unit.defId];
    let bonusMoves = 0;
    if (unit.promotions.includes('pathfinder') || unit.promotions.includes('seafarer')) {
      bonusMoves += 1;
    }

    if (unit.task) {
      unit.task.turnsLeft -= 1;
      if (unit.task.turnsLeft <= 0) {
        const tile = state.tiles[tileKey(unit.q, unit.r)];
        if (tile) {
          if (unit.task.type === 'repair') {
            tile.improvementDamaged = false;
            if (unit.civId === state.playerCivId) {
              state.notices.unshift({
                id: `rep_${state.turn}_${tile.q}_${tile.r}`,
                turn: state.turn,
                title: 'Infrastructure Repaired',
                detail: `Worker restored damaged ${tile.improvement.replace('_', ' ')}.`,
                kind: 'city',
                q: tile.q,
                r: tile.r,
              });
            }
          } else if (unit.task.type === 'build' && unit.task.improvement) {
            if (unit.task.improvement === 'road') {
              tile.hasRoad = true;
            } else {
              tile.improvement = unit.task.improvement;
              tile.improvementDamaged = false;
            }
          }
        }
        unit.task = undefined;
      }
    }

    // Healing if stationary / fortified
    if (!unit.hasActed && unit.hp < unit.maxHp) {
      let heal = unit.fortified ? 12 : 6;
      if (unit.promotions.includes('field_medic')) heal += 8;
      if (sanitationActive(unit.civId)) heal += 5;
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
    }

    unit.movesLeft = unit.task ? 0 : def.moves + bonusMoves;
    unit.hasActed = false;
  }

  // 3. Barbarians Turn (Peaceful roaming vs Aggressive raiders)
  runBarbarianTurn(state);

  state.turn += 1;
  state.notices = state.notices.slice(0, 24);
  updateVisibility(state);
  checkConquestVictory(state);
  saveGameToLocalStorage(state);

  return { ...state };
}

function runAiCivTurn(state: GameState, civId: string) {
  const civ = state.civs[civId];
  const cities = Object.values(state.cities).filter((c) => c.civId === civId);
  const units = Object.values(state.units).filter((u) => u.civId === civId);

  // Queue city production if idle
  for (const city of cities) {
    if (!city.producing) {
      const availUnits = getAvailableUnitsForCity(civ);
      const availBlds = getAvailableBuildingsForCity(civ, city);

      if (availBlds.length > 0 && Math.random() < 0.55) {
        const bId = availBlds[Math.floor(Math.random() * availBlds.length)];
        city.producing = {
          type: 'building',
          id: bId,
          progress: 0,
          cost: BUILDING_DEFS[bId].cost,
        };
      } else {
        const military = availUnits.filter((id) => {
          const r = UNIT_DEFS[id].role;
          return r === 'melee' || r === 'ranged' || r === 'cavalry' || r === 'siege';
        });
        const pickId =
          units.filter((u) => u.defId === 'worker').length < cities.length
            ? 'worker'
            : cities.length < 3 && Math.random() < 0.25
              ? 'settler'
              : military[military.length - 1] ?? 'warrior';
        city.producing = {
          type: 'unit',
          id: pickId,
          progress: 0,
          cost: UNIT_DEFS[pickId].cost,
        };
      }
    }
  }

  // Move AI units
  for (const unit of units) {
    const def = UNIT_DEFS[unit.defId];
    if (unit.pendingPromotion) {
      const eligible = SKILL_PROMOTIONS.filter(
        (p) => p.roles.includes(def.role) && !unit.promotions.includes(p.id)
      );
      if (eligible[0]) applyPromotion(state, unit.id, eligible[0].id);
    }

    if (def.role === 'settler') {
      const canSettle = !Object.values(state.cities).some(
        (c) => hexDistance(c.q, c.r, unit.q, unit.r) < 3
      );
      const tile = state.tiles[tileKey(unit.q, unit.r)];
      if (canSettle && tile && tile.biome !== 'ocean' && tile.biome !== 'coast' && tile.biome !== 'mountain') {
        foundCityWithSettler(state, unit.id);
        continue;
      }
    }

    if (def.role === 'worker' && !unit.task) {
      const tile = state.tiles[tileKey(unit.q, unit.r)];
      if (tile?.improvementDamaged) {
        startWorkerTask(state, unit.id, 'repair');
        continue;
      } else if (tile && tile.ownerCivId === civId && tile.improvement === 'none') {
        if (civ.unlockedInventions.includes('agriculture') && tile.biome === 'plains') {
          startWorkerTask(state, unit.id, 'build', 'farm');
          continue;
        }
        if (civ.unlockedInventions.includes('mining_shafts') && tile.biome === 'hills') {
          startWorkerTask(state, unit.id, 'build', 'mine');
          continue;
        }
      }
    }

    // Combat AI: attack adjacent enemies if at war or aggressive barbarians
    if (def.attack > 0) {
      const enemyTarget = Object.values(state.units).find(
        (other) =>
          other.civId !== civId &&
          civ.relations[other.civId]?.status === 'war' &&
          hexDistance(unit.q, unit.r, other.q, other.r) <= def.range
      );
      if (enemyTarget) {
        resolveCombat(state, unit.id, enemyTarget.q, enemyTarget.r);
        continue;
      }
      const barbTarget = Object.values(state.barbarianUnits).find(
        (bu) =>
          bu.disposition === 'aggressive' &&
          hexDistance(unit.q, unit.r, bu.q, bu.r) <= def.range
      );
      if (barbTarget) {
        resolveCombat(state, unit.id, barbTarget.q, barbTarget.r);
        continue;
      }
    }

    // Patrol / wander to valid neighbor
    const neighbors = hexNeighbors(unit.q, unit.r)
      .map((n) => state.tiles[tileKey(n.q, n.r)])
      .filter(
        (t) =>
          t &&
          t.biome !== 'ocean' &&
          t.biome !== 'coast' &&
          t.biome !== 'mountain' &&
          !Object.values(state.units).some((u) => u.q === t.q && u.r === t.r)
      );
    if (neighbors.length > 0 && Math.random() < 0.65) {
      const dest = neighbors[Math.floor(Math.random() * neighbors.length)];
      unit.q = dest.q;
      unit.r = dest.r;
    }
  }
}

function runBarbarianTurn(state: GameState) {
  for (const camp of Object.values(state.barbarianCamps)) {
    camp.tradedThisTurn = false;
    camp.spawnCooldown--;
    const campUnits = Object.values(state.barbarianUnits).filter((bu) => bu.campId === camp.id);
    if (camp.spawnCooldown <= 0 && campUnits.length < 2) {
      camp.spawnCooldown = camp.disposition === 'aggressive' ? 5 : 8;
      const occupied = Object.values(state.barbarianUnits).some(
        (bu) => bu.q === camp.q && bu.r === camp.r
      );
      if (!occupied) {
        const id = `bu_${camp.id}_${state.turn}`;
        state.barbarianUnits[id] = {
          id,
          campId: camp.id,
          disposition: camp.disposition,
          name: camp.disposition === 'peaceful' ? 'Tribal Watch' : 'Barbarian Raider',
          q: camp.q,
          r: camp.r,
          hp: 80,
          maxHp: 80,
          attack: camp.disposition === 'peaceful' ? 9 : 14 + Math.min(14, Math.floor(state.turn / 5)),
          defense: 11 + Math.min(10, Math.floor(state.turn / 6)),
          movesLeft: 2,
        };
      }
    }
  }

  for (const bu of Object.values(state.barbarianUnits)) {
    if (bu.disposition === 'aggressive') {
      // Attack adjacent unit if found
      const targetUnit = Object.values(state.units).find(
        (u) => hexDistance(bu.q, bu.r, u.q, u.r) === 1
      );
      if (targetUnit) {
        const targetTile = state.tiles[tileKey(targetUnit.q, targetUnit.r)];
        const defStats = getUnitEffectiveStats(targetUnit, targetTile);
        const dmg = Math.max(6, Math.round((bu.attack / Math.max(6, defStats.defense)) * 24));
        targetUnit.hp -= dmg;
        bu.hp -= Math.max(4, Math.round((defStats.defense / Math.max(6, bu.attack)) * 14));
        if (targetUnit.civId === state.playerCivId) {
          state.recentCombats.push({
            id: `bcmb_${Date.now()}_${Math.random()}`,
            fromQ: bu.q,
            fromR: bu.r,
            toQ: targetUnit.q,
            toR: targetUnit.r,
            damage: dmg,
            timestamp: Date.now(),
          });
        }
        if (targetUnit.hp <= 0) delete state.units[targetUnit.id];
        if (bu.hp <= 0) delete state.barbarianUnits[bu.id];
        continue;
      }

      // Pillage improvement on current tile
      const standing = state.tiles[tileKey(bu.q, bu.r)];
      if (standing && standing.improvement !== 'none' && !standing.improvementDamaged) {
        standing.improvementDamaged = true;
        if (standing.ownerCivId === state.playerCivId) {
          state.notices.unshift({
            id: `pillage_${state.turn}_${standing.q}`,
            turn: state.turn,
            title: 'Infrastructure Pillaged!',
            detail: `Raiders damaged your ${standing.improvement.replace('_', ' ')}. Send a Worker to repair it.`,
            kind: 'combat',
            q: standing.q,
            r: standing.r,
          });
        }
        continue;
      }

      // Move toward nearest player/AI unit within 4 hexes
      const nearUnit = Object.values(state.units).find(
        (u) => hexDistance(bu.q, bu.r, u.q, u.r) <= 4
      );
      if (nearUnit) {
        const step = hexNeighbors(bu.q, bu.r)
          .map((n) => state.tiles[tileKey(n.q, n.r)])
          .filter(
            (t) =>
              t &&
              t.biome !== 'ocean' &&
              t.biome !== 'coast' &&
              t.biome !== 'mountain' &&
              !Object.values(state.units).some((u) => u.q === t.q && u.r === t.r) &&
              !Object.values(state.barbarianUnits).some((o) => o.q === t.q && o.r === t.r)
          )
          .sort(
            (a, b) =>
              hexDistance(a.q, a.r, nearUnit.q, nearUnit.r) -
              hexDistance(b.q, b.r, nearUnit.q, nearUnit.r)
          )[0];
        if (step) {
          bu.q = step.q;
          bu.r = step.r;
        }
      }
    } else {
      // Peaceful tribe stays near camp
      const camp = state.barbarianCamps[bu.campId];
      if (camp && Math.random() < 0.35) {
        const step = hexNeighbors(bu.q, bu.r)
          .map((n) => state.tiles[tileKey(n.q, n.r)])
          .find(
            (t) =>
              t &&
              t.biome !== 'ocean' &&
              t.biome !== 'coast' &&
              t.biome !== 'mountain' &&
              hexDistance(t.q, t.r, camp.q, camp.r) <= 1 &&
              !Object.values(state.units).some((u) => u.q === t.q && u.r === t.r) &&
              !Object.values(state.barbarianUnits).some((o) => o.q === t.q && o.r === t.r)
          );
        if (step) {
          bu.q = step.q;
          bu.r = step.r;
        }
      }
    }
  }
}
