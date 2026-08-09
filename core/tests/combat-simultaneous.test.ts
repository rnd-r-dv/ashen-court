import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
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
});
