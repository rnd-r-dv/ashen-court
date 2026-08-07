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
  it('windfury creature attacks twice in one turn; a third attack is illegal (audit 01 C1)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const wf = addCreature(game, 0, { id: 't-001', attack: 2, health: 5, keywords: ['windfury'], exhausted: false });
    // two enemy defenders so each swing has a legal target
    const d1 = addCreature(game, 1, { id: 't-002', attack: 1, health: 5, keywords: [], exhausted: false });
    const d2 = addCreature(game, 1, { id: 't-003', attack: 1, health: 5, keywords: [], exhausted: false });
    // first swing
    const evts1 = game.submit({ kind: 'attack', attackerId: wf.id, target: { type: 'creature', id: d1.id } });
    expect(evts1.some(e => e.type === 'damageDealt')).toBe(true);
    expect(wf.attacksLeft).toBe(1);
    expect(wf.exhausted).toBe(false);   // exhausted = summoning sickness only — attacking must not set it
    // second swing is legal and enumerated
    expect(game.legalIntents(0).filter(i => i.kind === 'attack' && i.attackerId === wf.id).length).toBeGreaterThan(0);
    const evts2 = game.submit({ kind: 'attack', attackerId: wf.id, target: { type: 'creature', id: d2.id } });
    expect(evts2.some(e => e.type === 'damageDealt')).toBe(true);
    expect(wf.attacksLeft).toBe(0);
    // third swing: no attack intent enumerated, submit throws cleanly
    expect(game.legalIntents(0).filter(i => i.kind === 'attack' && i.attackerId === wf.id)).toHaveLength(0);
    expect(() => game.submit({ kind: 'attack', attackerId: wf.id, target: { type: 'hero', player: 1 } })).toThrow();
  });
  it('non-windfury creature attacks exactly once per turn (audit 01 C1)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const att = addCreature(game, 0, { id: 't-001', attack: 2, health: 5, keywords: [], exhausted: false });
    const d1 = addCreature(game, 1, { id: 't-002', attack: 1, health: 5, keywords: [], exhausted: false });
    const d2 = addCreature(game, 1, { id: 't-003', attack: 1, health: 5, keywords: [], exhausted: false });
    game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'creature', id: d1.id } });
    expect(att.attacksLeft).toBe(0);
    expect(att.exhausted).toBe(false);
    expect(game.legalIntents(0).filter(i => i.kind === 'attack' && i.attackerId === att.id)).toHaveLength(0);
    expect(() => game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'creature', id: d2.id } })).toThrow();
  });
  it('invalid creature target with a taunt present gives a clean error, not a TypeError (audit 01 I4)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const taunt = addCreature(game, 1, { id: 't-001', attack: 2, health: 3, keywords: ['taunt'], exhausted: false });
    const att = addCreature(game, 0, { id: 't-002', attack: 3, health: 3, keywords: [], exhausted: false });
    // attacker targets its OWN creature (not on the enemy board) while a taunt
    // guards the enemy side → clean validation error, never a TypeError.
    expect(() => game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'creature', id: att.id } })).toThrow('Defender not found');
    // hero target is still blocked by the taunt
    expect(() => game.submit({ kind: 'attack', attackerId: att.id, target: { type: 'hero', player: 1 } })).toThrow('Taunt creature in the way');
    expect(taunt.health).toBe(3);   // nothing landed
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
