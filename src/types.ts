import type { Color, Move, Square } from 'chess.js';

export type GameMode = 'computer' | 'local' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type OnlineStatus = 'idle' | 'creating' | 'joining' | 'waiting' | 'playing' | 'error';

export interface GameSettings {
  haptics: boolean;
  showLegalMoves: boolean;
  autoRotate: boolean;
}

export interface SavedGame {
  fen: string;
  pgn: string;
  mode: GameMode;
  difficulty: Difficulty;
  updatedAt: number;
}

export interface Hint {
  from: Square;
  to: Square;
  san: string;
  score: number;
}

export interface OnlineRoom {
  id: string;
  fen: string;
  pgn: string;
  hostId: string;
  guestId?: string;
  whiteId: string;
  status: 'waiting' | 'playing' | 'finished';
  turn: Color;
  result?: string;
  updatedAt: number;
  lastMove?: Pick<Move, 'from' | 'to' | 'promotion'>;
}
