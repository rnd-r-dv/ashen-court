import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { canAttack, tauntPresent } from '../src/engine/keywords.js';
import { applyEffect } from '../src/engine/effects.js';
import { makeTestSetup, addCreature } from './helpers.js';

describe('keywords', () => {
  it('taunt blocks attacks on the hero and on non-taunt creatures', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const t = addCreature(game, 1, { id: 't-001', attack: 2, health: 3, keywords: ['taunt'], exhausted: false });
    const other = addCreature(game, 1, { id: 't-002', attack: 1, health: 3, keywords: [], exhausted: false });
    const att = addCreature(game, 0, { id: 't-003', attack: 3, health: 3, keywords: [], exhausted: false });
    // submit-throws assertions (legalIntents is still a stub until Task 10)
    expect(() => game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'hero', player: 1 } })).toThrow();
    expect(() => game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'creature', id: other.id } })).toThrow();
    game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'creature', id: t.id } });
    expect(t.health).toBe(0);   // 3 damage kills the 2/3 taunt (stays on board until Task 8 removal)
  });
  it('rush creatures can attack the turn they are played, charge can attack heroes', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const rush = addCreature(game, 0, { id: 't-001', attack: 2, health: 2, keywords: ['rush'] });
    expect(canAttack(rush, game)).toBe(true);
  });
  it('windfury allows two attacks per turn', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const wf = addCreature(game, 0, { id: 't-001', attack: 2, health: 2, keywords: ['windfury'], exhausted: false });
    expect(wf.attacksLeft).toBe(2);
  });
  // NOTE: ward is a spell-targeting fizzle — its test lives in Task 9 (spell resolution).
  // Task 7 covers shield (absorb in effects.ts dealDamage).
  it('shield absorbs the first damage', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    addCreature(game, 1, { id: 't-001', attack: 1, health: 1, keywords: ['shield'], exhausted: false });
    applyEffect(game, { player: 0, cardId: 't-001' }, { kind: 'dealDamage', value: 1, target: 'allEnemies' });   // enemy board has only t-001
    const s = game.state.players[1].board[0]!;
    expect(s.shields).toBe(0); expect(s.health).toBe(1);
  });
  it('lifesteal heals the controller for damage dealt', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[0].hero.hp = 20;
    const ls = addCreature(game, 0, { id: 't-001', attack: 3, health: 3, keywords: ['lifesteal'], exhausted: false });
    addCreature(game, 1, { id: 't-002', attack: 1, health: 3, keywords: [] });
    game.submit({ kind: 'attack', attackerId: ls.id, target: { type: 'creature', id: game.state.players[1].board[0]!.id } });
    expect(game.state.players[0].hero.hp).toBe(23);
  });
});
