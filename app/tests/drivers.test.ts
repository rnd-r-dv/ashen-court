// Match driver + useMatch tests (Task 30). Covers: the local driver's
// submit/onEvents contract, useMatch driving turns against a Recruit bot
// (mulligan via mulliganPolicy, turns via chooseIntent, 300ms pacing),
// driver.reset rematch semantics, a full bot-vs-bot game through two drivers,
// and the LAN stub rejecting until Task 34.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  buildPool,
  CardRegistry,
  createBot,
  DECK_DEFS,
  expandDeck,
  Game,
  HEROES,
  mulliganPolicy,
} from '@ashen/core';
import type { GameEvent, Intent, MatchSetup } from '@ashen/core';
import { createLanDriver, createLocalDriver } from '../src/game/drivers.js';
import { useMatch } from '../src/game/useMatch.js';
import type { UseMatchOpts, UseMatchApi } from '../src/game/useMatch.js';

// React 18's act() requires the testing-environment flag, or it warns and runs
// in a degraded mode. jsdom does not set it; we drive useMatch via act here.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Bot pacing delay in useMatch (mirrors BOT_PACING_MS in useMatch.ts). */
const PACING = 300;

const pool = new CardRegistry(buildPool());
const deck = expandDeck(DECK_DEFS.ember);

function makeSetup(seed: number): MatchSetup {
  return { seed, decks: [deck, deck], heroes: [HEROES[0]!, HEROES[6]!] };
}

function makeGame(seed: number): Game {
  return Game.create(makeSetup(seed), pool);
}

/**
 * Mount useMatch in a real react-dom root (no testing-library in the app's
 * deps). The probe component hands the latest hook return value to the holder
 * on every render, and `api` is a LIVE getter over it — assertions always read
 * the freshest state without destructuring a stale snapshot.
 */
function mountHook(opts: UseMatchOpts): { api: UseMatchApi; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const holder: { api: UseMatchApi | undefined } = { api: undefined };
  function Probe() {
    const result = useMatch(opts);
    useEffect(() => {
      holder.api = result;
    });
    return null;
  }
  act(() => {
    root.render(createElement(Probe));
  });
  if (!holder.api) throw new Error('useMatch did not mount');
  return {
    get api() {
      return holder.api as UseMatchApi;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('local driver', () => {
  it('submit returns the resolution tree and onEvents fires with it', async () => {
    const game = makeGame(1);
    const driver = createLocalDriver(game);
    const seen: GameEvent[][] = [];
    driver.onEvents((batch) => seen.push(batch));
    const events = await driver.submit({ kind: 'mulligan', keep: [] });
    // player 0 redraws its full starting hand
    expect(events.length).toBe(3);
    expect(events.every((e) => e.type === 'cardDrawn')).toBe(true);
    expect(seen).toEqual([events]);
    expect(driver.game()).toBe(game);
    expect(game.state.mulligansDone[0]).toBe(true);
  });

  it('two local drivers over one game complete a full bot match', async () => {
    const game = makeGame(3);
    const d0 = createLocalDriver(game);
    const d1 = createLocalDriver(game);
    const seen0: GameEvent[][] = [];
    const seen1: GameEvent[][] = [];
    d0.onEvents((b) => seen0.push(b));
    d1.onEvents((b) => seen1.push(b));
    // each seat submits through its own driver; both share the same game
    const submit = (me: 0 | 1, intent: Intent) => (me === 0 ? d0 : d1).submit(intent);
    await submit(0, mulliganPolicy(game, 0));
    await submit(1, mulliganPolicy(game, 1));
    // Belt-and-suspenders guard: the engine's own turn-limit draw always ends
    // a bot match with a gameOver event, so this loop terminates by itself.
    for (let guard = 0; game.state.phase !== 'gameOver' && guard < 10000; guard++) {
      const me = game.currentPlayer();
      await submit(me, createBot('recruit').chooseIntent(game, me));
    }
    expect(game.state.phase).toBe('gameOver');
    expect(seen0.length).toBeGreaterThan(0);
    expect(seen1.length).toBeGreaterThan(0);
  });

  it('reset replaces the underlying game with a fresh valid one', async () => {
    const game = makeGame(1);
    const driver = createLocalDriver(game);
    driver.reset(makeSetup(99));
    const fresh = makeGame(99);
    expect(driver.game()).not.toBe(game);
    expect(driver.game().state.seed).toBe(99);
    // new seed → a different (deterministic) shuffle than the original game
    expect(driver.game().state.players[0].deck).not.toEqual(game.state.players[0].deck);
    // and a valid, playable state matching a directly-constructed game
    expect(driver.game().state.phase).toBe('mulligan');
    expect(driver.game().state.players[0].hand).toHaveLength(3);
    expect(driver.game().state.players[0].deck).toEqual(fresh.state.players[0].deck);
    expect(driver.game().registry).toBe(pool);
    const events = await driver.submit({ kind: 'mulligan', keep: [] });
    expect(events.length).toBe(3);
    expect(driver.game().state.mulligansDone[0]).toBe(true);
  });
});

describe('useMatch', () => {
  it('drives turns against a Recruit bot and reaches the human turn 2', async () => {
    const driver = createLocalDriver(makeGame(7));
    const hook = mountHook({ driver, myPlayer: 0, bot: { level: 'recruit' } });
    try {
      // mulligan: player 0 (human) first, then the bot via mulliganPolicy
      act(() => {
        hook.api.submit({ kind: 'mulligan', keep: [0] });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PACING);
      });
      expect(hook.api.state.phase).toBe('main');
      expect(hook.api.state.turn).toBe(0);
      // human turn: legal is populated (and always offers endTurn)
      expect(hook.api.legal.length).toBeGreaterThan(0);
      expect(hook.api.legal.some((i) => i.kind === 'endTurn')).toBe(true);

      // human ends turn 0 → the bot plays its whole turn 1, pacing included
      act(() => {
        hook.api.submit({ kind: 'endTurn' });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PACING * 100);
      });
      expect(hook.api.state.phase).toBe('main');
      expect(hook.api.state.turn).toBeGreaterThanOrEqual(2); // bot turn 1 completed

      // the bot's events accumulated in the queue for the UI to drain
      let drained: GameEvent[] = [];
      act(() => {
        drained = hook.api.drainEvents();
      });
      expect(drained.length).toBeGreaterThan(0);
      expect(hook.api.events).toEqual([]);

      // second cycle: human turn 2 → bot turn 3
      act(() => {
        hook.api.submit({ kind: 'endTurn' });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PACING * 100);
      });
      expect(hook.api.state.phase).toBe('main');
      expect(hook.api.state.turn).toBeGreaterThanOrEqual(4);
    } finally {
      hook.unmount();
    }
  });
});

describe('LAN driver stub', () => {
  it('rejects submits until Task 34 lands', async () => {
    const driver = createLanDriver({}, makeGame(1));
    await expect(driver.submit({ kind: 'endTurn' })).rejects.toThrow('Task 34');
    expect(driver.game().state.phase).toBe('mulligan');
  });
});
