import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';

describe('start-of-turn mana', () => {
  it('a startOfTurn gainMana artifact stacks on top of the turn crystal', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // Register an artifact whose startOfTurn trigger grants an empty crystal.
    game.registry.register({
      id: 'ramp-relic', name: 'Ramp Relic', type: 'artifact', cost: 3,
      keywords: [], effects: [],
      triggers: [{ when: 'startOfTurn', effects: [{ kind: 'gainMana', value: 1 }] }],
      rarity: 'rare', archetype: 'neutral',
      art: { preset: 'arcane', palette: ['#000', '#fff'], seed: 1 },
      author: 'curated', version: 1,
    });
    game.state.players[0].artifacts.push({ id: 'art-1', cardId: 'ramp-relic', owner: 0 });

    const before = game.state.players[0].maxMana;
    game.submit({ kind: 'endTurn' });   // player 0 -> 1
    game.submit({ kind: 'endTurn' });   // player 1 -> 0, beginTurn(0) runs
    const after = game.state.players[0].maxMana;

    // +1 for the turn, +1 for the artifact.
    expect(after).toBe(before + 2);
  });
});
