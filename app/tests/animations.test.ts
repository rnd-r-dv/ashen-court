// useAnimationQueue tests (Task 39 review round). Covers the Critical: the
// queue must animate EVERY event fed through it in sequential batches, even
// when a later batch is smaller than the events consumed so far (the old
// monotonic seenRef cursor dropped those because drainEvents() wipes the
// stream to [] after every ingest), and the pump guard: a batch arriving
// while a tick is pending must not fire its first event immediately (no
// double tick).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { act, createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { GameEvent } from '@ashen/core';
import type { Variants } from 'framer-motion';
import {
  useAnimationQueue,
  handEnter,
  playSlam,
  deathFade,
  manaPop,
  bannerSweep,
  dimVeil,
} from '../src/components/animations.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPACING = 50;

/** Minimal valid GameEvent (manaChanged) — the harness only counts/orders. */
function ev(n: number): GameEvent {
  return { type: 'manaChanged', player: 0, mana: n, maxMana: 10 };
}

interface QueueHarness {
  /** Append a batch to the events stream (mirrors useMatch's pendingRef). */
  add(batch: GameEvent[]): void;
  /** Drop every queued event instantly (useAnimationQueue.skip). */
  skip(): void;
  /** Events played so far, in order. */
  played: GameEvent[];
  /** Stand-in for the authoritative driver mirror: bumps on every batch. */
  version: number;
  unmount(): void;
}

/**
 * Mount useAnimationQueue in a real react-dom root (no testing-library in
 * the app's deps). The probe holds the events stream exactly like useMatch:
 * add() accumulates onto the pending array and drain() wipes it to [].
 */
function mountQueue(): QueueHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const played: GameEvent[] = [];
  const holder: {
    add: ((batch: GameEvent[]) => void) | undefined;
    skip: (() => void) | undefined;
  } = { add: undefined, skip: undefined };
  const version = { n: 0 };

  function Probe() {
    const [events, setEvents] = useState<GameEvent[]>([]);
    const queue = useAnimationQueue(events, {
      onEvent: (e) => {
        played.push(e);
      },
      drain: () => setEvents([]),
      spacing: SPACING,
    });
    useEffect(() => {
      holder.add = (batch) => {
        version.n += 1; // the authoritative mirror lands at the newest batch
        setEvents((prev) => [...prev, ...batch]);
      };
      holder.skip = queue.skip;
    });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    add: (batch: GameEvent[]) =>
      act(() => {
        holder.add!(batch);
      }),
    skip: () =>
      act(() => {
        holder.skip!();
      }),
    played,
    get version() {
      return version.n;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useAnimationQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays every event across sequential batches of any size (Critical: cursor reset)', () => {
    const h = mountQueue();
    // First batch: 9 events (the stream is drained after ingest).
    h.add(Array.from({ length: 9 }, (_, i) => ev(i)));
    act(() => {
      vi.advanceTimersByTime(9 * SPACING);
    });
    expect(h.played).toHaveLength(9);

    // Second batch: only 2 events — smaller than the 9 already consumed.
    // The old monotonic cursor dropped it entirely (nothing animated).
    h.add([ev(9), ev(10)]);
    act(() => {
      vi.advanceTimersByTime(2 * SPACING);
    });
    expect(h.played).toHaveLength(11);
    expect(h.played.map((e) => (e as { mana: number }).mana)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    h.unmount();
  });

  it('does not double-fire a batch that arrives while a tick is pending (pump guard)', () => {
    const h = mountQueue();
    h.add([ev(0), ev(1), ev(2)]); // first event fires on ingest, tick armed
    expect(h.played).toHaveLength(1);

    // A new batch arrives mid-playback: it must NOT fire its first event
    // immediately (that would be a second tick and a doubled timer).
    h.add([ev(3), ev(4)]);
    expect(h.played).toHaveLength(1);

    // Advancing the full schedule plays everything, in order.
    act(() => {
      vi.advanceTimersByTime(4 * SPACING);
    });
    expect(h.played.map((e) => (e as { mana: number }).mana)).toEqual([0, 1, 2, 3, 4]);
    h.unmount();
  });

  it('skip() drops the queued events without resurrecting them on the next batch', () => {
    const h = mountQueue();
    h.add([ev(0), ev(1), ev(2), ev(3)]);
    act(() => {
      vi.advanceTimersByTime(SPACING); // ev(0) fired on ingest, ev(1) at the tick
    });
    expect(h.played).toHaveLength(2);

    h.skip(); // clears the queue and the pending tick
    act(() => {
      vi.advanceTimersByTime(10 * SPACING);
    });
    expect(h.played).toHaveLength(2); // ev(2) / ev(3) never fire

    // A later batch plays only its own events.
    h.add([ev(4)]);
    act(() => {
      vi.advanceTimersByTime(SPACING);
    });
    expect(h.played.map((e) => (e as { mana: number }).mana)).toEqual([0, 1, 4]);
    h.unmount();
  });

  it('skip midway through two batches fires no later cosmetics and keeps the newest authoritative state', () => {
    const h = mountQueue();
    // Batch one starts playing.
    h.add([ev(0), ev(1), ev(2), ev(3)]);
    act(() => {
      vi.advanceTimersByTime(SPACING); // ev(0) on ingest, ev(1) at the tick
    });
    expect(h.played).toHaveLength(2);

    // A NEWER batch arrives mid-playback; the mirror is already at it.
    h.add([ev(4), ev(5), ev(6), ev(7), ev(8)]);
    expect(h.version).toBe(2);
    act(() => {
      vi.advanceTimersByTime(SPACING); // ev(2) from batch one fires before the skip
    });
    expect(h.played).toHaveLength(3);

    h.skip(); // midway through the second batch
    act(() => {
      vi.advanceTimersByTime(30 * SPACING);
    });
    // No later cosmetic handler fires — batch two's events never play.
    expect(h.played.map((e) => (e as { mana: number }).mana)).toEqual([0, 1, 2]);
    // The authoritative driver state stays at the newest batch (never reverted).
    expect(h.version).toBe(2);
    h.unmount();
  });
});

describe('Task 8 — Armorial motion grammar', () => {
  // Every exported variant factory must speak one grammar: the two Armorial
  // beats (140ms / 320ms) with linear or stepped easing, hard cuts, short
  // holds. No springs, bounce, glow (brightness/saturate filters), or depth
  // fades (scale-away / blur). scale=0 is the reduced-motion contract — every
  // transition reaches its final state instantly.
  const factories: Record<string, (scale?: number) => Variants> = {
    handEnter,
    playSlam,
    deathFade,
    manaPop,
    bannerSweep,
    dimVeil,
  };

  interface GrammarTransition {
    duration?: number;
    ease?: unknown;
    type?: string;
  }

  function collectTransitions(node: unknown, out: GrammarTransition[] = []): GrammarTransition[] {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'transition') out.push(value as GrammarTransition);
      else collectTransitions(value, out);
    }
    return out;
  }

  it('uses only the two Armorial beats, linearly, with no springs anywhere', () => {
    for (const [name, make] of Object.entries(factories)) {
      const transitions = collectTransitions(make(1));
      expect(transitions.length, `${name} must carry explicit transitions`).toBeGreaterThan(0);
      for (const t of transitions) {
        expect(t.type, `${name} must not spring or bounce`).not.toBe('spring');
        expect(t.ease, `${name} must move linearly (or step)`).toBe('linear');
        if (t.duration !== undefined) {
          expect([0.14, 0.32], `${name} may only use 140ms or 320ms`).toContain(t.duration);
        }
      }
    }
  });

  it('carries no glow or depth-fade recipes in any variant', () => {
    for (const [name, make] of Object.entries(factories)) {
      const json = JSON.stringify(make(1));
      expect(json, `${name} must not glow`).not.toContain('brightness');
      expect(json, `${name} must not saturate`).not.toContain('saturate');
      expect(json, `${name} must not depth-fade`).not.toContain('blur');
      expect(json, `${name} must not drop-shadow`).not.toContain('drop-shadow');
      expect(json, `${name} must not box-shadow`).not.toContain('boxShadow');
    }
  });

  it('scale 0 (reduced motion) zeroes every transition duration', () => {
    for (const [name, make] of Object.entries(factories)) {
      const transitions = collectTransitions(make(0));
      for (const t of transitions) {
        expect(t.duration, `${name} reduced-motion duration`).toBe(0);
      }
    }
  });

  it('match-shift CSS animation ends at rest — no hold fill', () => {
    // Captured in a const: Vite's jsdom transform rewrites the literal
    // `new URL(rel, import.meta.url)` asset pattern to resolve against the
    // document base, which fileURLToPath rejects. The const escapes the
    // rewrite (same idiom as cardTextWell.test.ts).
    const here = import.meta.url;
    const css = readFileSync(
      fileURLToPath(new URL('../src/screens/animations.css', here)),
      'utf8',
    );
    // The register page-shift rule: flat, one long beat, linear — and no
    // fill mode, so the board returns to rest when the class is toggled off
    // instead of freezing at the last keyframe.
    const shiftRule = css.match(/\.match-boardwrap\.match-shift\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(shiftRule, 'match-shift animation rule must exist').not.toBe('');
    expect(shiftRule).toContain('match-page-shift');
    expect(shiftRule).toContain('var(--beat-long)');
    expect(shiftRule).toContain('linear');
    expect(shiftRule).not.toMatch(/\bboth\b/);
    expect(shiftRule).not.toMatch(/\bforwards\b/);
    // The keyframes end where they began: translateY(0) at the 100% pose.
    const finalPose =
      css.match(/@keyframes match-page-shift[\s\S]*?100%\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(finalPose).toContain('translateY(0)');
  });
});
