// Match-screen audit-fix tests (Fix Slice E, audit 04). Mounts the real Match
// screen in jsdom over scripted drivers and pins the seam fixes:
//
//   I1 — the awaiting double-submit guard (a second click inside the LAN echo
//        latency window must not submit again) and its release on the
//        empty-batch mulligan keep-all (audit M7), plus the rejected-intent
//        surfacing (transient banner, guard released, no unhandled rejection).
//   M1 — shield-absorbed hits (damageDealt amount 0) never popup a '-0'.
//   I3 — the LAN divergence banner renders off driver.resyncRequested.
//   M6 — at game over the hotseat hand area is an empty placeholder, so the
//        winner's hand size never leaks to the other seat.
//
// Mirrors board.test.ts's harness conventions (fake timers, act-wrapped
// clicks, live driver.game() assertions).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { GameEvent, Intent } from '@ashen/core';
import type { MatchDriver, MatchScreenSetup } from '../src/types.js';
import Match from '../src/screens/Match.js';
import { buildMatchEntry } from '../src/game/matchSetup.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** useAnimationQueue's default spacing — a generous advance fully drains it. */
const SPACING = 180;
/** Echo latency for the LAN-window simulation. */
const ECHO_MS = 30;

/** Two-deck hotseat entry (both players human, no bot auto-play). */
function hotseatEntry() {
  return buildMatchEntry({
    mode: 'hotseat',
    decks: [
      { slug: 'ember', name: 'Ember Court' },
      { slug: 'bone', name: 'Bone Horde' },
    ],
  });
}

/**
 * Local driver whose echo (and therefore application + events) arrives
 * `delayMs` later — the LAN latency window between submit and the echoed
 * intent applying to the shadow.
 */
function deferringDriver(base: MatchDriver, delayMs = ECHO_MS): MatchDriver {
  return {
    submit(intent: Intent): Promise<GameEvent[]> {
      return new Promise((resolve) => {
        setTimeout(() => {
          void base.submit(intent).then(resolve);
        }, delayMs);
      });
    },
    onEvents: (cb) => base.onEvents(cb),
    game: () => base.game(),
    reset: (setup) => base.reset(setup),
  };
}

/** Local driver whose submit always rejects (the engine's duplicate-submit path). */
function rejectingDriver(base: MatchDriver): MatchDriver {
  return {
    async submit(): Promise<GameEvent[]> {
      throw new Error('Bad hand index');
    },
    onEvents: () => {}, // the mirror never advances in these tests
    game: () => base.game(),
    reset: (setup) => base.reset(setup),
  };
}

/** Local driver that additionally lets the test push synthetic event batches. */
interface ScriptedDriver extends MatchDriver {
  push(batch: GameEvent[]): void;
}
function scriptedDriver(base: MatchDriver): ScriptedDriver {
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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(setup: MatchScreenSetup) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Match, { setup }));
  });
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target not found');
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Submit both mulligans (redraw all) through the engine and drain the queue. */
function reachMain(driver: ScriptedDriver) {
  act(() => {
    void driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  act(() => {
    void driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  expect(driver.game().state.phase).toBe('main');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
  root = null;
  container = null;
});

describe('I1 — awaiting double-submit guard', () => {
  it('suppresses a duplicate submit in the latency window and releases on the empty-batch keep-all', () => {
    const entry = hotseatEntry();
    const driver = deferringDriver(entry.setup.driver);
    mount({ ...entry.setup, driver });

    const game = () => entry.setup.driver.game();
    expect(game().state.phase).toBe('mulligan');
    const confirm = () => document.querySelector('.mulligan .shell-btn-primary');

    // Two rapid clicks inside the echo latency window: only the first may
    // submit (the second is the audit's duplicate LAN intent). Player 0 keeps
    // all 3 cards, so the first echo is an EMPTY batch (audit M7) — which is
    // also what the guard's release must survive (no events to arrive).
    click(confirm());
    click(confirm());
    advance(ECHO_MS + 10);

    // Exactly one mulligan applied — the duplicate was suppressed, and the
    // guard released despite the empty batch (state mirror changed).
    expect(game().state.mulligansDone).toEqual([true, false]);
    expect(game().state.phase).toBe('mulligan');

    // The pass overlay hands the device to player 1; their mulligan confirm
    // still goes through (the guard did not stick), and their keep-all emits
    // the startMain batch → main phase. Player 1 holds 4 cards (Mana Surge:
    // the second seat gets a surge card head start).
    click(document.querySelector('.pass-device-confirm'));
    expect(document.querySelectorAll('.mulligan-card').length).toBe(4);
    click(confirm());
    advance(ECHO_MS + 10);
    // Player 1's keep-all flips both mulligans done → startMain resets
    // mulligansDone to [false, false] and begins player 0's turn 0.
    expect(game().state.mulligansDone).toEqual([false, false]);
    expect(game().state.phase).toBe('main');
    expect(game().state.turn).toBe(0);
  });

  it('surfaces a rejected submit as a transient banner and releases the guard', async () => {
    const entry = hotseatEntry();
    mount({ ...entry.setup, driver: rejectingDriver(entry.setup.driver) });

    const confirm = () => document.querySelector('.mulligan .shell-btn-primary');
    click(confirm());
    // Flush the rejection microtask (the async driver.submit rejects after
    // the click callback returns; the .catch → onError path needs a tick).
    await act(async () => {});
    // The rejection surfaced as a banner — not an unhandled rejection.
    let alert = document.querySelector('.match-alert');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('Bad hand index');

    // Transient: auto-dismissed.
    advance(5000);
    expect(document.querySelector('.match-alert')).toBeNull();

    // The guard was released on error — a second submit is allowed and
    // surfaces the error again (a stuck guard would swallow it silently).
    click(confirm());
    await act(async () => {});
    alert = document.querySelector('.match-alert');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('Bad hand index');
  });
});

describe('M1 — shield-absorbed hits do not popup', () => {
  it('skips popup and shake for damageDealt amount 0, still pops real damage', () => {
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver);
    mount({ ...entry.setup, driver });
    reachMain(driver);

    // Shield-absorbed hit (amount 0): no '-0' popup.
    act(() => {
      driver.push([
        { type: 'damageDealt', target: { type: 'hero', player: 0 }, amount: 0, sourceCardId: 'x' },
      ]);
    });
    expect(document.querySelectorAll('.damagepopup').length).toBe(0);

    // Real damage: the popup lands on the queue's next tick, '-3' — never '-0'.
    act(() => {
      driver.push([
        { type: 'damageDealt', target: { type: 'hero', player: 0 }, amount: 3, sourceCardId: 'x' },
      ]);
    });
    expect(document.querySelectorAll('.damagepopup').length).toBe(0); // waits for the armed tick
    advance(SPACING);
    const popups = document.querySelectorAll('.damagepopup');
    expect(popups.length).toBe(1);
    expect(popups[0]!.textContent).toBe('-3');
  });
});

describe('I3 — LAN divergence banner', () => {
  it('renders a persistent resync banner when the driver raises the flag', () => {
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver) as ScriptedDriver & {
      resyncRequested: boolean;
    };
    driver.resyncRequested = true;
    mount({ ...entry.setup, driver });

    const banner = document.querySelector('.match-alert--resync');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Out of sync');
  });

  it('renders nothing without the flag (local/hotseat drivers)', () => {
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver) as ScriptedDriver & {
      resyncRequested?: boolean;
    };
    driver.resyncRequested = false;
    mount({ ...entry.setup, driver });

    expect(document.querySelector('.match-alert--resync')).toBeNull();
  });
});

describe('M6 — hotseat game-over hand placeholder', () => {
  it('renders an empty hand area (no silhouettes) at game over', () => {
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver);
    mount({ ...entry.setup, driver });
    reachMain(driver);

    // Main phase: the viewer's own hand is up.
    expect(document.querySelectorAll('.hand-slot').length).toBeGreaterThan(0);

    // Force the mirror into the game-over state the 1.5s cinematic reads
    // (phase is a plain field; the mirror refreshes on the next batch).
    (driver.game().state as { phase: string }).phase = 'gameOver';
    act(() => {
      driver.push([]);
    });

    // The hand area renders an empty placeholder — no card silhouettes, no
    // hand-size leak to the other seat.
    const placeholder = document.querySelector('.match-handwrap .match-hand-hidden');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.querySelectorAll('.cardview').length).toBe(0);
  });
});
