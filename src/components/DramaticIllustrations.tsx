import React from 'react';
import { CoreDomain, NaturalDisasterKind, NaturalFeatureType } from '../types/game';

/**
 * Custom miniature illustrated artwork (48x48) for each Core Knowledge node in the DAG.
 */
export const CoreNodeThumb: React.FC<{
  nodeId: string;
  domain: CoreDomain;
  color: string;
  unlocked: boolean;
  variant?: 'thumb' | 'banner' | 'lg';
}> = ({ nodeId, domain, color, unlocked, variant = 'thumb' }) => {
  const stroke = unlocked ? '#f8f3e6' : color;
  const accent = color;

  const renderMotif = () => {
    switch (nodeId) {
      case 'fire_control':
        return (
          <g>
            <path d="M12 38 L22 33 L36 38 M14 33 L34 38" stroke="#92400e" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M24 9 C30 16, 33 22, 30 29 C28 33, 20 33, 18 29 C15 23, 19 16, 24 9 Z" fill="#f97316" />
            <path d="M24 16 C27 20, 28 24, 26 28 C25 30, 23 30, 22 28 C20 24, 21 20, 24 16 Z" fill="#fde047" />
          </g>
        );
      case 'stone_knapping':
        return (
          <g>
            <polygon points="24,8 35,20 31,37 16,38 12,22" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.4" />
            <polyline points="24,8 22,22 31,37" fill="none" stroke="#e2e8f0" strokeWidth="1.2" />
            <line x1="22" y1="22" x2="12" y2="22" stroke="#94a3b8" strokeWidth="1.2" />
            <circle cx="36" cy="14" r="1.8" fill="#fde047" />
            <circle cx="11" cy="15" r="1.4" fill="#fde047" />
          </g>
        );
      case 'clay_ceramics':
        return (
          <g>
            <path d="M18 11 L30 11 L28 16 C35 20, 35 32, 29 38 L19 38 C13 32, 13 20, 20 16 Z" fill="#b45309" stroke="#fcd34d" strokeWidth="1.4" />
            <path d="M17 24 Q24 27 31 24" fill="none" stroke="#fde68a" strokeWidth="1.4" />
            <path d="M18 29 Q24 32 30 29" fill="none" stroke="#fde68a" strokeWidth="1.2" />
          </g>
        );
      case 'coal_charcoal':
        return (
          <g>
            <polygon points="14,32 10,20 20,12 31,15 38,24 34,35 22,38" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.3" />
            <polygon points="20,12 25,24 14,32 10,20" fill="#334155" />
            <path d="M22 29 Q26 24 31 27" stroke="#f97316" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        );
      case 'copper_smelting':
      case 'tin_alloying':
        return (
          <g>
            <path d="M14 20 L34 20 L30 37 L18 37 Z" fill="#78350f" stroke="#f59e0b" strokeWidth="1.4" />
            <ellipse cx="24" cy="20" rx="10" ry="3.2" fill={nodeId === 'tin_alloying' ? '#eab308' : '#ea580c'} />
            <path d="M21 15 Q24 9 27 15" stroke="#fdba74" strokeWidth="1.5" fill="none" />
          </g>
        );
      case 'iron_metallurgy':
      case 'steel_carbonizing':
        return (
          <g>
            <path d="M11 26 L37 26 L33 33 L36 38 L12 38 L15 33 Z" fill={nodeId === 'steel_carbonizing' ? '#475569' : '#334155'} stroke="#cbd5e1" strokeWidth="1.3" />
            <rect x="17" y="21" width="14" height="5" rx="1" fill="#f97316" />
            <path d="M28 10 L35 15 L25 21" stroke="#e2e8f0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <circle cx="15" cy="16" r="1.5" fill="#fde047" />
            <circle cx="19" cy="12" r="1.2" fill="#fb923c" />
          </g>
        );
      case 'basic_chemistry':
        return (
          <g>
            <path d="M19 10 L23 10 L23 18 L31 33 C32 36, 30 38, 27 38 L15 38 C12 38, 10 36, 11 33 L19 18 Z" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M13 31 L29 31 L30 35 C30 37, 29 37, 27 37 L15 37 C13 37, 12 36, 13 31 Z" fill="#f59e0b" />
            <circle cx="34" cy="19" r="4" fill="rgba(52,211,153,0.35)" stroke="#34d399" strokeWidth="1.3" />
          </g>
        );
      case 'gunpowder_alchemy':
        return (
          <g>
            <circle cx="23" cy="27" r="10" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.4" />
            <path d="M26 17 C28 12, 34 14, 35 10" fill="none" stroke="#cbd5e1" strokeWidth="1.8" />
            <polygon points="36,6 38,10 42,9 39,12 41,16 37,13 34,15 35,11 32,9 36,9" fill="#fde047" />
          </g>
        );
      case 'petrochemicals':
        return (
          <g>
            <rect x="17" y="10" width="8" height="28" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.3" />
            <rect x="27" y="18" width="10" height="20" rx="2" fill="#475569" stroke="#f59e0b" strokeWidth="1.3" />
            <line x1="13" y1="38" x2="39" y2="38" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="25" y1="16" x2="32" y2="18" stroke="#f59e0b" strokeWidth="1.5" />
          </g>
        );
      case 'lever_pulley':
        return (
          <g>
            <polygon points="24,25 18,37 30,37" fill="#b45309" stroke="#fcd34d" strokeWidth="1.2" />
            <line x1="10" y1="31" x2="38" y2="18" stroke="#e2e8f0" strokeWidth="2.6" strokeLinecap="round" />
            <rect x="10" y="23" width="7" height="7" fill="#64748b" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="35" cy="14" r="3.5" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
          </g>
        );
      case 'wheel_axle':
        return (
          <g>
            <circle cx="24" cy="24" r="13" fill="none" stroke="#d97706" strokeWidth="3.2" />
            <circle cx="24" cy="24" r="4" fill="#94a3b8" stroke="#f8fafc" strokeWidth="1.2" />
            <line x1="24" y1="11" x2="24" y2="37" stroke="#b45309" strokeWidth="1.8" />
            <line x1="11" y1="24" x2="37" y2="24" stroke="#b45309" strokeWidth="1.8" />
            <line x1="15" y1="15" x2="33" y2="33" stroke="#b45309" strokeWidth="1.4" />
            <line x1="33" y1="15" x2="15" y2="33" stroke="#b45309" strokeWidth="1.4" />
          </g>
        );
      case 'optics_lenses':
        return (
          <g>
            <ellipse cx="22" cy="24" rx="6.5" ry="13" fill="rgba(56,189,248,0.28)" stroke="#7dd3fc" strokeWidth="1.6" />
            <line x1="8" y1="18" x2="20" y2="18" stroke="#fde047" strokeWidth="1.4" />
            <line x1="8" y1="30" x2="20" y2="30" stroke="#fde047" strokeWidth="1.4" />
            <line x1="24" y1="18" x2="39" y2="24" stroke="#fde047" strokeWidth="1.4" />
            <line x1="24" y1="30" x2="39" y2="24" stroke="#38bdf8" strokeWidth="1.4" />
          </g>
        );
      case 'hydraulics_fluid':
        return (
          <g>
            <circle cx="24" cy="23" r="10" fill="none" stroke="#92400e" strokeWidth="2.4" />
            <path d="M10 34 Q17 29 24 34 T38 34" fill="none" stroke="#38bdf8" strokeWidth="2.4" />
            <line x1="24" y1="11" x2="24" y2="35" stroke="#b45309" strokeWidth="1.6" />
            <line x1="12" y1="23" x2="36" y2="23" stroke="#b45309" strokeWidth="1.6" />
          </g>
        );
      case 'steam_thermodynamics':
      case 'internal_combustion':
        return (
          <g>
            <rect x="13" y="20" width="22" height="14" rx="2" fill="#475569" stroke="#e2e8f0" strokeWidth="1.4" />
            <rect x="19" y="11" width="5" height="9" fill="#334155" stroke="#cbd5e1" strokeWidth="1.2" />
            <circle cx="21" cy="7" r="2.5" fill="rgba(226,232,240,0.65)" />
            <circle cx="28" cy="27" r="4" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <line x1="17" y1="27" x2="28" y2="27" stroke="#f8fafc" strokeWidth="1.8" />
          </g>
        );
      case 'magnetism':
        return (
          <g>
            <path d="M15 15 L15 26 C15 32, 33 32, 33 26 L33 15" fill="none" stroke="#ef4444" strokeWidth="4.2" strokeLinecap="round" />
            <rect x="12.5" y="11" width="5" height="5" fill="#cbd5e1" />
            <rect x="30.5" y="11" width="5" height="5" fill="#38bdf8" />
            <path d="M18 9 Q24 5 30 9" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>
        );
      case 'static_charge':
      case 'electromagnetism':
        return (
          <g>
            <circle cx="24" cy="24" r="13" fill="rgba(167,139,250,0.16)" stroke="#a78bfa" strokeWidth="1.4" />
            <polygon points="26,11 18,25 24,25 21,37 31,22 25,22" fill="#fde047" />
          </g>
        );
      case 'semiconductors':
        return (
          <g>
            <rect x="15" y="15" width="18" height="18" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.6" />
            <rect x="20" y="20" width="8" height="8" fill="#a78bfa" />
            <path d="M19 10 V15 M24 10 V15 M29 10 V15 M19 33 V38 M24 33 V38 M29 33 V38 M10 19 H15 M10 24 H15 M10 29 H15 M33 19 H38 M33 24 H38 M33 29 H38" stroke="#eab308" strokeWidth="1.4" />
          </g>
        );
      case 'botany_domestication':
        return (
          <g>
            <path d="M24 37 V17" stroke="#16a34a" strokeWidth="2.2" />
            <path d="M24 29 C16 29, 13 22, 16 17 C21 18, 24 22, 24 29 Z" fill="#34d399" />
            <path d="M24 24 C32 24, 35 17, 32 12 C27 13, 24 17, 24 24 Z" fill="#10b981" />
            <ellipse cx="24" cy="38" rx="9" ry="2.5" fill="#78350f" />
          </g>
        );
      case 'fermentation_medicine':
        return (
          <g>
            <path d="M19 10 L29 10 L28 16 C33 19, 34 32, 29 37 L19 37 C14 32, 15 19, 20 16 Z" fill="rgba(52,211,153,0.22)" stroke="#34d399" strokeWidth="1.5" />
            <circle cx="22" cy="28" r="2.2" fill="#a7f3d0" />
            <circle cx="27" cy="24" r="1.6" fill="#a7f3d0" />
            <path d="M24 18 V24 M21 21 H27" stroke="#f8fafc" strokeWidth="1.6" />
          </g>
        );
      case 'anatomy_germ_theory':
        return (
          <g>
            <path d="M28 11 L22 25 L29 29" fill="none" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="28" cy="11" r="2.5" fill="#34d399" />
            <line x1="14" y1="36" x2="34" y2="36" stroke="#94a3b8" strokeWidth="2.4" />
            <circle cx="19" cy="27" r="4.5" fill="rgba(52,211,153,0.3)" stroke="#34d399" strokeWidth="1.3" />
          </g>
        );
      case 'solar_calendar':
        return (
          <g>
            <circle cx="24" cy="24" r="8" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.4" />
            <circle cx="24" cy="24" r="14" fill="none" stroke="#e6c983" strokeWidth="1.2" strokeDasharray="3 3" />
            <path d="M24 6 V10 M24 38 V42 M6 24 H10 M38 24 H42" stroke="#fde047" strokeWidth="1.6" />
          </g>
        );
      case 'celestial_navigation':
        return (
          <g>
            <circle cx="24" cy="25" r="12" fill="none" stroke="#e6c983" strokeWidth="1.8" />
            <polygon points="24,13 27,25 24,22 21,25" fill="#ef4444" />
            <polygon points="24,37 27,25 24,28 21,25" fill="#38bdf8" />
            <polygon points="36,10 37,13 40,13 38,15 39,18 36,16 33,18 34,15 32,13 35,13" fill="#fde047" />
          </g>
        );
      case 'gravitation_orbits':
        return (
          <g>
            <circle cx="24" cy="24" r="6" fill="#fbbf24" />
            <ellipse cx="24" cy="24" rx="16" ry="7" transform="rotate(-22 24 24)" fill="none" stroke="#f472b6" strokeWidth="1.5" />
            <circle cx="37" cy="18" r="3" fill="#38bdf8" />
            <circle cx="12" cy="29" r="2.2" fill="#e2e8f0" />
          </g>
        );
      case 'atomic_structure':
      default:
        return (
          <g>
            <ellipse cx="24" cy="24" rx="15" ry="6" transform="rotate(30 24 24)" fill="none" stroke={stroke} strokeWidth="1.4" />
            <ellipse cx="24" cy="24" rx="15" ry="6" transform="rotate(-30 24 24)" fill="none" stroke={accent} strokeWidth="1.4" />
            <ellipse cx="24" cy="24" rx="15" ry="6" transform="rotate(90 24 24)" fill="none" stroke={stroke} strokeWidth="1.4" strokeOpacity="0.65" />
            <circle cx="24" cy="24" r="3.5" fill="#fde047" />
          </g>
        );
    }
  };

  const art = CORE_ARTWORK_MAP[nodeId];
  const cellH = art && art.rows === 2 ? 384 : 256;
  const vx = art ? art.col * 344 + 8 : 0;
  const vy = art ? art.row * cellH + 8 : 0;
  const vh = cellH - 16;

  const containerSizeClass =
    variant === 'banner'
      ? 'w-full h-28 rounded-lg'
      : variant === 'lg'
        ? 'w-16 h-16 rounded-xl'
        : 'w-14 h-14 rounded-lg';

  const badgeSizeClass =
    variant === 'banner'
      ? 'bottom-1.5 right-1.5 w-6 h-6 rounded-md'
      : variant === 'lg'
        ? 'bottom-1 right-1 w-5 h-5 rounded'
        : 'bottom-0.5 right-0.5 w-4 h-4 rounded';

  const badgeSvgClass =
    variant === 'banner' ? 'w-4 h-4' : variant === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div
      className={`${containerSizeClass} shrink-0 border overflow-hidden relative bg-[#091220] shadow-inner`}
      style={{ borderColor: unlocked ? color : 'rgba(255, 255, 255, 0.2)' }}
    >
      {art ? (
        <>
          <svg
            viewBox={`${vx} ${vy} 328 ${vh}`}
            preserveAspectRatio="xMidYMid slice"
            className={`w-full h-full block transition-all duration-300 ${
              unlocked ? 'brightness-110 saturate-110' : 'brightness-90 saturate-90'
            }`}
          >
            <image
              href={CORE_KNOWLEDGE_SHEETS[art.sheet]}
              width="1376"
              height="768"
              preserveAspectRatio="none"
            />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d19]/65 via-transparent to-transparent pointer-events-none" />
          <div
            className={`absolute ${badgeSizeClass} bg-[#070d19]/90 border border-white/25 flex items-center justify-center shadow`}
          >
            <svg viewBox="0 0 48 48" className={badgeSvgClass}>
              {renderMotif()}
            </svg>
          </div>
        </>
      ) : (
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <defs>
            <radialGradient id={`g_${nodeId}_${domain}`} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor={accent} stopOpacity={unlocked ? 0.28 : 0.14} />
              <stop offset="100%" stopColor="#070d19" stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <rect width="48" height="48" rx="8" fill={`url(#g_${nodeId}_${domain})`} />
          {renderMotif()}
        </svg>
      )}
    </div>
  );
};

export const CORE_KNOWLEDGE_SHEETS = {
  matter: '/src/assets/images/core_matter_sheet_1794847712054.jpg',
  physics_energy: '/src/assets/images/core_physics_energy_sheet_1794847718732.jpg',
  life_cosmos: '/src/assets/images/core_life_cosmos_sheet_1794847736669.jpg',
  expanded: '/src/assets/images/core_expanded_sheet.jpg',
} as const;

export const CORE_ARTWORK_MAP: Record<
  string,
  {
    sheet: keyof typeof CORE_KNOWLEDGE_SHEETS;
    col: number;
    row: number;
    rows: 2 | 3;
    caption: string;
    principle: string;
  }
> = {
  fire_control: {
    sheet: 'matter',
    col: 0,
    row: 0,
    rows: 3,
    caption: 'Controlled hearth embers reaching 850°C for thermal reaction',
    principle: 'Exothermic Oxidation · Rapid O₂ bonding releases sustained radiant heat.',
  },
  stone_knapping: {
    sheet: 'matter',
    col: 1,
    row: 0,
    rows: 3,
    caption: 'Conchoidal percussion flaking of volcanic obsidian & flint cores',
    principle: 'Hertzian Cone Fracture · Shockwaves cleave amorphous silica into micron edges.',
  },
  clay_ceramics: {
    sheet: 'matter',
    col: 2,
    row: 0,
    rows: 3,
    caption: 'Updraft beehive kiln vitrifying terracotta amphorae & crucibles',
    principle: 'Silicate Sintering · Dehydroxylation fuses clay platelets into waterproof ceramic.',
  },
  coal_charcoal: {
    sheet: 'matter',
    col: 3,
    row: 0,
    rows: 3,
    caption: 'Bituminous coal seam & slow-pyrolysis charcoal mound kiln',
    principle: 'Pyrolytic Carbonization · Driving off volatiles concentrates pure reducing carbon.',
  },
  copper_smelting: {
    sheet: 'matter',
    col: 0,
    row: 1,
    rows: 3,
    caption: 'Malachite carbonate ore reduced to molten copper in a clay crucible',
    principle: 'Carbothermic Reduction · CO gas strips oxygen from CuCO₃ at 1,085°C.',
  },
  tin_alloying: {
    sheet: 'matter',
    col: 1,
    row: 1,
    rows: 3,
    caption: 'Casting molten Cu-Sn golden bronze into a carved stone blade mold',
    principle: 'Substitutional Lattice · Tin atoms lock copper slip planes for superior hardness.',
  },
  iron_metallurgy: {
    sheet: 'matter',
    col: 2,
    row: 1,
    rows: 3,
    caption: 'Forced-draft bloomery furnace & forging incandescent wrought iron',
    principle: 'Slag Liquation & Forging · Hammering expels silicate slag from spongy iron bloom.',
  },
  basic_chemistry: {
    sheet: 'matter',
    col: 3,
    row: 1,
    rows: 3,
    caption: 'Glass alembic distillation of mineral acids, alkalis & crystalline salts',
    principle: 'Proton Transfer & Vapor Fractionation · Selective boiling isolates pure reagents.',
  },
  steel_carbonizing: {
    sheet: 'matter',
    col: 0,
    row: 2,
    rows: 3,
    caption: 'Pneumatic converter decarburizing molten pig iron into structural steel',
    principle: 'Martensitic Phase Control · Controlled 0.2–1.5% carbon forms resilient crystal grains.',
  },
  gunpowder_alchemy: {
    sheet: 'matter',
    col: 1,
    row: 2,
    rows: 3,
    caption: 'Deflagration of potassium nitrate, charcoal, and crystalline sulfur',
    principle: 'Rapid Gas Expansion · Solid oxidizer fuels subsonic pressure waves (3,000x volume).',
  },
  petrochemicals: {
    sheet: 'matter',
    col: 2,
    row: 2,
    rows: 3,
    caption: 'Fractional distillation columns cracking crude oil into light hydrocarbons',
    principle: 'Chain-Length Boiling Gradient · Separates alkanes, aromatics, and polymer feedstocks.',
  },
  lever_pulley: {
    sheet: 'physics_energy',
    col: 0,
    row: 0,
    rows: 3,
    caption: 'Compound block-and-tackle crane & fulcrum beam hoisting dressed stone',
    principle: 'Work-Distance Tradeoff · Torque equilibrium (F₁d₁ = F₂d₂) multiplies lifting force.',
  },
  wheel_axle: {
    sheet: 'physics_energy',
    col: 1,
    row: 0,
    rows: 3,
    caption: 'Spoked timber wheel, bronze journal bearing & involute gear train',
    principle: 'Rolling Contact & Gear Ratio · Converts sliding drag into low-loss angular velocity.',
  },
  optics_lenses: {
    sheet: 'physics_energy',
    col: 2,
    row: 0,
    rows: 3,
    caption: 'Ground crown-glass biconvex lens & dispersive prism on a brass rail',
    principle: 'Snell’s Law of Refraction · Phase velocity shift bends wavefronts to a focal plane.',
  },
  hydraulics_fluid: {
    sheet: 'physics_energy',
    col: 3,
    row: 0,
    rows: 3,
    caption: 'Masonry aqueduct driving an overshot waterwheel & Archimedes screw',
    principle: 'Bernoulli & Hydrostatic Head · Gravitational fluid head converts into shaft torque.',
  },
  steam_thermodynamics: {
    sheet: 'physics_energy',
    col: 0,
    row: 1,
    rows: 3,
    caption: 'Pressurized fire-tube boiler, Watt linkage & heavy cast-iron flywheel',
    principle: 'Rankine Phase Expansion · Latent heat of vaporization drives cyclic piston work.',
  },
  internal_combustion: {
    sheet: 'physics_energy',
    col: 1,
    row: 1,
    rows: 3,
    caption: 'High-compression four-stroke cylinder igniting atomized hydrocarbon mist',
    principle: 'Otto Adiabatic Cycle · Spark ignition inside the working cylinder maximizes power-to-weight.',
  },
  magnetism: {
    sheet: 'physics_energy',
    col: 2,
    row: 1,
    rows: 3,
    caption: 'Natural magnetite lodestone aligning iron filings & pivoted compass needle',
    principle: 'Ferromagnetic Dipoles · Aligned electron spins project a coherent dipolar vector field.',
  },
  static_charge: {
    sheet: 'physics_energy',
    col: 3,
    row: 1,
    rows: 3,
    caption: 'Friction globe generator discharging high-voltage arcs into a Leyden jar',
    principle: 'Coulomb Potential & Dielectric Storage · Separated charge accumulates across glass.',
  },
  electromagnetism: {
    sheet: 'physics_energy',
    col: 0,
    row: 2,
    rows: 3,
    caption: 'Copper armature coil rotating inside permanent horseshoe magnetic poles',
    principle: 'Faraday-Maxwell Induction · Time-varying magnetic flux (dΦ/dt) induces electromotive force.',
  },
  semiconductors: {
    sheet: 'physics_energy',
    col: 1,
    row: 2,
    rows: 3,
    caption: 'Photolithographed silicon wafer die with microscopic P-N transistor gates',
    principle: 'Bandgap Depletion Modulation · Gate voltage controls charge carriers across doped silicon.',
  },
  botany_domestication: {
    sheet: 'life_cosmos',
    col: 0,
    row: 0,
    rows: 2,
    caption: 'Terraced experimental plots & selective hybridizing of non-shattering grain',
    principle: 'Artificial Phenotype Selection · Isolating high-yield alleles stabilizes staple crops.',
  },
  fermentation_medicine: {
    sheet: 'life_cosmos',
    col: 1,
    row: 0,
    rows: 2,
    caption: 'Apothecary herbarium, oak fermentation casks & botanical alkaloid tinctures',
    principle: 'Anaerobic Zymology & Phytochemistry · Yeast enzymes and plant alkaloids inhibit spoilage.',
  },
  anatomy_germ_theory: {
    sheet: 'life_cosmos',
    col: 2,
    row: 0,
    rows: 2,
    caption: 'Achromatic brass microscope resolving stained bacterial colonies in agar',
    principle: 'Pathogenic Contagion · Identifying cellular microbes enables antisepsis and immunization.',
  },
  solar_calendar: {
    sheet: 'life_cosmos',
    col: 3,
    row: 0,
    rows: 2,
    caption: 'Megalithic solstice sightlines paired with carved ephemeris tablets',
    principle: 'Ecliptic Periodicity · Reconciles the 365.24-day solar year with synodic lunar months.',
  },
  celestial_navigation: {
    sheet: 'life_cosmos',
    col: 0,
    row: 1,
    rows: 2,
    caption: 'Mariner’s brass astrolabe, octant & Pelorus chart fixing open-ocean latitude',
    principle: 'Spherical Trigonometry · Horizon zenith angles of Polaris and the Sun fix coordinates.',
  },
  gravitation_orbits: {
    sheet: 'life_cosmos',
    col: 1,
    row: 1,
    rows: 2,
    caption: 'Clockwork heliocentric orrery & observatory reflector tracking planetary ellipses',
    principle: 'Inverse-Square Universal Gravitation · Centripetal attraction (GMm/r²) governs conic orbits.',
  },
  atomic_structure: {
    sheet: 'life_cosmos',
    col: 2,
    row: 1,
    rows: 2,
    caption: 'Quantized electron shells orbiting a dense nucleon core with alpha tracks',
    principle: 'Quantum Wavefunctions & Nuclear Binding · Discrete orbital eigenstates & E = mc².',
  },
  gold_silver_refining: {
    sheet: 'expanded',
    col: 0,
    row: 0,
    rows: 3,
    caption: 'Cupellation hearth pouring molten gold & silver bullion beside quartz nuggets',
    principle: 'Selective Oxidation · Lead cupellation absorbs base oxides, leaving pure noble Au & Ag.',
  },
  zinc_brass_metallurgy: {
    sheet: 'expanded',
    col: 1,
    row: 0,
    rows: 3,
    caption: 'Precision brass gears, astrolabe rings & crystalline galena and sphalerite ores',
    principle: 'Cu-Zn Solid Solution · Alloying copper with zinc yields low-friction, non-sparking brass.',
  },
  aluminum_light_alloys: {
    sheet: 'expanded',
    col: 2,
    row: 0,
    rows: 3,
    caption: 'Electrolytic Hall-Héroult reduction of bauxite into lightweight aluminum-titanium trusses',
    principle: 'Cryolite Electrolysis · High-current reduction breaks Al₂O₃ bonds into low-density alloys.',
  },
  latex_natural_rubber: {
    sheet: 'expanded',
    col: 3,
    row: 0,
    rows: 3,
    caption: 'Tapping Hevea latex sap alongside crystalline sulfur and vulcanized rubber seals',
    principle: 'Polyisoprene Disulfide Cross-Linking · Sulfur bridges turn sticky latex into elastic rubber.',
  },
  synthetic_plastics: {
    sheet: 'expanded',
    col: 0,
    row: 1,
    rows: 3,
    caption: 'Molded thermoset polymers, hydrocarbon chain models & catalytic synthesis flasks',
    principle: 'Macromolecular Polymerization · Covalent monomer chains form lightweight, moldable plastics.',
  },
  cellular_anatomy: {
    sheet: 'expanded',
    col: 1,
    row: 1,
    rows: 3,
    caption: 'Vascular arterial circulation chart & brass lens resolving plant cell walls',
    principle: 'Cell Theory & Hemodynamics · All living tissues comprise discrete membrane-bound cells.',
  },
  bacteriology: {
    sheet: 'expanded',
    col: 2,
    row: 1,
    rows: 3,
    caption: 'Stained bacterial colonies on agar Petri dishes & Penicillium antibiotic flasks',
    principle: 'Prokaryotic Culture & Beta-Lactam Inhibition · Isolating bacteria unlocks targeted antibiotics.',
  },
  virology_immunology: {
    sheet: 'expanded',
    col: 3,
    row: 1,
    rows: 3,
    caption: 'Icosahedral viral capsids neutralized by Y-shaped adaptive immunoglobulin antibodies',
    principle: 'Antigen-Antibody Lock & Key · Sub-microscopic viral replication halted by immune memory.',
  },
  evolution_paleontology: {
    sheet: 'expanded',
    col: 0,
    row: 2,
    rows: 3,
    caption: 'Sedimentary fossil strata with ammonites, theropod skull & adaptive finch morphology',
    principle: 'Stratigraphic Superposition & Natural Selection · Differential survival shapes species over eons.',
  },
  planetary_kinematics: {
    sheet: 'expanded',
    col: 1,
    row: 2,
    rows: 3,
    caption: 'Geometric trajectory parabolas, brass calipers, masonry arch & equilibrium scales',
    principle: 'Vector Decomposition & Static Equilibrium · Parabolic motion (y = v₀t - ½gt²) and force balance.',
  },
  heliocentric_solar_system: {
    sheet: 'expanded',
    col: 2,
    row: 2,
    rows: 3,
    caption: 'Concentric planetary orbits around the radiant Sun with a brass Copernican armillary sphere',
    principle: 'Heliocentric Keplerian Ellipses · Planets sweep equal areas in equal times around the Sun (T² ∝ a³).',
  },
  stellar_spectroscopy: {
    sheet: 'expanded',
    col: 3,
    row: 2,
    rows: 3,
    caption: 'Optical prism dispersing starlight into Fraunhofer absorption lines before a spiral galaxy',
    principle: 'Quantum Spectral Absorption · Atomic transition lines reveal stellar elements and redshift.',
  },
};

export const CoreKnowledgeArtworkCard: React.FC<{
  nodeId: string;
  nodeName: string;
  domainLabel: string;
  color: string;
  unlocked: boolean;
  eligible: boolean;
  progress: number;
  tier: number;
}> = ({ nodeId, domainLabel, color, unlocked, eligible, progress, tier }) => {
  const art = CORE_ARTWORK_MAP[nodeId];
  if (!art) return null;

  const cellH = art.rows === 2 ? 384 : 256;
  const vx = art.col * 344 + 8;
  const vy = art.row * cellH + 8;
  const vh = cellH - 16;

  return (
    <div className="rounded-xl overflow-hidden border border-[#b89758]/55 bg-[#09111d] shadow-2xl relative group">
      <div className="relative w-full h-64 xl:h-72 overflow-hidden bg-[#070d18]">
        <svg
          viewBox={`${vx} ${vy} 328 ${vh}`}
          preserveAspectRatio="xMidYMid slice"
          className={`w-full h-full block transition-transform duration-500 group-hover:scale-105 ${
            unlocked ? 'brightness-110 saturate-110' : 'brightness-95'
          }`}
        >
          <image
            href={CORE_KNOWLEDGE_SHEETS[art.sheet]}
            width="1376"
            height="768"
            preserveAspectRatio="none"
          />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-[#09111d]/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-1.5 rounded-lg border border-[#e6c983]/30 pointer-events-none" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md border shadow"
            style={{
              backgroundColor: 'rgba(9, 17, 29, 0.85)',
              borderColor: `${color}80`,
              color,
            }}
          >
            Tier {tier + 1} · {domainLabel}
          </span>
        </div>

        <div className="absolute top-3 right-3">
          {unlocked ? (
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 backdrop-blur-md shadow">
              ✓ Discovered
            </span>
          ) : eligible ? (
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono-tabular font-semibold bg-sky-500/30 text-sky-200 border border-sky-400/60 backdrop-blur-md shadow">
              Researching · {progress}%
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900/85 text-slate-300 border border-white/20 backdrop-blur-md shadow">
              Locked Concept
            </span>
          )}
        </div>
      </div>

      <div className="px-3.5 py-2.5 bg-[#0c1626] border-t border-white/10 space-y-1.5">
        <div className="text-xs font-medium text-[#f8f3e6] leading-snug">{art.caption}</div>
        <div className="text-[11px] text-slate-300 leading-relaxed">
          <span className="font-semibold text-[#e6c983]">Physical Principle: </span>
          {art.principle}
        </div>
      </div>
    </div>
  );
};

/**
 * Rich thematic illustration banner for every Invention card in the Research & Discovery Tree.
 */
export const InventionBannerIllustration: React.FC<{
  invId: string;
  category: string;
  unlocked: boolean;
  primaryCoreId?: string;
}> = ({ invId, category, unlocked, primaryCoreId }) => {
  const palette =
    category === 'military'
      ? { skyTop: '#2b1215', skyBot: '#130b12', accent: '#f87171', gold: '#fbbf24' }
      : category === 'science'
        ? { skyTop: '#10243d', skyBot: '#091120', accent: '#38bdf8', gold: '#e6c983' }
        : category === 'maritime'
          ? { skyTop: '#0d2c3e', skyBot: '#071522', accent: '#22d3ee', gold: '#fde68a' }
          : category === 'economy'
            ? { skyTop: '#29200e', skyBot: '#12100a', accent: '#34d399', gold: '#fbbf24' }
            : { skyTop: '#241b12', skyBot: '#110e0b', accent: '#f59e0b', gold: '#e6c983' };

  const renderScene = () => {
    switch (invId) {
      case 'agriculture':
        return (
          <g>
            <path d="M0 64 Q80 54 150 62 T240 58 L240 88 L0 88 Z" fill="#3f6212" />
            <path d="M18 68 L110 68 M24 75 L125 75 M32 82 L140 82" stroke="#a3e635" strokeWidth="2.5" strokeDasharray="8 4" />
            <path d="M155 58 Q185 38 220 48 L220 88 L150 88 Z" fill="#65a30d" />
            <rect x="172" y="42" width="22" height="16" fill="#d6c5a3" stroke="#78350f" strokeWidth="1.5" />
            <polygon points="169,42 183,31 197,42" fill="#991b1b" />
            <circle cx="52" cy="24" r="10" fill="#fde047" opacity="0.85" />
          </g>
        );
      case 'stone_masonry':
      case 'fortified_keeps':
        return (
          <g>
            <rect x="35" y="42" width="170" height="46" fill="#475569" />
            <rect x="30" y="34" width="26" height="54" fill="#64748b" stroke="#cbd5e1" strokeWidth="1" />
            <rect x="184" y="34" width="26" height="54" fill="#64748b" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M56 38 H72 V44 H88 V38 H104 V44 H120 V38 H136 V44 H152 V38 H168 V44 H184" fill="none" stroke="#94a3b8" strokeWidth="4" />
            <path d="M104 88 V64 A16 16 0 0 1 136 64 V88 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.5" />
            <line x1="43" y1="34" x2="43" y2="18" stroke="#e2e8f0" strokeWidth="1.5" />
            <polygon points="43,18 58,22 43,26" fill={palette.accent} />
          </g>
        );
      case 'archery_bow':
        return (
          <g>
            <path d="M62 16 Q98 44 62 72" fill="none" stroke="#d97706" strokeWidth="4" />
            <line x1="62" y1="16" x2="62" y2="72" stroke="#f8fafc" strokeWidth="1.2" />
            <line x1="56" y1="44" x2="128" y2="44" stroke="#e6c983" strokeWidth="2.2" />
            <polygon points="128,40 138,44 128,48" fill="#cbd5e1" />
            <circle cx="188" cy="44" r="18" fill="#f8fafc" stroke="#ef4444" strokeWidth="4" />
            <circle cx="188" cy="44" r="8" fill="#ef4444" />
          </g>
        );
      case 'mining_shafts':
        return (
          <g>
            <path d="M0 88 L45 34 L105 26 L165 40 L240 24 L240 88 Z" fill="#44403c" />
            <path d="M84 88 V46 H136 V88 Z" fill="#0f172a" stroke="#b45309" strokeWidth="4" />
            <line x1="76" y1="84" x2="155" y2="84" stroke="#94a3b8" strokeWidth="2" />
            <polygon points="154,50 164,46 160,57" fill="#fbbf24" />
            <circle cx="94" cy="54" r="3" fill="#f97316" />
          </g>
        );
      case 'bronze_weapons':
      case 'iron_forging':
      case 'heavy_chivalry':
        return (
          <g>
            <line x1="70" y1="74" x2="155" y2="18" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <line x1="170" y1="74" x2="85" y2="18" stroke={invId === 'bronze_weapons' ? '#eab308' : '#e2e8f0'} strokeWidth="4" strokeLinecap="round" />
            <path d="M104 26 H136 V48 C136 62, 120 72, 120 72 C120 72, 104 62, 104 48 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="2.4" />
            <polygon points="120,34 124,44 134,44 126,50 129,60 120,54 111,60 114,50 106,44 116,44" fill="#fbbf24" />
          </g>
        );
      case 'wheeled_roads':
      case 'watermill_workshop':
        return (
          <g>
            <path d="M20 82 Q120 62 220 36" fill="none" stroke="#a8a29e" strokeWidth="14" />
            <path d="M20 82 Q120 62 220 36" fill="none" stroke="#d6d3d1" strokeWidth="8" strokeDasharray="10 6" />
            <circle cx="92" cy="48" r="17" fill="none" stroke="#d97706" strokeWidth="3.5" />
            <circle cx="136" cy="42" r="14" fill="none" stroke="#b45309" strokeWidth="3.5" />
            <line x1="92" y1="31" x2="92" y2="65" stroke="#d97706" strokeWidth="2" />
            <line x1="75" y1="48" x2="109" y2="48" stroke="#d97706" strokeWidth="2" />
          </g>
        );
      case 'coinage_markets':
        return (
          <g>
            <circle cx="88" cy="48" r="18" fill="#d97706" stroke="#fde047" strokeWidth="2.5" />
            <circle cx="122" cy="42" r="20" fill="#eab308" stroke="#fef08a" strokeWidth="2.5" />
            <circle cx="154" cy="52" r="16" fill="#b45309" stroke="#fcd34d" strokeWidth="2" />
            <polygon points="122,30 126,40 122,52 118,40" fill="#78350f" />
          </g>
        );
      case 'writing_schools':
      case 'universities':
      case 'expedition_guilds':
        return (
          <g>
            <path d="M48 64 L118 54 L118 22 L48 32 Z" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
            <path d="M192 64 L122 54 L122 22 L192 32 Z" fill="#fde68a" stroke="#b45309" strokeWidth="2" />
            <line x1="60" y1="38" x2="106" y2="31" stroke="#78350f" strokeWidth="1.8" />
            <line x1="60" y1="46" x2="106" y2="39" stroke="#78350f" strokeWidth="1.8" />
            <line x1="134" y1="31" x2="180" y2="38" stroke="#78350f" strokeWidth="1.8" />
            <circle cx="157" cy="47" r="7" fill="none" stroke="#0369a1" strokeWidth="1.6" />
          </g>
        );
      case 'torsion_siege':
      case 'blackpowder_muskets':
      case 'rifled_infantry':
      case 'armored_warfare':
        return (
          <g>
            <path d="M0 72 L240 72 L240 88 L0 88 Z" fill="#292524" />
            <rect x="64" y="46" width="58" height="22" rx="6" fill="#475569" stroke="#cbd5e1" strokeWidth="1.8" />
            <line x1="118" y1="52" x2="178" y2="38" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
            <circle cx="186" cy="36" r="9" fill="#f97316" />
            <circle cx="188" cy="35" r="4.5" fill="#fef08a" />
            <circle cx="78" cy="70" r="9" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
            <circle cx="106" cy="70" r="9" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
          </g>
        );
      case 'compass_caravel':
        return (
          <g>
            <path d="M0 66 Q40 58 80 66 T160 66 T240 66 L240 88 L0 88 Z" fill="#0369a1" />
            <path d="M72 60 L152 60 L138 74 L86 74 Z" fill="#78350f" stroke="#d97706" strokeWidth="1.5" />
            <line x1="112" y1="14" x2="112" y2="60" stroke="#e2e8f0" strokeWidth="2.5" />
            <path d="M114 18 Q148 34 114 54 Z" fill="#fef3c7" />
            <path d="M110 24 Q84 36 110 52 Z" fill="#fde68a" />
            <circle cx="192" cy="24" r="10" fill="none" stroke="#e6c983" strokeWidth="1.5" />
          </g>
        );
      case 'astronomical_observatory':
      case 'quantum_research_lab':
        return (
          <g>
            <circle cx="52" cy="20" r="2" fill="#fef08a" />
            <circle cx="192" cy="18" r="2.2" fill="#7dd3fc" />
            <ellipse cx="176" cy="36" rx="22" ry="9" transform="rotate(-18 176 36)" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="176" cy="36" r="5" fill="#fbbf24" />
            <path d="M72 78 V48 A26 26 0 0 1 124 48 V78 Z" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="104" y1="42" x2="138" y2="20" stroke="#e6c983" strokeWidth="5" strokeLinecap="round" />
          </g>
        );
      case 'steam_engine':
      case 'electric_grid':
        return (
          <g>
            <rect x="44" y="42" width="66" height="32" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="1.8" />
            <rect x="56" y="18" width="12" height="24" fill="#475569" stroke="#cbd5e1" strokeWidth="1.4" />
            <circle cx="88" cy="58" r="12" fill="none" stroke="#f59e0b" strokeWidth="3" />
            <polygon points="154,18 140,46 154,46 146,72 174,38 158,38" fill="#fde047" />
            <path d="M110 48 Q134 38 150 44" fill="none" stroke="#38bdf8" strokeWidth="2" />
          </g>
        );
      case 'tally_numbers':
        return (
          <g>
            <rect x="42" y="20" width="156" height="48" rx="6" fill="#78350f" stroke="#d97706" strokeWidth="2" />
            {/* Tally marks IIII with diagonal slash */}
            <g stroke="#fef3c7" strokeWidth="3" strokeLinecap="round">
              <line x1="64" y1="30" x2="64" y2="56" />
              <line x1="76" y1="30" x2="76" y2="56" />
              <line x1="88" y1="30" x2="88" y2="56" />
              <line x1="100" y1="30" x2="100" y2="56" />
              <line x1="58" y1="52" x2="106" y2="34" stroke="#fbbf24" />
              <line x1="128" y1="30" x2="128" y2="56" />
              <line x1="140" y1="30" x2="140" y2="56" />
              <line x1="152" y1="30" x2="152" y2="56" />
            </g>
            <circle cx="176" cy="36" r="6" fill="#eab308" />
            <circle cx="176" cy="52" r="6" fill="#eab308" />
          </g>
        );
      case 'pictographic_writing':
      case 'literacy_reading':
        return (
          <g>
            <rect x="40" y="18" width="74" height="52" rx="4" fill="#d97706" stroke="#fde68a" strokeWidth="1.8" />
            <line x1="52" y1="30" x2="100" y2="30" stroke="#451a03" strokeWidth="2.4" strokeDasharray="6 4" />
            <line x1="52" y1="42" x2="96" y2="42" stroke="#451a03" strokeWidth="2.4" strokeDasharray="8 3" />
            <line x1="52" y1="54" x2="102" y2="54" stroke="#451a03" strokeWidth="2.4" strokeDasharray="5 4" />
            <path d="M130 22 H194 V66 H130 Z" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
            <circle cx="130" cy="44" r="5" fill="#92400e" />
            <circle cx="194" cy="44" r="5" fill="#92400e" />
            <text x="162" y="49" textAnchor="middle" fill="#78350f" fontSize="16" fontWeight="700" fontFamily="Cinzel, serif">
              Α Β Γ
            </text>
          </g>
        );
      case 'basic_arithmetic_geometry':
        return (
          <g>
            <polygon points="48,66 96,20 128,66" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="2.4" />
            <circle cx="168" cy="44" r="22" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeDasharray="5 3" />
            <line x1="168" y1="44" x2="190" y2="44" stroke="#fef08a" strokeWidth="2" />
            <text x="88" y="58" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700" fontFamily="monospace">
              a²+b²=c²
            </text>
          </g>
        );
      case 'algebraic_equations':
        return (
          <g>
            <line x1="36" y1="68" x2="204" y2="68" stroke="#64748b" strokeWidth="1.8" />
            <line x1="52" y1="14" x2="52" y2="74" stroke="#64748b" strokeWidth="1.8" />
            <path d="M52 66 Q116 10 188 64" fill="none" stroke="#38bdf8" strokeWidth="3" />
            <text x="136" y="34" textAnchor="middle" fill="#fde047" fontSize="15" fontWeight="700" fontFamily="serif">
              x = −b ± √Δ
            </text>
          </g>
        );
      case 'calculus_complex_math':
        return (
          <g>
            <path d="M36 56 C68 12, 108 12, 140 56 S200 72, 212 24" fill="none" stroke="#c084fc" strokeWidth="2.8" />
            <text x="72" y="54" textAnchor="middle" fill="#fde047" fontSize="22" fontWeight="700" fontFamily="serif">
              ∫ f(z)dz
            </text>
            <text x="172" y="42" textAnchor="middle" fill="#38bdf8" fontSize="16" fontWeight="700" fontFamily="serif">
              e^(iπ) + 1 = 0
            </text>
          </g>
        );
      case 'vulcanized_rubber_plastics':
        return (
          <g>
            <circle cx="84" cy="46" r="22" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="84" cy="46" r="10" fill="#475569" stroke="#e2e8f0" strokeWidth="2" />
            <polyline points="132,56 148,32 168,56 184,32 202,56" fill="none" stroke="#f59e0b" strokeWidth="3" />
            <circle cx="132" cy="56" r="4.5" fill="#38bdf8" />
            <circle cx="148" cy="32" r="4.5" fill="#fbbf24" />
            <circle cx="168" cy="56" r="4.5" fill="#34d399" />
            <circle cx="184" cy="32" r="4.5" fill="#fbbf24" />
            <circle cx="202" cy="56" r="4.5" fill="#38bdf8" />
          </g>
        );
      case 'antibiotics_virology_therapy':
      case 'sanitation_vaccines':
      default:
        return (
          <g>
            <circle cx="120" cy="44" r="26" fill="rgba(52,211,153,0.16)" stroke="#34d399" strokeWidth="1.8" />
            <rect x="115" y="26" width="10" height="36" rx="2" fill="#34d399" />
            <rect x="102" y="39" width="36" height="10" rx="2" fill="#34d399" />
          </g>
        );
    }
  };

  const coreArt = primaryCoreId ? CORE_ARTWORK_MAP[primaryCoreId] : undefined;
  const cellH = coreArt && coreArt.rows === 2 ? 384 : 256;
  const vx = coreArt ? coreArt.col * 344 + 8 : 0;
  const vy = coreArt ? coreArt.row * cellH + 8 : 0;
  const vh = cellH - 16;

  return (
    <div className="w-full h-36 rounded-lg overflow-hidden border border-white/15 relative bg-[#070d18] flex">
      {coreArt && (
        <div className="w-1/2 h-full relative overflow-hidden border-r border-white/10">
          <svg
            viewBox={`${vx} ${vy} 328 ${vh}`}
            preserveAspectRatio="xMidYMid slice"
            className={`w-full h-full block ${
              unlocked ? 'brightness-105 saturate-110' : 'brightness-90 saturate-90'
            }`}
          >
            <image
              href={CORE_KNOWLEDGE_SHEETS[coreArt.sheet]}
              width="1376"
              height="768"
              preserveAspectRatio="none"
            />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#091120]/85 pointer-events-none" />
        </div>
      )}
      <div className={`${coreArt ? 'w-1/2' : 'w-full'} h-full relative`}>
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id={`inv_${invId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.skyTop} />
              <stop offset="100%" stopColor={palette.skyBot} />
            </linearGradient>
          </defs>
          <rect width="240" height="88" fill={`url(#inv_${invId})`} />
          {renderScene()}
          {unlocked && (
            <rect
              x="1.5"
              y="1.5"
              width="237"
              height="85"
              rx="6"
              fill="none"
              stroke="#fbbf24"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

export type DramaticSceneKind =
  | 'age_transition'
  | 'invention_breakthrough'
  | 'exploration_ruins'
  | 'exploration_flora'
  | 'city_capture'
  | 'natural_wonder'
  | 'victory_triumph'
  | 'victory_defeat';

/**
 * Rich widescreen illuminated panorama plate for major milestones, exploration events,
 * battles/city captures, age changes, and victory screens.
 */
export const DramaticScenePlate: React.FC<{
  kind: DramaticSceneKind;
  ageIndex?: number;
  accentColor?: string;
  className?: string;
}> = ({ kind, ageIndex = 0, accentColor = '#e6c983', className = '' }) => {
  return (
    <svg
      viewBox="0 0 480 170"
      preserveAspectRatio="xMidYMid slice"
      className={`w-full h-40 block border-b border-[#b89758]/35 ${className}`}
    >
      <defs>
        <linearGradient id={`scene_bg_${kind}_${ageIndex}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={
              kind === 'city_capture' || kind === 'victory_defeat'
                ? '#331215'
                : kind === 'exploration_flora'
                  ? '#0c2a24'
                  : kind === 'age_transition'
                    ? '#1b1a36'
                    : '#122238'
            }
          />
          <stop offset="65%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#090e18" />
        </linearGradient>
        <radialGradient id={`scene_glow_${kind}`} cx="50%" cy="45%" r="48%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="170" fill={`url(#scene_bg_${kind}_${ageIndex})`} />
      <rect width="480" height="170" fill={`url(#scene_glow_${kind})`} />

      {/* Distant cartographic stars / sun rays */}
      <g opacity="0.55">
        <circle cx="64" cy="28" r="1.4" fill="#fde68a" />
        <circle cx="142" cy="19" r="1.1" fill="#f8fafc" />
        <circle cx="338" cy="24" r="1.4" fill="#fde68a" />
        <circle cx="418" cy="34" r="1.2" fill="#bae6fd" />
        <line x1="240" y1="74" x2="120" y2="0" stroke={accentColor} strokeOpacity="0.12" strokeWidth="18" />
        <line x1="240" y1="74" x2="360" y2="0" stroke={accentColor} strokeOpacity="0.12" strokeWidth="18" />
      </g>

      {kind === 'age_transition' && (
        <g>
          {/* Horizon ridge */}
          <path d="M0 132 L80 105 L155 124 L240 94 L328 122 L410 100 L480 126 L480 170 L0 170 Z" fill="#1e293b" />
          {/* Rising Sun / Era Emblem */}
          <circle cx="240" cy="82" r="34" fill={accentColor} fillOpacity="0.22" stroke={accentColor} strokeWidth="2" />
          <circle cx="240" cy="82" r="23" fill={accentColor} fillOpacity="0.38" />
          {/* Era silhouettes progressing from ancient to modern */}
          {ageIndex <= 2 && (
            <g fill="#0f172a" stroke="#e6c983" strokeWidth="1.5">
              <rect x="175" y="96" width="16" height="44" />
              <rect x="215" y="88" width="18" height="52" />
              <rect x="255" y="92" width="16" height="48" />
              <rect x="170" y="90" width="110" height="10" />
            </g>
          )}
          {ageIndex >= 3 && ageIndex <= 5 && (
            <g fill="#0f172a" stroke="#e6c983" strokeWidth="1.5">
              <rect x="170" y="96" width="28" height="48" />
              <rect x="218" y="76" width="44" height="68" />
              <polygon points="215,76 240,52 265,76" fill="#b45309" />
              <rect x="282" y="96" width="28" height="48" />
            </g>
          )}
          {ageIndex === 6 && (
            <g>
              <path d="M165 124 L315 124 L295 144 L185 144 Z" fill="#78350f" stroke="#e6c983" strokeWidth="1.5" />
              <line x1="240" y1="54" x2="240" y2="124" stroke="#f8fafc" strokeWidth="3" />
              <path d="M244 58 Q298 84 244 114 Z" fill="#fef3c7" />
              <path d="M236 66 Q190 88 236 112 Z" fill="#fde68a" />
            </g>
          )}
          {ageIndex >= 7 && (
            <g>
              <rect x="165" y="98" width="38" height="46" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
              <rect x="176" y="64" width="10" height="34" fill="#475569" />
              <ellipse cx="240" cy="84" rx="44" ry="15" transform="rotate(-18 240 84)" fill="none" stroke="#22d3ee" strokeWidth="2" />
              <ellipse cx="240" cy="84" rx="44" ry="15" transform="rotate(18 240 84)" fill="none" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="240" cy="84" r="8" fill="#fde047" />
              <rect x="280" y="88" width="34" height="56" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
            </g>
          )}
          <path d="M0 142 Q240 132 480 142 L480 170 L0 170 Z" fill="#090e18" />
        </g>
      )}

      {kind === 'invention_breakthrough' && (
        <g>
          {/* Drafting bench + golden gears + brass astrolabe + spark */}
          <rect x="0" y="132" width="480" height="38" fill="#1c140d" />
          <path d="M120 132 L145 78 L335 78 L360 132 Z" fill="#2c2116" stroke="#b89758" strokeWidth="1.8" />
          <rect x="162" y="86" width="156" height="36" fill="#f3e5c2" stroke="#92400e" strokeWidth="1.5" />
          <line x1="176" y1="98" x2="254" y2="98" stroke="#78350f" strokeWidth="2" />
          <line x1="176" y1="108" x2="236" y2="108" stroke="#92400e" strokeWidth="1.6" />
          <circle cx="284" cy="104" r="12" fill="none" stroke="#0369a1" strokeWidth="1.8" />
          <circle cx="174" cy="52" r="22" fill="none" stroke="#e6c983" strokeWidth="4" strokeDasharray="7 4" />
          <circle cx="308" cy="56" r="16" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeDasharray="5 3" />
          <polygon points="240,20 247,42 269,49 247,56 240,78 233,56 211,49 233,42" fill="#fde047" />
        </g>
      )}

      {kind === 'exploration_ruins' && (
        <g>
          <path d="M0 136 L72 90 L132 120 L240 76 L348 118 L412 88 L480 136 L480 170 L0 170 Z" fill="#1e293b" />
          <rect x="168" y="68" width="22" height="74" fill="#57534e" stroke="#a8a29e" strokeWidth="1.5" />
          <rect x="290" y="72" width="22" height="70" fill="#57534e" stroke="#a8a29e" strokeWidth="1.5" />
          <rect x="158" y="56" width="164" height="14" fill="#78716c" stroke="#d6d3d1" strokeWidth="1.5" />
          {/* Glowing Golden Astrolabe Pedestal */}
          <rect x="228" y="106" width="24" height="36" fill="#44403c" />
          <circle cx="240" cy="92" r="14" fill="none" stroke="#fbbf24" strokeWidth="2.4" />
          <circle cx="240" cy="92" r="6" fill="#fde047" />
          {/* Torches */}
          <circle cx="179" cy="86" r="5" fill="#f97316" />
          <circle cx="301" cy="88" r="5" fill="#f97316" />
        </g>
      )}

      {kind === 'exploration_flora' && (
        <g>
          <path d="M0 138 Q120 96 240 124 T480 112 L480 170 L0 170 Z" fill="#064e3b" />
          <path d="M180 170 L205 64 L275 64 L300 170 Z" fill="#0e7490" opacity="0.5" />
          <circle cx="145" cy="96" r="28" fill="#059669" />
          <circle cx="335" cy="92" r="32" fill="#047857" />
          {/* Luminous Medicinal Blossoms */}
          <circle cx="240" cy="108" r="14" fill="#34d399" fillOpacity="0.4" />
          <path d="M240 136 V96" stroke="#6ee7b7" strokeWidth="3" />
          <circle cx="240" cy="94" r="6" fill="#fef08a" />
          <circle cx="212" cy="112" r="4" fill="#a7f3d0" />
          <circle cx="268" cy="114" r="4" fill="#a7f3d0" />
        </g>
      )}

      {(kind === 'city_capture' || kind === 'victory_defeat') && (
        <g>
          {/* Smoke plumes */}
          <circle cx="165" cy="60" r="24" fill="#475569" fillOpacity="0.45" />
          <circle cx="310" cy="52" r="28" fill="#475569" fillOpacity="0.4" />
          {/* Bastion walls */}
          <rect x="120" y="90" width="240" height="60" fill="#334155" stroke="#94a3b8" strokeWidth="1.8" />
          <rect x="198" y="64" width="84" height="86" fill="#475569" stroke="#cbd5e1" strokeWidth="1.8" />
          <path d="M222 150 V112 A18 18 0 0 1 258 112 V150 Z" fill="#090e18" />
          {/* Flames */}
          <path d="M150 96 C158 76, 168 84, 164 98 Z" fill="#f97316" />
          <path d="M318 96 C324 72, 336 82, 332 98 Z" fill="#f97316" />
          {/* Conqueror Standard */}
          <line x1="240" y1="20" x2="240" y2="66" stroke="#f8fafc" strokeWidth="2.5" />
          <polygon points="242,22 296,31 242,42" fill={kind === 'victory_defeat' ? '#ef4444' : '#fbbf24'} />
        </g>
      )}

      {(kind === 'natural_wonder' || kind === 'victory_triumph') && (
        <g>
          <path d="M80 150 L175 44 L240 112 L305 38 L400 150 Z" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
          <polygon points="175,44 150,76 200,76" fill="#f8fafc" />
          <polygon points="305,38 278,74 332,74" fill="#f8fafc" />
          <circle cx="240" cy="64" r="26" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <polygon points="240,42 246,58 263,58 249,68 254,84 240,74 226,84 231,68 217,58 234,58" fill="#fde047" />
        </g>
      )}

      {/* Subtle brass corner filigree */}
      <path d="M8 22 V8 H22 M458 8 H472 V22 M8 148 V162 H22 M458 162 H472 V148" fill="none" stroke="#e6c983" strokeOpacity="0.65" strokeWidth="1.6" />
    </svg>
  );
};

const NATURAL_PHENOMENA_SHEET = '/src/assets/images/natural_phenomena_sheet.jpg';

const DISASTER_PANEL_MAP: Record<
  NaturalDisasterKind,
  { col: number; row: number; badge: string; accent: string }
> = {
  shore_anomaly: {
    col: 0,
    row: 0,
    badge: 'Coastal Gale & Pelagic Drift',
    accent: '#38bdf8',
  },
  meteor_strike: {
    col: 1,
    row: 0,
    badge: 'Celestial Bolide & Crater',
    accent: '#c084fc',
  },
  volcano_eruption: {
    col: 0,
    row: 1,
    badge: 'Volcanic Pyroclasm',
    accent: '#f97316',
  },
  river_flood: {
    col: 1,
    row: 1,
    badge: 'Alluvial Deluge & Exposed Strata',
    accent: '#34d399',
  },
};

export const NaturalDisasterIllustration: React.FC<{
  kind: NaturalDisasterKind;
  hasDamage?: boolean;
}> = ({ kind, hasDamage }) => {
  const meta = DISASTER_PANEL_MAP[kind] || DISASTER_PANEL_MAP.meteor_strike;
  const vx = meta.col * 688 + 10;
  const vy = meta.row * 384 + 10;

  return (
    <div className="relative w-full h-60 overflow-hidden bg-[#070d18] border-b border-[#b89758]/40">
      <svg
        viewBox={`${vx} ${vy} 668 364`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block brightness-105 saturate-110"
      >
        <image
          href={NATURAL_PHENOMENA_SHEET}
          width="1376"
          height="768"
          preserveAspectRatio="none"
        />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c1822] via-transparent to-[#070d18]/30 pointer-events-none" />
      <div className="absolute inset-2 rounded-xl border border-[#e6c983]/30 pointer-events-none" />

      <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
        <span
          className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-lg"
          style={{
            backgroundColor: 'rgba(9, 17, 29, 0.85)',
            borderColor: `${meta.accent}88`,
            color: meta.accent,
          }}
        >
          {meta.badge}
        </span>
      </div>

      <div className="absolute top-3.5 right-3.5">
        {hasDamage ? (
          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/60 backdrop-blur-md shadow-lg">
            ⚠ Destructive Shockwave
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 backdrop-blur-md shadow-lg">
            ✦ Scientific Phenomenon
          </span>
        )}
      </div>
    </div>
  );
};

function buildJigsawPiecePaths(vx: number, vy: number, W: number, H: number): string[] {
  const x0 = vx;
  const xm = vx + W * 0.5;
  const x1 = vx + W;
  const y0 = vy;
  const ym = vy + H * 0.5;
  const y1 = vy + H;
  const r = Math.round(Math.min(W, H) * 0.085);

  // Piece 0: Top-Left (right tab protrudes +r into Piece 1; bottom tab protrudes +r into Piece 2)
  const p0 = [
    `M ${x0} ${y0}`,
    `L ${xm} ${y0}`,
    `L ${xm} ${y0 + H * 0.16}`,
    `C ${xm + r * 0.25} ${y0 + H * 0.16}, ${xm + r} ${y0 + H * 0.11}, ${xm + r} ${y0 + H * 0.25}`,
    `C ${xm + r} ${y0 + H * 0.39}, ${xm + r * 0.25} ${y0 + H * 0.34}, ${xm} ${y0 + H * 0.34}`,
    `L ${xm} ${ym}`,
    `L ${x0 + W * 0.34} ${ym}`,
    `C ${x0 + W * 0.34} ${ym + r * 0.25}, ${x0 + W * 0.39} ${ym + r}, ${x0 + W * 0.25} ${ym + r}`,
    `C ${x0 + W * 0.11} ${ym + r}, ${x0 + W * 0.16} ${ym + r * 0.25}, ${x0 + W * 0.16} ${ym}`,
    `L ${x0} ${ym}`,
    'Z',
  ].join(' ');

  // Piece 1: Top-Right (left blank matches Piece 0's +r tab; bottom socket matches Piece 3's -r tab)
  const p1 = [
    `M ${xm} ${y0}`,
    `L ${x1} ${y0}`,
    `L ${x1} ${ym}`,
    `L ${xm + W * 0.34} ${ym}`,
    `C ${xm + W * 0.34} ${ym - r * 0.25}, ${xm + W * 0.39} ${ym - r}, ${xm + W * 0.25} ${ym - r}`,
    `C ${xm + W * 0.11} ${ym - r}, ${xm + W * 0.16} ${ym - r * 0.25}, ${xm + W * 0.16} ${ym}`,
    `L ${xm} ${ym}`,
    `L ${xm} ${y0 + H * 0.34}`,
    `C ${xm + r * 0.25} ${y0 + H * 0.34}, ${xm + r} ${y0 + H * 0.39}, ${xm + r} ${y0 + H * 0.25}`,
    `C ${xm + r} ${y0 + H * 0.11}, ${xm + r * 0.25} ${y0 + H * 0.16}, ${xm} ${y0 + H * 0.16}`,
    'Z',
  ].join(' ');

  // Piece 2: Bottom-Left (top socket matches Piece 0's +r tab; right socket matches Piece 3's -r tab)
  const p2 = [
    `M ${x0} ${ym}`,
    `L ${x0 + W * 0.16} ${ym}`,
    `C ${x0 + W * 0.16} ${ym + r * 0.25}, ${x0 + W * 0.11} ${ym + r}, ${x0 + W * 0.25} ${ym + r}`,
    `C ${x0 + W * 0.39} ${ym + r}, ${x0 + W * 0.34} ${ym + r * 0.25}, ${x0 + W * 0.34} ${ym}`,
    `L ${xm} ${ym}`,
    `L ${xm} ${ym + H * 0.16}`,
    `C ${xm - r * 0.25} ${ym + H * 0.16}, ${xm - r} ${ym + H * 0.11}, ${xm - r} ${ym + H * 0.25}`,
    `C ${xm - r} ${ym + H * 0.39}, ${xm - r * 0.25} ${ym + H * 0.34}, ${xm} ${ym + H * 0.34}`,
    `L ${xm} ${y1}`,
    `L ${x0} ${y1}`,
    'Z',
  ].join(' ');

  // Piece 3: Bottom-Right (top tab protrudes -r into Piece 1; left tab protrudes -r into Piece 2)
  const p3 = [
    `M ${xm} ${ym}`,
    `L ${xm + W * 0.16} ${ym}`,
    `C ${xm + W * 0.16} ${ym - r * 0.25}, ${xm + W * 0.11} ${ym - r}, ${xm + W * 0.25} ${ym - r}`,
    `C ${xm + W * 0.39} ${ym - r}, ${xm + W * 0.34} ${ym - r * 0.25}, ${xm + W * 0.34} ${ym}`,
    `L ${x1} ${ym}`,
    `L ${x1} ${y1}`,
    `L ${xm} ${y1}`,
    `L ${xm} ${ym + H * 0.34}`,
    `C ${xm - r * 0.25} ${ym + H * 0.34}, ${xm - r} ${ym + H * 0.39}, ${xm - r} ${ym + H * 0.25}`,
    `C ${xm - r} ${ym + H * 0.11}, ${xm - r * 0.25} ${ym + H * 0.16}, ${xm} ${ym + H * 0.16}`,
    'Z',
  ].join(' ');

  return [p0, p1, p2, p3];
}

function progressToPieceCount(pct: number): number {
  if (pct >= 100) return 4;
  if (pct >= 70) return 3;
  if (pct >= 38) return 2;
  if (pct > 0) return 1;
  return 0;
}

export const FeatureSpecimenBadge: React.FC<{ feature: NaturalFeatureType }> = ({ feature }) => {
  const meta: Record<
    NaturalFeatureType,
    { label: string; sub: string; bg: string; border: string; accent: string }
  > = {
    copper: {
      label: 'Native Copper & Malachite Vein',
      sub: 'Metallic Ore Specimen',
      bg: 'rgba(217, 119, 6, 0.18)',
      border: 'rgba(251, 191, 36, 0.5)',
      accent: '#f59e0b',
    },
    iron: {
      label: 'Hematite & Magnetite Iron Lode',
      sub: 'Ferrous Mineral Specimen',
      bg: 'rgba(148, 163, 184, 0.18)',
      border: 'rgba(203, 213, 225, 0.5)',
      accent: '#cbd5e1',
    },
    coal: {
      label: 'Bituminous Carbon Seam',
      sub: 'High-Heat Fuel Deposit',
      bg: 'rgba(51, 65, 85, 0.35)',
      border: 'rgba(249, 115, 22, 0.5)',
      accent: '#fb923c',
    },
    rare_flora: {
      label: 'Luminous Botanical Specimen',
      sub: 'Endemic Medicinal Flora',
      bg: 'rgba(16, 185, 129, 0.18)',
      border: 'rgba(52, 211, 153, 0.5)',
      accent: '#34d399',
    },
    fossils: {
      label: 'Petrified Megafauna Strata',
      sub: 'Paleontological Specimen',
      bg: 'rgba(234, 179, 8, 0.16)',
      border: 'rgba(253, 224, 71, 0.5)',
      accent: '#fde047',
    },
    geothermal_vent: {
      label: 'Pressurized Geothermal Fumarole',
      sub: 'Thermal & Sulfur Vent',
      bg: 'rgba(249, 115, 22, 0.18)',
      border: 'rgba(251, 146, 60, 0.55)',
      accent: '#fb923c',
    },
    ancient_ruins: {
      label: 'Weathered Precursor Reliquary',
      sub: 'Archaeological Artifact',
      bg: 'rgba(168, 85, 247, 0.18)',
      border: 'rgba(192, 132, 252, 0.5)',
      accent: '#c084fc',
    },
    natural_wonder: {
      label: 'Extraordinary Natural Marvel',
      sub: 'World Landmark',
      bg: 'rgba(56, 189, 248, 0.18)',
      border: 'rgba(103, 232, 249, 0.5)',
      accent: '#38bdf8',
    },
    none: {
      label: 'Field Observation',
      sub: 'Empirical Survey',
      bg: 'rgba(56, 189, 248, 0.15)',
      border: 'rgba(148, 163, 184, 0.4)',
      accent: '#38bdf8',
    },
  };

  const m = meta[feature] || meta.none;

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border"
      style={{ backgroundColor: m.bg, borderColor: m.border }}
    >
      <svg viewBox="0 0 44 44" className="w-11 h-11 shrink-0 rounded-lg bg-[#070d18]/90 border border-white/15 p-1">
        {feature === 'copper' && (
          <g>
            <polygon points="8,32 14,14 26,10 36,20 32,34 18,36" fill="#047857" stroke="#34d399" strokeWidth="1.4" />
            <polygon points="16,28 22,15 32,18 29,31" fill="#d97706" stroke="#fde047" strokeWidth="1.4" />
            <circle cx="25" cy="22" r="2.2" fill="#fef08a" />
          </g>
        )}
        {feature === 'iron' && (
          <g>
            <polygon points="9,32 13,14 25,11 36,19 33,34 17,35" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
            <polyline points="13,14 23,24 33,34" fill="none" stroke="#f8fafc" strokeWidth="1.5" />
            <circle cx="28" cy="17" r="2" fill="#38bdf8" />
          </g>
        )}
        {feature === 'coal' && (
          <g>
            <polygon points="8,31 14,13 27,12 36,22 31,35 16,35" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.4" />
            <path d="M16 28 Q22 21 29 27" stroke="#f97316" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </g>
        )}
        {feature === 'rare_flora' && (
          <g>
            <path d="M22 36 V14" stroke="#10b981" strokeWidth="2.4" />
            <circle cx="22" cy="14" r="6" fill="#34d399" fillOpacity="0.45" stroke="#6ee7b7" strokeWidth="1.4" />
            <circle cx="22" cy="14" r="2.5" fill="#fef08a" />
            <path d="M22 26 C14 26, 12 20, 15 16 C19 17, 22 21, 22 26 Z" fill="#10b981" />
            <path d="M22 23 C30 23, 32 17, 29 13 C25 14, 22 18, 22 23 Z" fill="#34d399" />
          </g>
        )}
        {feature === 'fossils' && (
          <g>
            <circle cx="22" cy="22" r="12" fill="#78350f" stroke="#fde047" strokeWidth="1.6" />
            <path d="M22 22 m-2 0 a 2 2 0 1 0 4 0 a 4 4 0 1 0 -8 0 a 6 6 0 1 0 12 0 a 8 8 0 1 0 -16 0" fill="none" stroke="#fef3c7" strokeWidth="1.6" />
          </g>
        )}
        {feature !== 'copper' &&
          feature !== 'iron' &&
          feature !== 'coal' &&
          feature !== 'rare_flora' &&
          feature !== 'fossils' && (
            <g>
              <polygon points="22,8 34,20 28,35 16,35 10,20" fill="#b45309" stroke="#fde047" strokeWidth="1.5" />
              <circle cx="22" cy="22" r="4.5" fill="#38bdf8" />
            </g>
          )}
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.accent }}>
          {m.sub}
        </div>
        <div className="text-sm font-bold text-white truncate">{m.label}</div>
      </div>
    </div>
  );
};

/**
 * Renders a Core Knowledge oil painting as an interlocking 4-piece Jigsaw Puzzle:
 * - Unrevealed pieces are rendered heavily blurred & veiled with jigsaw contours.
 * - Revealed piece(s) are rendered 100% crystal-clear, with the newly discovered puzzle brick
 *   highlighted by a glowing golden jigsaw bevel!
 */
export const CoreKnowledgePuzzlePlate: React.FC<{
  nodeId: string;
  progressBefore: number;
  progressAfter: number;
  accentColor: string;
}> = ({ nodeId, progressBefore, progressAfter, accentColor }) => {
  const art = CORE_ARTWORK_MAP[nodeId] || CORE_ARTWORK_MAP.copper_smelting;
  const cellH = art.rows === 2 ? 384 : 256;
  const vx = art.col * 344 + 8;
  const vy = art.row * cellH + 8;
  const vw = 328;
  const vh = cellH - 16;

  const piecePaths = buildJigsawPiecePaths(vx, vy, vw, vh);
  const prevPieces = progressToPieceCount(progressBefore);
  const nowPieces = Math.max(1, progressToPieceCount(progressAfter));

  const pieceCenters = [
    { x: vx + vw * 0.25, y: vy + vh * 0.25, label: 'Piece I' },
    { x: vx + vw * 0.75, y: vy + vh * 0.25, label: 'Piece II' },
    { x: vx + vw * 0.25, y: vy + vh * 0.75, label: 'Piece III' },
    { x: vx + vw * 0.75, y: vy + vh * 0.75, label: 'Piece IV' },
  ];

  const clipId = `puzzle_clear_clip_${nodeId}_${nowPieces}`;
  const blurFilterId = `puzzle_blur_filter_${nodeId}`;

  return (
    <div className="relative w-full h-64 overflow-hidden bg-[#060b14] border-b border-[#b89758]/40 select-none">
      <svg
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
      >
        <defs>
          {/* Strong Gaussian Blur + Desaturation for unrevealed puzzle pieces */}
          <filter id={blurFilterId} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="blurred" />
            <feColorMatrix
              in="blurred"
              type="matrix"
              values="0.45 0.15 0.15 0 0
                      0.15 0.45 0.15 0 0
                      0.15 0.15 0.50 0 0
                      0    0    0    1 0"
            />
          </filter>

          {/* Clip path containing ONLY the unlocked/revealed jigsaw puzzle bricks */}
          <clipPath id={clipId}>
            {piecePaths.slice(0, nowPieces).map((d, idx) => (
              <path key={`clip_${idx}`} d={d} />
            ))}
          </clipPath>
        </defs>

        {/* LAYER 1: Blurred & Veiled Full Artwork (shown in locked puzzle regions) */}
        <image
          href={CORE_KNOWLEDGE_SHEETS[art.sheet]}
          width="1376"
          height="768"
          preserveAspectRatio="none"
          filter={`url(#${blurFilterId})`}
        />
        <rect x={vx} y={vy} width={vw} height={vh} fill="rgba(7, 13, 25, 0.42)" />

        {/* LAYER 2: Frosted Jigsaw Outlines & Lock Markers on Unrevealed Pieces */}
        {piecePaths.map((d, idx) => {
          if (idx < nowPieces) return null;
          const c = pieceCenters[idx];
          return (
            <g key={`locked_${idx}`}>
              <path
                d={d}
                fill="rgba(9, 16, 28, 0.36)"
                stroke="rgba(148, 163, 184, 0.42)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <circle
                cx={c.x}
                cy={c.y}
                r="18"
                fill="rgba(9, 17, 29, 0.78)"
                stroke="rgba(255, 255, 255, 0.22)"
                strokeWidth="1.5"
              />
              <text
                x={c.x}
                y={c.y + 5}
                textAnchor="middle"
                fill="rgba(203, 213, 225, 0.72)"
                fontSize="15"
                fontWeight="700"
                fontFamily="Cinzel, serif"
              >
                ?
              </text>
            </g>
          );
        })}

        {/* LAYER 3: Crystal-Clear Unblurred Artwork inside Revealed Jigsaw Puzzle Pieces! */}
        <g clipPath={`url(#${clipId})`}>
          <image
            href={CORE_KNOWLEDGE_SHEETS[art.sheet]}
            width="1376"
            height="768"
            preserveAspectRatio="none"
          />
        </g>

        {/* LAYER 4: Glowing Jigsaw Borders around Revealed Pieces (especially newly snapped brick!) */}
        {piecePaths.slice(0, nowPieces).map((d, idx) => {
          const isNewlyUnlockedBrick = idx >= prevPieces || idx === nowPieces - 1;
          return (
            <path
              key={`clear_border_${idx}`}
              d={d}
              fill="none"
              stroke={isNewlyUnlockedBrick ? '#fde047' : accentColor}
              strokeWidth={isNewlyUnlockedBrick ? '3.4' : '2.0'}
              strokeOpacity={isNewlyUnlockedBrick ? '0.96' : '0.75'}
            />
          );
        })}
      </svg>

      {/* Top Overlay Badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <span
          className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-lg"
          style={{
            backgroundColor: 'rgba(9, 17, 29, 0.88)',
            borderColor: `${accentColor}88`,
            color: accentColor,
          }}
        >
          {nowPieces >= 4
            ? '★ 4 / 4 Puzzle Pieces · Full Discovery!'
            : `🧩 ${nowPieces} / 4 Puzzle Pieces Clear`}
        </span>
      </div>

      <div className="absolute top-3 right-3 pointer-events-none">
        <span className="px-2.5 py-1 rounded-md text-[11px] font-mono-tabular font-bold bg-amber-500/25 text-amber-200 border border-amber-400/60 backdrop-blur-md shadow-lg">
          {progressBefore}% → {progressAfter}%
        </span>
      </div>

      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-1 rounded bg-[#070d18]/85 border border-white/15 text-[11px] text-[#f8f3e6] font-medium truncate">
          {art.caption}
        </span>
      </div>
    </div>
  );
};
