// LAN match driver (Task 34). Implements the Task 12/33 LAN-mirroring
// contract: the client keeps a local "shadow" Game built from the same seed,
// deck, heroes and card registry as the server's authoritative Game, and the
// deterministic engine keeps both states identical.
//
// Shadow advancement policy (VERIFIED against core/src/engine/game.ts — see
// task-34-report for the full writeup):
//
//  1. Own intents: replay locally via game.submit(intent) BEFORE sending. The
//     engine is deterministic (same seed + same intents = identical states),
//     so the shadow already equals the server's post-submit state. The local
//     result is also the EXACT event tree the server will broadcast back, so
//     the echo is recognized by content and NOT re-applied (re-applying would
//     double-apply — Task 12 test 4 documented this for turnEnd).
//  2. Opponent broadcasts: most events are NOT state-reconstructable —
//     mulligan discards, playCard mana/hand/board, attack damage/exhaustion,
//     and effect mutations all happen INLINE in submit/applyEffect, with the
//     event stream serving as the animation/log layer (Task 12 ruling note:
//     "do NOT reconstruct state from events"). The two reconstructable
//     exceptions are applied:
//       - turnEnd: dispatch(turnEnd) advances the turn and REGENERATES the
//         beginTurn follow-ups (turnStart/manaChanged/cardDrawn) determinis-
//         tically, so applying just the turnEnd reconstructs the transition.
//         Gated on evt.player === currentPlayer() so an own echo that somehow
//         slips through the content match can never double-advance the turn.
//       - gameOver: dispatch sets phase='gameOver' (no other state), and the
//         broadcast winner is authoritative even when the shadow's own
//         checkWin didn't fire (the shadow misses opponent damage).
//     Opponent mulligan: not reconstructable either (inline discards +
//     mulligansDone progress), but while the shadow is in the mulligan phase
//     every opponent broadcast IS a mulligan batch, so the phase transition
//     (phase='main', beginTurn(0)) is completed by explicit state surgery +
//     applying the reconstructable beginTurn emissions.
//
// The opponent's inline mutations (their plays, damage, mana, hand) are a
// documented v1 limitation of the wire protocol: the server broadcasts events
// only, not intents, so the opponent's intent script is unavailable to replay.
// The broadcast events still flow to the UI via onEvents for animation.
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

/** Content equality for the own-echo match (deterministic engine → exact). */
function eventsEqual(a: GameEvent[], b: GameEvent[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Apply the reconstructable parts of an opponent broadcast to the shadow.
 * See the module comment for the verified policy.
 */
function applyBroadcast(game: Game, events: GameEvent[]): void {
  // Mulligan phase: every opponent broadcast here is a mulligan batch.
  if (game.state.phase === 'mulligan') {
    const draws = events.filter((e): e is Extract<GameEvent, { type: 'cardDrawn' }> => e.type === 'cardDrawn');
    if (draws.length > 0) {
      const actor = draws[0]!.player;
      game.state.mulligansDone[actor] = true;
      const turnStartIdx = events.findIndex(e => e.type === 'turnStart');
      if (turnStartIdx >= 0) {
        // Completing mulligan: the server entered main and began turn 0.
        // beginTurn's emissions (turnStart/manaChanged/cardDrawn) are
        // reconstructable dispatch handlers — apply them after the inline
        // phase transition (startMain is inline in submit, not an event).
        game.state.phase = 'main';
        game.state.mulligansDone = [false, false];
        for (const evt of events.slice(turnStartIdx)) game.applyEvent(evt);
      }
    }
    return;
  }
  for (const evt of events) {
    if (evt.type === 'turnEnd' && evt.player === game.currentPlayer()) {
      game.applyEvent(evt); // dispatch regenerates the beginTurn follow-ups
    } else if (evt.type === 'gameOver') {
      game.applyEvent(evt); // phase flip only; broadcast winner is authoritative
    }
  }
}

/**
 * Create the LAN MatchDriver over a LanClient and a shadow Game. The driver
 * registers the client's message handler that keeps the shadow in sync and
 * forwards every broadcast batch (own echoes included) to onEvents listeners
 * for the UI to animate.
 *
 * submit() sends the intent and resolves with [] — no local optimism: the
 * animation events come back from the server broadcast. The shadow advance
 * (own-intent replay) is the Task 33 mirroring contract, not optimism.
 */
export function createLanDriver(
  client: LanClient,
  game: Game,
  onError?: (message: string) => void,
): MatchDriver {
  const listeners = new Set<(events: GameEvent[]) => void>();
  /** Local results of sent intents (FIFO); each broadcast matching the head is our echo. */
  const pendingEchoes: GameEvent[][] = [];
  let current = game;

  client.addMessageHandler((m) => {
    if (m.type === 'events') {
      let ownEcho = false;
      if (pendingEchoes.length > 0 && eventsEqual(m.events, pendingEchoes[0]!)) {
        pendingEchoes.shift();
        ownEcho = true; // already applied by the local replay — animation only
      }
      if (!ownEcho) applyBroadcast(current, m.events);
      for (const cb of listeners) cb(m.events);
    } else if (m.type === 'error') {
      // Server-side rejection (only sent to the sender). The shadow already
      // applied this intent locally — the game states have diverged; surface
      // the message and let the UI decide (v1 limitation, documented).
      if (pendingEchoes.length > 0) pendingEchoes.shift();
      onError?.(m.message);
    }
  });

  return {
    submit(intent: Intent): Promise<GameEvent[]> {
      let result: GameEvent[];
      try {
        result = current.submit(intent); // deterministic mirror — same as the server
      } catch (err) {
        // Illegal locally = illegal on the server (identical engine): don't
        // send, surface the error instead of a rejected promise.
        onError?.(err instanceof Error ? err.message : String(err));
        return Promise.resolve([]);
      }
      pendingEchoes.push(result);
      client.send({ type: 'intent', intent });
      return Promise.resolve([]); // no local optimism — events arrive via broadcast
    },
    onEvents(cb: (events: GameEvent[]) => void): void {
      listeners.add(cb);
    },
    game(): Game {
      return current;
    },
    reset(setup: MatchSetup): void {
      current = new Game(setup, current.registry); // rematch: fresh game, same registry
    },
  };
}

