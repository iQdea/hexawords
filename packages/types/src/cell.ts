export interface AxialCoord {
  q: number;
  r: number;
}

/** A hexagon on the game field, containing multiple letter slots. */
export interface HexagonDTO {
  q: number;
  r: number;
  cells: CellDTO[];
}

export type CellVariant = 'light' | 'dark' | null;

/**
 * Lock types:
 * - gray: unlocked when ANY cell in same hexagon is used
 * - blue: unlocked when CENTER cell (slot 0) is used
 * - purple: unlocked when a neighboring ring cell (not center) is used
 * - orange: unlocked when BOTH center AND an adjacent ring cell are used
 */
export type LockType = 'gray' | 'blue' | 'purple' | 'orange' | null;

/** A single letter cell inside a hexagon. */
export interface CellDTO {
  id: string;
  hexQ: number;
  hexR: number;
  slot: number;       // 0-6 position within the hexagon
  char: string;
  points: number;
  isActive: boolean;
  lockType: LockType;
  variant: CellVariant;
}

export interface CellState {
  hexQ: number;
  hexR: number;
  slot: number;
  char: string;
  points: number;
  isActive: boolean;
  lockType: LockType;
  variant: CellVariant;
}

/** Path element: which hexagon and which slot was picked. */
export interface WordPathStep {
  hexQ: number;
  hexR: number;
  slot: number;
}

export type CellPath = WordPathStep[];
