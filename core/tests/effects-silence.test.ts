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

  it('strips an existing shield charge — a silenced shield creature takes damage', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-b', attack: 3, health: 3, keywords: ['shield'] });
    expect(c.shields).toBe(1);

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'dealDamage', value: 1, target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.shields).toBe(0);
    expect(c.health).toBe(2);   // the damage landed, not absorbed
  });

  it('clears ward', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-c', attack: 2, health: 2, keywords: ['ward'] });
    expect(c.warded).toBe(true);

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.warded).toBe(false);
  });

  it('clamps a fresh windfury creature to one attack', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-d', attack: 2, health: 2, keywords: ['windfury'], exhausted: false });
    expect(c.attacksLeft).toBe(2);

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.attacksLeft).toBe(1);   // clamp to 1, never set
  });

  it('does not refund swings spent before the silence', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-e', attack: 2, health: 2, keywords: ['windfury'], exhausted: false });
    c.attacksLeft = 0;   // already swung twice this turn

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.attacksLeft).toBe(0);
  });
});
