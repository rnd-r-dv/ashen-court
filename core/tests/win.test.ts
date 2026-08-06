import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';

describe('win conditions', () => {
  it('hero at 0 → gameOver with winner', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[1].hero.hp = 1;
    game.state.players[0].mana = 10; game.state.players[0].hand.unshift('bc-2dmg');   // battlecry dealDamage 2 allEnemies (empty enemy board → hero)
    game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.phase).toBe('gameOver');
    expect(game.state.log.some(e => e.type === 'gameOver' && e.winner === 0)).toBe(true);
  });
  it('simultaneous deaths → draw', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[0].hero.hp = 1; game.state.players[1].hero.hp = 1;
    game.state.players[0].mana = 10; game.state.players[0].hand.unshift('test-spell-2'); // dealDamage 1 allEnemies + dealDamage 1 self → both heroes die in ONE resolution
    game.submit({ kind: 'playCard', handIndex: 0 });
    expect(game.state.phase).toBe('gameOver');
    expect(game.state.log.some(e => e.type === 'gameOver' && e.winner === 'draw')).toBe(true);
  });
  it('no intents accepted after game over', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'gameOver';
    expect(() => game.submit({ kind: 'endTurn' })).toThrow();
  });
  it('deck out just stops drawing', () => {
    const game = Game.create(makeTestSetup()); game.state.phase = 'main';
    game.state.players[0].deck = [];
    expect(() => game.submit({ kind: 'endTurn' })).not.toThrow();
  });
});
