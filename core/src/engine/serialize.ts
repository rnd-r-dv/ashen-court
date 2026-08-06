import type { GameState } from '../types.js';

// Plain JSON round-trip of GameState. The Game class keeps a reference to its
// CardRegistry (exposed as `registry`) so deserialization can rehydrate card
// lookups; the RNG position is carried inside rngState and re-advanced by
// Game.deserialize.

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
