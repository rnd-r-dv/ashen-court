import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('spellPower', () => {
  it('adds to spell damage but not to attack damage', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const mage = addCreature(game, 0, { id: 't-mage', attack: 1, health: 4 });
    mage.spellPower = 2;
    const victim = addCreature(game, 1, { id: 't-victim', attack: 0, health: 10 });

    // A SPELL (no source creature) deals 3 + 2 = 5.
    applyEffect(game, { player: 0, cardId: 'a-spell' }, { kind: 'dealDamage', value: 3, target: 'enemyCreature' }, { type: 'creature', id: victim.id });
    expect(victim.health).toBe(5);
  });

  it('does not boost a creature battlecry', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const mage = addCreature(game, 0, { id: 't-mage', attack: 1, health: 4 });
    mage.spellPower = 2;
    const victim = addCreature(game, 1, { id: 't-victim', attack: 0, health: 10 });

    applyEffect(
      game,
      { player: 0, cardId: 'a-creature', creatureId: mage.id },
      { kind: 'dealDamage', value: 3, target: 'enemyCreature' },
      { type: 'creature', id: victim.id },
    );
    expect(victim.health).toBe(7);
  });
});
