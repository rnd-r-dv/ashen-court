// Wire protocol for the LAN server (Task 33). Types are verbatim from the
// plan (docs/superpowers/plans/2026-08-06-tcg.md, Task 33 Interfaces) —
// clients (Task 34) and server share exactly this shape over JSON.
import type { Card, GameEvent, Intent, PlayerIndex } from '@ashen/core';

export type ClientMessage =
  | { type: 'createRoom'; name: string; deckIds: string[]; customCards: Card[]; heroId: string; seed: number }
  | { type: 'joinRoom'; code: string }
  | { type: 'intent'; intent: Intent }
  | { type: 'rematch' };

export type ServerMessage =
  | { type: 'roomCreated'; code: string; player: PlayerIndex }
  | { type: 'joined'; player: PlayerIndex; seed: number; opponentName: string; deckIds: string[]; cards: Card[] }
  | { type: 'opponentJoined'; opponentName: string }
  | { type: 'gameStart' }
  | { type: 'events'; events: GameEvent[] }
  | { type: 'playerLeft'; reason: string }
  | { type: 'rematchStart' }
  | { type: 'error'; message: string };
