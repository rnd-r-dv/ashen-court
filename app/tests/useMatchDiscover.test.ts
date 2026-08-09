// useMatch discover tests (Task 3). The hook must treat a pending choice's
// owner as the temporary actor even when that owner is not the current player:
//   - the bot resolves a bot-owned choice that arrives during the HUMAN's turn
//     (owner 1 while currentPlayer is 0), and the resolution does not advance
//     the turn;
//   - a choice owned by the human while the BOT's turn is active is exposed to
//     the human as discover intents through `legal` (off-turn), the bot waits
//     (no stale/rejected submission during the pacing window), and resolving
//     hands the turn back to the bot to finish.
// Real engine throughout: choices are injected through the Game's own
// discoverOffered event dispatch (the same path the LAN server uses), the bot
// is a real core policy, and only the driver's listener set is stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { buildPool, CardRegistry, DECK_DEFS, expandDeck, Game, HEROES } from '@ashen/core';
import type { GameEvent, Intent, MatchSetup, PendingChoice, PlayerIndex } from '@ashen/core';
import { createLocalDriver } from '../src/game/drivers.js';
import { useMatch } from '../src/game/useMatch.js';
import type { UseMatchApi, UseMatchOpts } from '../src/game/useMatch.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BOT_PACING_MS = 300;
const pool = new CardRegistry(buildPool());
const deck = expandDeck(DECK_DEFS.ember);
const CANDIDATES = ['neutral-boar', 'neutral-militia', 'neutral-scroll'];

function makeSetup(seed: number): MatchSetup {
  return { seed, decks: [deck, deck], heroes: [HEROES[0]!, HEROES[6]!] };
}

function choice(player: PlayerIndex): PendingChoice {
  return { kind: 'discover', player, cardIds: CANDIDATES };
}

/** Local driver that additionally lets the test push synthetic (incl. empty) batches. */
interface ScriptedDriver {
  submit(intent: Intent): Promise<GameEvent[]>;
  onEvents(cb: (events: GameEvent[]) => void): void;
  game(): Game;
  reset(setup: MatchSetup): void;
  push(batch: GameEvent[]): void;
}
function scriptedDriver(base: ReturnType<typeof createLocalDriver>): ScriptedDriver {
  const listeners = new Set<(events: GameEvent[]) => void>();
  base.onEvents((batch) => {
    for (const cb of [...listeners]) cb(batch);
  });
  return {
    push(batch) {
      for (const cb of [...listeners]) cb(batch);
    },
    async submit(intent) {
      return base.submit(intent);
    },
    onEvents(cb) {
      listeners.add(cb);
    },
    game: () => base.game(),
    reset: (setup) => base.reset(setup),
  };
}

/** Mount useMatch in a real react-dom root; `api` is a LIVE getter. */
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

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Human (0) mulligans, then the bot (1) mulligans on its pacing delay. */
function reachMain(hook: { api: UseMatchApi }, driver: ScriptedDriver) {
  act(() => {
    hook.api.submit({ kind: 'mulligan', keep: [] });
  });
  advance(BOT_PACING_MS * 2);
  if (driver.game().state.phase !== 'main') {
    throw new Error(`expected main phase, got ${driver.game().state.phase}`);
  }
  expect(driver.game().currentPlayer()).toBe(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useMatch — bot-owned pending choice', () => {
  it('resolves a bot-owned discover when the owner is not the current player', () => {
    const driver = scriptedDriver(createLocalDriver(Game.create(makeSetup(21), pool)));
    const hook = mountHook({ driver, myPlayer: 0, bot: { level: 'recruit' } });
    try {
      reachMain(hook, driver);
      // A bot-owned choice lands while it is the HUMAN's turn.
      driver.game().applyEvent({ type: 'discoverOffered', choice: choice(1) });
      act(() => {
        driver.push([]);
      });
      expect(hook.api.state.pendingChoice?.player).toBe(1);
      // The human has no legal intents while the bot chooses (suspended legality).
      expect(hook.api.legal).toEqual([]);

      const botHandBefore = [...driver.game().state.players[1].hand];
      // The bot resolves within its pacing window.
      advance(BOT_PACING_MS * 2);
      const g = driver.game();
      expect(g.state.pendingChoice).toBeNull();
      // discoverResolved appends the chosen candidate to the owner's hand.
      expect(g.state.players[1].hand.length).toBe(botHandBefore.length + 1);
      const added = g.state.players[1].hand[g.state.players[1].hand.length - 1];
      expect(CANDIDATES).toContain(added);
      // Resolution only adds the card — the turn does not advance.
      expect(g.currentPlayer()).toBe(0);
      expect(g.state.turn).toBe(0);
    } finally {
      hook.unmount();
    }
  });
});

describe('useMatch — human-owned pending choice off-turn', () => {
  it('exposes discover intents to the human on the bot\'s turn and makes the bot wait', async () => {
    const driver = scriptedDriver(createLocalDriver(Game.create(makeSetup(22), pool)));
    const onError = vi.fn();
    const hook = mountHook({ driver, myPlayer: 0, bot: { level: 'recruit' }, onError });
    try {
      reachMain(hook, driver);
      // Hand the turn to the bot (its move is queued on the pacing delay).
      act(() => {
        hook.api.submit({ kind: 'endTurn' });
      });
      expect(driver.game().currentPlayer()).toBe(1);

      // A HUMAN-owned choice lands while the bot's turn is active.
      driver.game().applyEvent({ type: 'discoverOffered', choice: choice(0) });
      act(() => {
        driver.push([]);
      });
      expect(hook.api.state.pendingChoice?.player).toBe(0);

      // legal exposes the three discover intents even though it is not the
      // human's turn (suspended legality names the pending owner).
      expect(hook.api.legal).toEqual([
        { kind: 'discover', choice: 0 },
        { kind: 'discover', choice: 1 },
        { kind: 'discover', choice: 2 },
      ]);

      // The bot's queued move must NOT fire across the pacing window (a stale
      // submission would be rejected by the engine and surface as an error).
      await act(async () => {
        vi.advanceTimersByTime(BOT_PACING_MS * 3);
      });
      expect(onError).not.toHaveBeenCalled();
      expect(driver.game().state.pendingChoice?.player).toBe(0);
      expect(driver.game().currentPlayer()).toBe(1); // the bot did not end turn

      // The human resolves; the bot resumes its interrupted turn afterwards.
      const handBefore = [...driver.game().state.players[0].hand];
      act(() => {
        hook.api.submit({ kind: 'discover', choice: 1 });
      });
      const g = driver.game();
      expect(g.state.pendingChoice).toBeNull();
      // discoverResolved appends the chosen card to the owner's hand.
      expect(g.state.players[0].hand.length).toBe(handBefore.length + 1);
      expect(g.state.players[0].hand[g.state.players[0].hand.length - 1]).toBe('neutral-militia');
      expect(g.currentPlayer()).toBe(1);
      for (let i = 0; i < 200 && driver.game().currentPlayer() !== 0; i++) {
        advance(BOT_PACING_MS);
        if (driver.game().state.phase === 'gameOver') break;
      }
      expect(driver.game().state.phase).not.toBe('gameOver');
    } finally {
      hook.unmount();
    }
  });
});
