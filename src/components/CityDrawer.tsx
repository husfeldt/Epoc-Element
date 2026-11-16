import React from 'react';
import { X, MapPin, Hammer, Building2, Shield } from 'lucide-react';
import { BUILDING_DEFS, UNIT_DEFS } from '../data/registries';
import {
  getAvailableBuildingsForCity,
  getAvailableUnitsForCity,
  getCityYields,
} from '../engine/turnEngine';
import { CityState, GameState } from '../types/game';

interface CityDrawerProps {
  state: GameState;
  city: CityState;
  buyTileMode: boolean;
  onToggleBuyTileMode: () => void;
  onSetProduction: (cityId: string, type: 'unit' | 'building', id: string) => void;
  onClose: () => void;
}

export const CityDrawer: React.FC<CityDrawerProps> = ({
  state,
  city,
  buyTileMode,
  onToggleBuyTileMode,
  onSetProduction,
  onClose,
}) => {
  const civ = state.civs[city.civId];
  const yields = getCityYields(state, city);
  const availUnits = getAvailableUnitsForCity(civ);
  const availBuildings = getAvailableBuildingsForCity(civ, city);
  const foodPct = Math.min(100, Math.round((city.foodStored / city.foodNeeded) * 100));

  return (
    <div className="absolute top-16 left-4 bottom-20 w-88 max-w-[92vw] z-30 bg-[#111a2e]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* City Header */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-[#16223b] flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white font-display">
            {city.isCapital ? '★ ' : ''}
            {city.name}
          </h3>
          <div className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
            Pop {city.population} · HP {city.hp}/{city.maxHp} · Upkeep -{yields.upkeep}g
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          aria-label="Close city panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Yields Grid */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-900/70 border border-white/10">
            <div className="text-[11px] text-slate-400">Food</div>
            <div className="text-sm font-mono-tabular font-semibold text-emerald-300">
              {yields.netFood >= 0 ? `+${yields.netFood}` : yields.netFood}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/70 border border-white/10">
            <div className="text-[11px] text-slate-400">Prod</div>
            <div className="text-sm font-mono-tabular font-semibold text-amber-300">
              +{yields.prod}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/70 border border-white/10">
            <div className="text-[11px] text-slate-400">Gold</div>
            <div className="text-sm font-mono-tabular font-semibold text-yellow-300">
              +{yields.gold - yields.upkeep}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/70 border border-white/10">
            <div className="text-[11px] text-slate-400">Sci</div>
            <div className="text-sm font-mono-tabular font-semibold text-sky-300">
              +{yields.research}
            </div>
          </div>
        </div>

        {/* Population Growth & Tile Purchase */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Population Growth</span>
            <span className="font-mono-tabular text-slate-400">
              {city.foodStored}/{city.foodNeeded}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${foodPct}%` }}
            />
          </div>

          <button
            onClick={onToggleBuyTileMode}
            className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
              buyTileMode
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-800/80 border-white/10 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{buyTileMode ? 'Click Highlighted Hex to Buy' : 'Purchase Adjacent Tile'}</span>
          </button>
        </div>

        {/* Current Production */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-white/10">
          <div className="text-xs font-semibold text-slate-400 mb-1.5">Active Production</div>
          {city.producing ? (
            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-white">
                <span>
                  {city.producing.type === 'unit'
                    ? UNIT_DEFS[city.producing.id]?.name
                    : BUILDING_DEFS[city.producing.id]?.name}
                </span>
                <span className="text-xs font-mono-tabular text-amber-300">
                  {city.producing.progress}/{city.producing.cost}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((city.producing.progress / city.producing.cost) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-300">Idle — Select a unit or building below</div>
          )}
        </div>

        {/* Train Units */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
            <Hammer className="w-3.5 h-3.5 text-amber-400" />
            <span>Train Units</span>
          </div>
          <div className="space-y-1.5">
            {availUnits.map((uId) => {
              const u = UNIT_DEFS[uId];
              const turns = Math.max(1, Math.ceil(u.cost / Math.max(1, yields.prod)));
              const active = city.producing?.type === 'unit' && city.producing.id === uId;
              return (
                <button
                  key={uId}
                  onClick={() => onSetProduction(city.id, 'unit', uId)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500/15 border-amber-400/60'
                      : 'bg-slate-900/50 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{u.name}</span>
                    <span className="text-[11px] font-mono-tabular text-amber-300">
                      {turns}t · {u.upkeep}g/t
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {u.attack > 0
                      ? `ATK ${u.attack} · DEF ${u.defense} · RNG ${u.range} · MOV ${u.moves}`
                      : u.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Construct Buildings */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Construct Buildings</span>
          </div>
          {availBuildings.length === 0 ? (
            <div className="text-xs text-slate-500">
              No unlocked buildings remaining here. Discover more Inventions!
            </div>
          ) : (
            <div className="space-y-1.5">
              {availBuildings.map((bId) => {
                const b = BUILDING_DEFS[bId];
                const turns = Math.max(1, Math.ceil(b.cost / Math.max(1, yields.prod)));
                const active = city.producing?.type === 'building' && city.producing.id === bId;
                return (
                  <button
                    key={bId}
                    onClick={() => onSetProduction(city.id, 'building', bId)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-500/15 border-sky-400/60'
                        : 'bg-slate-900/50 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{b.name}</span>
                      <span className="text-[11px] font-mono-tabular text-sky-300">
                        {turns}t · -{b.upkeep}g/t
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{b.description}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Existing Buildings */}
        {city.buildings.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Completed Structures ({city.buildings.length})</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              {city.buildings.map((bid) => BUILDING_DEFS[bid]?.name).join(' · ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
