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
    game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: foe.id } });   // anyCreature → must target a creature
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
  it('discountCheapest applies to the most expensive card in hand', () => {
    const game = Game.create(makeTestSetup()); ready(game);
    game.state.players[0].hero.discountCheapest = 2;
    game.state.players[0].hand = ['t-001', 't-007'];     // 3-cost and 7-cost in helpers
    game.state.players[0].mana = 6;
    game.submit({ kind: 'playCard', handIndex: 1 });     // play the 7-cost → costs 5
    expect(game.state.players[0].mana).toBe(1);
  });
});
