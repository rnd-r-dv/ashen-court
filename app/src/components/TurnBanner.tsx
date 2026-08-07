// TurnBanner (Task 40): full-width banner that sweeps in from the left, holds
// briefly, and sweeps out — driven by the bannerSweep variants (animations.ts)
// so fast mode halves every duration. Used for turn changes ("Your Turn" or
// the incoming hero's name) and the game-over title. Self-removing: the exit
// sweep completes → onDone and the parent drops the entry.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bannerSweep } from './animations.js';
import './turnbanner.css';

export interface TurnBannerEntry {
  id: number;
  /** Main text ("Your Turn", a hero name, "Victory"…). */
  text: string;
  /** Small line above the text ("Turn 3"). */
  kicker?: string;
  /** Gold styling for the viewer's own turn / win. */
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
  /** Animation duration scale (fast mode 0.5). */
  scale?: number;
  onDone?: () => void;
}

export default function TurnBanner({ entry, scale = 1, onDone }: TurnBannerProps) {
  const [leaving, setLeaving] = useState(false);
  const hold = entry.holdMs ?? DEFAULT_HOLD_MS;

  useEffect(() => {
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), hold * scale);
    return () => clearTimeout(t);
  }, [entry.id, scale, hold]);

  return (
    <AnimatePresence onExitComplete={() => onDone?.()}>
      {!leaving && (
        <motion.div
          key={entry.id}
          className={`turnbanner${entry.mine ? ' turnbanner--mine' : ''}`}
          variants={bannerSweep(scale)}
          initial={{ x: '-110%', opacity: 0 }}
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
