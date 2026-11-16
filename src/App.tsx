import React, { useEffect, useMemo, useState } from 'react';
import {
  Atom,
  Award,
  Building2,
  Coins,
  Compass,
  Flag,
  FolderOpen,
  Hammer,
  Handshake,
  HelpCircle,
  Save,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import { CityDrawer } from './components/CityDrawer';
import { DiplomacyModal } from './components/DiplomacyModal';
import {
  DramaticChronicleEvent,
  DramaticChronicleModal,
  ExplorationEventModal,
  PromotionModal,
  SaveLoadModal,
  SurveyDiscoveryModal,
  VictoryModal,
} from './components/GameModals';
import { HexMapCanvas } from './components/HexMapCanvas';
import { TechTreeModal } from './components/TechTreeModal';
import { TitleScreen } from './components/TitleScreen';
import { AGES, BUILDING_DEFS, DOMAIN_META, INVENTIONS, SKILL_PROMOTIONS, UNIT_DEFS } from './data/registries';
import { MapViewMode, getReachableHexes, hexDistance, tileKey } from './engine/hexMath';
import { generateWorld } from './engine/mapGenerator';
import { computeDiscoveryModifiers } from './engine/researchEngine';
import { soundFx } from './engine/soundFx';
import { resolveTileShoreline } from './engine/spriteAtlas';
import {
  SavedGameSlot,
  applyPromotion,
  buyTileForCity,
  clearSavedGame,
  declareWar,
  deleteSavedGame,
  endTurn,
  establishTradeRoute,
  foundCityWithSettler,
  getCivEconomySummary,
  getPurchasableTilesForCity,
  listSavedGames,
  loadGameFromLocalStorage,
  makePeace,
  moveUnitTo,
  resolveCombat,
  resolveExplorationEventChoice,
  saveGameToLocalStorage,
  saveNamedGame,
  startWorkerTask,
  surveyTileFeature,
  toggleOpenBorders,
  tradeWithPeacefulBarbarians,
  updateVisibility,
} from './engine/turnEngine';
import { CoreDomain, GameConfig, GameState, HexTile, ImprovementType } from './types/game';

export default function App() {
  const [savedSnapshot, setSavedSnapshot] = useState<GameState | null>(() =>
    loadGameFromLocalStorage()
  );
  const [savedSlots, setSavedSlots] = useState<SavedGameSlot[]>(() => listSavedGames());
  const [saveLoadModalMode, setSaveLoadModalMode] = useState<'save' | 'load' | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedTileKey, setSelectedTileKey] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<HexTile | null>(null);

  const [buyTileModeCityId, setBuyTileModeCityId] = useState<string | null>(null);
  const [showTechModal, setShowTechModal] = useState(false);
  const [showDiplomacyModal, setShowDiplomacyModal] = useState(false);
  const [promotingUnitId, setPromotingUnitId] = useState<string | null>(null);
  const [chronicleQueue, setChronicleQueue] = useState<DramaticChronicleEvent[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [viewMode, setViewMode] = useState<MapViewMode>('isometric');
  const [cameraTarget, setCameraTarget] = useState<{ q: number; r: number; trigger: number } | null>(
    null
  );

  // Start new campaign
  const handleStartNew = (config: GameConfig) => {
    const fresh = generateWorld(config);
    updateVisibility(fresh);
    saveGameToLocalStorage(fresh);
    setGameState(fresh);
    setSavedSnapshot(fresh);
    setSavedSlots(listSavedGames());
    const firstScout = Object.values(fresh.units).find(
      (u) => u.civId === fresh.playerCivId && u.defId === 'scout'
    );
    setSelectedUnitId(firstScout?.id ?? null);
    setSelectedCityId(null);
    setBuyTileModeCityId(null);

    const cap = Object.values(fresh.cities).find((c) => c.civId === fresh.playerCivId);
    if (cap) {
      setCameraTarget({ q: cap.q, r: cap.r, trigger: Date.now() });
    }
    soundFx.playTurnEnd();
  };

  const handleResumeSaved = () => {
    const loaded = loadGameFromLocalStorage() ?? savedSlots[0]?.state ?? null;
    if (!loaded) return;
    setGameState(structuredClone(loaded));
    const cap = Object.values(loaded.cities).find((c) => c.civId === loaded.playerCivId);
    if (cap) {
      setCameraTarget({ q: cap.q, r: cap.r, trigger: Date.now() });
    }
  };

  const handleSaveNamedGame = (title: string, overwriteSlotId?: string) => {
    if (!gameState) return;
    saveNamedGame(gameState, title, overwriteSlotId);
    saveGameToLocalStorage(gameState);
    setSavedSnapshot(gameState);
    setSavedSlots(listSavedGames());
    soundFx.playDiscovery();
  };

  const handleLoadSlot = (slot: SavedGameSlot) => {
    const loaded = structuredClone(slot.state);
    setGameState(loaded);
    setSavedSnapshot(loaded);
    setSelectedUnitId(null);
    setSelectedCityId(null);
    setBuyTileModeCityId(null);
    setSaveLoadModalMode(null);
    const cap = Object.values(loaded.cities).find((c) => c.civId === loaded.playerCivId);
    if (cap) {
      setCameraTarget({ q: cap.q, r: cap.r, trigger: Date.now() });
    }
    soundFx.playTurnEnd();
  };

  const handleDeleteSlot = (slotId: string) => {
    const nextSlots = deleteSavedGame(slotId);
    setSavedSlots(nextSlots);
    setSavedSnapshot(loadGameFromLocalStorage() ?? nextSlots[0]?.state ?? null);
    soundFx.playClick();
  };

  const handleQuitToMenu = () => {
    if (gameState) {
      saveGameToLocalStorage(gameState);
      setSavedSnapshot(gameState);
      setSavedSlots(listSavedGames());
    }
    setGameState(null);
    setSelectedUnitId(null);
    setSelectedCityId(null);
    setBuyTileModeCityId(null);
  };

  const handleToggleMute = () => {
    soundFx.muted = !muted;
    setMuted(!muted);
  };

  // Derived selections & reachable/attackable hexes
  const selectedUnit = gameState && selectedUnitId ? gameState.units[selectedUnitId] : null;
  const selectedCity = gameState && selectedCityId ? gameState.cities[selectedCityId] : null;

  const reachableHexes = useMemo(() => {
    if (!gameState || !selectedUnit || selectedUnit.civId !== gameState.playerCivId) {
      return new Map<string, { cost: number; parent: string | null }>();
    }
    if (selectedUnit.movesLeft <= 0 || selectedUnit.task) {
      return new Map<string, { cost: number; parent: string | null }>();
    }
    const def = UNIT_DEFS[selectedUnit.defId];
    const blocked = new Set<string>();
    for (const u of Object.values(gameState.units)) {
      if (u.id !== selectedUnit.id) blocked.add(tileKey(u.q, u.r));
    }
    for (const bu of Object.values(gameState.barbarianUnits)) {
      blocked.add(tileKey(bu.q, bu.r));
    }
    for (const c of Object.values(gameState.cities)) {
      if (c.civId !== selectedUnit.civId) blocked.add(tileKey(c.q, c.r));
    }
    return getReachableHexes(
      selectedUnit.q,
      selectedUnit.r,
      selectedUnit.movesLeft,
      gameState.tiles,
      def,
      selectedUnit,
      blocked
    );
  }, [gameState, selectedUnit]);

  const attackableKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!gameState || !selectedUnit || selectedUnit.civId !== gameState.playerCivId) return keys;
    const def = UNIT_DEFS[selectedUnit.defId];
    if (def.attack <= 0 || selectedUnit.movesLeft <= 0 || selectedUnit.hasActed) return keys;

    for (const u of Object.values(gameState.units)) {
      if (
        u.civId !== selectedUnit.civId &&
        hexDistance(selectedUnit.q, selectedUnit.r, u.q, u.r) <= def.range &&
        gameState.tiles[tileKey(u.q, u.r)]?.visibleTo[gameState.playerCivId]
      ) {
        keys.add(tileKey(u.q, u.r));
      }
    }
    for (const bu of Object.values(gameState.barbarianUnits)) {
      if (
        hexDistance(selectedUnit.q, selectedUnit.r, bu.q, bu.r) <= def.range &&
        gameState.tiles[tileKey(bu.q, bu.r)]?.visibleTo[gameState.playerCivId]
      ) {
        keys.add(tileKey(bu.q, bu.r));
      }
    }
    for (const c of Object.values(gameState.cities)) {
      if (
        c.civId !== selectedUnit.civId &&
        hexDistance(selectedUnit.q, selectedUnit.r, c.q, c.r) <= def.range &&
        gameState.tiles[tileKey(c.q, c.r)]?.visibleTo[gameState.playerCivId]
      ) {
        keys.add(tileKey(c.q, c.r));
      }
    }
    return keys;
  }, [gameState, selectedUnit]);

  const purchasableKeys = useMemo(() => {
    const s = new Set<string>();
    if (!gameState || !buyTileModeCityId) return s;
    for (const t of getPurchasableTilesForCity(gameState, buyTileModeCityId)) {
      s.add(tileKey(t.q, t.r));
    }
    return s;
  }, [gameState, buyTileModeCityId]);

  // Hex Click Handler
  const handleHexClick = (q: number, r: number) => {
    if (!gameState) return;
    const k = tileKey(q, r);
    const tile = gameState.tiles[k];
    if (!tile) return;

    // 1. Tile purchase mode
    if (buyTileModeCityId && purchasableKeys.has(k)) {
      const next = buyTileForCity(structuredClone(gameState), buyTileModeCityId, q, r);
      setGameState(next);
      soundFx.playClick();
      return;
    }

    // 2. Attack target if valid
    if (selectedUnit && attackableKeys.has(k)) {
      const next = resolveCombat(structuredClone(gameState), selectedUnit.id, q, r);
      const lastCmb = next.recentCombats[next.recentCombats.length - 1];
      setGameState(next);
      soundFx.playCombat(lastCmb?.kind ?? 'melee');
      if (lastCmb?.kind === 'capture' && lastCmb.capturedCityName) {
        setChronicleQueue((prev) => [
          ...prev,
          {
            id: `cap_${lastCmb.id}`,
            kind: 'city_capture',
            eyebrow: 'Citadel Seized',
            title: `${lastCmb.capturedCityName} Captured!`,
            description: `Your forces breached the defenses and raised your standard above ${lastCmb.capturedCityName}.`,
            accentColor: '#fbbf24',
          },
        ]);
      }
      return;
    }

    // 3. Move selected unit if reachable
    if (selectedUnit && reachableHexes.has(k)) {
      const step = reachableHexes.get(k)!;
      const hadEvent = Boolean(gameState.activeEvent);
      const hadSurvey = Boolean(gameState.activeSurveyPopup);
      const next = moveUnitTo(structuredClone(gameState), selectedUnit.id, q, r, step.cost);
      setGameState(next);
      const isNaval =
        UNIT_DEFS[selectedUnit.defId]?.role === 'naval' ||
        tile.biome === 'coast' ||
        tile.biome === 'ocean';
      soundFx.playMove(isNaval);
      if (!hadEvent && next.activeEvent) {
        soundFx.playEventPopup();
      } else if (!hadSurvey && next.activeSurveyPopup) {
        soundFx.playDiscovery();
      }
      setSelectedTileKey(k);
      return;
    }

    // 4. Select friendly unit or city on tile
    setSelectedTileKey(k);
    const unitOnTile = Object.values(gameState.units).find(
      (u) => u.q === q && u.r === r && u.civId === gameState.playerCivId
    );
    const cityOnTile = Object.values(gameState.cities).find(
      (c) => c.q === q && c.r === r && c.civId === gameState.playerCivId
    );

    if (unitOnTile && unitOnTile.id !== selectedUnitId) {
      setSelectedUnitId(unitOnTile.id);
      setSelectedCityId(null);
      setBuyTileModeCityId(null);
      soundFx.playClick();
      return;
    }

    if (cityOnTile) {
      setSelectedCityId(cityOnTile.id);
      setSelectedUnitId(null);
      setBuyTileModeCityId(null);
      soundFx.playClick();
      return;
    }

    if (!unitOnTile && !cityOnTile) {
      setSelectedUnitId(null);
    }
  };

  const handleEndTurn = () => {
    if (!gameState) return;
    const prevCiv = gameState.civs[gameState.playerCivId];
    const prevCore = prevCiv.unlockedCore.length;
    const prevInvs = new Set(prevCiv.unlockedInventions);
    const prevAge = prevCiv.ageIndex;
    const prevWonders = new Set(prevCiv.discoveredWonders);

    const next = endTurn(structuredClone(gameState));
    setGameState(next);
    setSavedSnapshot(next);
    setSavedSlots(listSavedGames());
    setBuyTileModeCityId(null);

    const pCiv = next.civs[next.playerCivId];
    const newInvs = pCiv.unlockedInventions.filter((id) => !prevInvs.has(id));
    const newWonders = pCiv.discoveredWonders.filter((w) => !prevWonders.has(w));
    const newChronicles: DramaticChronicleEvent[] = [];

    if (pCiv.ageIndex > prevAge) {
      const ageDef = AGES[pCiv.ageIndex];
      newChronicles.push({
        id: `age_${ageDef.id}_${next.turn}`,
        kind: 'age_transition',
        eyebrow: `Era Transition · Turn ${next.turn}`,
        title: `Entered the ${ageDef.name}`,
        description: ageDef.subtitle,
        accentColor: ageDef.accentColor,
        ageIndex: pCiv.ageIndex,
      });
    }

    for (const invId of newInvs) {
      const inv = INVENTIONS.find((i) => i.id === invId);
      if (!inv) continue;
      const isEarly = pCiv.earlyInventions.includes(invId);
      newChronicles.push({
        id: `inv_${invId}_${next.turn}`,
        kind: 'invention_breakthrough',
        eyebrow: isEarly ? 'Early Scientific Breakthrough!' : 'Invention Unlocked',
        title: inv.name,
        description: inv.summary,
        accentColor: isEarly ? '#fbbf24' : '#38bdf8',
        inventionId: invId,
      });
    }

    for (const wonder of newWonders) {
      newChronicles.push({
        id: `wonder_${wonder}_${next.turn}`,
        kind: 'natural_wonder',
        eyebrow: 'Expedition Landmark',
        title: `Discovered ${wonder}`,
        description:
          'Cartographers record this extraordinary natural marvel (+12 Research and permanent +16% Invention discovery rate).',
        accentColor: '#34d399',
      });
    }

    if (newChronicles.length > 0) {
      setChronicleQueue((prev) => [...prev, ...newChronicles]);
    }

    const latestDisaster = next.recentDisasters?.[0];
    if (latestDisaster) {
      setCameraTarget({ q: latestDisaster.q, r: latestDisaster.r, trigger: Date.now() });
      soundFx.playNaturalDisaster(latestDisaster.kind);
    } else if (pCiv.ageIndex > prevAge) {
      soundFx.playAgeAdvance();
    } else if (newInvs.length > 0 || newWonders.length > 0) {
      soundFx.playDiscovery();
    } else if (pCiv.unlockedCore.length > prevCore) {
      soundFx.playCoreSpark();
    } else if (next.recentCombats.length > 0) {
      soundFx.playCombat(next.recentCombats[0].kind ?? 'melee');
    } else {
      soundFx.playTurnEnd();
    }
  };

  const cycleNextReadyUnit = () => {
    if (!gameState) return;
    const ready = Object.values(gameState.units).filter(
      (u) => u.civId === gameState.playerCivId && u.movesLeft > 0 && !u.task && !u.fortified
    );
    if (ready.length === 0) return;
    const curIdx = ready.findIndex((u) => u.id === selectedUnitId);
    const nextUnit = ready[(curIdx + 1) % ready.length];
    setSelectedUnitId(nextUnit.id);
    setSelectedCityId(null);
    setCameraTarget({ q: nextUnit.q, r: nextUnit.r, trigger: Date.now() });
    soundFx.playClick();
  };

  if (!gameState) {
    const latestPreview = savedSnapshot ?? savedSlots[0]?.state ?? null;
    return (
      <>
        <TitleScreen
          hasSavedGame={Boolean(latestPreview) || savedSlots.length > 0}
          savedCount={savedSlots.length}
          savedTurn={latestPreview?.turn}
          savedCivName={
            latestPreview ? latestPreview.civs[latestPreview.playerCivId]?.name : undefined
          }
          onStartNew={handleStartNew}
          onResumeSaved={handleResumeSaved}
          onOpenLoadModal={() => {
            setSavedSlots(listSavedGames());
            setSaveLoadModalMode('load');
          }}
        />
        {saveLoadModalMode && (
          <SaveLoadModal
            mode="load"
            state={null}
            savedSlots={savedSlots}
            onSave={handleSaveNamedGame}
            onLoad={handleLoadSlot}
            onDelete={handleDeleteSlot}
            onClose={() => setSaveLoadModalMode(null)}
          />
        )}
      </>
    );
  }

  const playerCiv = gameState.civs[gameState.playerCivId];
  const econ = getCivEconomySummary(gameState, playerCiv.id);
  const modifiers = computeDiscoveryModifiers(gameState, playerCiv.id);
  const currentAge = AGES[playerCiv.ageIndex];
  const inspectedTile =
    hoveredTile ?? (selectedTileKey ? gameState.tiles[selectedTileKey] : null);
  const readyUnitsCount = Object.values(gameState.units).filter(
    (u) => u.civId === playerCiv.id && u.movesLeft > 0 && !u.task && !u.fortified
  ).length;

  const selectedUnitTile = selectedUnit
    ? gameState.tiles[tileKey(selectedUnit.q, selectedUnit.r)]
    : null;
  const selectedUnitDef = selectedUnit ? UNIT_DEFS[selectedUnit.defId] : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070d19] text-slate-100">
      {/* TOP HUD BAR (Clean 3-Zone Contract) */}
      <header className="absolute top-0 inset-x-0 z-30 h-14 px-4 bg-[#0d1a24]/95 backdrop-blur-md border-b border-[#b89758]/40 flex items-center justify-between gap-6">
        {/* Zone 1: Brand / Empire & Era */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-base font-bold text-[#f8f3e6] font-display whitespace-nowrap">
            {playerCiv.name}
          </span>
          <span className="text-xs text-[#cbb88b] hidden sm:inline whitespace-nowrap">
            · {currentAge.name} · Turn{' '}
            <span className="font-mono-tabular text-[#f8f3e6]">{gameState.turn}</span>
          </span>
        </div>

        {/* Zone 2: Economy, Research & Focus */}
        <div className="flex items-center gap-5 text-xs overflow-x-auto">
          <div
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title={`Gross +${econ.grossGold + econ.tradeGold}g | Building & Unit Upkeep -${econ.totalUpkeep}g`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono-tabular font-semibold text-white">{playerCiv.gold}g</span>
            <span
              className={`font-mono-tabular ${
                econ.netGold >= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              ({econ.netGold >= 0 ? `+${econ.netGold}` : econ.netGold})
            </span>
          </div>

          <div
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Research/turn & Discovery Multiplier"
          >
            <Atom className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono-tabular text-sky-200 font-semibold">
              +{econ.researchPerTurn} Sci
            </span>
            <span className="text-slate-400 font-mono-tabular">
              · {modifiers.totalMultiplier.toFixed(2)}x
            </span>
          </div>

          <button
            onClick={() => setShowTechModal(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Focus: {DOMAIN_META[playerCiv.domainFocus].label}</span>
          </button>
        </div>

        {/* Zone 3: Primary Navigation Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowTechModal(true)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Atom className="w-3.5 h-3.5" />
            <span>Science</span>
          </button>
          <button
            onClick={() => setShowDiplomacyModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Handshake className="w-3.5 h-3.5" />
            <span>Diplomacy</span>
          </button>
          <button
            onClick={() => {
              setSavedSlots(listSavedGames());
              setSaveLoadModalMode('save');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#d4af5a]/20 hover:bg-[#d4af5a]/30 border border-[#e6c983]/45 text-[#f8f3e6] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Save Campaign"
          >
            <Save className="w-3.5 h-3.5 text-[#e6c983]" />
            <span>Save</span>
          </button>
          <button
            onClick={() => {
              setSavedSlots(listSavedGames());
              setSaveLoadModalMode('load');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Load Saved Campaign"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-300" />
            <span>Load</span>
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
            title="Field Manual"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleQuitToMenu}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 whitespace-nowrap cursor-pointer"
          >
            Menu
          </button>
        </div>
      </header>

      {/* MAIN 3D ISOMETRIC / TOP-DOWN HEX MAP CANVAS */}
      <main className="w-full h-full pt-14">
        <HexMapCanvas
          state={gameState}
          viewMode={viewMode}
          onToggleViewMode={() =>
            setViewMode((m) => (m === 'isometric' ? 'topdown' : 'isometric'))
          }
          selectedUnitId={selectedUnitId}
          selectedCityId={selectedCityId}
          selectedTileKey={selectedTileKey}
          reachableHexes={reachableHexes}
          attackableKeys={attackableKeys}
          buyTileModeCityId={buyTileModeCityId}
          purchasableKeys={purchasableKeys}
          cameraTarget={cameraTarget}
          onHexClick={handleHexClick}
          onHexHover={setHoveredTile}
        />
      </main>

      {/* RECENT NOTIFICATIONS / CHRONICLE LOG (Top Right) */}
      <div className="absolute top-16 right-4 z-20 w-72 space-y-2 pointer-events-none">
        {gameState.notices.slice(0, 3).map((n) => (
          <div
            key={n.id}
            onClick={() => {
              if (n.q !== undefined && n.r !== undefined) {
                setCameraTarget({ q: n.q, r: n.r, trigger: Date.now() });
              }
            }}
            className={`pointer-events-auto p-3 rounded-lg bg-[#0c1822]/92 backdrop-blur-md border shadow-lg cursor-pointer transition-opacity ${
              n.kind === 'invention' || n.kind === 'age'
                ? 'border-[#e6c983]/60'
                : n.kind === 'core'
                  ? 'border-sky-400/50'
                  : n.kind === 'combat'
                    ? 'border-rose-400/45'
                    : 'border-[#b89758]/35'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="capitalize">{n.kind}</span>
              <span className="font-mono-tabular">Turn {n.turn}</span>
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">{n.title}</div>
            <div className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{n.detail}</div>
          </div>
        ))}
      </div>

      {/* CITY DRAWER */}
      {selectedCity && (
        <CityDrawer
          state={gameState}
          city={selectedCity}
          buyTileMode={buyTileModeCityId === selectedCity.id}
          onToggleBuyTileMode={() =>
            setBuyTileModeCityId((cur) => (cur === selectedCity.id ? null : selectedCity.id))
          }
          onSetProduction={(cityId, type, id) => {
            const next = structuredClone(gameState);
            const c = next.cities[cityId];
            if (!c) return;
            const cost = type === 'unit' ? UNIT_DEFS[id].cost : BUILDING_DEFS[id].cost;
            c.producing = { type, id, progress: 0, cost };
            setGameState(next);
            soundFx.playClick();
          }}
          onClose={() => {
            setSelectedCityId(null);
            setBuyTileModeCityId(null);
          }}
        />
      )}

      {/* BOTTOM HUD: TILE INSPECTOR + UNIT ACTION BAR + END TURN */}
      <div className="absolute bottom-4 inset-x-4 z-30 flex items-end justify-between gap-4 pointer-events-none">
        {/* Bottom-Left: Tile Inspector */}
        <div className="pointer-events-auto w-72 p-3.5 rounded-xl bg-[#0c1822]/92 backdrop-blur-md border border-[#b89758]/40 shadow-xl">
          {inspectedTile && inspectedTile.exploredBy[playerCiv.id] ? (
            (() => {
              const shore = resolveTileShoreline(inspectedTile, gameState.tiles, gameState.height);
              const shoreLabels: Record<string, string> = {
                sandy_beach: 'Sandy Beach Shore',
                rocky_shore: 'Rocky Shore (+1 Prod)',
                high_cliffs: 'High Sea Cliffs (+1 Prod)',
                coastal_swamp: 'Coastal Swamp & Mangrove (+1 Food, +1 Prod)',
                coral_reef: 'Coral Reef Lagoon (+1 Food, +1 Sci)',
                icy_shore: 'Arctic Icy Shore',
              };
              const clusterLabels: Record<string, string> = {
                desert_oasis: 'Oasis Sanctuary Cluster',
                mountain_massif: 'Sovereign Mountain Massif',
                coral_lagoon: 'Coral Reef Lagoon & Atoll Cluster',
                coastal_swamp_delta: 'River Delta & Swamp Cluster',
                cliff_headland: 'Sea Cliff Headland Cluster',
                icy_fjord: 'Arctic Pack-Ice Fjord Cluster',
              };
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white capitalize">
                      {inspectedTile.biome} · {inspectedTile.temperature}
                    </span>
                    {inspectedTile.hasRiver && (
                      <span className="text-[11px] text-sky-300">Riverbank (+1 Food, +1 Gold)</span>
                    )}
                  </div>
                  {shore !== 'none' && shoreLabels[shore] && (
                    <div className="text-[11px] text-cyan-300">
                      Shoreline: {shoreLabels[shore]}
                    </div>
                  )}
                  {inspectedTile.clusterType && clusterLabels[inspectedTile.clusterType] && (
                    <div className="text-[11px] text-teal-300 font-medium">
                      Formation: {clusterLabels[inspectedTile.clusterType]}
                    </div>
                  )}
                  {inspectedTile.feature !== 'none' && (
                    <div className="text-[11px] text-amber-300">
                      Feature: {inspectedTile.wonderName || inspectedTile.feature.replace('_', ' ')}{' '}
                      {inspectedTile.featureSurveyed ? '(Surveyed)' : '(Unsurveyed — Send Explorer)'}
                    </div>
                  )}
                  {inspectedTile.improvement !== 'none' && (
                    <div
                      className={`text-[11px] ${
                        inspectedTile.improvementDamaged ? 'text-rose-300 font-semibold' : 'text-emerald-300'
                      }`}
                    >
                      Improvement: {inspectedTile.improvement.replace('_', ' ')}{' '}
                      {inspectedTile.improvementDamaged ? '— DAMAGED (Needs Worker Repair)' : ''}
                    </div>
                  )}
                  {inspectedTile.hasRoad && (
                    <div className="text-[11px] text-slate-300">Paved Road (0.5 Move Cost)</div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-xs text-slate-400">
              Unexplored Frontier — Move Scouts or Ships to reveal veiled terrain.
            </div>
          )}
        </div>

        {/* Bottom-Center: Selected Unit Controls */}
        {selectedUnit && selectedUnitDef && (
          <div className="pointer-events-auto max-w-2xl p-3.5 rounded-xl bg-[#0c1822]/95 backdrop-blur-md border border-[#e6c983]/45 shadow-2xl flex flex-wrap items-center gap-4">
            <div className="min-w-[155px]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{selectedUnitDef.name}</span>
                <span className="text-[11px] font-mono-tabular text-amber-300">
                  Lv.{selectedUnit.level}
                </span>
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-300 mt-0.5">
                HP {selectedUnit.hp}/{selectedUnit.maxHp} · MOV {selectedUnit.movesLeft.toFixed(1)} ·
                ATK {selectedUnitDef.attack} / DEF {selectedUnitDef.defense}
              </div>
              {selectedUnit.promotions.length > 0 && (
                <div className="text-[10px] text-sky-300 mt-0.5">
                  Skills:{' '}
                  {selectedUnit.promotions
                    .map((pid) => SKILL_PROMOTIONS.find((p) => p.id === pid)?.name)
                    .join(', ')}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Promotion Button */}
              {selectedUnit.pendingPromotion && (
                <button
                  onClick={() => setPromotingUnitId(selectedUnit.id)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Promote Skill</span>
                </button>
              )}

              {/* Settler Found City */}
              {selectedUnitDef.role === 'settler' && selectedUnit.movesLeft > 0 && (
                <button
                  onClick={() => {
                    const next = foundCityWithSettler(structuredClone(gameState), selectedUnit.id);
                    setGameState(next);
                    setSelectedUnitId(null);
                    soundFx.playDiscovery();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Found City</span>
                </button>
              )}

              {/* Scout / Explorer Survey Special Feature */}
              {(selectedUnitDef.role === 'scout' || selectedUnitDef.role === 'explorer') &&
                selectedUnitTile &&
                selectedUnitTile.feature !== 'none' &&
                !selectedUnitTile.featureSurveyed &&
                selectedUnit.movesLeft > 0 && (
                  <button
                    onClick={() => {
                      const next = surveyTileFeature(structuredClone(gameState), selectedUnit.id);
                      setGameState(next);
                      soundFx.playDiscovery();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Survey {selectedUnitTile.feature.replace('_', ' ')}</span>
                  </button>
                )}

              {/* Worker Actions */}
              {selectedUnitDef.role === 'worker' && selectedUnit.movesLeft > 0 && selectedUnitTile && (
                <>
                  {selectedUnitTile.improvementDamaged && (
                    <button
                      onClick={() => {
                        setGameState(startWorkerTask(structuredClone(gameState), selectedUnit.id, 'repair'));
                        soundFx.playClick();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Repair Damage</span>
                    </button>
                  )}

                  {(
                    [
                      { id: 'farm', label: 'Farm', req: 'agriculture' },
                      { id: 'mine', label: 'Mine', req: 'mining_shafts' },
                      { id: 'road', label: 'Road', req: 'wheeled_roads' },
                      { id: 'lumber_mill', label: 'Lumber Mill', req: 'wheeled_roads' },
                      { id: 'quarry', label: 'Quarry', req: 'stone_masonry' },
                      { id: 'trade_post', label: 'Trade Post', req: 'coinage_markets' },
                      { id: 'fort', label: 'Fort', req: 'fortified_keeps' },
                    ] as Array<{ id: ImprovementType; label: string; req: string }>
                  )
                    .filter((item) => playerCiv.unlockedInventions.includes(item.req))
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setGameState(
                            startWorkerTask(
                              structuredClone(gameState),
                              selectedUnit.id,
                              'build',
                              item.id
                            )
                          );
                          soundFx.playClick();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs text-slate-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Hammer className="w-3 h-3 text-amber-400" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                </>
              )}

              {/* Fortify / Skip */}
              {selectedUnitDef.attack > 0 && (
                <button
                  onClick={() => {
                    const next = structuredClone(gameState);
                    const u = next.units[selectedUnit.id];
                    if (u) {
                      u.fortified = true;
                      u.movesLeft = 0;
                    }
                    setGameState(next);
                    soundFx.playClick();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  Fortify
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom-Right: Cycle Unit & End Turn */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {readyUnitsCount > 0 && (
            <button
              onClick={cycleNextReadyUnit}
              className="px-3.5 py-3 rounded-xl bg-[#0c1822]/95 hover:bg-[#142636] border border-[#b89758]/50 text-[#f8f3e6] text-xs font-semibold flex items-center gap-2 shadow-xl whitespace-nowrap cursor-pointer"
            >
              <Flag className="w-4 h-4 text-[#e6c983]" />
              <span>Next Unit ({readyUnitsCount})</span>
            </button>
          )}

          <button
            onClick={handleEndTurn}
            className="px-5 py-3 rounded-xl bg-[#d4af5a] hover:bg-[#e6c983] text-slate-950 font-bold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/20 whitespace-nowrap cursor-pointer"
          >
            <span>End Turn</span>
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* MODALS */}
      {showTechModal && (
        <TechTreeModal
          state={gameState}
          onSelectFocus={(domain: CoreDomain) => {
            const next = structuredClone(gameState);
            next.civs[next.playerCivId].domainFocus = domain;
            setGameState(next);
            soundFx.playClick();
          }}
          onClose={() => setShowTechModal(false)}
        />
      )}

      {showDiplomacyModal && (
        <DiplomacyModal
          state={gameState}
          onDeclareWar={(cid) => {
            setGameState(declareWar(structuredClone(gameState), playerCiv.id, cid));
            soundFx.playCombat();
          }}
          onMakePeace={(cid) => {
            setGameState(makePeace(structuredClone(gameState), playerCiv.id, cid, 40));
            soundFx.playClick();
          }}
          onEstablishTrade={(cid) => {
            setGameState(establishTradeRoute(structuredClone(gameState), playerCiv.id, cid));
            soundFx.playDiscovery();
          }}
          onToggleOpenBorders={(cid) => {
            setGameState(toggleOpenBorders(structuredClone(gameState), playerCiv.id, cid));
            soundFx.playClick();
          }}
          onTradeBarbarians={(campId) => {
            setGameState(tradeWithPeacefulBarbarians(structuredClone(gameState), campId));
            soundFx.playDiscovery();
          }}
          onFocusHex={(q, r) => setCameraTarget({ q, r, trigger: Date.now() })}
          onClose={() => setShowDiplomacyModal(false)}
        />
      )}

      {gameState.activeEvent && (
        <ExplorationEventModal
          event={gameState.activeEvent}
          onChoose={(idx) => {
            setGameState(resolveExplorationEventChoice(structuredClone(gameState), idx));
            soundFx.playDiscovery();
          }}
        />
      )}

      {!gameState.activeEvent && gameState.activeSurveyPopup && (
        <SurveyDiscoveryModal
          popup={gameState.activeSurveyPopup}
          onClose={() => {
            const next = structuredClone(gameState);
            next.activeSurveyPopup = null;
            setGameState(next);
            soundFx.playClick();
          }}
        />
      )}

      {!gameState.activeEvent && !gameState.activeSurveyPopup && chronicleQueue.length > 0 && (
        <DramaticChronicleModal
          chronicle={chronicleQueue[0]}
          onDismiss={() => {
            setChronicleQueue((prev) => prev.slice(1));
            soundFx.playClick();
          }}
        />
      )}

      {promotingUnitId && gameState.units[promotingUnitId] && (
        <PromotionModal
          unit={gameState.units[promotingUnitId]}
          onSelect={(pid) => {
            setGameState(applyPromotion(structuredClone(gameState), promotingUnitId, pid));
            setPromotingUnitId(null);
            soundFx.playDiscovery();
          }}
          onClose={() => setPromotingUnitId(null)}
        />
      )}

      {gameState.winnerCivId && (
        <VictoryModal
          state={gameState}
          onRestart={() => {
            clearSavedGame();
            setSavedSnapshot(null);
            setSavedSlots(listSavedGames());
            setGameState(null);
          }}
        />
      )}

      {saveLoadModalMode && (
        <SaveLoadModal
          mode={saveLoadModalMode}
          state={gameState}
          savedSlots={savedSlots}
          onSave={handleSaveNamedGame}
          onLoad={handleLoadSlot}
          onDelete={handleDeleteSlot}
          onClose={() => setSaveLoadModalMode(null)}
        />
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#0f172a] border border-white/15 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white font-display">Field Manual</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li>
                <strong className="text-white">Core Knowledge & Inventions:</strong> Research is
                split between physical Core Knowledge (fire, coal, iron, optics, electricity,
                cosmos) and probabilistic Inventions. Meeting Core prerequisites enables chance-based
                breakthroughs each turn—even ahead of your current Age!
              </li>
              <li>
                <strong className="text-white">Discovery Boosters:</strong> Expand cities, grow
                population, uncover % of the map, discover Natural Wonders & mountains, cross deep
                oceans, chart Arctic/Desert/Tropical climate zones, build Schools & Universities,
                and open Trade Routes.
              </li>
              <li>
                <strong className="text-white">Workers & Infrastructure:</strong> Build farms,
                mines, roads, quarries, and forts—and repair pillaged tiles damaged during combat.
              </li>
              <li>
                <strong className="text-white">Barbarians & Victory:</strong> Peaceful tribes can
                trade local Core Knowledge lore in Diplomacy; aggressive raiders attack and pillage.
                Win by conquering every rival civilization.
              </li>
              <li>
                <strong className="text-white">Controls:</strong> Drag to pan, scroll wheel or +/-
                to zoom, WASD/Arrow keys to pan camera.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
