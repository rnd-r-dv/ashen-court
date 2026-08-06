// playerVisibility (Task 32): the hotseat pass-and-play contract. A player
// sees their own hand only while they are the acting player:
//   - main phase: the current player (turn % 2) — hands hide between turns,
//     when the device physically changes hands;
//   - mulligan: the player the engine still expects to mulligan (turn stays 0
//     through both mulligans, so progress comes from mulligansDone — player 0
//     mulligans first, then player 1, and each sees their own hand in turn);
//   - anything else (gameOver): hands hidden.
// Pure over GameState, so the Match screen and tests share one truth.
import type { GameState, PlayerIndex } from '@ashen/core';

export function playerVisibility(state: GameState, viewer: PlayerIndex): boolean {
  if (state.phase === 'mulligan') {
    // Both mulligans done never persists (startMain() flips to 'main'
    // synchronously), but never mis-assign the actor if it is observed.
    if (state.mulligansDone[0] && state.mulligansDone[1]) return false;
    return ((state.mulligansDone[0] ? 1 : 0) as PlayerIndex) === viewer;
  }
  if (state.phase === 'main') {
    return ((state.turn % 2) as PlayerIndex) === viewer;
  }
  return false;
}
