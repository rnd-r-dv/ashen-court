// Match drivers (Task 30). The MatchDriver interface itself is declared in
// app/src/types.ts (Task 28) — implemented here, never redeclared.
//
// Local driver: a thin wrapper over the synchronous core Game. submit runs
// the engine immediately and notifies every onEvents listener with the
// returned resolution tree, so the hook's single event pipeline (onEvents)
// works identically for local and LAN play (the LAN driver lives in
// app/src/game/lanDriver.ts).
import { Game } from '@ashen/core';
import type { GameEvent, Intent, MatchSetup } from '@ashen/core';
import type { MatchDriver } from '../types.js';

/**
 * Local driver: wraps one synchronous core Game. Events flow to subscribers
 * as the same GameEvent[] the engine returned, so the resolution tree and the
 * subscribed batches are identical objects.
 */
export function createLocalDriver(game: Game): MatchDriver {
  let current = game;
  const listeners = new Set<(events: GameEvent[]) => void>();
  return {
    async submit(intent: Intent): Promise<GameEvent[]> {
      const events = current.submit(intent);
      for (const cb of listeners) cb(events);
      return events;
    },
    onEvents(cb: (events: GameEvent[]) => void): void {
      listeners.add(cb);
    },
    game(): Game {
      return current;
    },
    reset(setup: MatchSetup): void {
      // Rematch (Task 35): fresh Game over the same registry, same decks.
      current = new Game(setup, current.registry);
    },
  };
}
