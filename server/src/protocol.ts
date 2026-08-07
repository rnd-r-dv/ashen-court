// Wire protocol for the LAN server (Task 33 + Task 45: guests pick their own
// deck — no forced mirror match). Clients (Task 34) and server share exactly
// this shape over JSON. Task 45: joinRoom now carries the guest's full deck
// choice, and joined/opponentJoined carry the resolved [host, guest] decks,
// hero NAMES, seed and the merged card registry.
import type { Card, GameEvent, Intent, PlayerIndex } from '@ashen/core';

export type ClientMessage =
  | { type: 'createRoom'; name: string; deckIds: string[]; customCards: Card[]; heroId: string; seed: number }
  | { type: 'joinRoom'; code: string; deckIds: string[]; customCards: Card[]; heroId: string }
  | { type: 'intent'; intent: Intent }
  | { type: 'rematch' };

export type ServerMessage =
  | { type: 'roomCreated'; code: string; player: PlayerIndex }
  | { type: 'joined'; player: PlayerIndex; seed: number; opponentName: string; decks: [string[], string[]]; heroes: [string, string]; cards: Card[] }
  | { type: 'opponentJoined'; opponentName: string; decks: [string[], string[]]; heroes: [string, string]; seed: number; cards: Card[] }
  // Bug 6: a peer RECONNECT is not a peer JOIN. opponentJoined carries a full
  // setup payload and makes the LAN driver rebuild its shadow from scratch;
  // doing that to the still-connected player mid-match would wipe its game,
  // and — unlike the reconnecting client — it gets no intent-log replay to
  // catch back up. So the peer notice is its own payload-free message: purely
  // informational, it only clears the stale "Opponent disconnected" banner.
  | { type: 'opponentReconnected' }
  | { type: 'gameStart' }
  | { type: 'events'; events: GameEvent[] }
  // Bug 8: `replay` marks an intent re-sent from the room's log during the
  // reconnect catch-up burst (joined → N replayed intents → gameStart), as
  // opposed to a live broadcast. The client must still APPLY every one of them
  // (shadow determinism depends on it) but must not forward their resolution
  // trees for animation, or a rejoining player watches the whole match replay
  // before reaching the live board. Marked server-side rather than inferred
  // client-side from the message sequence — inference breaks if the burst ever
  // interleaves with a live broadcast.
  | { type: 'intent'; intent: Intent; replay?: boolean }
  | { type: 'playerLeft'; reason: string }
  | { type: 'rematchStart'; seed: number }
  | { type: 'error'; message: string };
