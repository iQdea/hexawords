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

/** A single letter cell inside a hexagon. */
export interface CellDTO {
  id: string;
  hexQ: number;
  hexR: number;
  slot: number;       // 0-6 position within the hexagon
  char: string;
  points: number;
  isActive: boolean;
}

export interface CellState {
  hexQ: number;
  hexR: number;
  slot: number;
  char: string;
  points: number;
  isActive: boolean;
}

/** Path element: which hexagon and which slot was picked. */
export interface WordPathStep {
  hexQ: number;
  hexR: number;
  slot: number;
}

export type CellPath = WordPathStep[];
