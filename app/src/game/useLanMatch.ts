// useLanMatch (Task 34) — the LAN-side counterpart to useMatch (Task 30).
// Given the LanClient plus the room parameters (host knows them at createRoom;
// the guest receives them in the 'joined' message and feeds them in via props),
// it builds the shadow Game (same seed/deck/hero/registry as the server),
// creates the LAN MatchDriver, and mirrors useMatch's shape so match screens
// can consume LAN play through the same interface. The driver owns the shadow:
// own intents are replayed locally (Task 33 mirroring), opponent broadcasts
// advance it where the engine allows (see lanDriver.ts), and every broadcast
// batch is forwarded to the UI event queue for animation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardRegistry, Game, HEROES, buildPool, summarize } from '@ashen/core';
import type { Card, GameEvent, GameState, Intent, PlayerIndex } from '@ashen/core';
import type { MatchDriver, MatchResult } from '../types.js';
import type { LanClient } from './lanClient.js';
import type { ServerMessage } from '@ashen/server/protocol';
import { createLanDriver } from './lanDriver.js';

/** Everything needed to build the shadow Game. heroId is the hero NAME (the
 *  v1 wire protocol carries no hero id; the server resolves by name). */
export interface LanRoomParams {
  deckIds: string[];
  customCards: Card[];
  heroId: string;
  seed: number;
}

export function useLanMatch(opts: {
  client: LanClient | null;
  /** Host: its createRoom params. Guest: null until 'joined' arrives. */
  room: LanRoomParams | null;
  /** Host: 0. Guest: null until 'joined' arrives. */
  myPlayer: PlayerIndex | null;
  onGameOver?: (result: MatchResult) => void;
}): {
  state: GameState | null;
  events: GameEvent[];
  submit(intent: Intent): void;
  legal: Intent[];
  myPlayer: PlayerIndex | null;
  drainEvents(): GameEvent[];
  driver: MatchDriver | null;
  error: string | null;
} {
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [driver, setDriver] = useState<MatchDriver | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventsRef = useRef<GameEvent[]>([]);
  const allEventsRef = useRef<GameEvent[]>([]); // full log: summarized for stats
  const driverRef = useRef<MatchDriver | null>(null);
  const roomRef = useRef<LanRoomParams | null>(null);
  const playerRef = useRef<PlayerIndex | null>(null);
  const gameOverFiredRef = useRef(false);
  const onGameOverRef = useRef(opts.onGameOver);
  onGameOverRef.current = opts.onGameOver;

  /** Forward one broadcast batch: queue it for animation, refresh the state
   *  mirror, and fire onGameOver once when the server declares a winner. */
  const handleBatch = useCallback((batch: GameEvent[]) => {
    allEventsRef.current = [...allEventsRef.current, ...batch];
    eventsRef.current = [...eventsRef.current, ...batch];
    setEvents(eventsRef.current);
    const g = driverRef.current?.game();
    if (g) setState({ ...g.state });
    if (!gameOverFiredRef.current && batch.some(e => e.type === 'gameOver')) {
      const over = batch.find((e): e is Extract<GameEvent, { type: 'gameOver' }> => e.type === 'gameOver');
      if (over) {
        gameOverFiredRef.current = true;
        onGameOverRef.current?.({ winner: over.winner, stats: summarize(allEventsRef.current) });
      }
    }
  }, []);

  // Build the shadow Game + driver once the room and player are known.
  useEffect(() => {
    const { client, room, myPlayer } = opts;
    if (!client || !room || myPlayer === null || driverRef.current) return;
    roomRef.current = room;
    playerRef.current = myPlayer;
    const hero = HEROES.find(h => h.name === room.heroId) ?? HEROES[0]!;
    const registry = new CardRegistry([...buildPool(), ...room.customCards]);
    const shadow = Game.create(
      { decks: [room.deckIds, room.deckIds], heroes: [hero, hero], seed: room.seed },
      registry,
    );
    const d = createLanDriver(client, shadow, (msg) => setError(msg));
    d.onEvents(handleBatch);
    driverRef.current = d;
    setDriver(d);
    setState({ ...shadow.state });
  }, [opts.client, opts.room, opts.myPlayer, handleBatch]);

  // Protocol messages the match needs beyond the event stream. Pre-match
  // messages (roomCreated/joined/opponentJoined/gameStart) are handled by the
  // screens' own connectLan handler; this handler only reacts to in-match
  // control messages.
  useEffect(() => {
    const client = opts.client;
    if (!client) return;
    const handler = (m: ServerMessage) => {
      if (m.type === 'rematchStart') {
        // Server rematch: same decks/hero, seed + 1 (server/src/rooms.ts).
        const room = roomRef.current;
        if (room && driverRef.current) {
          const hero = HEROES.find(h => h.name === room.heroId) ?? HEROES[0]!;
          driverRef.current.reset({
            decks: [room.deckIds, room.deckIds],
            heroes: [hero, hero],
            seed: room.seed + 1,
          });
          gameOverFiredRef.current = false;
          allEventsRef.current = [];
          eventsRef.current = [];
          setEvents([]);
          setState({ ...driverRef.current.game().state });
        }
      } else if (m.type === 'error') {
        setError(m.message);
      } else if (m.type === 'playerLeft') {
        setError(m.reason);
      }
    };
    client.addMessageHandler(handler);
  }, [opts.client]);

  const submit = useCallback((intent: Intent) => {
    driverRef.current?.submit(intent);
  }, []);

  const drainEvents = useCallback((): GameEvent[] => {
    const out = eventsRef.current;
    eventsRef.current = [];
    setEvents([]);
    return out;
  }, []);

  const myPlayer = opts.myPlayer;

  const legal = useMemo(() => {
    if (!state || !driverRef.current || myPlayer === null) return [];
    if (state.phase !== 'main') return [];
    const g = driverRef.current.game();
    if (g.currentPlayer() !== myPlayer) return [];
    return g.legalIntents(myPlayer);
  }, [state, myPlayer]);

  return { state, events, submit, legal, myPlayer, drainEvents, driver, error };
}
