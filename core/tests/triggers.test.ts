import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';

// Task 8: trigger keywords (battlecry, deathrattle, start/end of turn, onDamage).
// Fixture notes (brief 060164e):
//  - battlecry drives the public applyEvent entry (the LAN/replay path), not
//    submit(playCard) — playCard resolution lands in Task 9.
//  - deathrattle/onDamage attack tests end the turn first so the ENEMY (player 1)
//    is the current player and may attack the player-0 creature.
//  - the startOfTurn artifact is placed mid-turn AFTER the mulligan turnStart, so
//    it fires exactly once on the next turn start.

describe('battlecry', () => {
  it('fires from a cardPlayed event (submit playCard path lands in Task 9)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[1].hero.hp = 30;
    // playCard resolution (mana/summon) is Task 9; here we drive the dispatch wiring
    // directly through the public applyEvent entry (the LAN/replay path):
    const evts = game.applyEvent({ type: 'cardPlayed', player: 0, cardId: 'bc-2dmg' });
    expect(game.state.players[1].hero.hp).toBe(28);
    expect(evts.some(e => e.type === 'effectResolved' && e.kind === 'dealDamage')).toBe(true);
  });
});

describe('deathrattle', () => {
  it('fires when the creature dies, even from enemy attack', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[1].hero.hp = 30;
    const dr = addCreature(game, 0, { id: 't-001', attack: 1, health: 1, keywords: [], trigger: 'deathrattle', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] });
    addCreature(game, 1, { id: 't-002', attack: 5, health: 5, keywords: [], exhausted: false });
    game.submit({ kind: 'endTurn' });          // enemy (player 1) turn → may attack
    game.submit({ kind: 'attack', attackerId: game.state.players[1].board[0]!.id, target: { type: 'creature', id: dr.id } });
    expect(game.state.players[1].hero.hp).toBe(29);          // deathrattle damage to hero
    expect(game.state.players[0].board).toHaveLength(0);     // dead
  });
});

describe('onDamage', () => {
  it('fires once per damage event (not per point)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[1].hero.hp = 30;
    const od = addCreature(game, 0, { id: 't-001', attack: 1, health: 5, keywords: [], trigger: 'onDamage', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] });
    addCreature(game, 1, { id: 't-002', attack: 2, health: 5, keywords: [], exhausted: false });
    game.submit({ kind: 'endTurn' });          // enemy (player 1) turn → may attack
    game.submit({ kind: 'attack', attackerId: game.state.players[1].board[0]!.id, target: { type: 'creature', id: od.id } });
    expect(game.state.players[1].hero.hp).toBe(29);          // ONE 2-damage event → onDamage fires once → 30 - 1 (retaliation damage to t-002 does not re-trigger od)
  });
  it('does not fire when a shield absorbs the damage (amount-0 events are skipped)', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[1].hero.hp = 30;
    const od = addCreature(game, 0, { id: 't-001', attack: 1, health: 5, keywords: ['shield'], trigger: 'onDamage', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] });
    addCreature(game, 1, { id: 't-002', attack: 2, health: 5, keywords: [], exhausted: false });
    game.submit({ kind: 'endTurn' });          // enemy (player 1) turn → may attack
    game.submit({ kind: 'attack', attackerId: game.state.players[1].board[0]!.id, target: { type: 'creature', id: od.id } });
    // shield absorbed the 2 damage → damageDealt amount 0 → onDamage must not fire
    expect(game.state.players[1].hero.hp).toBe(30);
  });
});

describe('start/end of turn', () => {
  it('startOfTurn artifacts fire for the active player', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] }); game.submit({ kind: 'mulligan', keep: [] });
    // p0's first turn already started; put the artifact on the board mid-turn,
    // then start a fresh turn so its startOfTurn trigger fires:
    game.state.players[0].artifacts.push({ id: 'a1', cardId: 'art-heal', owner: 0 });  // startOfTurn: heal 2 hero
    game.state.players[0].hero.hp = 25;
    game.submit({ kind: 'endTurn' });            // p1 turn
    game.state.players[1].hero.hp = 25;
    game.submit({ kind: 'endTurn' });            // back to p0 → startOfTurn heals p0
    expect(game.state.players[0].hero.hp).toBe(27);
  });
  it('endOfTurn creature triggers fire for the active player', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    addCreature(game, 0, { id: 't-001', attack: 1, health: 2, keywords: [], trigger: 'endOfTurn', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] });
    game.state.players[1].hero.hp = 30;
    game.submit({ kind: 'endTurn' });            // p0's end of turn → endOfTurn fires
    expect(game.state.players[1].hero.hp).toBe(29);
  });
  it('returns every follow-up event across multiple triggers (runQueue collector contract)', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] }); game.submit({ kind: 'mulligan', keep: [] });
    // TWO startOfTurn heal artifacts: the endTurn that returns to p0 fires two
    // nested drains inside one top-level dispatch — both heroHealed follow-ups
    // must be present in the returned events (applyEvent/submit contract).
    game.state.players[0].artifacts.push({ id: 'a1', cardId: 'art-heal', owner: 0 });
    game.state.players[0].artifacts.push({ id: 'a2', cardId: 'art-heal', owner: 0 });
    game.state.players[0].hero.hp = 25;
    game.submit({ kind: 'endTurn' });            // p1 turn
    game.state.players[1].hero.hp = 25;
    const evts = game.submit({ kind: 'endTurn' });   // back to p0 → both artifacts heal
    expect(game.state.players[0].hero.hp).toBe(29);  // 25 + 2 + 2 (state is correct either way)
    expect(evts.filter(e => e.type === 'heroHealed' && e.player === 0)).toHaveLength(2);
  });
});
