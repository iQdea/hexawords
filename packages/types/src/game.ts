export enum GameMode {
  SINGLE = 'single',
  CAMPAIGN = 'campaign',
}

export enum GameComplexity {
  EASY = 'easy',
  MIDDLE = 'middle',
  HARD = 'hard',
  CRAZY = 'crazy',
}

export enum GameStatus {
  ACTIVE = 'active',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

/** Number of hexagons per complexity level. */
export const COMPLEXITY_HEX_COUNT: Record<GameComplexity, number> = {
  [GameComplexity.EASY]: 7,
  [GameComplexity.MIDDLE]: 5,
  [GameComplexity.HARD]: 4,
  [GameComplexity.CRAZY]: 3,
};

/** Letters per hexagon. */
export const CELLS_PER_HEX = 7;

export interface GameConfig {
  mode: GameMode;
  complexity?: GameComplexity;
  campaignLevel?: number;
  hexCount: number;        // number of full hexagons on the field
  cellsPerHex: number;     // letters per full hexagon (usually 7)
  minWordLength?: number;  // minimum word length (default 2)
  edgeHexCount?: number;   // number of edge half-hexagons (default 0)
  edgeHexType?: 'edge3' | 'edge4'; // edge hex type (default 'edge4')
}

export interface GameDTO {
  id: string;
  mode: GameMode;
  complexity?: GameComplexity;
  level?: number;
  status: GameStatus;
  score: number;
  wordCount: number;
  createdAt: string;
}

export interface WordResult {
  valid: boolean;
  word: string;
  points: number;
  reason?: 'not_adjacent' | 'not_in_dictionary' | 'already_found' | 'too_short' | 'same_hexagon';
}
