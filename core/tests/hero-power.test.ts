import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';

// Test Power (helpers.ts hero()): cost 2, dealDamage 1 target 'any'.
describe('hero power', () => {
  it('pays 2 mana, once per turn, applies effects', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].mana = 5;
    game.state.players[0].maxMana = 5;
    game.state.players[1].hero.hp = 30;
    const evts = game.submit({ kind: 'heroPower', target: { type: 'hero', player: 1 } });   // any → enemy hero is a legal target
    expect(game.state.players[1].hero.hp).toBe(29);
    expect(game.state.players[0].mana).toBe(3);
    expect(evts.some(e => e.type === 'heroPowerUsed')).toBe(true);
    // second use same turn rejected
    expect(() => game.submit({ kind: 'heroPower', target: { type: 'hero', player: 1 } })).toThrow();
  });

  it('resets after end turn (full cycle back to the user)', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].mana = 5;
    game.state.players[0].maxMana = 5;
    game.submit({ kind: 'heroPower', target: { type: 'hero', player: 1 } });   // p0 uses (usedPower=true)
    expect(() => game.submit({ kind: 'heroPower', target: { type: 'hero', player: 1 } })).toThrow();
    game.submit({ kind: 'endTurn' });                                          // p1's turn
    game.state.players[1].mana = 5;
    game.state.players[1].maxMana = 5;
    expect(() => game.submit({ kind: 'heroPower', target: { type: 'hero', player: 0 } })).not.toThrow();   // p1's power unused
    game.submit({ kind: 'endTurn' });                                          // back to p0
    game.state.players[0].mana = 5;
    game.state.players[0].maxMana = 5;
    expect(() => game.submit({ kind: 'heroPower', target: { type: 'hero', player: 1 } })).not.toThrow();   // beginTurn reset p0.usedPower
  });
});
