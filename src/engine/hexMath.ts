import { HexTile, UnitDef, UnitState } from '../types/game';

export const HEX_SIZE = 42;
export const HEX_SQRT3 = Math.sqrt(3);

export function tileKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseTileKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export type MapViewMode = 'isometric' | 'topdown';

export function getViewYScale(viewMode: MapViewMode = 'isometric'): number {
  return viewMode === 'isometric' ? 0.56 : 1.0;
}

export const ISO_Y_SCALE = 0.56;

export function axialToPixel(
  q: number,
  r: number,
  viewMode: MapViewMode = 'isometric'
): { x: number; y: number } {
  const yScale = getViewYScale(viewMode);
  const x = HEX_SIZE * (HEX_SQRT3 * q + (HEX_SQRT3 / 2) * r);
  const y = HEX_SIZE * (1.5 * r) * yScale;
  return { x, y };
}

export function pixelToAxial(
  px: number,
  py: number,
  viewMode: MapViewMode = 'isometric'
): { q: number; r: number } {
  const yScale = getViewYScale(viewMode);
  const unscaledY = py / yScale;
  const q = ((HEX_SQRT3 / 3) * px - (1 / 3) * unscaledY) / HEX_SIZE;
  const r = ((2 / 3) * unscaledY) / HEX_SIZE;
  return axialRound(q, r);
}

export function axialRound(q: number, r: number): { q: number; r: number } {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function hexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  return DIRECTIONS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

export function hexInRange(centerQ: number, centerR: number, radius: number): Array<{ q: number; r: number }> {
  const results: Array<{ q: number; r: number }> = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (
      let dr = Math.max(-radius, -dq - radius);
      dr <= Math.min(radius, -dq + radius);
      dr++
    ) {
      results.push({ q: centerQ + dq, r: centerR + dr });
    }
  }
  return results;
}

export function getTileMoveCost(
  tile: HexTile,
  unitDef: UnitDef,
  unit: UnitState | null,
  fromTile?: HexTile
): number {
  if (tile.biome === 'mountain') {
    // Only Scouts/Explorers with pathfinder or special cases can skirt high passes? Keep mountains impassable except for high sight
    return Infinity;
  }

  const isNaval = unitDef.role === 'naval';
  const isWater = tile.biome === 'ocean' || tile.biome === 'coast';

  if (isNaval) {
    if (!isWater) return Infinity;
    if (tile.biome === 'ocean' && !unitDef.canCrossOcean) return Infinity;
    return 1;
  }

  // Land unit entering water
  if (isWater) {
    if (tile.biome === 'coast') {
      // Land units can embark coastal shallow waters at full movement cost if they are explorers or later age, or cost 2
      return 2;
    }
    if (tile.biome === 'ocean') {
      if (unitDef.canCrossOcean) return 1;
      return Infinity;
    }
  }

  // Road bonus
  if (tile.hasRoad && fromTile?.hasRoad) {
    return 0.5;
  }

  // Scout / Explorer ignore rough penalty
  const ignoreRough =
    unitDef.role === 'scout' ||
    unitDef.role === 'explorer' ||
    (unit?.promotions.includes('pathfinder') ?? false);

  if (tile.biome === 'forest' || tile.biome === 'hills' || tile.biome === 'desert' || tile.biome === 'tundra') {
    return ignoreRough ? 1 : 2;
  }

  return 1;
}

export function getReachableHexes(
  startQ: number,
  startR: number,
  movesLeft: number,
  tiles: Record<string, HexTile>,
  unitDef: UnitDef,
  unit: UnitState,
  blockedKeys: Set<string>
): Map<string, { cost: number; parent: string | null }> {
  const startKey = tileKey(startQ, startR);
  const visited = new Map<string, { cost: number; parent: string | null }>();
  visited.set(startKey, { cost: 0, parent: null });

  const queue: Array<{ q: number; r: number; cost: number }> = [
    { q: startQ, r: startR, cost: 0 },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = tileKey(current.q, current.r);
    const currentTile = tiles[currentKey];

    for (const n of hexNeighbors(current.q, current.r)) {
      const nKey = tileKey(n.q, n.r);
      const nTile = tiles[nKey];
      if (!nTile) continue;
      if (blockedKeys.has(nKey)) continue;

      const stepCost = getTileMoveCost(nTile, unitDef, unit, currentTile);
      if (!Number.isFinite(stepCost)) continue;

      const effectiveStep = current.cost === 0 && stepCost > movesLeft && movesLeft > 0 ? movesLeft : stepCost;
      const nextCost = current.cost + effectiveStep;

      if (nextCost <= movesLeft + 0.01) {
        const prev = visited.get(nKey);
        if (!prev || nextCost < prev.cost) {
          visited.set(nKey, { cost: nextCost, parent: currentKey });
          queue.push({ q: n.q, r: n.r, cost: nextCost });
        }
      }
    }
  }

  visited.delete(startKey);
  return visited;
}
