import {
  AGES,
  BUILDING_DEFS,
  CORE_KNOWLEDGE_NODES,
  INVENTIONS,
} from '../data/registries';
import {
  CivState,
  CoreKnowledgeNode,
  DiscoveryModifiers,
  GameState,
  InventionNode,
  ToastNotice,
} from '../types/game';

export function computeDiscoveryModifiers(state: GameState, civId: string): DiscoveryModifiers {
  const civ = state.civs[civId];
  const civCities = Object.values(state.cities).filter((c) => c.civId === civId);
  const citiesCount = civCities.length;
  const totalPop = civCities.reduce((acc, c) => acc + c.population, 0);

  let exploredLand = 0;
  let totalLand = 0;
  let mountainsCount = 0;

  for (const tile of Object.values(state.tiles)) {
    if (tile.biome !== 'ocean' && tile.biome !== 'coast') {
      totalLand++;
      if (tile.exploredBy[civId]) {
        exploredLand++;
        if (tile.biome === 'mountain') {
          mountainsCount++;
        }
      }
    }
  }

  const landUncoveredPct = totalLand > 0 ? Math.round((exploredLand / totalLand) * 100) : 0;

  const civsMetCount = Object.values(civ.relations).filter((r) => r.status !== 'unmet').length;
  const tradeRoutesCount = Object.values(civ.relations).filter((r) => r.tradeRouteActive).length;

  let buildingsBonus = 0;
  for (const city of civCities) {
    for (const bId of city.buildings) {
      const bDef = BUILDING_DEFS[bId];
      if (bDef?.inventionMultiplier) {
        buildingsBonus += bDef.inventionMultiplier;
      }
    }
  }
  if (civ.unlockedInventions.includes('pictographic_writing')) {
    buildingsBonus += 0.1;
  }
  if (civ.unlockedInventions.includes('algebraic_equations')) {
    buildingsBonus += 0.15;
  }

  const citiesBonus = Math.min(0.45, Math.max(0, (citiesCount - 1) * 0.08));
  const populationBonus = Math.min(0.5, totalPop * 0.015);
  const landBonus = Math.min(0.6, (landUncoveredPct / 100) * 0.65);
  const wondersCount = civ.discoveredWonders.length;
  const wondersBonus = wondersCount * 0.16;
  const mountainsBonus = Math.min(0.24, mountainsCount * 0.02);
  const civsBonus = civsMetCount * 0.09;
  const tradeBonus = tradeRoutesCount * 0.14;
  const oceanCrossedBonus = civ.crossedOcean ? 0.2 : 0;
  const zonesCount = civ.discoveredZones.length;
  const zonesBonus = Math.max(0, zonesCount - 1) * 0.11;

  const totalMultiplier =
    1 +
    citiesBonus +
    populationBonus +
    landBonus +
    wondersBonus +
    mountainsBonus +
    civsBonus +
    buildingsBonus +
    tradeBonus +
    oceanCrossedBonus +
    zonesBonus;

  return {
    citiesBonus,
    populationBonus,
    landUncoveredPct,
    landBonus,
    wondersCount,
    wondersBonus,
    mountainsCount,
    mountainsBonus,
    civsMetCount,
    civsBonus,
    buildingsBonus,
    tradeRoutesCount,
    tradeBonus,
    oceanCrossedBonus,
    zonesCount,
    zonesBonus,
    totalMultiplier,
  };
}

export function getEligibleCoreNodes(civ: CivState): CoreKnowledgeNode[] {
  return CORE_KNOWLEDGE_NODES.filter(
    (node) =>
      !civ.unlockedCore.includes(node.id) &&
      node.dependencies.every((dep) => civ.unlockedCore.includes(dep))
  );
}

export function getEligibleInventions(civ: CivState): InventionNode[] {
  return INVENTIONS.filter(
    (inv) =>
      !civ.unlockedInventions.includes(inv.id) &&
      inv.requiredCore.every((c) => civ.unlockedCore.includes(c)) &&
      inv.requiredInventions.every((req) => civ.unlockedInventions.includes(req))
  );
}

export function getInventionTurnChance(
  inv: InventionNode,
  civ: CivState,
  modifiers: DiscoveryModifiers,
  researchPerTurn: number,
  pacingMultiplier: number
): number {
  const researchScale = 0.65 + Math.min(1.4, researchPerTurn / 24);
  const pity = civ.inventionPity[inv.id] ?? 0;
  const raw = inv.baseChance * 0.55 * modifiers.totalMultiplier * researchScale * pacingMultiplier + pity;
  return Math.min(0.88, Math.max(0.02, raw));
}

export function getPacingResearchFactor(pacing: GameState['config']['pacing']): number {
  if (pacing === 'quick') return 1.45;
  if (pacing === 'epic') return 0.72;
  return 1.0;
}

export function processCivResearchTurn(
  state: GameState,
  civId: string,
  researchPerTurn: number
): ToastNotice[] {
  const civ = state.civs[civId];
  const notices: ToastNotice[] = [];
  const modifiers = computeDiscoveryModifiers(state, civId);
  const pacingFactor = getPacingResearchFactor(state.config.pacing);

  civ.researchPoints += researchPerTurn;

  // 1. Distribute Research Points into eligible Core Knowledge nodes with weighted focus + randomness
  const eligibleCore = getEligibleCoreNodes(civ);
  if (eligibleCore.length > 0) {
    const weights = eligibleCore.map((node) => {
      let w = node.domain === civ.domainFocus ? 2.6 : 1.0;
      // Add slight randomness so discovery order varies organically each game
      w *= 0.75 + Math.random() * 0.65;
      return { node, w };
    });
    const totalWeight = weights.reduce((s, item) => s + item.w, 0);

    const literacyMult = civ.unlockedInventions.includes('literacy_reading') ? 1.12 : 1.0;
    // ~2.6x higher Core Knowledge / science threshold per era so early techs take 12-20 turns
    const effectiveRp =
      researchPerTurn * 0.38 * (0.75 + modifiers.totalMultiplier * 0.35) * pacingFactor * literacyMult;
    for (const { node, w } of weights) {
      const share = (w / totalWeight) * effectiveRp;
      const pctGain = (share / node.baseDifficulty) * 100;
      const luckSpark = Math.random() < 0.06 * modifiers.totalMultiplier ? 6 : 0;
      const nextVal = (civ.coreProgress[node.id] ?? 0) + pctGain + luckSpark;
      civ.coreProgress[node.id] = nextVal;

      if (nextVal >= 100) {
        civ.coreProgress[node.id] = 100;
        civ.unlockedCore.push(node.id);
        if (civ.isHuman) {
          notices.push({
            id: `core_${node.id}_${state.turn}`,
            turn: state.turn,
            title: `Core Knowledge: ${node.name}`,
            detail: node.summary,
            kind: 'core',
          });
        }
      }
    }
  }

  // 2. Roll probabilistic Invention breakthroughs (only when Core dependencies are met, NOT automatic!)
  const eligibleInvs = getEligibleInventions(civ);
  for (const inv of eligibleInvs) {
    const chance = getInventionTurnChance(inv, civ, modifiers, researchPerTurn, pacingFactor);
    if (Math.random() < chance) {
      civ.unlockedInventions.push(inv.id);
      const isEarly = inv.eraHint > civ.ageIndex;
      if (isEarly) {
        civ.earlyInventions.push(inv.id);
      }
      if (civ.isHuman) {
        notices.push({
          id: `inv_${inv.id}_${state.turn}`,
          turn: state.turn,
          title: isEarly ? `Early Breakthrough: ${inv.name}!` : `Invention: ${inv.name}`,
          detail: isEarly
            ? `Ahead of the ${AGES[inv.eraHint].name}! ${inv.summary}`
            : inv.summary,
          kind: 'invention',
        });
      }
    } else {
      // Accumulate gentle pity luck so discoveries don't stall forever
      civ.inventionPity[inv.id] = (civ.inventionPity[inv.id] ?? 0) + 0.015 * pacingFactor;
    }
  }

  // 3. Evaluate Age Progression
  let nextAge = civ.ageIndex;
  for (const age of AGES) {
    if (
      age.index > nextAge &&
      civ.unlockedCore.length >= age.minCoreCount &&
      civ.unlockedInventions.length >= age.minInventionCount
    ) {
      nextAge = age.index;
    }
  }
  if (nextAge > civ.ageIndex) {
    civ.ageIndex = nextAge;
    const ageDef = AGES[nextAge];
    if (civ.isHuman) {
      notices.push({
        id: `age_${ageDef.id}_${state.turn}`,
        turn: state.turn,
        title: `Entered the ${ageDef.name}`,
        detail: ageDef.subtitle,
        kind: 'age',
      });
    }
  }

  return notices;
}
