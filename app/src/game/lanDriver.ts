// LAN match driver (Task 34 + Task 34 fix rounds). Implements the Task 12/33
// LAN-mirroring contract: the client keeps a local "shadow" Game built from
// the same seed, deck, heroes and card registry as the server's authoritative
// Game, and the deterministic engine keeps both states identical.
//
// Shadow advancement policy (INTENT BROADCAST + DRIVER-OWNED APPLICATION,
// fix round 2 — verified against core/src/engine/game.ts):
//
//  1. The server broadcasts every ACCEPTED intent as {type:'intent', intent}
//     (in addition to the {type:'events'} resolution tree for animation).
//  2. The DRIVER registers its own message handler on the client at
//     construction — the single application point. submit() ONLY sends the
//     intent; when the echoed {type:'intent'} arrives, the driver applies it
//     to the shadow itself (game.submit) and forwards the returned resolution
//     tree to every onEvents subscriber (which is what the Match screen's
//     useMatch consumes — fix round 2: the LAN match screen was frozen because
//     application happened in the hook, which unmounts at match entry).
//     No local pre-apply, no own-echo content matching, no double-application.
//  3. Because the engine is deterministic (same seed + same intents =
//     identical states), both shadows and the server reach byte-identical
//     states after every intent, and the tree forwarded to subscribers IS the
//     server's events broadcast (the {type:'events'} wire message is redundant
//     for the client but kept on the wire).
//  4. On a mid-game reconnect the server re-sends joined → the full intent
//     log → gameStart. The driver rebuilds the shadow fresh from the 'joined'
//     payload (same seed/deck/hero/registry resolution as the server's
//     makeGame) so the replayed log applies cleanly — this works even after
//     the LAN screens (and their hook) unmount at match entry.
//  5. Shadow divergence (the shadow cannot apply an echoed intent) is
//     unreachable while the states match; if it happens the driver
//     console.warns with the intent kind and raises a resync flag the hook
//     surfaces to the UI (v1 recovery: rejoin by code — the server replays
//     the intent log to a fresh shadow).
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck } from '@ashen/core';
import type { GameEvent, HeroSpec, Intent, MatchSetup, PlayerIndex } from '@ashen/core';
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

/** LAN driver: MatchDriver plus the divergence flag and the wire seat. */
export interface LanMatchDriver extends MatchDriver {
  /** True once a shadow divergence was detected (v1 recovery: rejoin by code). */
  resyncRequested: boolean;
  /** The wire-assigned seat (player index). Set from the session's initial
   *  join (createLanDriver's initialSeat); a reconnect 'joined' can REMAP it
   *  (audit 06 I2 — both players away, the first rejoin reclaims the host
   *  slot). Screens + App read this live so the UI never keeps submitting the
   *  old seat's intents (each would land as the other seat's → 'Not your
   *  turn' → deadlock). */
  seat: PlayerIndex | null;
}

/**
 * Create the LAN MatchDriver over a LanClient and a shadow Game. At
 * construction the driver registers its own message handler on the client —
 * it OWNS echo application, so the driver works even after the LAN screens
 * (and useLanMatch) unmount at match entry:
 *
 *   - {type:'error'}  → onError (server-side rejection of a submitted intent;
 *                        the shadow never applied it locally, so the states
 *                        stay aligned).
 *   - {type:'joined'} or {type:'opponentJoined'} → rebuild the shadow fresh
 *                        from the setup payload (decks/heroes/seed/cards), so
 *                        the intent-log replay that follows applies cleanly.
 *                        The host gets opponentJoined (the guest's deck is now
 *                        known); the guest gets joined. Same code path — both
 *                        rebuild the shadow from the server's resolved setup.
 *   - {type:'intent'} → apply the echoed intent to the shadow (try/catch:
 *                        console.warn + resync flag + onResync on divergence)
 *                        and forward the resolution tree to onEvents
 *                        subscribers (the Match screen's useMatch pipeline).
 *
 * submit() only sends the intent — the echo applies, exactly once. onEvents
 * stores the subscriber set (mirroring useMatch's single event pipeline, so
 * local and LAN play flow through the same interface).
 */
export function createLanDriver(
  client: LanClient,
  game: Game,
  onError?: (message: string) => void,
  onResync?: (intentKind: string) => void,
  initialSeat: PlayerIndex | null = null,
): LanMatchDriver {
  let current = game;
  let resyncRequested = false;
  let seat = initialSeat;
  const listeners = new Set<(events: GameEvent[]) => void>();

  client.addMessageHandler((m) => {
    if (m.type === 'error') {
      onError?.(m.message);
      return;
    }
    if (m.type === 'joined' || m.type === 'opponentJoined') {
      // Reconnect/join setup: the server re-sent the resolved setup (both
      // decks, hero names, seed, merged registry) and will replay the intent
      // log after 'joined'. Rebuild the shadow fresh from the payload (the
      // same resolution the server's makeGame uses: hero by NAME, merged
      // registry) so the replay applies cleanly. The initial join is a no-op
      // rebuild — the payload matches the shadow the hook already built.
      // I2 (audit 06): the reconnect 'joined' also carries the wire-assigned
      // SEAT (the first rejoin after a dual disconnect reclaims the host
      // slot) — remap so the UI never submits the wrong seat's intents.
      if (m.type === 'joined') seat = m.player;
      const heroes = m.heroes.map(name => HEROES.find(h => h.name === name) ?? HEROES[0]!);
      current = Game.create(
        { decks: m.decks, heroes: heroes as [HeroSpec, HeroSpec], seed: m.seed },
        new CardRegistry([...buildPool(), ...m.cards]),
      );
      resyncRequested = false;
      return;
    }
    if (m.type === 'intent') {
      try {
        const tree = current.submit(m.intent); // deterministic mirror — same as the server
        for (const cb of [...listeners]) cb(tree);
      } catch (err) {
        // Shadow divergence: unreachable while both sides replay the same
        // intent script on the same seed. Flag it for the hook to surface;
        // v1 recovery is a manual rejoin by code (the server replays the log).
        resyncRequested = true;
        console.warn(`[lan] shadow divergence applying ${m.intent.kind} intent`, err);
        onResync?.(m.intent.kind);
      }
      return;
    }
    // {type:'events'} drives nothing client-side (the forwarded tree IS the
    // events); gameStart / rematchStart / playerLeft are the screens' +
    // App's business.
  });

  return {
    submit(intent: Intent): Promise<GameEvent[]> {
      // No local application — the echoed intent applies the shadow exactly
      // once when the server broadcasts it back. No optimism, no content
      // matching, no double-application possible.
      client.send({ type: 'intent', intent });
      return Promise.resolve([]); // events flow through the echoed tree
    },
    onEvents(cb: (events: GameEvent[]) => void): void {
      listeners.add(cb);
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
    get seat(): PlayerIndex | null {
      return seat;
    },
  };
}
