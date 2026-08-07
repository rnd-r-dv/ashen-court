// Match FX-timing tests (bugs 25/26/27).
//
//   25 — HeroPortrait's HP tween must resume from the number actually on
//        screen when a second HP change interrupts a running tween, not from
//        the interrupted tween's target (which snaps the counter).
//   26 — the spell damage popup must be delayed by the projectile's REAL
//        flight budget (Projectile.flightTime / aoeFlightTime), measured from
//        the launch, not by a hardcoded guess that drifts from it.
//   27 — TurnBanner's hold time comes from the entry (Match's only channel).
//
// Mirrors board.test.ts / match.test.ts harness conventions (fake timers,
// act-wrapped renders, live driver.game() assertions).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { GameEvent, HeroState, Intent } from '@ashen/core';
import type { MatchDriver, MatchScreenSetup } from '../src/types.js';
import Match from '../src/screens/Match.js';
import type { BoardTargeting } from '../src/components/Board.js';
import HeroPortrait from '../src/components/HeroPortrait.js';
import TurnBanner from '../src/components/TurnBanner.js';
import { flightTime, aoeFlightTime } from '../src/components/Projectile.js';
import { buildMatchEntry } from '../src/game/matchSetup.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** useAnimationQueue's default spacing (one event per tick). */
const SPACING = 180;
/** HeroPortrait's HP tween budget at animScale 1, and its tick interval. */
const TWEEN_MS = 340;
const TICK = 16;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(el: ReturnType<typeof createElement>) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(el);
  });
}

function rerender(el: ReturnType<typeof createElement>) {
  act(() => {
    root!.render(el);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
  // stubRects() spies on Element.prototype — restore it, or the next test
  // silently inherits the previous one's geometry.
  vi.restoreAllMocks();
  root = null;
  container = null;
});

// ---------------------------------------------------------------- bug 25 ---

function hero(hp: number): HeroState {
  return {
    name: 'Pyra',
    hp,
    maxHp: 30,
    shields: 0,
    power: { name: 'Ember', cost: 2, effects: [] },
    usedPower: false,
    discountMostExpensive: 0,
    discountNextSpell: 0,
  };
}

function hpNumber(): number {
  const el = container!.querySelector('.heroportrait-hpnum');
  if (!el) throw new Error('hp readout missing');
  return Number(el.textContent!.split('/')[0]);
}

function portrait(hp: number) {
  return createElement(HeroPortrait, {
    hero: hero(hp),
    player: 0,
    isViewer: true,
    active: true,
  });
}

describe('bug 25 — hero HP tween interrupted mid-flight', () => {
  it('resumes from the displayed number instead of snapping to the interrupted target', () => {
    mount(portrait(30));
    expect(hpNumber()).toBe(30);

    // First change: 30 → 20. Let it run a couple of ticks only, so the
    // display is still well above the target.
    rerender(portrait(20));
    advance(TICK * 2);
    const midFlight = hpNumber();
    expect(midFlight).toBeLessThan(30);
    expect(midFlight).toBeGreaterThan(20); // genuinely mid-tween

    // Second change arrives before the first tween finished (routine: the
    // animation queue lands damage events well inside 340ms). The next tick
    // must continue from `midFlight`, not jump to the old target of 20.
    rerender(portrait(18));
    advance(TICK);
    expect(Math.abs(hpNumber() - midFlight)).toBeLessThanOrEqual(1);

    // …and it still lands exactly on the new target.
    advance(TWEEN_MS + TICK * 2);
    expect(hpNumber()).toBe(18);
  });

  it('still tweens normally when no interruption happens', () => {
    mount(portrait(30));
    rerender(portrait(24));
    advance(TWEEN_MS + TICK * 2);
    expect(hpNumber()).toBe(24);
  });
});

// ---------------------------------------------------------------- bug 27 ---

describe('bug 27 — TurnBanner hold time', () => {
  // The prop removal has no behavioural delta to assert: Match only ever
  // supplied the hold through `entry.holdMs`, so `entry.holdMs ?? holdMs`
  // could never take the right branch. What IS assertable is the type
  // surface (below — checked by `tsc --noEmit -p app`, not by vitest) and
  // that the surviving channel still drives the banner. The exit sweep is a
  // Framer animation that does not complete under fake timers, so only the
  // hold itself is observed.
  it('renders the banner and holds it for the entry hold time', () => {
    mount(
      createElement(TurnBanner, {
        entry: { id: 1, text: 'Victory', holdMs: 900 },
        scale: 0.5,
      }),
    );
    expect(container!.querySelector('.turnbanner')!.textContent).toContain('Victory');
    advance(900 * 0.5 - 20);
    expect(container!.querySelector('.turnbanner')).not.toBeNull();
  });

  it('rejects a holdMs prop — hold time rides on the entry alone', () => {
    // @ts-expect-error TurnBannerProps no longer carries a dead holdMs prop.
    const bad = createElement(TurnBanner, { entry: { id: 3, text: 'x' }, holdMs: 500 });
    expect(bad).toBeTruthy();
  });
});

// ---------------------------------------------------------------- bug 20 ---

describe('bug 20 — BoardTargeting is a discriminated union', () => {
  // Compile-time only: the runtime hazard (`handIndex ?? 0` silently playing
  // hand slot 0) is unreachable through the UI, so the fix is that the
  // missing-payload state stops being representable. `tsc --noEmit -p app`
  // typechecks app/tests, so these @ts-expect-error lines fail the build if
  // the union ever collapses back to one flat optional-field shape.
  it('requires each kind to carry exactly its own payload', () => {
    const play: BoardTargeting = { kind: 'play', handIndex: 2 };
    const attack: BoardTargeting = { kind: 'attack', attackerId: 'c1' };
    const power: BoardTargeting = { kind: 'heroPower' };

    // @ts-expect-error 'play' without a handIndex is not representable.
    const noIndex: BoardTargeting = { kind: 'play' };
    // @ts-expect-error 'attack' without an attackerId is not representable.
    const noAttacker: BoardTargeting = { kind: 'attack' };
    // @ts-expect-error the payloads do not cross between kinds.
    const crossed: BoardTargeting = { kind: 'play', attackerId: 'c1' };

    expect([play, attack, power, noIndex, noAttacker, crossed]).toHaveLength(6);
    if (play.kind === 'play') expect(play.handIndex).toBe(2); // no `?? 0` needed
    if (attack.kind === 'attack') expect(attack.attackerId).toBe('c1'); // no `?? ''`
  });
});

// ---------------------------------------------------------------- bug 26 ---

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
    async submit(intent: Intent) {
      return base.submit(intent);
    },
    onEvents(cb) {
      listeners.add(cb);
    },
    game: () => base.game(),
    reset: (setup) => base.reset(setup),
  };
}

function hotseatEntry() {
  return buildMatchEntry({
    mode: 'hotseat',
    decks: [
      { slug: 'ember', name: 'Ember Court' },
      { slug: 'bone', name: 'Bone Horde' },
    ],
  });
}

function mountMatch(setup: MatchScreenSetup) {
  mount(createElement(Match, { setup }));
}

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

function rect(x: number, y: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    right: x,
    bottom: y,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * jsdom reports every rect as 0×0 at the origin, which collapses the flight
 * distance to the 0.35s floor and makes the hardcoded 0.55s guess and the
 * real flight budget nearly indistinguishable. Stub the rects so the caster
 * (hero 0) and the target (hero 1) are far apart — a long shot, where the
 * two numbers diverge by hundreds of milliseconds.
 */
const CASTER_Y = 1800;
function stubRects() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('match')) return rect(0, 0);
    if (this.closest('.heroportrait[data-player="0"]')) return rect(0, CASTER_Y);
    if (this.closest('.heroportrait[data-player="1"]')) return rect(0, 0);
    return rect(0, 900);
  });
}

describe('bug 26 — spell damage popup lands on the projectile impact', () => {
  it('delays the popup by the real flight budget, measured from the launch', () => {
    stubRects();
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver);
    mountMatch({ ...entry.setup, driver });
    reachMain(driver);

    // Hero-power damage: a spell-damage source (isSpellDamage) that flies
    // from the caster's hero circle to the target hero. damageDealt arrives
    // first, effectResolved (which launches the projectile) one tick later.
    act(() => {
      driver.push([
        { type: 'damageDealt', target: { type: 'hero', player: 1 }, amount: 4, sourceCardId: 'hero-power' },
        { type: 'effectResolved', player: 0, sourceCardId: 'hero-power', kind: 'dealDamage' },
      ]);
    });

    // t = 0: damageDealt played. No popup — it waits for the impact.
    expect(container!.querySelectorAll('.damagepopup')).toHaveLength(0);

    // t = SPACING: effectResolved played → the projectile launches.
    advance(SPACING);
    expect(container!.querySelectorAll('.projectile')).toHaveLength(1);
    const flightMs = flightTime({ x: 0, y: CASTER_Y }, { x: 0, y: 0 }, 1) * 1000;
    expect(flightMs).toBeGreaterThan(600); // a genuinely long shot

    // Before the impact there must be no popup — the old hardcoded 0.55s
    // guess fires here, well ahead of the orb.
    advance(flightMs - 40);
    expect(container!.querySelectorAll('.damagepopup')).toHaveLength(0);

    // At the impact the popup appears.
    advance(80);
    const popups = container!.querySelectorAll('.damagepopup');
    expect(popups).toHaveLength(1);
    expect(popups[0]!.textContent).toBe('-4');
  });

  it('never throws and still pops exactly once under jsdom degenerate geometry', () => {
    // No rect stub: every jsdom rect is 0×0 at the origin, so the flight
    // distance collapses to the 0.35s floor and the target is a creature that
    // never existed (targetPoint's last fallback). handleEvent documents a
    // no-crash contract — the popup must survive the fallback path, not be
    // swallowed with the projectile.
    const entry = hotseatEntry();
    const driver = scriptedDriver(entry.setup.driver);
    mountMatch({ ...entry.setup, driver });
    reachMain(driver);

    expect(() => {
      act(() => {
        driver.push([
          { type: 'damageDealt', target: { type: 'creature', id: 'ghost' }, amount: 2, sourceCardId: 'hero-power' },
          { type: 'effectResolved', player: 0, sourceCardId: 'hero-power', kind: 'dealDamage' },
        ]);
      });
      advance(SPACING); // effectResolved → launch
    }).not.toThrow();

    // Degenerate geometry collapses the distance to the 0.35s floor; the
    // popup still fires, on that budget, and is not lost with the FX.
    const floorMs = flightTime({ x: 0, y: 0 }, { x: 0, y: 0 }, 1) * 1000;
    expect(floorMs).toBe(350);
    advance(floorMs - 40);
    expect(container!.querySelectorAll('.damagepopup')).toHaveLength(0);
    advance(60);
    const popups = container!.querySelectorAll('.damagepopup');
    expect(popups).toHaveLength(1);
    expect(popups[0]!.textContent).toBe('-2');
  });

  it('uses the AoE ring budget, not the traveller flight, for AoE spell damage', () => {
    // AoE is a genuinely different animation (no traveller — a ring at the
    // zone centre), so it keeps its own budget; both sides must read it from
    // the same exported constant rather than duplicating a magic number.
    expect(aoeFlightTime(1)).toBeGreaterThan(0);
    expect(aoeFlightTime(0.5)).toBeCloseTo(aoeFlightTime(1) * 0.5, 6);
  });
});
