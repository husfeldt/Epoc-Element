export type MapType = 'continents' | 'archipelago' | 'pangaea' | 'inland_sea' | 'wild_frontier';
export type MapSize = 'small' | 'medium' | 'large';
export type TurnPacing = 'quick' | 'standard' | 'epic';
export type Difficulty = 'explorer' | 'strategist' | 'sovereign';

export type TemperatureZone = 'arctic' | 'temperate' | 'arid' | 'tropical' | 'ocean';

export type BiomeType =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'desert'
  | 'tundra';

export type ShorelineType =
  | 'none'
  | 'sandy_beach'
  | 'rocky_shore'
  | 'high_cliffs'
  | 'coastal_swamp'
  | 'coral_reef'
  | 'icy_shore';

export type NaturalFeatureType =
  | 'none'
  | 'coal'
  | 'iron'
  | 'copper'
  | 'rare_flora'
  | 'fossils'
  | 'ancient_ruins'
  | 'natural_wonder'
  | 'geothermal_vent';

export type ImprovementType =
  | 'none'
  | 'farm'
  | 'mine'
  | 'road'
  | 'lumber_mill'
  | 'quarry'
  | 'trade_post'
  | 'fort';

export type CoreDomain = 'matter' | 'physics' | 'energy' | 'life' | 'cosmos';

export interface AgeDef {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  minCoreCount: number;
  minInventionCount: number;
  accentColor: string;
}

export interface CoreKnowledgeNode {
  id: string;
  name: string;
  domain: CoreDomain;
  dependencies: string[];
  tier: number; // 0..4 for visual DAG column layout
  baseDifficulty: number;
  summary: string;
  boostedByFeatures?: NaturalFeatureType[];
  boostedByZones?: TemperatureZone[];
}

export interface InventionNode {
  id: string;
  name: string;
  eraHint: number; // Typical Age index 0..8 (can be discovered earlier!)
  requiredCore: string[];
  requiredInventions: string[];
  baseChance: number; // Per-turn probability baseline 0.04 .. 0.25
  category: 'construction' | 'military' | 'science' | 'economy' | 'maritime';
  summary: string;
  unlocksUnits?: string[];
  unlocksBuildings?: string[];
  unlocksImprovements?: ImprovementType[];
  passiveBonusText?: string;
}

export type UnitRole =
  | 'settler'
  | 'worker'
  | 'scout'
  | 'explorer'
  | 'melee'
  | 'ranged'
  | 'cavalry'
  | 'siege'
  | 'naval';

export interface UnitDef {
  id: string;
  name: string;
  role: UnitRole;
  cost: number;
  upkeep: number;
  attack: number;
  defense: number;
  range: number;
  moves: number;
  sight: number;
  maxHp: number;
  minAge: number;
  requiredCore?: string[];
  requiredInvention?: string;
  canCrossOcean?: boolean;
  description: string;
}

export interface SkillPromotionDef {
  id: string;
  name: string;
  roles: UnitRole[];
  description: string;
  attackBonus?: number;
  defenseBonus?: number;
  moveBonus?: number;
  sightBonus?: number;
  healPerTurn?: number;
  surveyBonus?: number;
  siegeBonus?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  cost: number;
  upkeep: number;
  foodYield?: number;
  prodYield?: number;
  goldYield?: number;
  researchYield?: number;
  defenseBonus?: number;
  inventionMultiplier?: number; // e.g. 0.12 = +12% discovery rate
  requiredCore?: string[];
  requiredInvention?: string;
  description: string;
}

export interface HexTile {
  q: number;
  r: number;
  biome: BiomeType;
  temperature: TemperatureZone;
  elevation: number; // 0..1
  feature: NaturalFeatureType;
  featureSurveyed: boolean;
  wonderName?: string;
  improvement: ImprovementType;
  improvementDamaged: boolean;
  hasRoad: boolean;
  hasRiver?: boolean;
  ownerCityId: string | null;
  ownerCivId: string | null;
  exploredBy: Record<string, boolean>; // civId -> explored
  visibleTo: Record<string, boolean>; // civId -> currently visible
  riverEdges?: boolean[];
  shoreline?: ShorelineType;
  clusterType?:
    | 'oasis'
    | 'mountain_massif'
    | 'coral_lagoon'
    | 'coastal_swamp_delta'
    | 'cliff_headland'
    | 'icy_fjord';
  clusterRole?: 'center' | 'inner_ring' | 'outer_ring';
}

export interface UnitState {
  id: string;
  defId: string;
  civId: string;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  movesLeft: number;
  xp: number;
  level: number;
  promotions: string[];
  pendingPromotion: boolean;
  fortified: boolean;
  task?: {
    type: 'build' | 'repair';
    improvement?: ImprovementType;
    turnsLeft: number;
  };
  hasActed: boolean;
}

export interface CityState {
  id: string;
  name: string;
  civId: string;
  q: number;
  r: number;
  isCapital: boolean;
  population: number;
  foodStored: number;
  foodNeeded: number;
  hp: number;
  maxHp: number;
  buildings: string[];
  producing: {
    type: 'unit' | 'building';
    id: string;
    progress: number;
    cost: number;
  } | null;
  workedTiles: string[]; // "q,r" keys
}

export type DiplomaticStatus = 'unmet' | 'peace' | 'war' | 'open_borders' | 'alliance';

export interface DiplomacyRelation {
  status: DiplomaticStatus;
  opinion: number; // -100 to 100
  tradeRouteActive: boolean;
  truceTurns: number;
  lastContactTurn: number;
}

export interface CivState {
  id: string;
  name: string;
  leaderName: string;
  color: string;
  accentColor: string;
  isHuman: boolean;
  isEliminated: boolean;
  personality: 'expansionist' | 'scholar' | 'militarist' | 'mercantile';
  gold: number;
  researchPoints: number;
  ageIndex: number;
  domainFocus: CoreDomain;
  unlockedCore: string[];
  coreProgress: Record<string, number>; // nodeId -> 0..100
  unlockedInventions: string[];
  inventionPity: Record<string, number>; // inventionId -> accumulated bonus chance
  earlyInventions: string[]; // inventions discovered ahead of eraHint
  discoveredZones: TemperatureZone[];
  discoveredWonders: string[];
  crossedOcean: boolean;
  relations: Record<string, DiplomacyRelation>;
}

export type BarbarianDisposition = 'peaceful' | 'aggressive';

export type NaturalDisasterKind =
  | 'shore_anomaly'
  | 'meteor_strike'
  | 'volcano_eruption'
  | 'river_flood';

export interface NaturalDisasterVfx {
  id: string;
  kind: NaturalDisasterKind;
  q: number;
  r: number;
  title: string;
  damageDealt?: number;
  timestamp: number;
}

export interface SurveyDiscoveryPopup {
  id: string;
  turn: number;
  q: number;
  r: number;
  feature: NaturalFeatureType;
  unitName: string;
  coreNodeId: string;
  coreNodeName: string;
  domain: CoreDomain;
  progressBefore: number;
  progressAfter: number;
  sparkAdded: number;
  isFullDiscovery: boolean;
  xpGained: number;
}

export interface BarbarianCamp {
  id: string;
  name: string;
  q: number;
  r: number;
  disposition: BarbarianDisposition;
  hp: number;
  maxHp: number;
  attitude: number; // for peaceful tribes: can increase via gifts/trade
  tradedThisTurn: boolean;
  spawnCooldown: number;
}

export interface BarbarianUnit {
  id: string;
  campId: string;
  disposition: BarbarianDisposition;
  name: string;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  movesLeft: number;
}

export interface ExplorationEventChoice {
  label: string;
  description: string;
  effect: {
    gold?: number;
    research?: number;
    coreBoostDomain?: CoreDomain;
    instantCoreSpark?: boolean;
    xp?: number;
    heal?: number;
    population?: number;
  };
}

export interface ExplorationEvent {
  id: string;
  title: string;
  subtitle: string;
  narrative: string;
  q: number;
  r: number;
  unitId?: string;
  disasterKind?: NaturalDisasterKind;
  observerSummary?: string;
  damageReport?: string;
  choices: ExplorationEventChoice[];
}

export interface DiscoveryModifiers {
  citiesBonus: number;
  populationBonus: number;
  landUncoveredPct: number;
  landBonus: number;
  wondersCount: number;
  wondersBonus: number;
  mountainsCount: number;
  mountainsBonus: number;
  civsMetCount: number;
  civsBonus: number;
  buildingsBonus: number;
  tradeRoutesCount: number;
  tradeBonus: number;
  oceanCrossedBonus: number;
  zonesCount: number;
  zonesBonus: number;
  totalMultiplier: number;
}

export interface ToastNotice {
  id: string;
  turn: number;
  title: string;
  detail: string;
  kind: 'core' | 'invention' | 'age' | 'combat' | 'diplomacy' | 'event' | 'city';
  q?: number;
  r?: number;
}

export interface CombatAnimation {
  id: string;
  fromQ: number;
  fromR: number;
  toQ: number;
  toR: number;
  damage: number;
  counterDamage?: number;
  kind?: 'melee' | 'ranged' | 'siege' | 'naval' | 'capture';
  capturedCityName?: string;
  timestamp: number;
}

export interface GameConfig {
  playerName: string;
  civName: string;
  mapType: MapType;
  mapSize: MapSize;
  aiCount: number;
  pacing: TurnPacing;
  difficulty: Difficulty;
}

export interface GameState {
  id: string;
  config: GameConfig;
  turn: number;
  width: number;
  height: number;
  tiles: Record<string, HexTile>; // key "q,r"
  civs: Record<string, CivState>;
  cities: Record<string, CityState>;
  units: Record<string, UnitState>;
  barbarianCamps: Record<string, BarbarianCamp>;
  barbarianUnits: Record<string, BarbarianUnit>;
  playerCivId: string;
  winnerCivId: string | null;
  activeEvent: ExplorationEvent | null;
  activeSurveyPopup?: SurveyDiscoveryPopup | null;
  notices: ToastNotice[];
  recentCombats: CombatAnimation[];
  recentDisasters?: NaturalDisasterVfx[];
  naturalEventsByAge?: Record<number, number>;
  lastNaturalEventTurn?: number;
  seed: number;
}
