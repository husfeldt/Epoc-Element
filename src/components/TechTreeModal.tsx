import React, { useMemo, useState } from 'react';
import {
  Anchor,
  Atom,
  Beaker,
  BookOpen,
  Building2,
  Castle,
  Cog,
  Compass,
  Cpu,
  Droplets,
  Eye,
  Flame,
  Hammer,
  HeartPulse,
  Landmark,
  Leaf,
  Magnet,
  Microscope,
  Mountain,
  Orbit,
  Pickaxe,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Target,
  Tractor,
  X,
  Zap,
} from 'lucide-react';
import {
  AGES,
  BUILDING_DEFS,
  CORE_KNOWLEDGE_NODES,
  DOMAIN_META,
  INVENTIONS,
  UNIT_DEFS,
} from '../data/registries';
import {
  computeDiscoveryModifiers,
  getInventionTurnChance,
  getPacingResearchFactor,
} from '../engine/researchEngine';
import { getCivEconomySummary } from '../engine/turnEngine';
import { CoreDomain, GameState } from '../types/game';
import {
  CoreKnowledgeArtworkCard,
  CoreNodeThumb,
  DramaticScenePlate,
  InventionBannerIllustration,
} from './DramaticIllustrations';

interface TechTreeModalProps {
  state: GameState;
  onSelectFocus: (domain: CoreDomain) => void;
  onClose: () => void;
}

const DOMAIN_ORDER: CoreDomain[] = ['matter', 'physics', 'energy', 'life', 'cosmos'];
const TIER_LABELS = [
  'Tier I · Foundational',
  'Tier II · Early Empirical',
  'Tier III · Classical & Alloy',
  'Tier IV · Experimental',
  'Tier V · Industrial Field',
  'Tier VI · Solid-State',
];

function getCoreIcon(nodeId: string, domain: CoreDomain) {
  switch (nodeId) {
    case 'fire_control':
      return Flame;
    case 'stone_knapping':
      return Mountain;
    case 'clay_ceramics':
      return Landmark;
    case 'coal_charcoal':
      return Pickaxe;
    case 'copper_smelting':
    case 'tin_alloying':
    case 'iron_metallurgy':
    case 'steel_carbonizing':
      return Hammer;
    case 'basic_chemistry':
    case 'petrochemicals':
      return Beaker;
    case 'gunpowder_alchemy':
      return Sparkles;
    case 'lever_pulley':
    case 'wheel_axle':
    case 'steam_thermodynamics':
    case 'internal_combustion':
      return Cog;
    case 'optics_lenses':
      return Eye;
    case 'hydraulics_fluid':
      return Droplets;
    case 'magnetism':
      return Magnet;
    case 'static_charge':
    case 'electromagnetism':
      return Zap;
    case 'semiconductors':
      return Cpu;
    case 'botany_domestication':
    case 'fermentation_medicine':
      return Leaf;
    case 'anatomy_germ_theory':
      return Microscope;
    case 'solar_calendar':
      return Sun;
    case 'celestial_navigation':
      return Compass;
    case 'gravitation_orbits':
      return Orbit;
    case 'atomic_structure':
      return Atom;
    default:
      return domain === 'matter'
        ? Beaker
        : domain === 'physics'
          ? Cog
          : domain === 'energy'
            ? Zap
            : domain === 'life'
              ? Leaf
              : Orbit;
  }
}

function getInventionIcon(invId: string, category: string) {
  switch (invId) {
    case 'agriculture':
      return Tractor;
    case 'stone_masonry':
    case 'fortified_keeps':
      return Castle;
    case 'archery_bow':
      return Target;
    case 'mining_shafts':
      return Pickaxe;
    case 'bronze_weapons':
    case 'iron_forging':
    case 'heavy_chivalry':
    case 'blackpowder_muskets':
    case 'rifled_infantry':
    case 'armored_warfare':
      return Swords;
    case 'wheeled_roads':
    case 'watermill_workshop':
    case 'steam_engine':
      return Cog;
    case 'coinage_markets':
      return Landmark;
    case 'writing_schools':
    case 'universities':
      return BookOpen;
    case 'expedition_guilds':
      return Compass;
    case 'compass_caravel':
      return Anchor;
    case 'astronomical_observatory':
      return Orbit;
    case 'electric_grid':
      return Zap;
    case 'sanitation_vaccines':
      return HeartPulse;
    case 'quantum_research_lab':
      return Atom;
    default:
      return category === 'military'
        ? Shield
        : category === 'maritime'
          ? Anchor
          : category === 'science'
            ? Microscope
            : Building2;
  }
}

// Bespoke vector illustration per scientific domain for the inspector card
const DomainIllustration: React.FC<{ domain: CoreDomain; color: string }> = ({
  domain,
  color,
}) => {
  return (
    <div
      className="w-full h-20 rounded-lg border border-white/10 flex items-center justify-between px-3.5 overflow-hidden relative"
      style={{ backgroundColor: DOMAIN_META[domain].bgTint }}
    >
      <div className="z-10">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Domain Schematic
        </div>
        <div className="text-xs font-semibold text-slate-100 mt-0.5">
          {DOMAIN_META[domain].label}
        </div>
      </div>
      <svg viewBox="0 0 220 90" className="w-44 h-full opacity-95 shrink-0">
        {domain === 'matter' && (
          <g stroke={color} strokeWidth="2" fill="none">
            <circle cx="65" cy="45" r="20" strokeOpacity="0.4" />
            <circle cx="110" cy="45" r="14" />
            <circle cx="155" cy="45" r="20" strokeOpacity="0.4" />
            <line x1="85" y1="45" x2="96" y2="45" />
            <line x1="124" y1="45" x2="135" y2="45" />
            <path d="M104 38 L110 24 L116 38 Z" fill={color} fillOpacity="0.3" />
          </g>
        )}
        {domain === 'physics' && (
          <g stroke={color} strokeWidth="2" fill="none">
            <circle cx="80" cy="45" r="22" strokeDasharray="5 4" />
            <circle cx="80" cy="45" r="8" fill={color} fillOpacity="0.25" />
            <circle cx="132" cy="52" r="15" />
            <line x1="102" y1="45" x2="165" y2="28" strokeOpacity="0.7" />
            <polygon points="165,24 173,26 167,33" fill={color} />
          </g>
        )}
        {domain === 'energy' && (
          <g stroke={color} strokeWidth="2" fill="none">
            <path d="M35 45 Q55 15, 75 45 T115 45 T155 45 T190 45" strokeOpacity="0.65" />
            <polygon
              points="114,20 100,48 112,48 106,72 124,42 112,42"
              fill={color}
              fillOpacity="0.35"
            />
          </g>
        )}
        {domain === 'life' && (
          <g stroke={color} strokeWidth="2" fill="none">
            <path d="M75 68 C75 38, 105 22, 140 22 C138 52, 112 68, 75 68 Z" fill={color} fillOpacity="0.2" />
            <path d="M75 68 Q105 45, 136 25" />
            <circle cx="156" cy="48" r="14" strokeOpacity="0.5" />
            <circle cx="156" cy="48" r="5" fill={color} />
          </g>
        )}
        {domain === 'cosmos' && (
          <g stroke={color} strokeWidth="2" fill="none">
            <ellipse cx="110" cy="45" rx="56" ry="18" transform="rotate(-14 110 45)" strokeOpacity="0.55" />
            <ellipse cx="110" cy="45" rx="44" ry="14" transform="rotate(24 110 45)" strokeOpacity="0.55" />
            <circle cx="110" cy="45" r="10" fill={color} fillOpacity="0.4" />
            <circle cx="158" cy="34" r="4" fill="#fde68a" stroke="none" />
            <circle cx="62" cy="54" r="3" fill="#bae6fd" stroke="none" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const TechTreeModal: React.FC<TechTreeModalProps> = ({
  state,
  onSelectFocus,
  onClose,
}) => {
  const [tab, setTab] = useState<'core' | 'inventions' | 'multipliers'>('core');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('iron_metallurgy');

  const civ = state.civs[state.playerCivId];
  const econ = useMemo(() => getCivEconomySummary(state, civ.id), [state, civ.id]);
  const modifiers = useMemo(() => computeDiscoveryModifiers(state, civ.id), [state, civ.id]);
  const pacingFactor = getPacingResearchFactor(state.config.pacing);

  const coreLayout = useMemo(() => {
    const colW = 304;
    const rowH = 204;
    const topOffset = 58;

    const bucketCounts: Record<string, number> = {};
    const maxRowsByDomain: Record<CoreDomain, number> = {
      matter: 1,
      physics: 1,
      energy: 1,
      life: 1,
      cosmos: 1,
    };

    for (const node of CORE_KNOWLEDGE_NODES) {
      const k = `${node.domain}_${node.tier}`;
      bucketCounts[k] = (bucketCounts[k] ?? 0) + 1;
      if (bucketCounts[k] > maxRowsByDomain[node.domain]) {
        maxRowsByDomain[node.domain] = bucketCounts[k];
      }
    }

    const domainBaseRow = {} as Record<CoreDomain, number>;
    const domainRowSpan = {} as Record<CoreDomain, { startY: number; height: number }>;
    let cursorRow = 0;

    for (const dom of DOMAIN_ORDER) {
      const rowsNeeded = maxRowsByDomain[dom];
      domainBaseRow[dom] = cursorRow;
      const spanRows = rowsNeeded * 1.02 + 0.16;
      domainRowSpan[dom] = {
        startY: topOffset + cursorRow * rowH - 12,
        height: spanRows * rowH - 6,
      };
      cursorRow += spanRows;
    }

    const tierBucketCount: Record<string, number> = {};
    const positions: Record<string, { x: number; y: number }> = {};

    for (const node of CORE_KNOWLEDGE_NODES) {
      const bucketKey = `${node.domain}_${node.tier}`;
      const idx = tierBucketCount[bucketKey] ?? 0;
      tierBucketCount[bucketKey] = idx + 1;

      positions[node.id] = {
        x: 32 + node.tier * colW,
        y: topOffset + (domainBaseRow[node.domain] + idx * 1.02) * rowH,
      };
    }
    return {
      positions,
      colW,
      topOffset,
      domainRowSpan,
      width: 6 * colW + 56,
      height: (cursorRow + 0.25) * rowH + topOffset,
    };
  }, []);

  const selectedCore = CORE_KNOWLEDGE_NODES.find((n) => n.id === selectedNodeId);
  const unlocksCore = useMemo(
    () =>
      selectedCore
        ? CORE_KNOWLEDGE_NODES.filter((n) => n.dependencies.includes(selectedCore.id))
        : [],
    [selectedCore]
  );
  const currentAge = AGES[civ.ageIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1680px] h-[92vh] bg-[#0f172a] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#131e36]">
          <div>
            <h2 className="text-xl font-bold text-slate-100 font-display">
              Science & Emergent Discovery Atlas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentAge.name} · {civ.unlockedCore.length}/{CORE_KNOWLEDGE_NODES.length} Core
              Knowledge · {civ.unlockedInventions.length}/{INVENTIONS.length} Inventions ·{' '}
              <span className="text-sky-300 font-mono-tabular">
                {modifiers.totalMultiplier.toFixed(2)}x Discovery Multiplier
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-lg border border-white/10">
              <button
                onClick={() => setTab('core')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === 'core'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Core Knowledge Tree
              </button>
              <button
                onClick={() => setTab('inventions')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === 'inventions'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Inventions & Constructions
              </button>
              <button
                onClick={() => setTab('multipliers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === 'multipliers'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Discovery Boosters
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close science atlas"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weighted Domain Focus Strip */}
        <div className="px-6 py-3 bg-[#0c1324] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Atom className="w-4 h-4 text-sky-400" />
            <span className="font-medium">Research Focus (2.6x Priority Weight):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DOMAIN_ORDER.map((dom) => {
              const meta = DOMAIN_META[dom];
              const active = civ.domainFocus === dom;
              return (
                <button
                  key={dom}
                  onClick={() => onSelectFocus(dom)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-white shadow-sm'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                  style={
                    active
                      ? { backgroundColor: meta.bgTint, borderColor: meta.color, color: '#fff' }
                      : undefined
                  }
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {tab === 'core' && (
            <>
              <div className="flex-1 overflow-auto relative bg-[#090f1d]">
                <div
                  className="relative"
                  style={{ width: coreLayout.width, height: coreLayout.height }}
                >
                  {/* Tier Column Headers */}
                  {TIER_LABELS.map((label, tIdx) => (
                    <div
                      key={label}
                      style={{ left: 32 + tIdx * coreLayout.colW, top: 12, width: 268 }}
                      className="absolute px-3 py-1.5 rounded bg-slate-900/85 border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
                    >
                      <span>{label}</span>
                      <span className="text-slate-400 font-mono-tabular">T{tIdx + 1}</span>
                    </div>
                  ))}

                  {/* Domain Swimlane Bands */}
                  {DOMAIN_ORDER.map((dom) => {
                    const span = coreLayout.domainRowSpan[dom];
                    const meta = DOMAIN_META[dom];
                    return (
                      <div
                        key={`band_${dom}`}
                        style={{
                          top: span.startY,
                          height: span.height,
                          borderColor: `${meta.color}22`,
                          background: `linear-gradient(90deg, ${meta.bgTint} 0%, rgba(9,15,29,0) 45%)`,
                        }}
                        className="absolute inset-x-3 rounded-xl border pointer-events-none"
                      >
                        <div
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest opacity-60"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </div>
                      </div>
                    );
                  })}

                  {/* Physical Dependency Branch Lines */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={coreLayout.width}
                    height={coreLayout.height}
                  >
                    {CORE_KNOWLEDGE_NODES.map((node) =>
                      node.dependencies.map((depId) => {
                        const from = coreLayout.positions[depId];
                        const to = coreLayout.positions[node.id];
                        if (!from || !to) return null;
                        const bothUnlocked =
                          civ.unlockedCore.includes(depId) && civ.unlockedCore.includes(node.id);
                        const depUnlocked = civ.unlockedCore.includes(depId);
                        const highlighted = selectedNodeId === node.id || selectedNodeId === depId;
                        const x1 = from.x + 268;
                        const y1 = from.y + 88;
                        const x2 = to.x;
                        const y2 = to.y + 88;
                        const cx = (x1 + x2) / 2;

                        return (
                          <path
                            key={`${depId}->${node.id}`}
                            d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={
                              highlighted
                                ? '#fde047'
                                : bothUnlocked
                                  ? DOMAIN_META[node.domain].color
                                  : depUnlocked
                                    ? 'rgba(148, 163, 184, 0.55)'
                                    : 'rgba(148, 163, 184, 0.16)'
                            }
                            strokeWidth={highlighted ? 3 : bothUnlocked ? 2.5 : 1.5}
                            strokeDasharray={depUnlocked || highlighted ? undefined : '4 4'}
                          />
                        );
                      })
                    )}
                  </svg>

                  {/* Node Cards with Custom Bespoke Illustrations */}
                  {CORE_KNOWLEDGE_NODES.map((node) => {
                    const pos = coreLayout.positions[node.id];
                    const meta = DOMAIN_META[node.domain];
                    const unlocked = civ.unlockedCore.includes(node.id);
                    const eligible =
                      !unlocked && node.dependencies.every((d) => civ.unlockedCore.includes(d));
                    const progress = Math.min(100, Math.round(civ.coreProgress[node.id] ?? 0));
                    const isSelected = selectedNodeId === node.id;
                    const isRelated =
                      selectedCore?.dependencies.includes(node.id) ||
                      node.dependencies.includes(selectedNodeId);
                    const enabledInvCount = INVENTIONS.filter((inv) =>
                      inv.requiredCore.includes(node.id)
                    ).length;

                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          borderColor: isSelected
                            ? '#fde047'
                            : unlocked
                              ? meta.color
                              : isRelated
                                ? 'rgba(253, 224, 71, 0.45)'
                                : eligible
                                  ? 'rgba(184, 151, 88, 0.45)'
                                  : 'rgba(148, 163, 184, 0.16)',
                          backgroundColor: unlocked ? meta.bgTint : 'rgba(12, 24, 34, 0.96)',
                        }}
                        className={`absolute w-[268px] text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 shadow-lg ${
                          isSelected
                            ? 'ring-2 ring-amber-300/60 scale-[1.02] z-10'
                            : 'hover:border-white/40'
                        }`}
                      >
                        <CoreNodeThumb
                          nodeId={node.id}
                          domain={node.domain}
                          color={meta.color}
                          unlocked={unlocked}
                          variant="banner"
                        />
                        <div className="w-full min-w-0 px-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider truncate"
                              style={{ color: meta.color }}
                            >
                              {node.domain} · Tier {node.tier + 1}
                            </span>
                            <span
                              className={`text-[10px] font-mono-tabular ${
                                unlocked
                                  ? 'text-emerald-300 font-semibold'
                                  : eligible
                                    ? 'text-sky-300 font-semibold'
                                    : 'text-slate-400'
                              }`}
                            >
                              {unlocked ? '✓ Known' : eligible ? `${progress}%` : 'Locked'}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-100 mt-0.5 truncate">
                            {node.name}
                          </div>
                          {eligible ? (
                            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progress}%`, backgroundColor: meta.color }}
                              />
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              Enables {enabledInvCount}{' '}
                              {enabledInvCount === 1 ? 'invention' : 'inventions'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Inspector with Oil-Painted Artwork Plate & Domain Diagram */}
              {selectedCore && (
                <div className="w-[440px] xl:w-[490px] border-l border-[#b89758]/25 bg-[#0e1a28] p-5 flex flex-col gap-4 overflow-y-auto shrink-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <CoreNodeThumb
                          nodeId={selectedCore.id}
                          domain={selectedCore.domain}
                          color={DOMAIN_META[selectedCore.domain].color}
                          unlocked={civ.unlockedCore.includes(selectedCore.id)}
                          variant="lg"
                        />
                        <div>
                          <div
                            className="text-xs font-medium flex items-center gap-1.5"
                            style={{ color: DOMAIN_META[selectedCore.domain].color }}
                          >
                            {React.createElement(getCoreIcon(selectedCore.id, selectedCore.domain), {
                              className: 'w-3.5 h-3.5',
                            })}
                            <span>{DOMAIN_META[selectedCore.domain].label}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white mt-0.5 font-display leading-snug">
                            {selectedCore.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {selectedCore.summary}
                    </p>
                  </div>

                  <CoreKnowledgeArtworkCard
                    nodeId={selectedCore.id}
                    nodeName={selectedCore.name}
                    domainLabel={DOMAIN_META[selectedCore.domain].label}
                    color={DOMAIN_META[selectedCore.domain].color}
                    unlocked={civ.unlockedCore.includes(selectedCore.id)}
                    eligible={
                      !civ.unlockedCore.includes(selectedCore.id) &&
                      selectedCore.dependencies.every((d) => civ.unlockedCore.includes(d))
                    }
                    progress={Math.min(100, Math.round(civ.coreProgress[selectedCore.id] ?? 0))}
                    tier={selectedCore.tier}
                  />

                  <div className="space-y-2">
                    <DomainIllustration
                      domain={selectedCore.domain}
                      color={DOMAIN_META[selectedCore.domain].color}
                    />
                    {civ.domainFocus !== selectedCore.domain && (
                      <button
                        onClick={() => onSelectFocus(selectedCore.domain)}
                        className="w-full py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        style={{
                          borderColor: `${DOMAIN_META[selectedCore.domain].color}66`,
                          backgroundColor: DOMAIN_META[selectedCore.domain].bgTint,
                          color: '#f8fafc',
                        }}
                      >
                        <Sparkles
                          className="w-3.5 h-3.5"
                          style={{ color: DOMAIN_META[selectedCore.domain].color }}
                        />
                        <span>Prioritize {DOMAIN_META[selectedCore.domain].label} (2.6x)</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <div className="text-xs font-semibold text-slate-400 mb-2">
                      Physical Dependencies
                    </div>
                    {selectedCore.dependencies.length === 0 ? (
                      <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-400/25 rounded-lg px-3 py-2">
                        Foundational Observation — No prior prerequisites required.
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {selectedCore.dependencies.map((depId) => {
                          const dep = CORE_KNOWLEDGE_NODES.find((d) => d.id === depId);
                          const has = civ.unlockedCore.includes(depId);
                          return dep ? (
                            <li key={depId}>
                              <button
                                onClick={() => setSelectedNodeId(depId)}
                                className={`w-full text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                                  has
                                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20'
                                    : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                                }`}
                              >
                                <span className="font-medium">{dep.name}</span>
                                <span className="text-[11px]">{has ? '✓ Known' : 'Required →'}</span>
                              </button>
                            </li>
                          ) : null;
                        })}
                      </ul>
                    )}
                  </div>

                  {unlocksCore.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="text-xs font-semibold text-slate-400 mb-2">
                        Leads To Core Knowledge
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {unlocksCore.map((nextNode) => {
                          const has = civ.unlockedCore.includes(nextNode.id);
                          return (
                            <button
                              key={nextNode.id}
                              onClick={() => setSelectedNodeId(nextNode.id)}
                              className={`px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer ${
                                has
                                  ? 'bg-sky-500/15 border-sky-400/35 text-sky-200'
                                  : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-amber-300/40'
                              }`}
                            >
                              {nextNode.name} →
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-3">
                    <div className="text-xs font-semibold text-slate-400 mb-2">
                      Enables Inventions
                    </div>
                    <ul className="space-y-1.5">
                      {INVENTIONS.filter((inv) => inv.requiredCore.includes(selectedCore.id)).map(
                        (inv) => {
                          const hasInv = civ.unlockedInventions.includes(inv.id);
                          return (
                            <li
                              key={inv.id}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                                hasInv
                                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                                  : 'bg-slate-900/50 border-white/10 text-amber-200/90'
                              }`}
                            >
                              <span className="font-medium">{inv.name}</span>
                              <span className="text-[11px] text-slate-400">
                                {hasInv ? '✓ Discovered' : AGES[inv.eraHint].name}
                              </span>
                            </li>
                          );
                        }
                      )}
                    </ul>
                  </div>

                  {selectedCore.boostedByFeatures && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="text-xs font-semibold text-slate-400 mb-1">
                        Explorer Survey Boosters
                      </div>
                      <p className="text-xs text-sky-300">
                        Surveying{' '}
                        {selectedCore.boostedByFeatures
                          .map((f) => f.replace('_', ' '))
                          .join(', ')}{' '}
                        grants rapid Core Knowledge breakthroughs.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'inventions' && (
            <div className="flex-1 overflow-y-auto p-6 bg-[#090f1d]">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Inventions are NOT automatic when prerequisites are met — each turn rolls against
                  your Discovery Probability and luck! Core Knowledge alone can unlock later-era
                  inventions early.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {INVENTIONS.map((inv) => {
                  const unlocked = civ.unlockedInventions.includes(inv.id);
                  const isEarly = civ.earlyInventions.includes(inv.id);
                  const coreMet = inv.requiredCore.every((c) => civ.unlockedCore.includes(c));
                  const invMet = inv.requiredInventions.every((i) =>
                    civ.unlockedInventions.includes(i)
                  );
                  const eligible = !unlocked && coreMet && invMet;
                  const chance = eligible
                    ? Math.round(
                        getInventionTurnChance(
                          inv,
                          civ,
                          modifiers,
                          econ.researchPerTurn,
                          pacingFactor
                        ) * 100
                      )
                    : 0;
                  const aheadOfAge = inv.eraHint > civ.ageIndex;
                  const InvIcon = getInventionIcon(inv.id, inv.category);

                  return (
                    <div
                      key={inv.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                        unlocked
                          ? 'bg-amber-500/10 border-[#e6c983]/50'
                          : eligible
                            ? 'bg-[#0f1d2e] border-sky-400/40'
                            : 'bg-[#0b1522] border-white/10 opacity-80'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <InventionBannerIllustration
                          invId={inv.id}
                          category={inv.category}
                          unlocked={unlocked}
                          primaryCoreId={inv.requiredCore[0]}
                        />

                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                              unlocked
                                ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                                : eligible
                                  ? 'bg-sky-500/15 border-sky-400/35 text-sky-300'
                                  : 'bg-slate-800/80 border-white/10 text-slate-400'
                            }`}
                          >
                            <InvIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-400 truncate">
                                {AGES[inv.eraHint].name} · {inv.category}
                              </span>
                              {unlocked ? (
                                <span className="text-amber-300 font-semibold whitespace-nowrap">
                                  {isEarly ? 'Early!' : 'Discovered'}
                                </span>
                              ) : eligible ? (
                                <span className="text-sky-300 font-mono-tabular font-semibold whitespace-nowrap">
                                  {chance}% / turn
                                </span>
                              ) : (
                                <span className="text-slate-500 whitespace-nowrap">Locked</span>
                              )}
                            </div>

                            <h4 className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                              {aheadOfAge && !unlocked && (
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              <span className="truncate">{inv.name}</span>
                            </h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                              {inv.summary}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 border-t border-white/10 pt-2.5 text-[11px]">
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          <span className="text-slate-400">Core:</span>
                          {inv.requiredCore.map((cid) => {
                            const cn = CORE_KNOWLEDGE_NODES.find((x) => x.id === cid);
                            const ok = civ.unlockedCore.includes(cid);
                            return (
                              <span
                                key={cid}
                                className={ok ? 'text-emerald-300' : 'text-rose-300/80'}
                              >
                                {cn?.name} {ok ? '✓' : ''}
                              </span>
                            );
                          })}
                        </div>

                        {inv.requiredInventions.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-1">
                            <span className="text-slate-400">Prior:</span>
                            {inv.requiredInventions.map((rid) => {
                              const rn = INVENTIONS.find((x) => x.id === rid);
                              const ok = civ.unlockedInventions.includes(rid);
                              return (
                                <span
                                  key={rid}
                                  className={ok ? 'text-emerald-300' : 'text-slate-400'}
                                >
                                  {rn?.name} {ok ? '✓' : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="text-amber-200/90">
                          {inv.unlocksUnits &&
                            `Units: ${inv.unlocksUnits.map((u) => UNIT_DEFS[u]?.name).join(', ')} `}
                          {inv.unlocksBuildings &&
                            `Buildings: ${inv.unlocksBuildings
                              .map((b) => BUILDING_DEFS[b]?.name)
                              .join(', ')} `}
                          {inv.unlocksImprovements &&
                            `Worker: ${inv.unlocksImprovements
                              .map((im) => im.replace('_', ' '))
                              .join(', ')} `}
                          {inv.passiveBonusText && inv.passiveBonusText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'multipliers' && (
            <div className="flex-1 overflow-y-auto p-6 bg-[#090f1d]">
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="rounded-xl overflow-hidden border border-[#b89758]/35 bg-[#0e1a28]">
                  <DramaticScenePlate kind="invention_breakthrough" accentColor="#38bdf8" />
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Total Discovery Multiplier</div>
                      <div className="text-3xl font-bold text-sky-300 font-mono-tabular mt-1">
                        {modifiers.totalMultiplier.toFixed(2)}x
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Research Output</div>
                      <div className="text-xl font-bold text-white font-mono-tabular mt-1">
                        +{econ.researchPerTurn} RP / turn
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111a2e] border border-white/10 rounded-xl divide-y divide-white/10">
                  {[
                    {
                      label: 'Empire Cities',
                      detail: `${Object.values(state.cities).filter((c) => c.civId === civ.id).length} founded cities`,
                      val: modifiers.citiesBonus,
                    },
                    {
                      label: 'Total Population',
                      detail: 'Urban scholars & artisans across your cities',
                      val: modifiers.populationBonus,
                    },
                    {
                      label: 'Land Uncovered',
                      detail: `${modifiers.landUncoveredPct}% of world landmass explored`,
                      val: modifiers.landBonus,
                    },
                    {
                      label: 'Natural Wonders',
                      detail: `${modifiers.wondersCount} wonders discovered`,
                      val: modifiers.wondersBonus,
                    },
                    {
                      label: 'Mountain Ranges Surveyed',
                      detail: `${modifiers.mountainsCount} mountain peaks revealed`,
                      val: modifiers.mountainsBonus,
                    },
                    {
                      label: 'Civilizations Contacted',
                      detail: `${modifiers.civsMetCount} foreign powers met`,
                      val: modifiers.civsBonus,
                    },
                    {
                      label: 'Science Buildings',
                      detail: 'Schools, Universities, Observatories, Harbors & Research Labs',
                      val: modifiers.buildingsBonus,
                    },
                    {
                      label: 'Active Trade Routes',
                      detail: `${modifiers.tradeRoutesCount} international trade routes`,
                      val: modifiers.tradeBonus,
                    },
                    {
                      label: 'Deep Ocean Crossings',
                      detail: civ.crossedOcean
                        ? 'Open ocean charted!'
                        : 'Cross deep ocean tiles to unlock +20%',
                      val: modifiers.oceanCrossedBonus,
                    },
                    {
                      label: 'Climate & Temperature Zones',
                      detail: `${modifiers.zonesCount} zones discovered (${civ.discoveredZones.join(', ')})`,
                      val: modifiers.zonesBonus,
                    },
                  ].map((row) => (
                    <div key={row.label} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-100">{row.label}</div>
                        <div className="text-xs text-slate-400">{row.detail}</div>
                      </div>
                      <div className="text-sm font-mono-tabular font-semibold text-emerald-300">
                        +{Math.round(row.val * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
