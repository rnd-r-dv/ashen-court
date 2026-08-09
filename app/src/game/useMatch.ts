// useMatch (Task 30): the match controller hook. Subscribes to the driver's
// event pipeline (driver.onEvents — the single source of truth for both the
// local sync engine and the Task 34 LAN shadow game), mirrors the authoritative
// game state, queues event batches for the UI to drain, and auto-plays a bot
// opponent (mulligan via mulliganPolicy, turns via createBot(level).chooseIntent)
// with a small pacing delay between moves.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBot, mulliganPolicy } from '@ashen/core';
import type { Game, GameEvent, GameState, Intent, MatchStats, PlayerIndex } from '@ashen/core';
import type { BotLevel, MatchDriver, MatchResult } from '../types.js';

export interface UseMatchOpts {
  driver: MatchDriver;
  myPlayer: PlayerIndex;
  /** Auto-play the opponent as a bot at this level (omitted for hotseat). */
  bot?: { level: BotLevel };
  onGameOver?: (result: MatchResult) => void;
  /** A rejected driver.submit (invalid/duplicate intent) — surfaced instead of an unhandled rejection. */
  onError?: (message: string) => void;
}

export interface UseMatchApi {
  state: GameState;
  /** Event queue: batches accumulate here until the UI drains them. */
  events: GameEvent[];
  /** Submit one intent for the human player (validated against `legal`). */
  submit(intent: Intent): void;
  /** Legal intents for the human player; [] while it is not their turn. */
  legal: Intent[];
  myPlayer: PlayerIndex;
  /** Return and clear the pending event queue. */
  drainEvents(): GameEvent[];
}

/** Pacing delay between bot moves so the UI reads as a sequence, not a burst. */
const BOT_PACING_MS = 300;

/**
 * Minimal inline match stats until Task 35's core summarize() lands. Mirrors
 * the planned summarize(log): turns from turnEnd, damage from heroDamaged per
 * player, cards from cardPlayed per player.
 */
function summarizeLog(log: GameEvent[]): MatchStats {
  let turns = 0;
  const damageDealt: [number, number] = [0, 0];
  const cardsPlayed: [number, number] = [0, 0];
  for (const e of log) {
    switch (e.type) {
      case 'turnEnd':
        turns += 1;
        break;
      case 'heroDamaged':
        damageDealt[e.player] += e.amount;
        break;
      case 'cardPlayed':
        cardsPlayed[e.player] += 1;
        break;
    }
  }
  return { turns, damageDealt, cardsPlayed };
}

function matchResult(game: Game): MatchResult {
  const log = game.state.log;
  const over = [...log]
    .reverse()
    .find((e): e is Extract<GameEvent, { type: 'gameOver' }> => e.type === 'gameOver');
  return { winner: over?.winner ?? 'draw', stats: summarizeLog(log) };
}

export function useMatch(opts: UseMatchOpts): UseMatchApi {
  const { driver, myPlayer, bot, onGameOver, onError } = opts;

  // Latest-value refs (rendered each render; callbacks read them at call time).
  const botRef = useRef(bot);
  botRef.current = bot;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  /**
   * Submit and surface a rejected intent (invalid/duplicate — the engine
   * throws on stale hand indices, used powers, out-of-window turns) via
   * onError instead of an unhandled promise rejection. LAN submits never
   * reject (they only send; the echo applies later), so this is the local-
   * mode safety net; the Match screen renders the message as a transient
   * banner and releases its awaiting guard.
   */
  const safeSubmit = useCallback(
    (intent: Intent) => {
      void driver.submit(intent).catch((err: unknown) => {
        onErrorRef.current?.(err instanceof Error ? err.message : String(err));
      });
    },
    [driver],
  );
  const botPolicyRef = useRef(bot ? createBot(bot.level) : undefined);
  botPolicyRef.current = bot ? createBot(bot.level) : undefined;

  // Mirrored authoritative state + the UI event queue.
  const [state, setState] = useState<GameState>(() => ({ ...driver.game().state }));
  const [events, setEvents] = useState<GameEvent[]>([]);

  const pendingRef = useRef<GameEvent[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameOverNotifiedRef = useRef(false);
  const disposedRef = useRef(false);

  /**
   * The event processor: every batch (driver push, initial kick) flows through
   * here — queue the events, refresh the state mirror from the authoritative
   * game, fire onGameOver once, then keep driving the bot until it is the
   * human's turn or the game is over. Reads the engine directly (never React
   * state), so the bot loop advances without waiting for re-renders.
   */
  const stepRef = useRef<(events: GameEvent[]) => void>(() => {});
  stepRef.current = (batch) => {
    if (disposedRef.current) return;
    if (batch.length > 0) {
      pendingRef.current.push(...batch);
      setEvents([...pendingRef.current]);
    }
    const g = driver.game();
    setState({ ...g.state });
    if (g.state.phase === 'gameOver') {
      if (!gameOverNotifiedRef.current) {
        gameOverNotifiedRef.current = true;
        onGameOverRef.current?.(matchResult(g));
      }
      return;
    }
    const b = botRef.current;
    if (!b) return;
    const botPlayer = (1 - myPlayer) as PlayerIndex;
    // Task 3: a pending choice makes its OWNER the temporary actor even when
    // that owner is not the current player (start/end-turn triggers can offer a
    // choice to either player; see core/intents.ts). The bot is scheduled when
    // the choice belongs to it — and, conversely, a HUMAN-owned choice suspends
    // the bot's turn, because the human resolves it regardless of whose turn it
    // is (no current-player intent is legal until it resolves). Mulligan order
    // is FIXED by the engine (player 0 first, then player 1, tracked by
    // mulligansDone) regardless of who submits — turn stays 0 so
    // currentPlayer() is meaningless there. In main phase the bot plays while
    // currentPlayer() is the bot and nothing is pending.
    const botOwnsMove = (live: GameState): boolean => {
      const pending = live.pendingChoice;
      const mulliganActor = (live.mulligansDone[0] ? 1 : 0) as PlayerIndex;
      return (
        (pending !== null && pending.player === botPlayer) ||
        (live.phase === 'mulligan' && mulliganActor === botPlayer) ||
        (live.phase === 'main' && (live.turn % 2) as PlayerIndex === botPlayer && pending === null)
      );
    };
    if (!botOwnsMove(g.state)) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      // Re-derive at FIRE time, not schedule time: the pacing delay may have
      // been interrupted by a pending choice or turn change (e.g. a human-owned
      // choice landed while a bot move was queued). A stale submission would be
      // rejected by the engine and surface as a spurious error banner.
      const live = driver.game();
      if (!botOwnsMove(live.state)) return;
      const intent =
        live.state.phase === 'mulligan'
          ? mulliganPolicy(live, botPlayer)
          : botPolicyRef.current!.chooseIntent(live, botPlayer);
      safeSubmit(intent);
      // events arrive via onEvents → stepRef, which schedules the next move
    }, BOT_PACING_MS);
  };

  // Stable listener identity for driver.onEvents (a Set on the driver side, so
  // re-subscribing the same function is idempotent under effect re-runs).
  const listenerRef = useRef<(events: GameEvent[]) => void>((batch) => stepRef.current(batch));

  useEffect(() => {
    disposedRef.current = false;
    driver.onEvents(listenerRef.current);
    // Kick the loop: lets the bot open when it acts first (player-0 bot
    // mulligans/plays before the human in seat 1).
    stepRef.current([]);
    return () => {
      disposedRef.current = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [driver]);

  const submit = useCallback(
    (intent: Intent) => {
      // The driver notifies onEvents with the resulting batch (local: the
      // resolution tree; LAN (Task 34): the server echo), so the hook needs no
      // separate drain of submit's promise — only the rejection needs
      // handling (safeSubmit), so a bad intent never becomes an unhandled
      // rejection with zero user feedback.
      safeSubmit(intent);
    },
    [safeSubmit],
  );

  const drainEvents = useCallback((): GameEvent[] => {
    const drained = pendingRef.current;
    pendingRef.current = [];
    setEvents([]);
    return drained;
  }, []);

  const humanLegal = useMemo<Intent[]>(() => {
    const g = driver.game();
    const pending = g.state.pendingChoice;
    // Task 3: a pending choice names its owner as the temporary actor, so the
    // human's legal intents are theirs even when it is not their turn (the
    // engine suspends legality: the owner gets the discover intents, everyone
    // else gets []).
    const isHumanChoice = pending !== null && pending.player === myPlayer;
    const isHumanTurn = g.state.phase === 'main' && g.currentPlayer() === myPlayer;
    return isHumanTurn || isHumanChoice ? g.legalIntents(myPlayer) : [];
  }, [driver, myPlayer, state]);

  return { state, events, submit, legal: humanLegal, myPlayer, drainEvents };
}
