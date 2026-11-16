import React from 'react';
import { Award, Compass, Crown, Shield, Sparkles, Swords, Trophy } from 'lucide-react';
import { AGES, INVENTIONS, SKILL_PROMOTIONS, UNIT_DEFS } from '../data/registries';
import { ExplorationEvent, GameState, UnitState } from '../types/game';
import {
  DramaticSceneKind,
  DramaticScenePlate,
  InventionBannerIllustration,
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
      <div className="w-full max-w-lg bg-[#0c1822] border border-[#e6c983]/50 rounded-2xl shadow-2xl overflow-hidden">
        <DramaticScenePlate
          kind={isFlora ? 'exploration_flora' : 'exploration_ruins'}
          accentColor={isFlora ? '#34d399' : '#fbbf24'}
        />

        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 text-xs text-[#e6c983] font-medium uppercase tracking-wider">
            <Compass className="w-4 h-4" />
            <span>{event.subtitle}</span>
          </div>
          <h3 className="text-xl font-bold text-[#f8f3e6] font-display mt-1">{event.title}</h3>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-5">
          <p className="text-sm text-slate-300 leading-relaxed">{event.narrative}</p>

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
