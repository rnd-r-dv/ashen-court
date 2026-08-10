import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { applyEffect } from '../src/engine/effects.js';
import type { EffectCtx } from '../src/engine/effects.js';
import { summarize } from '../src/engine/stats.js';
import { makeTestSetup, addCreature } from './helpers.js';

const g = () => Game.create(makeTestSetup());
const ctx: EffectCtx = { player: 0, cardId: 't-001' };

describe('dealDamage', () => {
  it('damages a creature and reduces health', () => {
    const game = g();
    game.state.phase = 'main';
    const c = game.state.players[0];
    // put a 3/3 on the board via direct state (test helper pattern)
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
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
  it('hero damage emits heroDamaged and summarize counts it on a real log (audit 01 I1)', () => {
    const game = g();
    game.state.phase = 'main';
    game.state.players[0].mana = 10;
    game.state.players[0].hand.unshift('bc-2dmg');   // battlecry: deal 2 to allEnemies
    const evts = game.submit({ kind: 'playCard', handIndex: 0 });   // enemy board empty → hero hit
    expect(evts.some(e => e.type === 'heroDamaged' && e.player === 1 && e.amount === 2)).toBe(true);
    expect(evts.some(e => e.type === 'damageDealt' && e.target.type === 'hero' && e.amount === 2)).toBe(true);
    expect(game.state.players[1].hero.hp).toBe(28);
    expect(summarize(game.state.log).damageDealt).toEqual([0, 2]);
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
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 1, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
    applyEffect(game, ctx, { kind: 'heal', value: 5, target: 'anyCreature' });
    expect(c.board[0]!.health).toBe(3);
  });
  it('buff adds attack and health, and maxHealth', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
    applyEffect(game, ctx, { kind: 'buff', value: 2, target: 'allFriendlyCreatures' });
    expect(c.board[0]!.attack).toBe(5); expect(c.board[0]!.health).toBe(5); expect(c.board[0]!.maxHealth).toBe(5);
  });
  it('buff adds reflect from value3 alongside attack and health (Task 1)', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
    // value = Attack delta, value2 = Health delta, value3 = Reflect delta.
    applyEffect(game, ctx, { kind: 'buff', value: 2, value3: 1, target: 'allFriendlyCreatures' });
    expect(c.board[0]!.attack).toBe(5);
    expect(c.board[0]!.health).toBe(5);
    expect(c.board[0]!.reflect).toBe(4);
  });
  it('silence preserves permanent stat modifications, reflect included (Task 1)', () => {
    const game = g(); game.state.phase = 'main';
    const c = addCreature(game, 0, { id: 't-sil', attack: 2, health: 3, reflect: 1, keywords: ['taunt'] });
    applyEffect(game, ctx, { kind: 'buff', value: 1, value3: 1, target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.reflect).toBe(2);
    applyEffect(game, ctx, { kind: 'silence', target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.reflect).toBe(2);   // buffed stats survive silence, like attack/health
    expect(c.keywords).toHaveLength(0);
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
  // The two mana kinds are distinct and must never share a formula again
  // (audit 02: they did, so refillMana handed out permanent crystals):
  //   gainMana   "Gain N empty mana crystals." → maxMana += N, mana unchanged
  //   refillMana "Gain N Mana."                → mana += N (capped at maxMana), maxMana unchanged
  it('refillMana refills current mana only — maxMana is untouched', () => {
    const game = g(); game.state.phase = 'main';
    const p = game.state.players[0];
    p.maxMana = 5; p.mana = 1;
    applyEffect(game, ctx, { kind: 'refillMana', value: 3 });
    expect(p.mana).toBe(4);
    expect(p.maxMana).toBe(5);        // no permanent crystals from a refill
  });
  // A refill MAY leave the player above their crystal count for the turn — the
  // Coin depends on it (a player is always at full mana on their own turn), and
  // beginTurn's mana = maxMana expires the surplus. Only the hard 15 cap holds.
  it('refillMana may exceed maxMana for the turn but never the 15 cap', () => {
    const game = g(); game.state.phase = 'main';
    const p = game.state.players[0];
    p.maxMana = 3; p.mana = 3;
    applyEffect(game, ctx, { kind: 'refillMana', value: 4 });
    expect(p.mana).toBe(7);
    expect(p.maxMana).toBe(3);
    p.mana = 14;
    applyEffect(game, ctx, { kind: 'refillMana', value: 4 });
    expect(p.mana).toBe(15);
    expect(p.maxMana).toBe(3);
  });
  it('gainMana adds empty crystals only — current mana is untouched', () => {
    const game = g(); game.state.phase = 'main';
    const p = game.state.players[0];
    p.maxMana = 2; p.mana = 2;
    applyEffect(game, ctx, { kind: 'gainMana', value: 2 });
    expect(p.maxMana).toBe(4);
    expect(p.mana).toBe(2);           // the new crystals arrive empty
  });
  it('freeze sets frozen, destroy removes without damage events', () => {
    const game = g(); game.state.phase = 'main';
    const c = game.state.players[0];
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
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
    c.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, reflect: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: false, spellPower: 0 });
    applyEffect(game, ctx, { kind: 'giveKeyword', keyword: 'taunt', target: 'anyCreature' });
    expect(c.board[0]!.keywords).toContain('taunt');
  });
  it('giveKeyword shield grants a real absorb — the shields field increments and damage is absorbed', () => {
    const game = g(); game.state.phase = 'main';
    const c = addCreature(game, 0, { id: 't-gks', attack: 3, health: 3 });
    expect(c.shields).toBe(0);
    applyEffect(game, ctx, { kind: 'giveKeyword', keyword: 'shield', target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.shields).toBe(1);
    applyEffect(game, ctx, { kind: 'dealDamage', value: 1, target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.health).toBe(3);   // absorbed
    expect(c.shields).toBe(0);
  });
  it('giveKeyword ward sets warded', () => {
    const game = g(); game.state.phase = 'main';
    const c = addCreature(game, 0, { id: 't-gkw', attack: 2, health: 2 });
    expect(c.warded).toBe(false);
    applyEffect(game, ctx, { kind: 'giveKeyword', keyword: 'ward', target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.warded).toBe(true);
  });
  it('giveKeyword windfury increments attacksLeft for an immediate extra swing', () => {
    const game = g(); game.state.phase = 'main';
    const c = addCreature(game, 0, { id: 't-gkf', attack: 2, health: 2, exhausted: false });
    expect(c.attacksLeft).toBe(1);
    applyEffect(game, ctx, { kind: 'giveKeyword', keyword: 'windfury', target: 'anyCreature' }, { type: 'creature', id: c.id });
    expect(c.attacksLeft).toBe(2);
    expect(c.keywords).toContain('windfury');
  });
});
