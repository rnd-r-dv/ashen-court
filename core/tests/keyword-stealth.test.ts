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

  it('loses stealth once it attacks', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const hidden = addCreature(game, 0, { id: 't-hidden', attack: 2, health: 4, keywords: ['stealth'], exhausted: false });
    addCreature(game, 1, { id: 't-victim', attack: 0, health: 6 });

    game.submit({ kind: 'attack', attackerId: hidden.id, target: { type: 'hero', player: 1 } });

    expect(hidden.keywords).not.toContain('stealth');
  });
});
