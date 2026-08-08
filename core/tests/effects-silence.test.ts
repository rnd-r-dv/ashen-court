import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('silence', () => {
  it('strips keywords from the target', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-a', attack: 4, health: 4, keywords: ['taunt', 'windfury'] });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.keywords).toHaveLength(0);
    expect(c.silenced).toBe(true);
  });

  it('suppresses the deathrattle of a silenced creature', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, {
      id: 't-rattler', attack: 1, health: 1,
      trigger: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-rat', value: 2 }],
    });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'destroy', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(game.state.players[1].board).toHaveLength(0);
  });
});
