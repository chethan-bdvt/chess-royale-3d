import { Chess } from 'chess.js';
import { bestMove, gameResult, getHint, legalTargets, positionScore } from '../engine';

describe('chess engine', () => {
  it('returns legal opening hints', () => {
    const game = new Chess();
    const hint = getHint(game.fen());
    expect(hint).not.toBeNull();
    expect(game.moves()).toContain(hint?.san);
  });

  it('returns legal computer moves at every difficulty', () => {
    const game = new Chess();
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = bestMove(game.fen(), level);
      expect(move).not.toBeNull();
      expect(game.moves()).toContain(move?.san);
    }
  });

  it('finds legal pawn targets', () => {
    expect(legalTargets(new Chess(), 'e2')).toEqual(expect.arrayContaining(['e3', 'e4']));
  });

  it('recognizes checkmate', () => {
    const game = new Chess();
    game.move('f3'); game.move('e5'); game.move('g4'); game.move('Qh4#');
    expect(gameResult(game)).toBe('Black wins by checkmate');
  });

  it('evaluates the initial position as equal', () => {
    expect(positionScore(new Chess())).toBe(0);
  });
});
