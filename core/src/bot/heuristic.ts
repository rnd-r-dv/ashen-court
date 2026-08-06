import type { Game } from '../engine/game.js';
import type { PlayerIndex, PlayerState } from '../types.js';

export function evaluate(game: Game, me: PlayerIndex): number {
  const { players } = game.state;
  const meP = players[me], foeP = players[(1 - me) as PlayerIndex];
  const board = (p: PlayerState) => p.board.reduce((s, c) => s
    + c.attack * 2 + c.health
    + (c.keywords.includes('taunt') ? 2 : 0)
    + (c.keywords.includes('lifesteal') ? 2 : 0)
    + (c.keywords.includes('windfury') ? 2 : 0), 0);
  const enemyTaunts = foeP.board.filter(c => c.keywords.includes('taunt')).length;
  return board(meP) - board(foeP) * 1.3
    + (meP.hero.hp - foeP.hero.hp) * 2
    + meP.hand.length * 1.2
    + meP.maxMana * 0.3
    + (meP.board.length - foeP.board.length) * 0.5
    + enemyTaunts * 1.5;
}
