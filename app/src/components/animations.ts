// animations.ts (Task 39): Framer Motion variants + useAnimationQueue, the
// event-driven animation loop for the board.
//
// Variants are FACTORIES taking a duration scale (0.5 in fast mode; Match
// threads its settings read through every usage) so fastMode actually halves
// every framer-driven duration — the CSS-driven animations (slam ripple,
// hand draw) read the `--anim-scale` custom property from the .match root.
//
// useAnimationQueue consumes useMatch's GameEvent stream one event at a time
// (~spacing ms apart), drains useMatch's queue so it stays bounded, and
// exposes skip() — clicking anywhere on the match surface (or the Skip
// button) drains the remaining events instantly. The state mirror (useMatch)
// updates immediately, so skipping only drops cosmetic animations, never game
// state.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';
import type { GameEvent } from '@ashen/core';

/** Per-hero animation sequence counters (portrait flash / heal glow). */
export interface HeroFX {
  /** heroDamaged sequence counter — retriggers the portrait flash. */
  flash: number;
  /** heroHealed sequence counter — retriggers the heal glow. */
  heal: number;
  /** Most recent effect kind — drives the overlay color. */
  kind: 'flash' | 'heal';
}

export const HERO_FX_ZERO: HeroFX = { flash: 0, heal: 0, kind: 'flash' };

/** Hand cards fading/lifting in as they enter the fanned hand. */
export function handEnter(scale = 1): Variants {
  return {
    handIn: { opacity: 0, y: 24, transition: { duration: 0.01 } },
    enter: { opacity: 1, y: 0, transition: { duration: 0.32 * scale, ease: 'easeOut' } },
  };
}

/** A creature landing on the board: overshoot slam from above + fade in. */
export function playSlam(scale = 1): Variants {
  return {
    slam: { scale: 1.5, opacity: 0, y: -26, transition: { duration: 0.01 } },
    enter: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 380, damping: 22, duration: 0.42 * scale },
    },
  };
}

/** Attacker lunging at its target (reserved for a future attack event). */
export function attackLunge(scale = 1): Variants {
  return {
    lunge: { x: 34, transition: { duration: 0.16 * scale, ease: 'easeOut' } },
    return: { x: 0, transition: { duration: 0.24 * scale, ease: 'easeOut' } },
  };
}

/** creatureDied: ember dissolve (AnimatePresence exit on the board slot). */
export function deathFade(scale = 1): Variants {
  return {
    exit: {
      opacity: 0,
      scale: 1.18,
      filter: 'brightness(2.4) saturate(0.15)',
      transition: { duration: 0.5 * scale, ease: 'easeIn' },
    },
  };
}

/** Draw-from-deck slide for a card entering the hand. */
export function drawSlide(scale = 1): Variants {
  return {
    slideIn: { y: 42, opacity: 0, transition: { duration: 0.01 } },
    enter: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 26, duration: 0.4 * scale },
    },
  };
}

/** manaChanged: crystal tray pop. */
export function manaPop(scale = 1): Variants {
  return {
    pop: { scale: 1.45, filter: 'brightness(1.7)', transition: { duration: 0.01 } },
    enter: { scale: 1, filter: 'brightness(1)', transition: { duration: 0.3 * scale, ease: 'easeOut' } },
  };
}

/** Turn banner sweep (wired in Task 40's TurnBanner). */
export function bannerSweep(scale = 1): Variants {
  return {
    enter: {
      x: ['-110%', '0%'],
      opacity: [0, 1],
      transition: { duration: 0.5 * scale, ease: 'easeOut' },
    },
    exit: {
      x: '110%',
      opacity: 0,
      transition: { duration: 0.35 * scale, ease: 'easeIn' },
    },
  };
}

// ---- useAnimationQueue ----

export interface UseAnimationQueueOptions {
  /** Called for each event when its turn in the queue comes up. */
  onEvent: (e: GameEvent) => void;
  /** Drains the source queue (useMatch.drainEvents) once a batch is ingested. */
  drain?: () => void;
  /** Milliseconds between events (default 180). */
  spacing?: number;
  /** Duration scale (fast mode 0.5) — also scales the inter-event spacing. */
  scale?: number;
}

export interface AnimationQueue {
  /** Drop every queued event instantly (state already mirrors them). */
  skip(): void;
  /** True while events are queued or between ticks. */
  playing: boolean;
}

/**
 * Consume a GameEvent stream sequentially. New events appended to `events`
 * are ingested into an internal queue (and useMatch's queue drained so it
 * stays bounded); a setTimeout loop plays one event per tick, calling the
 * latest `onEvent` (the Match event → animation map). skip() clears the queue
 * so the remaining cosmetics never fire.
 */
export function useAnimationQueue(
  events: GameEvent[],
  { onEvent, drain, spacing = 180, scale = 1 }: UseAnimationQueueOptions,
): AnimationQueue {
  const queueRef = useRef<GameEvent[]>([]);
  const seenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);

  // Latest-value refs so the pump loop never calls a stale closure.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const drainRef = useRef(drain);
  drainRef.current = drain;

  // One tick: play the next queued event, then schedule the following tick.
  // pump() is ONLY ever called from a timer callback (never from ingest), so
  // it cannot double-fire: each call plays exactly one event and arms exactly
  // one timer.
  const pump = useCallback(() => {
    const next = queueRef.current.shift();
    if (next === undefined) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    onEventRef.current(next);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pump();
    }, Math.max(30, spacing * scale));
  }, [spacing, scale]);

  // Ingest new batches as they arrive, then drain useMatch's queue so the
  // events state stays bounded (replaces Match's old drain-per-batch effect).
  // drainEvents() wipes the stream to [] after every ingest, so the old
  // monotonic seenRef cursor silently dropped any later batch smaller than
  // the events consumed so far (a 2-event batch after a 9-event one never
  // animated). With the stream re-seeded fresh on every batch, ingest the
  // whole batch and reset the cursor. Only pump when no tick is pending, so
  // a batch arriving mid-playback waits its turn instead of firing its first
  // event immediately (and never arms a second timer).
  useEffect(() => {
    if (events.length === 0) return;
    if (drainRef.current) {
      // Stream is drained after every ingest — always a fresh batch.
      queueRef.current.push(...events);
      seenRef.current = 0;
      drainRef.current();
    } else if (events.length > seenRef.current) {
      // No drain (hook used standalone): events accumulate; ingest only the
      // unseen suffix.
      queueRef.current.push(...events.slice(seenRef.current));
      seenRef.current = events.length;
    }
    if (timerRef.current === null) pump();
  }, [events, pump]);

  // Clear the pending tick on unmount (no setState after teardown).
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  const skip = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    queueRef.current = [];
    setPlaying(false);
  }, []);

  return { skip, playing };
}
