import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { applyEffect } from '../src/engine/effects.js';
import type { EffectCtx } from '../src/engine/effects.js';
import { makeTestSetup } from './helpers.js';

const g = () => Game.create(makeTestSetup());
const ctx: EffectCtx = { player: 0, cardId: 't-001' };

describe('dealDamage', () => {
  it('damages a creature and reduces health', () => {
    const game = g();
    game.state.phase = 'main';
    const c = game.state.players[0];
    // put a 3/3 on the board via direct state (test helper pattern)
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false });
    applyEffect(game, ctx, { kind: 'dealDamage', value: 2, target: 'anyCreature' });
    expect(c.board[0]!.health).toBe(1);
  });
  it('damaging a hero to 0 ends the game', () => {
    const game = g();
    game.state.phase = 'main';
    game.state.players[1].hero.hp = 2;
    applyEffect(game, ctx, { kind: 'dealDamage', value: 3, target: 'allEnemies' });   // allEnemies hits the enemy hero (enemy board empty)
    expect(game.state.phase).toBe('gameOver');
    expect(game.state.log.some(e => e.type === 'gameOver')).toBe(true);
  });
});

describe('draw', () => {
  it('draws N cards from the deck', () => {
    const game = g(); game.state.phase = 'main';
    const before = game.state.players[0].hand.length;
    applyEffect(game, ctx, { kind: 'draw', value: 2 });
    expect(game.state.players[0].hand.length).toBe(before + 2);
  });
  it('drawing from an empty deck draws nothing (no fatigue)', () => {
    const game = g(); game.state.phase = 'main';
    game.state.players[0].deck = [];
    applyEffect(game, ctx, { kind: 'draw', value: 5 });
    expect(game.state.players[0].hand.length).toBe(3);   // unchanged
  });
});

describe('heal / buff / summon / gainMana / freeze / destroy / copyCard / giveKeyword', () => {
  // Each asserts the obvious state change; e.g.:
  it('heal restores creature health up to max', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 1, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false });
    applyEffect(game, ctx, { kind: 'heal', value: 5, target: 'anyCreature' });
    expect(c.board[0]!.health).toBe(3);
  });
  it('buff adds attack and health, and maxHealth', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false });
    applyEffect(game, ctx, { kind: 'buff', value: 2, target: 'allFriendlyCreatures' });
    expect(c.board[0]!.attack).toBe(5); expect(c.board[0]!.health).toBe(5); expect(c.board[0]!.maxHealth).toBe(5);
  });
  it('summon puts a token creature from the registry on the board', () => {
    const game = g(); game.state.phase = 'main';
    applyEffect(game, ctx, { kind: 'summon', cardId: 't-001' });
    expect(game.state.players[0].board).toHaveLength(1);
  });
  it('gainMana adds an empty crystal, refillMana fills one', () => {
    const game = g(); game.state.phase = 'main';
    game.state.players[0].maxMana = 3; game.state.players[0].mana = 0;
    applyEffect(game, ctx, { kind: 'gainMana', value: 1 });
    expect(game.state.players[0].maxMana).toBe(4); expect(game.state.players[0].mana).toBe(0);
    applyEffect(game, ctx, { kind: 'refillMana', value: 1 });
    expect(game.state.players[0].mana).toBe(1);
  });
  it('freeze sets frozen, destroy removes without damage events', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false });
    applyEffect(game, ctx, { kind: 'freeze', target: 'anyCreature' });
    expect(c.board[0]!.frozen).toBe(true);
    applyEffect(game, ctx, { kind: 'destroy', target: 'anyCreature' });
    expect(c.board).toHaveLength(0);
  });
  it('copyCard adds a card object to hand', () => {
    const game = g(); game.state.phase = 'main';
    applyEffect(game, ctx, { kind: 'copyCard', cardId: 't-001' });
    expect(game.state.players[0].hand).toContain('t-001');
  });
  it('giveKeyword grants a keyword to target creature', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false });
    applyEffect(game, ctx, { kind: 'giveKeyword', keyword: 'taunt', target: 'anyCreature' });
    expect(c.board[0]!.keywords).toContain('taunt');
  });
});
