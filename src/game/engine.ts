import { Chess, type Move, type Square } from 'chess.js';
import type { Difficulty, Hint } from '../types';

const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20_000 };
const center = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'd4', 'e4', 'f4', 'c5', 'd5', 'e5', 'f5', 'c6', 'd6', 'e6', 'f6']);

export function positionScore(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === 'w' ? -100_000 : 100_000;
  if (game.isDraw()) return 0;
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const file = String.fromCharCode(97 + piece.square.charCodeAt(0) - 97);
      const square = `${file}${piece.square[1]}`;
      const positional = center.has(square) && piece.type !== 'k' ? 12 : 0;
      score += ((values[piece.type] ?? 0) + positional) * (piece.color === 'w' ? 1 : -1);
    }
  }
  return score;
}

function search(game: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || game.isGameOver()) return positionScore(game);
  const maximizing = game.turn() === 'w';
  let best = maximizing ? -Infinity : Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    const score = search(game, depth - 1, alpha, beta);
    game.undo();
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function rankedMoves(fen: string, depth = 2): Hint[] {
  const game = new Chess(fen);
  const maximizing = game.turn() === 'w';
  return game.moves({ verbose: true }).map((move) => {
    game.move(move);
    const score = search(game, Math.max(0, depth - 1), -Infinity, Infinity);
    game.undo();
    return { from: move.from, to: move.to, san: move.san, score };
  }).sort((a, b) => maximizing ? b.score - a.score : a.score - b.score);
}

export function bestMove(fen: string, difficulty: Difficulty): Move | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  const depth = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
  const ranked = rankedMoves(fen, depth);
  const poolSize = difficulty === 'easy' ? Math.min(6, ranked.length) : difficulty === 'medium' ? Math.min(2, ranked.length) : 1;
  const chosen = ranked[Math.floor(Math.random() * poolSize)] ?? ranked[0];
  return moves.find((move) => move.from === chosen?.from && move.to === chosen.to) ?? moves[0] ?? null;
}

export function getHint(fen: string): Hint | null {
  return rankedMoves(fen, 3)[0] ?? null;
}

export function legalTargets(game: Chess, square: Square): Square[] {
  return game.moves({ square, verbose: true }).map((move) => move.to);
}

export function gameResult(game: Chess): string | null {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  if (game.isStalemate()) return 'Draw by stalemate';
  if (game.isThreefoldRepetition()) return 'Draw by repetition';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material';
  if (game.isDrawByFiftyMoves()) return 'Draw by fifty-move rule';
  if (game.isDraw()) return 'Draw';
  return null;
}
