import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import type { GameEvent } from '../src/types.js';
import { makeTestSetup, addCreature } from './helpers.js';

describe('simultaneous combat', () => {
  it('a defender killed outright still deals its attack back', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 5, health: 2, exhausted: false });
    const defender = addCreature(game, 1, { id: 't-b', attack: 4, health: 4 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    // 5 >= 4 kills the defender; 4 >= 2 must still kill the attacker.
    expect(game.state.players[1].board).toHaveLength(0);
    expect(game.state.players[0].board).toHaveLength(0);
  });

  it('emits one combatStarted cue with both ids, before either damage event', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 5, health: 2, exhausted: false });
    const defender = addCreature(game, 1, { id: 't-b', attack: 4, health: 4 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    const log = game.state.log;
    const started = log.filter((e) => e.type === 'combatStarted');
    // Exactly one cue for this exchange, carrying BOTH combatant ids in one
    // record — triggers/deaths resolving between the two damage events can
    // never split the visual strike (Task 8).
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ attackerId: attacker.id, defenderId: defender.id });
    const startedIdx = log.findIndex((e) => e.type === 'combatStarted');
    const dmgIdx = log
      .map((e, i) => (e.type === 'damageDealt' ? i : -1))
      .filter((i) => i !== -1);
    expect(dmgIdx.length).toBeGreaterThanOrEqual(2);
    expect(startedIdx).toBeLessThan(dmgIdx[0]!);
    // The cue is a log-only marker — no state, no RNG draw.
    expect(log.filter((e) => e.type === 'combatStarted')).toHaveLength(1);
  });

  it('a hero attack emits no combatStarted (creature combat only)', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 3, exhausted: false });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'hero', player: 1 } });

    expect(game.state.log.filter((e) => e.type === 'combatStarted')).toHaveLength(0);
  });

  it('a zero-attack wall still deals nothing back', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 3, exhausted: false });
    const wall = addCreature(game, 1, { id: 't-b', attack: 0, health: 6 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: wall.id } });

    expect(wall.health).toBe(3);
    expect(attacker.health).toBe(3);
  });

  it('a surviving defender still retaliates', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 3, exhausted: false });
    const defender = addCreature(game, 1, { id: 't-b', attack: 2, health: 5 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    expect(defender.health).toBe(2);
    expect(attacker.health).toBe(1);
  });

  // Task 1: Reflect is the DEFENSIVE counter-damage stat. Attack decides the
  // initiating damage a creature deals; Reflect decides the damage it deals
  // back when it is attacked. The two are captured simultaneously before
  // either lands (see the rationale on submit/attack).
  it('counter-damage comes from Reflect, not the defender\'s Attack', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // 5-Attack/2-Reflect attacker vs 1-Attack/4-Reflect defender (brief).
    const attacker = addCreature(game, 0, { id: 't-a', attack: 5, health: 8, exhausted: false, reflect: 2 });
    const defender = addCreature(game, 1, { id: 't-b', attack: 1, health: 4, reflect: 4 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    // attacker deals its Attack 5 (defender 4 → dies); defender reflects 4.
    expect(game.state.players[1].board).toHaveLength(0);
    expect(attacker.health).toBe(8 - 4);
    // exactly one damage event per side, each carrying the initiating/reflected amount
    const dmg = game.state.log.filter(
      (e): e is Extract<GameEvent, { type: 'damageDealt' }> =>
        e.type === 'damageDealt' && e.target.type === 'creature',
    );
    expect(dmg).toHaveLength(2);
    expect(dmg.some(e => e.target.type === 'creature' && e.target.id === defender.id && e.amount === 5)).toBe(true);
    expect(dmg.some(e => e.target.type === 'creature' && e.target.id === attacker.id && e.amount === 4)).toBe(true);
  });

  it('both damage events are emitted even when one creature dies', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 5, health: 10, exhausted: false, reflect: 2 });
    const defender = addCreature(game, 1, { id: 't-b', attack: 1, health: 1, reflect: 4 });

    const evts = game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    // the defender dies to 5 but still reflects its 4 before leaving the board
    expect(game.state.players[1].board).toHaveLength(0);
    expect(attacker.health).toBe(6);
    const dmg = evts.filter(
      (e): e is Extract<GameEvent, { type: 'damageDealt' }> =>
        e.type === 'damageDealt' && e.target.type === 'creature',
    );
    expect(dmg.map(e => e.amount).sort()).toEqual([4, 5]);
  });

  it('defender lifesteal heals from Reflect damage, not the defender\'s Attack', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 5, exhausted: false, reflect: 1 });
    const defender = addCreature(game, 1, { id: 't-b', attack: 1, health: 4, reflect: 2, keywords: ['lifesteal'] });
    game.state.players[1].hero.hp = 25;

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    // the defender survived (3 < 4) and reflected its Reflect 2 — the source
    // stays the defender, so its lifesteal heals its controller for the 2.
    expect(attacker.health).toBe(3);
    expect(game.state.players[1].hero.hp).toBe(27);
  });

  it('hero attacks deal Attack damage — Reflect never reaches the hero', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 4, health: 3, exhausted: false, reflect: 9 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'hero', player: 1 } });

    expect(game.state.players[1].hero.hp).toBe(26);   // 4, not 9
    expect(attacker.health).toBe(3);                  // no counter-damage to the attacker
  });
});
