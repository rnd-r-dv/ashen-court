import { describe, it, expect } from 'vitest';
import { Game } from '../../src/engine/game.js';
import { evaluate } from '../../src/bot/heuristic.js';
import { makeTestSetup, addCreature } from '../helpers.js';

describe('evaluate', () => {
  it('values a bigger board higher', () => {
    const a = Game.create(makeTestSetup()); const b = a.clone();
    addCreature(a, 0, { id: 't-001', attack: 3, health: 3, keywords: [] });
    expect(evaluate(a, 0)).toBeGreaterThan(evaluate(b, 0));
  });
  it('values higher own HP and lower enemy HP', () => {
    const a = Game.create(makeTestSetup()); const b = a.clone();
    b.state.players[0].hero.hp = 10; b.state.players[1].hero.hp = 30;
    expect(evaluate(a, 0)).toBeGreaterThan(evaluate(b, 0));
  });
  it('penalizes enemy taunts', () => {
    const a = Game.create(makeTestSetup()); const b = a.clone();
    addCreature(b, 1, { id: 't-002', attack: 1, health: 1, keywords: ['taunt'] });
    expect(evaluate(a, 0)).toBeGreaterThan(evaluate(b, 0));
  });
});
