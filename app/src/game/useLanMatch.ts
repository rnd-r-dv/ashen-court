// useLanMatch (Task 34 + fix round) — the LAN-side counterpart to useMatch
// (Task 30). Given the LanClient plus the room parameters (host knows them at
// createRoom; the guest receives them in the 'joined' message and feeds them
// in via props), it builds the shadow Game (same seed/deck/hero/registry as
// the server), creates the LAN MatchDriver, and mirrors useMatch's shape so
// match screens can consume LAN play through the same interface. The driver
// owns the shadow: every accepted intent is broadcast back by the server as
// {type:'intent'} and applied exactly once via driver.applyIntent (no local
// pre-apply), the returned resolution tree is queued for animation, and the
// state mirror is refreshed from the shadow. On a mid-game reconnect the
// server re-sends joined + the intent log + gameStart; this hook rebuilds the
// shadow from seed on 'joined' so the replay catches up to the live state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardRegistry, Game, HEROES, buildPool, summarize } from '@ashen/core';
import type { Card, GameEvent, GameState, Intent, PlayerIndex } from '@ashen/core';
import type { MatchDriver, MatchResult } from '../types.js';
import type { LanClient } from './lanClient.js';
import type { ServerMessage } from '@ashen/server/protocol';
import { createLanDriver, heroNameForDeck } from './lanDriver.js';
import type { LanMatchDriver } from './lanDriver.js';

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
  const driverRef = useRef<LanMatchDriver | null>(null);
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

  /** Build (or rebuild, on reconnect) the shadow Game + driver for `room`. */
  const buildDriver = useCallback((room: LanRoomParams, myPlayer: PlayerIndex) => {
    const client = opts.client;
    if (!client) return;
    const hero = HEROES.find(h => h.name === room.heroId) ?? HEROES[0]!;
    const registry = new CardRegistry([...buildPool(), ...room.customCards]);
    const shadow = Game.create(
      { decks: [room.deckIds, room.deckIds], heroes: [hero, hero], seed: room.seed },
      registry,
    );
    const d = createLanDriver(
      client,
      shadow,
      (msg) => setError(msg),
      (kind) => setError(`connection out of sync (${kind} intent) — rejoin by code`),
    );
    driverRef.current = d;
    setDriver(d);
    setState({ ...shadow.state });
  }, [opts.client]);

  // Build the shadow Game + driver once the room and player are known.
  useEffect(() => {
    const { room, myPlayer } = opts;
    if (!room || myPlayer === null || driverRef.current) return;
    roomRef.current = room;
    playerRef.current = myPlayer;
    buildDriver(room, myPlayer);
  }, [opts.room, opts.myPlayer, buildDriver]);

  // Protocol messages the match needs beyond the event stream. Pre-match
  // messages (roomCreated/joined/opponentJoined/gameStart) are handled by the
  // screens' own connectLan handler; this handler reacts to in-match control
  // messages plus the rejoin replay sequence.
  useEffect(() => {
    const client = opts.client;
    if (!client) return;
    const handler = (m: ServerMessage) => {
      if (m.type === 'joined') {
        // Mid-game reconnect: the server re-sent the setup and will replay the
        // intent log (joined → intents → gameStart). Rebuild the shadow fresh
        // from seed so the replay applies cleanly. (Initial join is handled by
        // the build effect above — the driver does not exist yet here.)
        if (driverRef.current) {
          const room: LanRoomParams = {
            deckIds: m.deckIds,
            customCards: m.cards,
            heroId: heroNameForDeck(m.deckIds), // host resolves identically
            seed: m.seed,
          };
          roomRef.current = room;
          playerRef.current = m.player;
          buildDriver(room, m.player);
        }
      } else if (m.type === 'intent') {
        const d = driverRef.current;
        if (!d) return;
        // Single application point: apply the echoed intent to the shadow, then
        // queue its resolution tree for animation (identical to the server's
        // events broadcast; the tree also animates reconnect-log replays).
        const tree = d.applyIntent(m.intent);
        if (tree.length > 0) handleBatch(tree);
      } else if (m.type === 'rematchStart') {
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
  }, [opts.client, buildDriver, handleBatch]);

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
