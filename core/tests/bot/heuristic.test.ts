import { describe, it, expect } from 'vitest';
import { Game } from '../../src/engine/game.js';
import { evaluate } from '../../src/bot/heuristic.js';
import { Veteran, Grandmaster } from '../../src/bot/policies.js';
import type { Card } from '../../src/types.js';
import { makeTestSetup, addCreature } from '../helpers.js';

/** Synthetic 1-cost creature card for play-decision fixtures. */
const card = (id: string, attack: number, health: number, reflect: number): Card => ({
  id,
  name: `Test ${id}`,
  type: 'creature',
  cost: 1,
  attack,
  health,
  reflect,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
  author: 'curated',
  version: 1,
});

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
  it('golden value: pins evaluate() to the locked formula on a fixed state (audit 03 M3)', () => {
    // Any weight/sign regression that preserves monotonicity (1.3→1.2,
    // hp-diff ×2→×1, dropping hand/maxMana terms, enemy-taunt sign flip)
    // passes the relational tests above — this one pins an exact number,
    // hand-computed from the locked formula (task brief):
    //   board(p) = Σ(atk*1.25 + reflect*0.75 + hp + taunt?2 + lifesteal?2 + windfury?2)
    //   score = board(me) - board(foe)*1.3 + (hpMe-hpFoe)*2 + hand*1.2
    //         + maxMana*0.3 + (boardCountMe-boardCountFoe)*0.5 + enemyTaunts*1.5
    // Task 1: reflect defaults to attack on these fixtures, so
    // atk*1.25 + reflect*0.75 = atk*2 — the pinned value is unchanged.
    const game = Game.create(makeTestSetup());
    game.state.players[0].hero.hp = 25;
    game.state.players[1].hero.hp = 20;
    game.state.players[0].hand = [];
    game.state.players[1].hand = [];
    game.state.players[0].deck = [];
    game.state.players[1].deck = [];
    game.state.players[0].maxMana = 6;
    game.state.players[1].maxMana = 5;
    // own board: 3/4 taunt (3*2+4+2 = 12) + 2/2 lifesteal (2*2+2+2 = 8) → 20
    addCreature(game, 0, { id: 'g-001', attack: 3, health: 4, keywords: ['taunt'] });
    addCreature(game, 0, { id: 'g-002', attack: 2, health: 2, keywords: ['lifesteal'] });
    // enemy board: 4/3 windfury (4*2+3+2 = 13) + 1/1 taunt (1*2+1+2 = 5) → 18
    addCreature(game, 1, { id: 'g-003', attack: 4, health: 3, keywords: ['windfury'] });
    addCreature(game, 1, { id: 'g-004', attack: 1, health: 1, keywords: ['taunt'] });
    // 20 - 18*1.3 + (25-20)*2 + 0*1.2 + 6*0.3 + (2-2)*0.5 + 1*1.5 = 9.9
    // (toBeCloseTo, not toBe: 18*1.3 + 6*0.3 are not binary-exact floats.)
    expect(evaluate(game, 0)).toBeCloseTo(9.9, 10);
  });
  // Task 1: Reflect is worth 0.75 per point — defensive value, less than the
  // 1.25 Attack carries, and never credited as hero damage.
  it('values Reflect as defensive worth: a higher-Reflect creature is worth more on board', () => {
    const a = Game.create(makeTestSetup()); const b = a.clone();
    addCreature(a, 0, { id: 't-001', attack: 2, health: 3, reflect: 0 });
    addCreature(b, 0, { id: 't-001', attack: 2, health: 3, reflect: 4 });
    expect(evaluate(b, 0)).toBeGreaterThan(evaluate(a, 0));
  });
  it('Veteran/Grandmaster play the higher-Reflect creature when other dimensions are equal', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.registry.register(card('t-low', 2, 2, 0));
    game.registry.register(card('t-high', 2, 2, 5));
    game.state.players[0].mana = 1;
    game.state.players[0].hand = ['t-low', 't-high'];
    // both 1-cost 2/2s are playable; the higher-Reflect one is the better
    // defender (same body, +5 * 0.75 board value), so both policies play it
    expect(Veteran.chooseIntent(game, 0)).toMatchObject({ kind: 'playCard', handIndex: 1 });
    expect(Grandmaster.chooseIntent(game, 0)).toMatchObject({ kind: 'playCard', handIndex: 1 });
  });
  it('hero attacks ignore Reflect — the higher-Attack creature takes lethal', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[1].hero.hp = 4;
    const weak = addCreature(game, 0, { id: 't-w', attack: 1, health: 5, reflect: 10, keywords: ['charge'] });
    const strong = addCreature(game, 0, { id: 't-s', attack: 4, health: 5, reflect: 0, keywords: ['charge'] });
    // lethal through Attack wins: Reflect must never be credited as hero damage
    const intent = Veteran.chooseIntent(game, 0);
    expect(intent.kind).toBe('attack');
    if (intent.kind === 'attack') {
      expect(intent.attackerId).toBe(strong.id);
      expect(intent.attackerId).not.toBe(weak.id);
      expect(intent.target).toEqual({ type: 'hero', player: 1 });
    }
  });
});
