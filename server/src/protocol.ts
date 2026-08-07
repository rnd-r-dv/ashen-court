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
  | { type: 'gameStart' }
  | { type: 'events'; events: GameEvent[] }
  | { type: 'intent'; intent: Intent }
  | { type: 'playerLeft'; reason: string }
  | { type: 'rematchStart' }
  | { type: 'error'; message: string };
