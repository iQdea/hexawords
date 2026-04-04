import type { CellDTO, WordPathStep } from './cell';

export interface ServerToClientEvents {
  'cell:update': (data: CellUpdateEvent) => void;
  'cell:respawned': (data: CellsRespawnedEvent) => void;
  'score:update': (data: ScoreUpdateEvent) => void;
  'word:invalid': (data: WordInvalidEvent) => void;
  'game:finished': (data: GameFinishedEvent) => void;
}

export interface ClientToServerEvents {
  'game:join': (data: { gameId: string }) => void;
}

export interface CellUpdateEvent {
  gameId: string;
  cell: CellDTO;
}

export interface CellsRespawnedEvent {
  gameId: string;
  cells: CellDTO[];
}

export interface ScoreUpdateEvent {
  gameId: string;
  score: number;
  wordCount: number;
  word: string;
  wordPoints: number;
}

export interface WordInvalidEvent {
  gameId: string;
  word: string;
  reason: string;
}

export interface GameFinishedEvent {
  gameId: string;
  finalScore: number;
  wordsFound: number;
}
