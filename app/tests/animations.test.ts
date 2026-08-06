// useAnimationQueue tests (Task 39 review round). Covers the Critical: the
// queue must animate EVERY event fed through it in sequential batches, even
// when a later batch is smaller than the events consumed so far (the old
// monotonic seenRef cursor dropped those because drainEvents() wipes the
// stream to [] after every ingest), and the pump guard: a batch arriving
// while a tick is pending must not fire its first event immediately (no
// double tick).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { GameEvent } from '@ashen/core';
import { useAnimationQueue } from '../src/components/animations.js';

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
      holder.add = (batch) => setEvents((prev) => [...prev, ...batch]);
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
});
