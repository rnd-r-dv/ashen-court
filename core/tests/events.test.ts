import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';

describe('applyEvent', () => {
  it('cardDrawn moves a card from deck to hand deterministically', () => {
    const game = Game.create(makeTestSetup());
    const p = game.state.players[0];
    const before = p.deck.length;
    const drawn = p.deck[p.deck.length - 1]!;
    game.applyEvent({ type: 'cardDrawn', player: 0, cardId: drawn });
    expect(p.deck.length).toBe(before - 1);
    expect(p.hand).toContain(drawn);
  });
  it('gameOver freezes further play', () => {
    const game = Game.create(makeTestSetup());
    game.applyEvent({ type: 'gameOver', winner: 0, reason: 'test' });
    expect(game.state.phase).toBe('gameOver');
  });
});
