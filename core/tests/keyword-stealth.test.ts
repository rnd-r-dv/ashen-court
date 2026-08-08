import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { legalIntents } from '../src/engine/intents.js';

describe('stealth', () => {
  it('is not a legal attack target for the enemy', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    addCreature(game, 0, { id: 't-att', attack: 3, health: 3, exhausted: false });
    const hidden = addCreature(game, 1, { id: 't-hidden', attack: 2, health: 2, keywords: ['stealth'] });

    const legal = legalIntents(game, 0);
    const hits = legal.filter(i => i.kind === 'attack' && i.target.type === 'creature' && i.target.id === hidden.id);
    expect(hits).toHaveLength(0);
  });

  it('rejects a crafted attack intent on a stealthed enemy with no taunt present', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // Attacker is itself stealthed so the "not revealed" assertion is
    // meaningful: a rejected attack must neither consume the swing nor reveal.
    const attacker = addCreature(game, 0, { id: 't-att', attack: 3, health: 3, keywords: ['stealth'], exhausted: false });
    const hidden = addCreature(game, 1, { id: 't-hidden', attack: 2, health: 2, keywords: ['stealth'] });
    // no taunt on either board — the taunt gate is not what rejects this

    expect(() => game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: hidden.id } })).toThrow();

    // rejected attack changes nothing: swing intact, attacker still hidden
    expect(attacker.attacksLeft).toBe(1);
    expect(attacker.keywords).toContain('stealth');
  });

  it('a stealthed taunt does not lock out attacks', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-att', attack: 3, health: 3, exhausted: false });
    const hiddenTaunt = addCreature(game, 1, { id: 't-hidden-taunt', attack: 2, health: 2, keywords: ['taunt', 'stealth'] });
    const visible = addCreature(game, 1, { id: 't-visible', attack: 1, health: 1 });

    // the stealthed taunt cannot be attacked and must not gate anything:
    // the non-stealthed creature stays a legal attack target
    const legal = legalIntents(game, 0);
    const visibleHits = legal.filter(i => i.kind === 'attack' && i.target.type === 'creature' && i.target.id === visible.id);
    expect(visibleHits).toHaveLength(1);

    // attacking the stealthed taunt directly via submit is rejected
    expect(() => game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: hiddenTaunt.id } })).toThrow();
  });

  it('loses stealth once it attacks', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const hidden = addCreature(game, 0, { id: 't-hidden', attack: 2, health: 4, keywords: ['stealth'], exhausted: false });
    addCreature(game, 1, { id: 't-victim', attack: 0, health: 6 });

    game.submit({ kind: 'attack', attackerId: hidden.id, target: { type: 'hero', player: 1 } });

    expect(hidden.keywords).not.toContain('stealth');
  });
});
