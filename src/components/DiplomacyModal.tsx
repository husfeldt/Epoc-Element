import React from 'react';
import { X, Swords, Handshake, ArrowLeftRight, Compass } from 'lucide-react';
import { AGES } from '../data/registries';
import { tileKey } from '../engine/hexMath';
import { GameState } from '../types/game';

interface DiplomacyModalProps {
  state: GameState;
  onDeclareWar: (civId: string) => void;
  onMakePeace: (civId: string) => void;
  onEstablishTrade: (civId: string) => void;
  onToggleOpenBorders: (civId: string) => void;
  onTradeBarbarians: (campId: string) => void;
  onFocusHex: (q: number, r: number) => void;
  onClose: () => void;
}

export const DiplomacyModal: React.FC<DiplomacyModalProps> = ({
  state,
  onDeclareWar,
  onMakePeace,
  onEstablishTrade,
  onToggleOpenBorders,
  onTradeBarbarians,
  onFocusHex,
  onClose,
}) => {
  const player = state.civs[state.playerCivId];
  const otherCivs = Object.values(state.civs).filter((c) => c.id !== player.id);

  const visibleCamps = Object.values(state.barbarianCamps).filter(
    (c) => state.tiles[tileKey(c.q, c.r)]?.exploredBy[player.id]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#0f172a] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#131e36]">
          <div>
            <h2 className="text-xl font-bold text-white font-display">
              Diplomacy & Frontier Relations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Conquest Victory requires capturing all rival capitals · Trade routes boost both Gold
              and Invention odds.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Civilizations */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Rival Civilizations</h3>
            <div className="space-y-3">
              {otherCivs.map((civ) => {
                const rel = player.relations[civ.id];
                const met = rel && rel.status !== 'unmet';
                const cityCount = Object.values(state.cities).filter(
                  (c) => c.civId === civ.id
                ).length;

                return (
                  <div
                    key={civ.id}
                    className="p-4 rounded-xl bg-[#131e36] border border-white/10 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-10 rounded-sm shrink-0"
                        style={{ backgroundColor: met ? civ.color : '#475569' }}
                      />
                      <div>
                        <div className="text-sm font-bold text-white">
                          {civ.isEliminated
                            ? `${civ.name} (Conquered)`
                            : met
                              ? `${civ.name} · ${civ.leaderName}`
                              : 'Uncontacted Civilization'}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {civ.isEliminated
                            ? 'Defeated'
                            : met
                              ? `${AGES[civ.ageIndex].name} · ${cityCount} Cities · Standing: ${rel.status.replace('_', ' ')} (${rel.opinion})`
                              : 'Explore the frontier to establish diplomatic contact'}
                        </div>
                      </div>
                    </div>

                    {met && !civ.isEliminated && (
                      <div className="flex flex-wrap items-center gap-2">
                        {rel.status === 'war' ? (
                          <button
                            onClick={() => onMakePeace(civ.id)}
                            disabled={player.gold < 40}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Handshake className="w-3.5 h-3.5" />
                            <span>Negotiate Peace (40g)</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onEstablishTrade(civ.id)}
                              disabled={rel.tradeRouteActive || player.gold < 30}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600/80 hover:bg-amber-500 disabled:opacity-40 text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>
                                {rel.tradeRouteActive ? 'Trade Active (+6g/t)' : 'Trade Route (30g)'}
                              </span>
                            </button>

                            <button
                              onClick={() => onToggleOpenBorders(civ.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 whitespace-nowrap cursor-pointer"
                            >
                              {rel.status === 'open_borders' ? 'Close Borders' : 'Open Borders'}
                            </button>

                            <button
                              onClick={() => onDeclareWar(civ.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Swords className="w-3.5 h-3.5" />
                              <span>Declare War</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discovered Barbarians (Peaceful & Aggressive) */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Discovered Barbarian Tribes ({visibleCamps.length})
            </h3>
            {visibleCamps.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#111a2e] border border-white/10 text-xs text-slate-400">
                No barbarian camps discovered yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleCamps.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-4 rounded-xl bg-[#131e36] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{camp.name}</div>
                      <div
                        className={`text-xs mt-0.5 ${
                          camp.disposition === 'peaceful' ? 'text-teal-300' : 'text-rose-300'
                        }`}
                      >
                        {camp.disposition === 'peaceful'
                          ? `Peaceful Tribe · Attitude ${camp.attitude}`
                          : 'Aggressive Raiders · Attacks & Pillages'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onFocusHex(camp.q, camp.r);
                          onClose();
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Locate on map"
                      >
                        <Compass className="w-4 h-4" />
                      </button>

                      {camp.disposition === 'peaceful' && (
                        <button
                          onClick={() => onTradeBarbarians(camp.id)}
                          disabled={camp.tradedThisTurn || player.gold < 20}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white whitespace-nowrap cursor-pointer"
                        >
                          {camp.tradedThisTurn ? 'Traded' : 'Trade Lore (20g)'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
