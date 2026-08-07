// useLanMatch (Task 34 + fix rounds) — the LAN-side counterpart to useMatch
// (Task 30). Given the LanClient plus the room parameters (host knows them at
// createRoom; the guest receives them in the 'joined' message and feeds them
// in via props), it builds the shadow Game (same seed/deck/hero/registry as
// the server), creates the LAN MatchDriver, and mirrors useMatch's shape so
// match screens can consume LAN play through the same interface.
//
// Fix round 2: the DRIVER owns echo application (createLanDriver registers its
// own handler on the client at construction and applies every echoed intent to
// the shadow, forwarding the resolution tree to onEvents subscribers). The
// hook therefore no longer touches intents itself: like useMatch, it just
// subscribes to driver.onEvents to queue batches and mirror the shadow state
// while it is mounted (the LAN screens render nothing from the hook's state,
// but the mirror keeps the hook consistent with the Match screen). Because the
// driver's handler lives on the LanClient — not in this hook — the match keeps
// advancing after the screens navigate away at gameStart (round 1's frozen
// match screen). The hook has NO client protocol handler of its own anymore:
// 'joined' rebuilds live in the driver, rematchStart is App's session
// handler, and errors surface via the driver's onError. The hook's onEvents
// listener checks a disposed flag so an unmounted hook never touches React
// state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardRegistry, Game, HEROES, buildPool, summarize } from '@ashen/core';
import type { Card, GameEvent, GameState, HeroSpec, Intent, PlayerIndex } from '@ashen/core';
import type { MatchResult } from '../types.js';
import type { LanClient } from './lanClient.js';
import { createLanDriver } from './lanDriver.js';
import type { LanMatchDriver } from './lanDriver.js';

/** Everything needed to build the shadow Game. heroes are hero NAMES (v1 wire
 *  convention: heroId is a name; the server resolves by name and sends the
 *  names back). customCards is the FULL merged registry the server sent. */
export interface LanRoomParams {
  decks: [string[], string[]];  // [host, guest]
  heroes: [string, string];     // hero NAMES
  customCards: Card[];          // full merged registry (server-sent cards)
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
  driver: LanMatchDriver | null;
  error: string | null;
} {
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [driver, setDriver] = useState<LanMatchDriver | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventsRef = useRef<GameEvent[]>([]);
  const allEventsRef = useRef<GameEvent[]>([]); // full log: summarized for stats
  const driverRef = useRef<LanMatchDriver | null>(null);
  const gameOverFiredRef = useRef(false);
  const disposedRef = useRef(false);
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

  // Stable listener for driver.onEvents (mirrors useMatch): the driver
  // forwards each echoed intent's resolution tree here. The disposed guard
  // makes an unmounted hook a no-op (the LAN screens navigate away at
  // gameStart; the Match screen's own useMatch subscription takes over).
  const listenerRef = useRef<(events: GameEvent[]) => void>(() => {});
  listenerRef.current = (batch) => {
    if (disposedRef.current) return;
    handleBatch(batch);
  };

  /** Build the shadow Game + driver for `room`. */
  const buildDriver = useCallback((room: LanRoomParams, myPlayer: PlayerIndex) => {
    const client = opts.client;
    if (!client) return;
    const heroes = room.heroes.map(name => HEROES.find(h => h.name === name) ?? HEROES[0]!);
    const registry = new CardRegistry([...buildPool(), ...room.customCards]);
    const shadow = Game.create(
      { decks: room.decks, heroes: heroes as [HeroSpec, HeroSpec], seed: room.seed },
      registry,
    );
    const d = createLanDriver(
      client,
      shadow,
      (msg) => setError(msg),
      (kind) => setError(`connection out of sync (${kind} intent) — rejoin by code`),
    );
    d.onEvents(listenerRef.current); // the driver now owns application; we mirror
    driverRef.current = d;
    setDriver(d);
    setState({ ...shadow.state });
  }, [opts.client]);

  // Build the shadow Game + driver once the room and player are known.
  useEffect(() => {
    disposedRef.current = false;
    const { room, myPlayer } = opts;
    if (!room || myPlayer === null || driverRef.current) return;
    buildDriver(room, myPlayer);
    return () => {
      disposedRef.current = true;
    };
  }, [opts.room, opts.myPlayer, buildDriver]);

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
