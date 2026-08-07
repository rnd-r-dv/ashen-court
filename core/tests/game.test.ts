import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';   // created in step 3

describe('Game setup', () => {
  it('deals 3 cards to each player, player 1 gets Mana Surge', () => {
    const game = Game.create(makeTestSetup());
    expect(game.state.players[0].hand).toHaveLength(3);
    expect(game.state.players[1].hand).toHaveLength(4);           // 3 + surge
    expect(game.state.players[1].hand).toContain('mana-surge');
  });
  it('starts in mulligan phase', () => expect(Game.create(makeTestSetup()).state.phase).toBe('mulligan'));
});

describe('Mulligan', () => {
  it('redraws unkept cards from the deck', () => {
    const game = Game.create(makeTestSetup());
    const hand0 = [...game.state.players[0].hand];
    const evts = game.submit({ kind: 'mulligan', keep: [0, 1] });
    expect(game.state.players[0].hand[0]).toBe(hand0[0]);
    expect(game.state.players[0].hand[1]).toBe(hand0[1]);
    expect(evts.some(e => e.type === 'cardDrawn')).toBe(true);
  });
  it('after both mulligans, phase becomes main, turn 0 starts with 1 mana', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'mulligan', keep: [0, 1, 2] });
    expect(game.state.phase).toBe('main');
    expect(game.state.turn).toBe(0);
    expect(game.state.players[0].maxMana).toBe(1);
    expect(game.state.players[0].mana).toBe(1);
  });
  it('rejects duplicate or oversized keep lists — hand-corruption guard (audit 01 I2)', () => {
    const game = Game.create(makeTestSetup());
    const hand0 = [...game.state.players[0].hand];
    // duplicate indices would duplicate one card and silently discard another
    expect(() => game.submit({ kind: 'mulligan', keep: [1, 1] })).toThrow('Bad keep index');
    // out-of-range index still throws
    expect(() => game.submit({ kind: 'mulligan', keep: [5] })).toThrow('Bad keep index');
    // more keeps than cards in hand throws
    expect(() => game.submit({ kind: 'mulligan', keep: [0, 1, 2, 3] })).toThrow('Bad keep index');
    // rejected mulligans leave the hand untouched
    expect(game.state.players[0].hand).toEqual(hand0);
    // a valid keep still works
    const evts = game.submit({ kind: 'mulligan', keep: [0, 1] });
    expect(game.state.players[0].hand[0]).toBe(hand0[0]);
    expect(game.state.players[0].hand[1]).toBe(hand0[1]);
    expect(evts.some(e => e.type === 'cardDrawn')).toBe(true);
  });
  it('keep-all mulligan emits an empty event batch (contract pin, audit 04 M7)', () => {
    const game = Game.create(makeTestSetup());
    const hand0 = [...game.state.players[0].hand];
    // keeping every card: no redraws → no cardDrawn; player 1 has not
    // mulliganed yet → no startMain/turnStart. runQueue returns [].
    const evts = game.submit({ kind: 'mulligan', keep: [0, 1, 2] });
    expect(evts).toEqual([]);
    expect(game.state.players[0].hand).toEqual(hand0);
    expect(game.state.phase).toBe('mulligan');
  });
  it('a mulligan after the mulligan phase is rejected', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] });   // player 0
    game.submit({ kind: 'mulligan', keep: [] });   // player 1 → startMain
    expect(() => game.submit({ kind: 'mulligan', keep: [] })).toThrow();
  });
});

describe('Turn flow', () => {
  it('endTurn moves to next player, growing mana each new turn', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] }); game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'endTurn' });
    expect(game.state.turn).toBe(1);
    expect(game.state.players[1].maxMana).toBe(2);   // +1 from start, capped at 15
    expect(game.state.players[1].mana).toBe(2);
    expect(game.state.players[1].hand).toHaveLength(4); // 3 from mulligan redraw + 1 drawn this turn
  });
  it('mana never exceeds 15', () => {
    const game = Game.create(makeTestSetup());
    game.state.players[0].maxMana = 15; game.state.players[0].mana = 15;
    game.submit({ kind: 'mulligan', keep: [] }); game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'endTurn' }); game.submit({ kind: 'endTurn' });   // back to player 0
    expect(game.state.players[0].maxMana).toBe(15);
  });
  it('beginTurn thaws frozen creatures and emits thawed (audit 01 M1)', () => {
    const game = Game.create(makeTestSetup());
    const p = game.state.players[0];
    p.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: true });
    game.submit({ kind: 'mulligan', keep: [] });   // player 0's mulligan — startMain not yet
    // player 1's mulligan → startMain → beginTurn(0) thaws the frozen creature
    const evts = game.submit({ kind: 'mulligan', keep: [] });
    expect(p.board[0]!.frozen).toBe(false);
    expect(evts.some(e => e.type === 'thawed' && e.creatureId === 'c1')).toBe(true);
  });
});
