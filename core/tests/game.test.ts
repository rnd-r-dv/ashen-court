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
  it('refills to the opening hand size — mulliganing never costs a card (audit 02)', () => {
    const game = Game.create(makeTestSetup());
    // player 0 opens on 3; player 1 opens on 4 (3 dealt + the Coin). Refilling
    // to the STARTING_HAND constant silently cost player 1 a card.
    game.submit({ kind: 'mulligan', keep: [] });
    expect(game.state.players[0].hand).toHaveLength(3);
    game.submit({ kind: 'mulligan', keep: [] });
    expect(game.state.players[1].hand).toHaveLength(4);
  });
  it('partial keeps refill to the opening hand size too', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [0] });
    expect(game.state.players[0].hand).toHaveLength(3);
    game.submit({ kind: 'mulligan', keep: [0, 1] });
    expect(game.state.players[1].hand).toHaveLength(4);
  });
  it('a mulligan after the mulligan phase is rejected', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] });   // player 0
    game.submit({ kind: 'mulligan', keep: [] });   // player 1 → startMain
    expect(() => game.submit({ kind: 'mulligan', keep: [] })).toThrow();
  });
});

describe('Mana Surge (the Coin)', () => {
  /** Mulligan both players (keep everything), then pass to player 1's turn. */
  const toPlayer1Turn = (game: Game) => {
    game.submit({ kind: 'mulligan', keep: [0, 1, 2] });
    game.submit({ kind: 'mulligan', keep: [0, 1, 2, 3] });
    game.submit({ kind: 'endTurn' });
  };

  it('player 1 has no setup head start — same crystal curve as player 0', () => {
    const game = Game.create(makeTestSetup());
    expect(game.state.players[1].maxMana).toBe(0);
    expect(game.state.players[1].mana).toBe(0);
    expect(game.state.players[1].surged).toBe(false);   // the Coin has not been spent yet
    toPlayer1Turn(game);
    expect(game.state.players[1].maxMana).toBe(1);
    expect(game.state.players[1].mana).toBe(1);
  });

  it('the Coin is playable and grants +1 mana WITHOUT a permanent crystal', () => {
    const game = Game.create(makeTestSetup());
    toPlayer1Turn(game);
    const p1 = game.state.players[1];
    const idx = p1.hand.indexOf('mana-surge');
    expect(idx).toBeGreaterThanOrEqual(0);
    game.submit({ kind: 'playCard', handIndex: idx });
    expect(p1.mana).toBe(2);        // one extra crystal available this turn
    expect(p1.maxMana).toBe(1);     // ...but the curve is untouched
    expect(p1.surged).toBe(true);
    expect(p1.hand).not.toContain('mana-surge');
  });

  it('the Coin is one-shot: a second copy is rejected once surged', () => {
    const game = Game.create(makeTestSetup());
    toPlayer1Turn(game);
    const p1 = game.state.players[1];
    game.submit({ kind: 'playCard', handIndex: p1.hand.indexOf('mana-surge') });
    p1.hand.push('mana-surge');
    expect(() => game.submit({ kind: 'playCard', handIndex: p1.hand.length - 1 })).toThrow('already surged');
    expect(game.legalIntents(1).some(i => i.kind === 'playCard' && p1.hand[i.handIndex] === 'mana-surge')).toBe(false);
  });

  it('the extra crystal expires with the turn', () => {
    const game = Game.create(makeTestSetup());
    toPlayer1Turn(game);
    const p1 = game.state.players[1];
    game.submit({ kind: 'playCard', handIndex: p1.hand.indexOf('mana-surge') });
    game.submit({ kind: 'endTurn' });   // → player 0
    game.submit({ kind: 'endTurn' });   // → player 1 again
    expect(p1.maxMana).toBe(2);
    expect(p1.mana).toBe(2);
  });
});

describe('Turn flow', () => {
  it('endTurn moves to next player, growing mana each new turn', () => {
    const game = Game.create(makeTestSetup());
    game.submit({ kind: 'mulligan', keep: [] }); game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'endTurn' });
    expect(game.state.turn).toBe(1);
    // Both players share one curve: turn 1 is 1 crystal for player 1 too.
    // (This used to expect 2 — it encoded the setup head start that made the
    // Coin unplayable and left player 1 permanently a crystal ahead; audit 02.)
    expect(game.state.players[1].maxMana).toBe(1);
    expect(game.state.players[1].mana).toBe(1);
    // 4 from the mulligan redraw (player 1's opening hand is 3 + the Coin) plus
    // 1 drawn this turn. Was 4 while the redraw refilled to STARTING_HAND and
    // quietly ate a card (audit 02).
    expect(game.state.players[1].hand).toHaveLength(5);
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
    p.board.push({ id: 'c1', cardId: 't-001', owner: 0, attack: 3, health: 3, maxHealth: 3, keywords: [], exhausted: true, attacksLeft: 1, shields: 0, warded: false, frozen: true, spellPower: 0 });
    game.submit({ kind: 'mulligan', keep: [] });   // player 0's mulligan — startMain not yet
    // player 1's mulligan → startMain → beginTurn(0) thaws the frozen creature
    const evts = game.submit({ kind: 'mulligan', keep: [] });
    expect(p.board[0]!.frozen).toBe(false);
    expect(evts.some(e => e.type === 'thawed' && e.creatureId === 'c1')).toBe(true);
  });
});
