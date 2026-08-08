import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('consume', () => {
  it('destroys the given number of friendly tokens', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 3 });
    const real = addCreature(game, 0, { id: 't-real', attack: 2, health: 2 });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'consume', value: 2 });

    const board = game.state.players[0].board;
    expect(board.filter(c => c.token)).toHaveLength(1);
    // Non-token creatures are never eaten.
    expect(board.some(c => c.id === real.id)).toBe(true);
  });

  it('consumes what it can when short of tokens', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 1 });
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'consume', value: 3 });
    expect(game.state.players[0].board.filter(c => c.token)).toHaveLength(0);
  });
});
