// animations.ts (Task 39 + Task 8): Framer Motion variants + useAnimationQueue,
// the event-driven animation loop for the board.
//
// Task 8 establishes ONE motion grammar for the Armorial board:
//   - one beat = 140ms (--beat), one long beat = 320ms (--beat-long);
//   - linear or CSS steps() easing, hard cuts, short holds;
//   - no springs, bounce, glow (brightness/saturate filters), or depth fades.
// Every variant factory takes a duration scale: fast mode 0.5 halves every
// duration, and reduced motion (usePrefersReducedMotion, matched in Match)
// passes 0 so every transition reaches its final state immediately.
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

/**
 * prefers-reduced-motion, read once at mount (like Background.tsx). jsdom
 * has no matchMedia — the try/catch keeps every consumer alive in tests and
 * older browsers; the hook is also the reduced-motion switch tests stub.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (): void => setReduced(mq.matches);
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      }
      // Safari < 14 legacy API.
      (mq as unknown as { addListener(cb: () => void): void }).addListener(onChange);
      return () => (mq as unknown as { removeListener(cb: () => void): void }).removeListener(onChange);
    } catch {
      return undefined;
    }
  }, []);
  return reduced;
}

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

/** Draw (cardDrawn / cardDrawnExtra / opening hand): the card slides in from
 *  the deck edge (the viewer's deck sits left of the hand), one linear long
 *  beat — a deal, not a fade-and-lift. */
export function handEnter(scale = 1): Variants {
  return {
    handIn: { opacity: 0, x: -26 },
    enter: { opacity: 1, x: 0, transition: { duration: 0.32 * scale, ease: 'linear' } },
  };
}

/** Play (cardPlayed / creatureSummoned): ONE hard landing — scale 1.35 → 1 in
 *  a single 140ms linear step, no spring, no bounce, no fade-in. */
export function playSlam(scale = 1): Variants {
  return {
    slam: { scale: 1.35, opacity: 0, y: -14 },
    enter: { scale: 1, opacity: 1, y: 0, transition: { duration: 0.14 * scale, ease: 'linear' } },
  };
}

/** Death (creatureDied): the plate holds one half-beat then cuts out on a
 *  linear beat — the gules strike-through is drawn by Match's eager
 *  deathStrike FX (animations.css), so the plate itself only has to get out
 *  of the way quickly. No dissolve, no scale-away depth fade. */
export function deathFade(scale = 1): Variants {
  return {
    exit: {
      opacity: [1, 1, 0],
      transition: { duration: 0.14 * scale, times: [0, 0.5, 1], ease: 'linear' },
    },
  };
}

/** manaChanged: crystal tray pulse — a flat hard step, no brightness glow. */
export function manaPop(scale = 1): Variants {
  return {
    pop: { scale: 1.18 },
    enter: { scale: 1, transition: { duration: 0.14 * scale, ease: 'linear' } },
  };
}

/** Turn change: the banner lays down like a page register — drops from above
 *  on a linear long beat, exits on one beat. Only the active banner carries
 *  or (turnbanner.css). */
export function bannerSweep(scale = 1): Variants {
  return {
    enter: {
      y: ['-130%', '0%'],
      opacity: [0, 1],
      transition: { duration: 0.32 * scale, ease: 'linear' },
    },
    exit: {
      y: '110%',
      opacity: 0,
      transition: { duration: 0.14 * scale, ease: 'linear' },
    },
  };
}

/** Turn end: the register dims over one beat, holds to the long beat, then
 *  cuts back out — a page register being laid, not a fade to darkness. The
 *  0.44 split lands the full dim at exactly one beat (0.44 × 320ms = 140ms),
 *  mirroring the armorial-strike-cue keyframes' 44% strike-in. */
export function dimVeil(scale = 1): Variants {
  return {
    enter: {
      opacity: [0, 0.85, 0],
      transition: { duration: 0.32 * scale, times: [0, 0.44, 1], ease: 'linear' },
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
