import React, { useState } from 'react';
import { Play, RotateCcw, Compass, Sparkles, Shield, FolderOpen } from 'lucide-react';
import {
  Difficulty,
  GameConfig,
  MapSize,
  MapType,
  TurnPacing,
} from '../types/game';

interface TitleScreenProps {
  hasSavedGame: boolean;
  savedCount?: number;
  savedTurn?: number;
  savedCivName?: string;
  onStartNew: (config: GameConfig) => void;
  onResumeSaved: () => void;
  onOpenLoadModal?: () => void;
}

const MAP_TYPES: Array<{ id: MapType; label: string; desc: string }> = [
  { id: 'continents', label: 'Continents', desc: 'Balanced oceans separating rival powers' },
  { id: 'archipelago', label: 'Archipelago', desc: 'Scattered island chains rewarding naval exploration' },
  { id: 'pangaea', label: 'Pangaea', desc: 'One vast supercontinent for early land clashes' },
  { id: 'inland_sea', label: 'Inland Sea', desc: 'Fertile ring around a central strategic sea' },
  { id: 'wild_frontier', label: 'Wild Frontier', desc: 'Dense wilds, wonders, and barbarian tribes' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSavedGame,
  savedCount = 0,
  savedTurn,
  savedCivName,
  onStartNew,
  onResumeSaved,
  onOpenLoadModal,
}) => {
  const [civName, setCivName] = useState('Nova Terran Republic');
  const [playerName, setPlayerName] = useState('Commander');
  const [mapType, setMapType] = useState<MapType>('continents');
  const [mapSize, setMapSize] = useState<MapSize>('medium');
  const [aiCount, setAiCount] = useState<number>(3);
  const [pacing, setPacing] = useState<TurnPacing>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('strategist');
  const [imgError, setImgError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartNew({
      civName,
      playerName,
      mapType,
      mapSize,
      aiCount,
      pacing,
      difficulty,
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-[#0c1821] flex items-center justify-center p-6">
      {/* Reference Cartographic Diorama Artwork Backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        {!imgError ? (
          <img
            src="/assets/aistudio/image_84c6658d.png"
            alt="Cartographic isometric hex world map"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1b2e3c] via-[#0d1b24] to-[#262015]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09131a] via-[#09131a]/65 to-[#09131a]/50" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Hero Column (Antique Brass & Deep Navy Cartographic Style) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 md:p-8 rounded-2xl bg-[#0c1822]/90 backdrop-blur-md border border-[#b89758]/40 shadow-2xl">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium tracking-wider uppercase text-[#e6c983]">
                4X Hex Strategy · Conquest & Discovery
              </p>
              <h1 className="text-4xl font-bold text-[#f8f3e6] font-display mt-2 leading-tight">
                Epoch & Element
              </h1>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Chart an unexplored parchment world of alpine ridges, winding rivers, and golden
              dunes from the Stone Age to the Atomic Cosmos. Uncover fundamental Core Knowledge to
              spark unexpected early-era inventions, command armies, and conquer every rival capital.
            </p>

            <div className="space-y-3 pt-3 border-t border-[#b89758]/25">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#e6c983] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-[#f8f3e6]">Dual-Tier Emergent Science:</span>{' '}
                  Physical Core Knowledge dependencies unlock probabilistic inventions across 9 Ages.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Compass className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-[#f8f3e6]">Explore & Survey:</span> Scouts and
                  Naturalist Explorers catalog rare flora, minerals, climate zones, and wonders.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-[#f8f3e6]">Tactical Conquest:</span> Peaceful
                  tribes and aggressive raiders, diplomatic trade routes, and veteran unit skills.
                </div>
              </div>
            </div>
          </div>

          {hasSavedGame && (
            <div className="pt-6 mt-6 border-t border-[#b89758]/25 space-y-2.5">
              <button
                type="button"
                onClick={onResumeSaved}
                className="w-full py-3 px-4 rounded-xl bg-[#b89758]/20 hover:bg-[#b89758]/30 border border-[#e6c983]/50 text-[#f8f3e6] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#e6c983]" />
                <span>
                  Resume {savedCivName || 'Campaign'} (Turn {savedTurn ?? 1})
                </span>
              </button>

              {onOpenLoadModal && (
                <button
                  type="button"
                  onClick={onOpenLoadModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#081118]/90 hover:bg-[#102030] border border-sky-400/40 text-sky-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Load Saved Game ({savedCount})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Match Setup Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 md:p-8 rounded-2xl bg-[#0c1822]/92 backdrop-blur-md border border-[#b89758]/40 shadow-2xl flex flex-col justify-between gap-6"
        >
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-[#f8f3e6] font-display">
              Configure New Campaign
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Civilization Name
                </label>
                <input
                  type="text"
                  value={civName}
                  onChange={(e) => setCivName(e.target.value)}
                  maxLength={32}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#081118] border border-[#b89758]/30 text-sm text-white focus:outline-none focus:border-[#e6c983]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Leader Title
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={24}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#081118] border border-[#b89758]/30 text-sm text-white focus:outline-none focus:border-[#e6c983]"
                />
              </div>
            </div>

            {/* Map Type */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">World Map Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MAP_TYPES.map((mt) => (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => setMapType(mt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      mapType === mt.id
                        ? 'bg-[#b89758]/20 border-[#e6c983] text-white'
                        : 'bg-[#081118]/80 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-semibold">{mt.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{mt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Opponents, Size, Pacing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  AI Opponents ({aiCount})
                </label>
                <div className="flex items-center gap-1 p-1 bg-[#081118] rounded-lg border border-white/10">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAiCount(n)}
                      className={`flex-1 py-1.5 text-xs font-mono-tabular font-semibold rounded transition-colors cursor-pointer ${
                        aiCount === n
                          ? 'bg-[#d4af5a] text-slate-950'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Map Size</label>
                <div className="flex items-center gap-1 p-1 bg-[#081118] rounded-lg border border-white/10">
                  {(['small', 'medium', 'large'] as MapSize[]).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setMapSize(sz)}
                      className={`flex-1 py-1.5 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                        mapSize === sz
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Turn Pacing
                </label>
                <div className="flex items-center gap-1 p-1 bg-[#081118] rounded-lg border border-white/10">
                  {(['quick', 'standard', 'epic'] as TurnPacing[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPacing(p)}
                      className={`flex-1 py-1.5 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                        pacing === p
                          ? 'bg-emerald-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                AI Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'explorer', label: 'Explorer', sub: 'Relaxed expansion' },
                    { id: 'strategist', label: 'Strategist', sub: 'Balanced 4X rivals' },
                    { id: 'sovereign', label: 'Sovereign', sub: 'Wealthier AI empires' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      difficulty === d.id
                        ? 'bg-[#b89758]/20 border-[#e6c983]/60 text-white'
                        : 'bg-[#081118]/70 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold">{d.label}</div>
                    <div className="text-[11px] text-slate-400">{d.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-[#d4af5a] hover:bg-[#e4c271] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Launch Conquest Campaign</span>
          </button>
        </form>
      </div>
    </div>
  );
};
