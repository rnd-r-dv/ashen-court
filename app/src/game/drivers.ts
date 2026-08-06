// Match drivers (Task 30). The MatchDriver interface itself is declared in
// app/src/types.ts (Task 28) — implemented here, never redeclared.
//
// Local driver: a thin wrapper over the synchronous core Game. submit runs
// the engine immediately and notifies every onEvents listener with the
// returned resolution tree, so the hook's single event pipeline (onEvents)
// works identically for local and (Task 34) LAN play.
//
// LAN driver: a stub until Task 34 lands the real LanClient/socket wiring.
import { Game } from '@ashen/core';
import type { GameEvent, Intent, MatchSetup } from '@ashen/core';
import type { MatchDriver } from '../types.js';

/**
 * Placeholder for Task 34's LanClient (app/src/game/lanClient.ts). The LAN
 * driver stub never touches it; Task 34 defines the real class and replaces
 * this declaration when it wires submit/onEvents to the socket.
 */
interface LanClient {}

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

/**
 * LAN driver: NOT IMPLEMENTED until Task 34 (app/src/game/lanClient.ts). The
 * real driver will send intents over the socket (submit), forward the echoed
 * event batches to subscribers (onEvents), keep the shadow game in sync via
 * game.applyEvent, and rebuild the game on reset. Until then every submit
 * rejects so nothing can silently half-work over the network.
 */
export function createLanDriver(client: LanClient, game: Game): MatchDriver {
  return {
    submit: async () => {
      throw new Error('LAN driver lands in Task 34');
    },
    onEvents: () => {},
    game: () => game,
    reset: () => {},
  };
}
