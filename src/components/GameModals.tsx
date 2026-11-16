import React, { useState } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  FolderOpen,
  Save,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  AGES,
  CORE_KNOWLEDGE_NODES,
  DOMAIN_META,
  INVENTIONS,
  SKILL_PROMOTIONS,
  UNIT_DEFS,
} from '../data/registries';
import { SavedGameSlot } from '../engine/turnEngine';
import { ExplorationEvent, GameState, SurveyDiscoveryPopup, UnitState } from '../types/game';
import {
  CORE_ARTWORK_MAP,
  CoreKnowledgePuzzlePlate,
  DramaticSceneKind,
  DramaticScenePlate,
  FeatureSpecimenBadge,
  InventionBannerIllustration,
  NaturalDisasterIllustration,
} from './DramaticIllustrations';

export interface DramaticChronicleEvent {
  id: string;
  kind: DramaticSceneKind;
  eyebrow: string;
  title: string;
  description: string;
  accentColor?: string;
  ageIndex?: number;
  inventionId?: string;
}

export const DramaticChronicleModal: React.FC<{
  chronicle: DramaticChronicleEvent;
  onDismiss: () => void;
}> = ({ chronicle, onDismiss }) => {
  const inv = chronicle.inventionId
    ? INVENTIONS.find((i) => i.id === chronicle.inventionId)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-lg bg-[#0c1822] border border-[#e6c983]/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <DramaticScenePlate
          kind={chronicle.kind}
          ageIndex={chronicle.ageIndex}
          accentColor={chronicle.accentColor || '#e6c983'}
        />

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#e6c983]">
            {chronicle.kind === 'city_capture' ? (
              <Swords className="w-4 h-4 text-rose-400" />
            ) : chronicle.kind === 'age_transition' ? (
              <Crown className="w-4 h-4 text-[#e6c983]" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-300" />
            )}
            <span>{chronicle.eyebrow}</span>
          </div>

          <h2 className="text-2xl font-bold text-[#f8f3e6] font-display leading-snug">
            {chronicle.title}
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">{chronicle.description}</p>

          {inv && (
            <div className="p-3 rounded-xl bg-[#09121b] border border-[#b89758]/30 space-y-2.5">
              <InventionBannerIllustration
                invId={inv.id}
                category={inv.category}
                unlocked={true}
              />
              <div className="text-xs text-amber-200">
                {inv.unlocksUnits &&
                  `Unlocks Units: ${inv.unlocksUnits.map((u) => UNIT_DEFS[u]?.name).join(', ')} · `}
                {inv.unlocksImprovements &&
                  `Worker Constructions: ${inv.unlocksImprovements
                    .map((im) => im.replace('_', ' '))
                    .join(', ')} · `}
                {inv.passiveBonusText || 'Advances your empire’s scientific and military reach.'}
              </div>
            </div>
          )}

          <button
            onClick={onDismiss}
            className="w-full py-2.5 px-5 rounded-xl bg-[#d4af5a] hover:bg-[#e6c983] text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Continue Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

export const ExplorationEventModal: React.FC<{
  event: ExplorationEvent;
  onChoose: (index: number) => void;
}> = ({ event, onChoose }) => {
  const isFlora = event.id.includes('flora') || event.title.toLowerCase().includes('botanical');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0c1822] border border-[#e6c983]/55 rounded-2xl shadow-2xl overflow-hidden">
        {event.disasterKind ? (
          <NaturalDisasterIllustration
            kind={event.disasterKind}
            hasDamage={Boolean(event.damageReport)}
          />
        ) : (
          <DramaticScenePlate
            kind={isFlora ? 'exploration_flora' : 'exploration_ruins'}
            accentColor={isFlora ? '#34d399' : '#fbbf24'}
          />
        )}

        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[#e6c983] font-medium uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <Compass className="w-4 h-4" />
              <span>{event.subtitle}</span>
            </span>
            {event.observerSummary && (
              <span className="text-[11px] font-semibold text-sky-300 normal-case tracking-normal">
                {event.observerSummary}
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-[#f8f3e6] font-display mt-1">{event.title}</h3>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">{event.narrative}</p>

          {event.damageReport && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200 leading-snug">
              <strong className="text-rose-300">Impact Assessment: </strong>
              {event.damageReport}
            </div>
          )}

          <div className="space-y-2.5">
            {event.choices.map((c, idx) => (
              <button
                key={idx}
                onClick={() => onChoose(idx)}
                className="w-full text-left p-3.5 rounded-xl bg-[#132436] hover:bg-[#1a3148] border border-[#b89758]/25 hover:border-[#e6c983]/70 transition-colors cursor-pointer"
              >
                <div className="text-sm font-semibold text-[#f8f3e6]">{c.label}</div>
                <div className="text-xs text-sky-300 mt-1">{c.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SurveyDiscoveryModal: React.FC<{
  popup: SurveyDiscoveryPopup;
  onClose: () => void;
}> = ({ popup, onClose }) => {
  const domainMeta = DOMAIN_META[popup.domain];
  const coreNode = CORE_KNOWLEDGE_NODES.find((n) => n.id === popup.coreNodeId);
  const artMeta = CORE_ARTWORK_MAP[popup.coreNodeId];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0c1822] border border-[#e6c983]/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Jigsaw Puzzle Illustration Plate (Clear revealed puzzle brick + blurred locked pieces) */}
        <CoreKnowledgePuzzlePlate
          nodeId={popup.coreNodeId}
          progressBefore={popup.progressBefore}
          progressAfter={popup.progressAfter}
          accentColor={domainMeta.color}
        />

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#e6c983]">
              <Compass className="w-4 h-4 text-sky-300" />
              <span>
                {popup.isFullDiscovery
                  ? 'Full Core Knowledge Breakthrough!'
                  : 'Field Specimen Survey · Core Puzzle Piece'}
              </span>
            </div>
            <span className="text-xs font-mono-tabular text-amber-300 font-semibold">
              +{popup.sparkAdded}% Core · +{popup.xpGained} XP
            </span>
          </div>

          <div>
            <div className="text-xs font-semibold" style={{ color: domainMeta.color }}>
              {domainMeta.label}
            </div>
            <h2 className="text-2xl font-bold text-[#f8f3e6] font-display mt-0.5">
              {popup.coreNodeName}
            </h2>
            {coreNode && (
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{coreNode.summary}</p>
            )}
          </div>

          {/* Encountered Field Specimen Badge */}
          <FeatureSpecimenBadge feature={popup.feature} />

          {/* Progress Bar & Principle */}
          <div className="p-3.5 rounded-xl bg-[#09121c] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Surveyed by <strong className="text-white">{popup.unitName}</strong>
              </span>
              <span
                className={`font-mono-tabular font-bold ${
                  popup.isFullDiscovery ? 'text-emerald-300' : 'text-sky-300'
                }`}
              >
                {popup.isFullDiscovery
                  ? '100% Complete — Unlocked!'
                  : `${popup.progressAfter}% Assembled`}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${popup.progressAfter}%`,
                  backgroundColor: popup.isFullDiscovery ? '#34d399' : domainMeta.color,
                }}
              />
            </div>

            {artMeta && (
              <div className="text-[11px] text-slate-300 pt-1 leading-relaxed">
                <span className="font-semibold text-[#e6c983]">Empirical Insight: </span>
                {artMeta.principle}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-5 rounded-xl bg-[#d4af5a] hover:bg-[#e6c983] text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            {popup.isFullDiscovery ? 'Claim Breakthrough' : 'Continue Expedition'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PromotionModal: React.FC<{
  unit: UnitState;
  onSelect: (promotionId: string) => void;
  onClose: () => void;
}> = ({ unit, onSelect, onClose }) => {
  const def = UNIT_DEFS[unit.defId];
  const available = SKILL_PROMOTIONS.filter(
    (p) => p.roles.includes(def.role) && !unit.promotions.includes(p.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0c1822] border border-[#e6c983]/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#b89758]/20 to-transparent border-b border-[#b89758]/25">
          <div className="flex items-center gap-2 text-xs text-[#e6c983] font-medium">
            <Award className="w-4 h-4" />
            <span>Unit Veteran Level {unit.level}</span>
          </div>
          <h3 className="text-lg font-bold text-[#f8f3e6] font-display mt-1">
            Select Skill Promotion — {def.name}
          </h3>
        </div>

        <div className="p-5 space-y-2.5">
          {available.length === 0 ? (
            <div className="text-xs text-slate-300">All skills mastered for this unit class.</div>
          ) : (
            available.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="w-full text-left p-3 rounded-xl bg-[#132436] hover:bg-[#1a3148] border border-[#b89758]/25 hover:border-[#e6c983]/60 transition-colors cursor-pointer flex items-start gap-2.5"
              >
                <Shield className="w-4 h-4 text-[#e6c983] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-amber-200">{p.name}</div>
                  <div className="text-xs text-slate-300 mt-0.5">{p.description}</div>
                </div>
              </button>
            ))
          )}
          <button
            onClick={onClose}
            className="w-full mt-2 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Decide Later
          </button>
        </div>
      </div>
    </div>
  );
};

export const VictoryModal: React.FC<{
  state: GameState;
  onRestart: () => void;
}> = ({ state, onRestart }) => {
  if (!state.winnerCivId) return null;
  const winner = state.civs[state.winnerCivId];
  const playerWon = winner.id === state.playerCivId;
  const player = state.civs[state.playerCivId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-[#0c1822] border border-[#e6c983]/60 rounded-2xl shadow-2xl overflow-hidden text-center">
        <DramaticScenePlate
          kind={playerWon ? 'victory_triumph' : 'victory_defeat'}
          accentColor={playerWon ? '#fbbf24' : '#ef4444'}
        />

        <div className="p-7 space-y-5">
          <div className="mx-auto -mt-12 relative z-10 w-14 h-14 rounded-full bg-[#0c1822] border-2 border-[#e6c983] flex items-center justify-center shadow-lg">
            {playerWon ? (
              <Trophy className="w-7 h-7 text-amber-300" />
            ) : (
              <Crown className="w-7 h-7 text-rose-400" />
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-[#e6c983] font-semibold">
              {playerWon ? 'Conquest Victory Achieved' : 'Empire Fallen'}
            </div>
            <h2 className="text-2xl font-bold text-[#f8f3e6] font-display mt-1">
              {playerWon
                ? `${player.name} Rules the World`
                : `${winner.name} Claimed Supremacy`}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-[#132436] border border-[#b89758]/25">
              <div className="text-[11px] text-slate-400">Turns</div>
              <div className="text-lg font-mono-tabular font-bold text-white">{state.turn}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#132436] border border-[#b89758]/25">
              <div className="text-[11px] text-slate-400">Age Reached</div>
              <div className="text-xs font-semibold text-[#e6c983] mt-1">
                {AGES[player.ageIndex].name}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#132436] border border-[#b89758]/25">
              <div className="text-[11px] text-slate-400">Discoveries</div>
              <div className="text-lg font-mono-tabular font-bold text-sky-300">
                {player.unlockedCore.length + player.unlockedInventions.length}
              </div>
            </div>
          </div>

          <button
            onClick={onRestart}
            className="w-full py-3 px-6 rounded-xl bg-[#d4af5a] hover:bg-[#e6c983] text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

function formatSaveDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const SaveLoadModal: React.FC<{
  mode: 'save' | 'load';
  state: GameState | null;
  savedSlots: SavedGameSlot[];
  onSave: (title: string, overwriteSlotId?: string) => void;
  onLoad: (slot: SavedGameSlot) => void;
  onDelete: (slotId: string) => void;
  onClose: () => void;
}> = ({ mode: initialMode, state, savedSlots, onSave, onLoad, onDelete, onClose }) => {
  const canSave = Boolean(state);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>(canSave ? initialMode : 'load');

  const playerCiv = state ? state.civs[state.playerCivId] : null;
  const currentAge = playerCiv ? AGES[playerCiv.ageIndex] : null;
  const defaultTitle =
    state && playerCiv && currentAge ? `${playerCiv.name} — ${currentAge.name}` : '';

  const [saveTitle, setSaveTitle] = useState(defaultTitle);
  const [overwriteSlotId, setOverwriteSlotId] = useState<string | undefined>(undefined);
  const [justSavedMsg, setJustSavedMsg] = useState<string | null>(null);

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    const cleanTitle = saveTitle.trim() || defaultTitle || 'Campaign Save';
    onSave(cleanTitle, overwriteSlotId);
    setJustSavedMsg(`Saved "${cleanTitle}" (Turn ${state.turn})`);
    setOverwriteSlotId(undefined);
    setTimeout(() => setJustSavedMsg(null), 3200);
  };

  const citiesCount = state
    ? Object.values(state.cities).filter((c) => c.civId === state.playerCivId).length
    : 0;
  const discoveriesCount = playerCiv
    ? playerCiv.unlockedCore.length + playerCiv.unlockedInventions.length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] bg-[#0c1822] border border-[#b89758]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#112130] border-b border-[#b89758]/30 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#f8f3e6] font-display">
              Campaign Archives · Save & Load
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Save your campaign with a custom title. Date/time, turn number, and empire metadata
              are recorded automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canSave && (
              <div className="flex items-center gap-1 p-1 bg-[#081118] rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('save')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'save'
                      ? 'bg-[#d4af5a] text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Game</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('load')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'load'
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Load Game ({savedSlots.length})</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close save and load dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'save' && state && playerCiv && currentAge && (
            <form
              onSubmit={handleSaveSubmit}
              className="p-5 rounded-xl bg-[#102030] border border-[#e6c983]/35 space-y-4 shadow-inner"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#e6c983] mb-1.5">
                  Save Title
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Enter a save title (e.g. Northern Offensive, Iron Age Boom)..."
                    maxLength={60}
                    required
                    autoFocus
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#081118] border border-[#b89758]/40 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#e6c983]"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#d4af5a] hover:bg-[#e6c983] text-slate-950 font-bold text-sm flex items-center gap-2 shadow-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    <span>{overwriteSlotId ? 'Overwrite Save' : 'Save Campaign'}</span>
                  </button>
                </div>
                {overwriteSlotId && (
                  <div className="mt-1.5 flex items-center justify-between text-xs text-amber-300">
                    <span>Overwriting selected save slot.</span>
                    <button
                      type="button"
                      onClick={() => setOverwriteSlotId(undefined)}
                      className="underline hover:text-white cursor-pointer"
                    >
                      Save as new slot instead
                    </button>
                  </div>
                )}
              </div>

              {/* Implicitly Recorded Metadata Preview */}
              <div className="p-3 rounded-lg bg-[#09131d] border border-white/10">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Implicitly Included Metadata (Auto-attached)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-300" />
                      <span>Turn Number</span>
                    </div>
                    <div className="font-mono-tabular font-bold text-white mt-0.5">
                      Turn {state.turn}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-sky-300" />
                      <span>Date & Time</span>
                    </div>
                    <div className="font-mono-tabular text-slate-200 mt-0.5 truncate">
                      {formatSaveDateTime(new Date().toISOString())}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Empire & Era</div>
                    <div className="font-semibold text-[#e6c983] mt-0.5 truncate">
                      {playerCiv.name} · {currentAge.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Cities & Science</div>
                    <div className="text-slate-200 mt-0.5">
                      {citiesCount} {citiesCount === 1 ? 'City' : 'Cities'} · {discoveriesCount}{' '}
                      Techs
                    </div>
                  </div>
                </div>
              </div>

              {justSavedMsg && (
                <div className="px-3.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{justSavedMsg}</span>
                </div>
              )}
            </form>
          )}

          {/* Saved Games List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {activeTab === 'save'
                  ? 'Existing Save Slots (Click a slot to overwrite or load)'
                  : 'Available Saved Games'}
              </h3>
              <span className="text-xs text-slate-500 font-mono-tabular">
                {savedSlots.length} {savedSlots.length === 1 ? 'save' : 'saves'}
              </span>
            </div>

            {savedSlots.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#09131d] border border-white/10 text-center text-sm text-slate-400">
                No saved campaigns found yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedSlots.map((slot) => {
                  const isSelectedForOverwrite = overwriteSlotId === slot.slotId;
                  return (
                    <div
                      key={slot.slotId}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isSelectedForOverwrite
                          ? 'bg-amber-500/15 border-amber-400/60'
                          : 'bg-[#101e2d] border-white/10 hover:border-[#b89758]/45'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {slot.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#d4af5a]/20 border border-[#e6c983]/45 text-[#e6c983] text-xs font-mono-tabular font-semibold whitespace-nowrap">
                            Turn {slot.turn}
                          </span>
                          {slot.isAutosave && (
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">
                              Autosave
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                          <span className="flex items-center gap-1 text-sky-200 font-mono-tabular">
                            <Calendar className="w-3.5 h-3.5 text-sky-400" />
                            {formatSaveDateTime(slot.savedAt)}
                          </span>
                          <span>
                            <strong className="text-[#f8f3e6]">{slot.civName}</strong> ·{' '}
                            {slot.ageName}
                          </span>
                          <span className="text-slate-400 capitalize">
                            {slot.mapType.replace('_', ' ')} ({slot.mapSize}) · {slot.citiesCount}{' '}
                            {slot.citiesCount === 1 ? 'City' : 'Cities'} · {slot.discoveriesCount}{' '}
                            Discoveries
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {activeTab === 'save' && !slot.isAutosave && (
                          <button
                            type="button"
                            onClick={() => {
                              setSaveTitle(slot.title);
                              setOverwriteSlotId(slot.slotId);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              isSelectedForOverwrite
                                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                                : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                            }`}
                          >
                            {isSelectedForOverwrite ? 'Selected' : 'Select to Overwrite'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onLoad(slot)}
                          className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Load</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(slot.slotId)}
                          className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 transition-colors cursor-pointer"
                          title="Delete saved game"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
