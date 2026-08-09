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
    // The spent lock stays visible for the ledger this whole turn.
    expect(game.state.players[0].lockedMana).toBe(2);

    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the lock has expired

    expect(game.state.players[0].mana).toBe(7);
    expect(game.state.players[0].lockedMana).toBe(0);
  });

  it('keeps lockedMana known after mana is spent in the locked turn', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].maxMana = 5;
    game.state.players[0].mana = 5;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'overload', value: 2 });
    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the locked turn: 6 max, 4 free

    expect(game.state.players[0].lockedMana).toBe(2);
    expect(game.state.players[0].mana).toBe(4);

    // Spend 3 of the 4 available mana on a real creature (t-001: 3-cost 3/3).
    game.state.players[0].hand = ['t-001'];
    game.submit({ kind: 'playCard', handIndex: 0 });

    expect(game.state.players[0].mana).toBe(1);
    // The lock is spent overload, not unspent mana: spending never clears it.
    expect(game.state.players[0].lockedMana).toBe(2);
  });

  it('carries lockedMana through serialize/deserialize', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].maxMana = 5;
    game.state.players[0].mana = 5;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'overload', value: 2 });
    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the locked turn

    expect(game.state.players[0].lockedMana).toBe(2);

    const restored = Game.deserialize(game.serialize(), game.registry);
    expect(restored.state.players[0].lockedMana).toBe(2);
    expect(restored.state.players[0].mana).toBe(4);

    // The deserialized game keeps the same lifecycle: the lock expires on
    // the next turn boundary exactly as it would have in the live game.
    restored.submit({ kind: 'endTurn' });
    restored.submit({ kind: 'endTurn' });
    expect(restored.state.players[0].lockedMana).toBe(0);
    expect(restored.state.players[0].mana).toBe(7);
  });

  it('clears lockedMana the moment the locked turn ends', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].maxMana = 5;
    game.state.players[0].mana = 5;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'overload', value: 2 });
    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the locked turn
    expect(game.state.players[0].lockedMana).toBe(2);

    // The lock belongs to the turn it locked: it disappears at turnEnd, so
    // the opponent's turn shows no struck-through pips on this player's tray.
    game.submit({ kind: 'endTurn' });
    expect(game.state.players[0].lockedMana).toBe(0);
  });
});
