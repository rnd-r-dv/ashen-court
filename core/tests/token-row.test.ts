import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('token row', () => {
  it('tokens do not consume creature slots', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // Fill all 7 creature slots.
    for (let i = 0; i < 7; i++) {
      addCreature(game, 0, { id: `t-fill-${i}`, attack: 1, health: 1 });
    }
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 5 });

    const board = game.state.players[0].board;
    expect(board.filter(c => !c.token)).toHaveLength(7);
    expect(board.filter(c => c.token)).toHaveLength(5);
  });

  it('token summons clamp at TOKEN_CAP, not BOARD_CAP', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 99 });
    expect(game.state.players[0].board.filter(c => c.token)).toHaveLength(7);
  });
});
