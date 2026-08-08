import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('overload', () => {
  it('locks mana on the controller next turn only', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].maxMana = 5;
    game.state.players[0].mana = 5;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'overload', value: 2 });
    expect(game.state.players[0].mana).toBe(5);   // this turn is unaffected

    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // back to player 0

    // maxMana rises to 6; 2 are locked, so 4 are available.
    expect(game.state.players[0].maxMana).toBe(6);
    expect(game.state.players[0].mana).toBe(4);

    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the lock has expired

    expect(game.state.players[0].mana).toBe(7);
  });
});
