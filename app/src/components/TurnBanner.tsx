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

export interface TurnBannerProps {
  entry: TurnBannerEntry;
  /** Animation duration scale (fast mode 0.5). */
  scale?: number;
  /** Milliseconds the banner holds before sweeping out (default 1200). */
  holdMs?: number;
  onDone?: () => void;
}

export default function TurnBanner({ entry, scale = 1, holdMs = 1200, onDone }: TurnBannerProps) {
  const [leaving, setLeaving] = useState(false);
  const hold = entry.holdMs ?? holdMs;

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
