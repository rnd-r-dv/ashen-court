// LAN match driver (Task 34 + Task 34 fix round). Implements the Task 12/33
// LAN-mirroring contract: the client keeps a local "shadow" Game built from
// the same seed, deck, heroes and card registry as the server's authoritative
// Game, and the deterministic engine keeps both states identical.
//
// Shadow advancement policy (INTENT BROADCAST, verified against
// core/src/engine/game.ts — see task-34-report):
//
//  1. The server broadcasts every ACCEPTED intent as {type:'intent', intent}
//     (in addition to the {type:'events'} resolution tree for animation).
//  2. submit() ONLY sends the intent to the server — it is never applied
//     locally. The shadow advances exactly once, when the echoed intent
//     message arrives, via applyIntent() → game.submit(intent). Single
//     application point: no own-echo content matching, no pre-apply, no
//     double-application possible (the old event-reconstruction policy — and
//     its reconstructable turnEnd/gameOver/mulligan exceptions — is gone).
//  3. Because the engine is deterministic (same seed + same intents =
//     identical states), both shadows and the server reach byte-identical
//     states after every intent, and the resolution tree applyIntent returns
//     IS the server's broadcast events — the hook queues that tree as the
//     animation batch (single animation source; the {type:'events'} broadcast
//     is redundant for the client but kept on the wire).
//  4. Shadow divergence (applyIntent throws) is unreachable while the states
//     match; if it happens the driver console.warns with the intent kind and
//     raises a resync flag the hook surfaces to the UI (v1 recovery: rejoin
//     by code — the server replays the intent log to a fresh shadow).
import { DECK_DEFS, Game, HEROES, expandDeck } from '@ashen/core';
import type { GameEvent, Intent, MatchSetup } from '@ashen/core';
import type { MatchDriver } from '../types.js';
import type { LanClient } from './lanClient.js';

/**
 * Derive the hero name for a deck's card list. Curated decks expand to exactly
 * expandDeck(DECK_DEFS[slug]), and HEROES shares DECK_DEFS' archetype order
 * (same positional zip DeckPick uses), so an exact expansion match identifies
 * the deck's hero. Custom overlays and unknown decks fall back to HEROES[0] —
 * the same fallback the server's makeGame applies for an unknown heroId
 * (server/src/rooms.ts), keeping the shadow aligned in the common case.
 */
export function heroNameForDeck(deckIds: string[]): string {
  const slugs = Object.keys(DECK_DEFS) as (keyof typeof DECK_DEFS)[];
  for (let i = 0; i < slugs.length; i++) {
    const expanded = expandDeck(DECK_DEFS[slugs[i]!]!);
    if (expanded.length === deckIds.length && expanded.every((id, j) => id === deckIds[j])) {
      return HEROES[i]!.name;
    }
  }
  return HEROES[0]!.name;
}

/** LAN driver: MatchDriver plus the shadow-application surface the hook uses. */
export interface LanMatchDriver extends MatchDriver {
  /**
   * Apply one echoed intent to the shadow (deterministic replay). Returns the
   * resolution tree (identical to the server's events broadcast) for the UI
   * to animate. On shadow divergence (should be unreachable) returns [] and
   * sets resyncRequested.
   */
  applyIntent(intent: Intent): GameEvent[];
  /** True once a shadow divergence was detected (v1 recovery: rejoin by code). */
  resyncRequested: boolean;
}

/**
 * Create the LAN MatchDriver over a LanClient and a shadow Game. The driver's
 * own message handler only surfaces server errors. Echoed intents are applied
 * by the hook (or tests) via applyIntent when the {type:'intent'} message
 * arrives, and the returned resolution tree is queued as the animation batch —
 * the driver never applies intents or forwards events inside its handler, so
 * there is exactly one application point and one animation source per echo.
 * onEvents exists for MatchDriver shape compatibility; LAN animation flows
 * through applyIntent's return value instead.
 */
export function createLanDriver(
  client: LanClient,
  game: Game,
  onError?: (message: string) => void,
  onResync?: (intentKind: string) => void,
): LanMatchDriver {
  let current = game;
  let resyncRequested = false;

  client.addMessageHandler((m) => {
    if (m.type === 'error') {
      // Server-side rejection (sent only to the sender). The shadow never
      // applied this intent locally (no pre-apply), so the states stay
      // aligned; surface the message and let the UI decide.
      onError?.(m.message);
    }
    // {type:'events'} / {type:'intent'} broadcasts are the hook's business:
    // the events tree carries no reconstructable state (Task 12 ruling) and
    // the intent echo advances the shadow — both handled at the single
    // application point, so nothing happens here.
  });

  return {
    submit(intent: Intent): Promise<GameEvent[]> {
      // No local application — the echoed intent applies the shadow exactly
      // once when the server broadcasts it back. No optimism, no content
      // matching, no double-application possible.
      client.send({ type: 'intent', intent });
      return Promise.resolve([]); // animation events come from applyIntent's tree
    },
    applyIntent(intent: Intent): GameEvent[] {
      try {
        return current.submit(intent); // deterministic mirror — same as the server
      } catch (err) {
        // Shadow divergence: unreachable while both sides replay the same
        // intent script on the same seed. Flag it for the hook to surface;
        // v1 recovery is a manual rejoin by code (the server replays the log).
        resyncRequested = true;
        console.warn(`[lan] shadow divergence applying ${intent.kind} intent`, err);
        onResync?.(intent.kind);
        return [];
      }
    },
    onEvents(_cb: (events: GameEvent[]) => void): void {
      // Shape compatibility only — LAN animation is the applyIntent tree.
    },
    game(): Game {
      return current;
    },
    reset(setup: MatchSetup): void {
      current = new Game(setup, current.registry); // rematch: fresh game, same registry
      resyncRequested = false;
    },
    get resyncRequested(): boolean {
      return resyncRequested;
    },
  };
}
