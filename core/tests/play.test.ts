import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';

const ready = (game: Game) => { game.state.phase = 'main'; game.state.players[0].mana = 10; game.state.players[0].maxMana = 10; };

describe('playCard', () => {
  it('creature: pays cost, moves to board, exhausts unless rush/charge', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hand.unshift('t-001');        // 3/3 vanilla (in helpers)
    const evts = game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.players[0].mana).toBe(7);
    const c = game.state.players[0].board[0]!;
    expect(c.cardId).toBe('t-001'); expect(c.exhausted).toBe(true);
    expect(evts.some(e => e.type === 'creatureSummoned')).toBe(true);
  });
  it('rush clears exhausted on summon', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hand.unshift('t-rush');       // 2/1 rush
    game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.players[0].board[0]!.exhausted).toBe(false);
  });
  it('spell: applies effect then leaves hand, discountNextSpell consumed', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hero.discountNextSpell = 1;
    game.state.players[0].hand.unshift('test-spell');   // 1-cost, dmg 1 anyCreature
    const foe = addCreature(game, 1, { id: 't-002', attack: 2, health: 3, keywords: [], exhausted: false });
    const evts = game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: foe.id } });   // anyCreature → must target a creature
    expect(evts.some(e => e.type === 'damageDealt')).toBe(true);   // submit returns the full resolution tree
    expect(foe.health).toBe(2);
    expect(game.state.players[0].hand).not.toContain('test-spell');
    expect(game.state.players[0].mana).toBe(10);        // 1-cost spell, discountNextSpell 1 → effective 0 → mana unchanged
    expect(game.state.players[0].hero.discountNextSpell).toBe(0);
  });
  it('ward fizzles the first spell targeting the creature', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hand.unshift('test-spell');
    const w = addCreature(game, 1, { id: 't-002', attack: 1, health: 2, keywords: ['ward'], exhausted: false });
    const evts = game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: w.id } });
    expect(evts.some(e => e.type === 'spellFizzled')).toBe(true);
    expect(w.health).toBe(2);        // damage negated
    expect(w.warded).toBe(false);    // ward consumed
    expect(game.state.players[0].hand).not.toContain('test-spell');   // the spell is still spent
  });
  it('ward fizzles the WHOLE spell — effects before the warded spec do not land (audit 01 I3)', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    // mixed spell: heal 3 hero FIRST, then deal 3 to anyCreature — cast on a
    // warded enemy creature the heal must NOT land (whole spell fizzles).
    game.registry.register({
      id: 'mixed-spell', name: 'Mixed Spell', type: 'spell', cost: 1,
      keywords: [], effects: [
        { kind: 'heal', value: 3, target: 'hero' },
        { kind: 'dealDamage', value: 3, target: 'anyCreature' },
      ],
      rarity: 'common', archetype: 'neutral',
      art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 99 },
      author: 'custom', version: 1,
    });
    game.state.players[0].hero.hp = 20;   // heal 3 would bring it to 23
    game.state.players[0].hand.unshift('mixed-spell');
    const w = addCreature(game, 1, { id: 't-002', attack: 1, health: 2, keywords: ['ward'], exhausted: false });
    const evts = game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: w.id } });
    expect(evts.some(e => e.type === 'spellFizzled')).toBe(true);
    expect(w.health).toBe(2);              // damage negated
    expect(w.warded).toBe(false);          // ward consumed
    expect(game.state.players[0].hero.hp).toBe(20);   // heal did NOT land — whole spell fizzled
    expect(game.state.players[0].hand).not.toContain('mixed-spell');   // the spell is still spent
  });
  it('rejects creature plays at the 7-creature board cap; legalIntents excludes them (audit 01 C2)', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    for (let i = 0; i < 7; i++) addCreature(game, 0, { id: `t-cap-${i}`, attack: 1, health: 1, keywords: [], exhausted: false });
    game.state.players[0].hand.unshift('t-001');   // 3-cost creature
    expect(() => game.submit({ kind: 'playCard', handIndex: 0 })).toThrow('Board is full');
    expect(game.legalIntents(0).filter(i => i.kind === 'playCard' && i.handIndex === 0)).toHaveLength(0);
    // spells are still playable at a full board
    game.state.players[0].hand.unshift('test-spell-2');   // AoE spell, no target choice
    game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.players[0].board).toHaveLength(7);
  });
  it('artifact: moves to artifact zone', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hand.unshift('art-heal');
    game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.players[0].artifacts).toHaveLength(1);
  });
  it('rejects playing without enough mana and invalid target', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main'; game.state.players[0].mana = 0;
    game.state.players[0].hand.unshift('t-001');
    expect(() => game.submit({ kind: 'playCard', handIndex: 0 })).toThrow();
    // enemy-only target with wrong owner: test-spell-ec (1-cost spell, dealDamage 1 enemyCreature)
    game.state.players[0].mana = 10; game.state.players[0].hand.unshift('test-spell-ec');
    const own = addCreature(game, 0, { id: 't-001', attack: 2, health: 3, keywords: [] });
    // targeting an OWN creature → not an enemy creature → illegal → throws
    // (note: creature TargetRefs carry only { type: 'creature', id } — the owner is inferred from the board):
    expect(() => game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: own.id } })).toThrow();
  });
  it('discountMostExpensive applies to the most expensive card in hand', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hero.discountMostExpensive = 2;
    game.state.players[0].hand = ['t-001', 't-007'];     // 3-cost and 7-cost in helpers
    game.state.players[0].mana = 6;
    game.submit({ kind: 'playCard', handIndex: 1 });     // play the 7-cost → costs 5
    expect(game.state.players[0].mana).toBe(1);
  });
});

describe('submit returns the full resolution tree (attack path)', () => {
  it('attack returns its damageDealt events', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    const defender = addCreature(game, 0, { id: 't-001', attack: 1, health: 3, keywords: [] });
    const attacker = addCreature(game, 1, { id: 't-002', attack: 2, health: 3, keywords: [], exhausted: false });
    game.submit({ kind: 'endTurn' });   // player 1's turn → may attack
    const evts = game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });
    expect(defender.health).toBe(1);
    expect(evts.some(e => e.type === 'damageDealt')).toBe(true);   // attack damage events are returned
  });
});
