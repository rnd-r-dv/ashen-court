// TurnBanner (Task 40 -> Task 8): full-width banner that lays down like a
// page register — drops from above on one long beat, holds, then pushes away
// on one beat — driven by the bannerSweep variants (animations.ts) so fast
// mode halves every duration. Used for turn changes ("Your Turn" or the
// incoming hero's name) and the game-over title. Only the ACTIVE (mine)
// banner is marked with or (turnbanner.css). Self-removing: the exit sweep
// completes → onDone and the parent drops the entry. Under reduced motion the
// banner appears at its final pose immediately (Match passes scale 0).
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bannerSweep, usePrefersReducedMotion } from './animations.js';
import './turnbanner.css';

export interface TurnBannerEntry {
  id: number;
  /** Main text ("Your Turn", a hero name, "Victory"…). */
  text: string;
  /** Small line above the text ("Turn 3"). */
  kicker?: string;
  /** Or styling for the viewer's own turn / win. */
  mine?: boolean;
  /** Hold time before the sweep-out (default 1200ms; shorter for the win title). */
  holdMs?: number;
}

/**
 * Hold before the sweep-out when the entry does not name one. Hold time is
 * per-banner DATA (the win title's shorter 900ms rides on the entry Match
 * builds), so the entry is the single channel — the component used to also
 * take a `holdMs` prop, but `entry.holdMs ?? holdMs` meant no caller could
 * ever reach it, and a second channel for one value can only drift.
 */
const DEFAULT_HOLD_MS = 1200;

export interface TurnBannerProps {
  entry: TurnBannerEntry;
  /** Animation duration scale (fast mode 0.5; 0 under reduced motion). */
  scale?: number;
  onDone?: () => void;
}

export default function TurnBanner({ entry, scale = 1, onDone }: TurnBannerProps) {
  const reduced = usePrefersReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const hold = entry.holdMs ?? DEFAULT_HOLD_MS;

  useEffect(() => {
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), hold * (reduced ? 1 : scale));
    return () => clearTimeout(t);
  }, [entry.id, scale, hold, reduced]);

  return (
    <AnimatePresence onExitComplete={() => onDone?.()}>
      {!leaving && (
        <motion.div
          key={entry.id}
          className={`turnbanner${entry.mine ? ' turnbanner--mine' : ''}`}
          variants={bannerSweep(reduced ? 0 : scale)}
          initial={reduced ? false : { y: '-130%', opacity: 0 }}
          animate="enter"
          exit="exit"
        >
          {entry.kicker && <span className="turnbanner-kicker">{entry.kicker}</span>}
          <span className="turnbanner-text">{entry.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
