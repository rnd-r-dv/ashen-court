import { describe, it, expect } from 'vitest';
import type { GameEvent } from '../src/types.js';
import { summarize } from '../src/engine/stats.js';

// Task 35: match stats summarization. A hand-authored event log (no real game
// needed) drives exact counts:
//   - turns        = number of turnEnd events in the log (gameOver carries no turn)
//   - damageDealt  = sum of heroDamaged amounts per damaged player index
//   - cardsPlayed  = count of cardPlayed events per player index

describe('summarize', () => {
  it('derives turns, damage, and cards from a scripted log', () => {
    const log: GameEvent[] = [
      { type: 'turnStart', player: 0, mana: 1 },
      { type: 'cardPlayed', player: 0, cardId: 'c1' },
      { type: 'heroDamaged', player: 1, amount: 3, hp: 27 },
      { type: 'heroDamaged', player: 1, amount: 2, hp: 25 },
      { type: 'turnEnd', player: 0 },
      { type: 'turnStart', player: 1, mana: 1 },
      { type: 'cardPlayed', player: 1, cardId: 'c2' },
      { type: 'cardPlayed', player: 1, cardId: 'c3' },
      { type: 'heroDamaged', player: 0, amount: 5, hp: 25 },
      { type: 'turnEnd', player: 1 },
      { type: 'turnStart', player: 0, mana: 2 },
      { type: 'cardPlayed', player: 0, cardId: 'c4' },
      { type: 'heroDamaged', player: 1, amount: 4, hp: 21 },
      { type: 'turnEnd', player: 0 },
      { type: 'gameOver', winner: 0, reason: 'hero dead' },
    ];

    expect(summarize(log)).toEqual({
      turns: 3, // three turnEnd events
      damageDealt: [5, 9], // player 0 took 5, player 1 took 3+2+4
      cardsPlayed: [2, 2], // player 0 played c1+c4, player 1 played c2+c3
    });
  });

  it('empty log yields zeros', () => {
    expect(summarize([])).toEqual({
      turns: 0,
      damageDealt: [0, 0],
      cardsPlayed: [0, 0],
    });
  });
});
