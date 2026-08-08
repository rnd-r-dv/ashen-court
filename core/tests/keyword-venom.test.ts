import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';

describe('venom', () => {
  it('destroys any creature it damages, however large', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const snake = addCreature(game, 0, { id: 't-snake', attack: 1, health: 1, keywords: ['venom'], exhausted: false });
    const titan = addCreature(game, 1, { id: 't-titan', attack: 2, health: 12 });

    game.submit({ kind: 'attack', attackerId: snake.id, target: { type: 'creature', id: titan.id } });

    expect(game.state.players[1].board).toHaveLength(0);
  });

  it('does not trigger on zero damage', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const snake = addCreature(game, 0, { id: 't-snake', attack: 0, health: 3, keywords: ['venom'], exhausted: false });
    const titan = addCreature(game, 1, { id: 't-titan', attack: 1, health: 9 });

    game.submit({ kind: 'attack', attackerId: snake.id, target: { type: 'creature', id: titan.id } });

    expect(game.state.players[1].board).toHaveLength(1);
  });
});
