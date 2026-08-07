// Match stats summarization (Task 35). MatchStats lives in types.ts — this
// module only implements the summarize() reducer over a game event log.
//
// Semantics (per plan Task 35 / controller notes):
//   - turns       = number of turnEnd events (gameOver carries no turn number)
//   - damageDealt = sum of heroDamaged amounts per damaged player index, so
//                   damageDealt[i] = total hero damage dealt TO player i
//   - cardsPlayed = count of cardPlayed events per player index
// heroDamaged is emitted by the engine (effects.ts damageTarget) alongside
// every damageDealt that lands on a hero — real-game logs carry these events
// (audit 01 I1 fix), so the summarize contract matches engine behavior.
import type { GameEvent, MatchStats } from '../types.js';

export function summarize(log: GameEvent[]): MatchStats {
  let turns = 0;
  const damageDealt: [number, number] = [0, 0];
  const cardsPlayed: [number, number] = [0, 0];

  for (const event of log) {
    switch (event.type) {
      case 'turnEnd':
        turns += 1;
        break;
      case 'heroDamaged':
        damageDealt[event.player] = (damageDealt[event.player] ?? 0) + event.amount;
        break;
      case 'cardPlayed':
        cardsPlayed[event.player] = (cardsPlayed[event.player] ?? 0) + 1;
        break;
      default:
        break;
    }
  }

  return { turns, damageDealt, cardsPlayed };
}
