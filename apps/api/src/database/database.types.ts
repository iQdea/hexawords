// ─── ENUMS (match native PostgreSQL enum values) ────

export enum AuthProvider {
  EMAIL_PASSWORD = 'EMAIL_PASSWORD',
  PASSWORDLESS = 'PASSWORDLESS',
  ANONYMOUS = 'ANONYMOUS',
}

export enum GameMode {
  SINGLE = 'SINGLE',
  CAMPAIGN = 'CAMPAIGN',
}

export enum GameComplexity {
  EASY = 'EASY',
  MIDDLE = 'MIDDLE',
  HARD = 'HARD',
  CRAZY = 'CRAZY',
}

export enum GameStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  ABANDONED = 'ABANDONED',
}

// ─── ROW TYPES (match DB columns, snake_case) ───────

export interface CampaignLevelRow {
  level: number;
  hex_count: number;
  min_word_length: number;
  target_score: number;
  color_mode: boolean;
  locked_ratio: number;
  edge_hex_count: number;
  edge_hex_type: string;
}

export interface UserRow {
  id: string;
  created_at: Date;
  region: string;
}

export interface UserProfileRow {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
}

export interface UserAuthRow {
  id: string;
  user_id: string;
  email: string | null;
  password_hash: string | null;
  provider: AuthProvider;
  is_verified: boolean;
  refresh_token: string | null;
}

export interface GameRow {
  id: string;
  user_id: string;
  mode: GameMode;
  complexity: GameComplexity | null;
  level: number | null;
  status: GameStatus;
  score: number;
  word_count: number;
  hex_count: number;
  cells_per_hex: number;
  min_word_length: number;
  color_mode: boolean;
  edge_hex_count: number;
  created_at: Date;
  finished_at: Date | null;
}

export interface CellRow {
  id: string;
  game_id: string;
  hex_q: number;
  hex_r: number;
  slot: number;
  char: string;
  points: number;
  is_active: boolean;
  lock_type: string | null;
  variant: string | null;
}

export interface GameWordRow {
  id: string;
  game_id: string;
  word: string;
  points: number;
  cell_path: Array<{ hexQ: number; hexR: number; slot: number }>;
  created_at: Date;
}

export interface WordRow {
  word: string;
  freq: number;
  len: number;
}

export interface UserScoreRow {
  id: string;
  user_id: string;
  game_id: string;
  points: number;
}

export interface UserWordHistoryRow {
  id: string;
  user_id: string;
  word: string;
  points: number;
  mode: GameMode;
  created_at: Date;
}
