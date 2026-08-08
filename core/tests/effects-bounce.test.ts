import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('returnToHand', () => {
  it('moves the creature off the board and into its owner hand', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-a', attack: 4, health: 4 });
    const handBefore = game.state.players[1].hand.length;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'returnToHand', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(game.state.players[1].board).toHaveLength(0);
    expect(game.state.players[1].hand).toHaveLength(handBefore + 1);
    expect(game.state.players[1].hand.at(-1)).toBe('t-a');
  });

  it('does not fire the deathrattle', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, {
      id: 't-rattler', attack: 1, health: 1,
      trigger: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-rat', value: 2 }],
    });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'returnToHand', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    // Bounced, not killed: no rats.
    expect(game.state.players[1].board).toHaveLength(0);
  });
});
