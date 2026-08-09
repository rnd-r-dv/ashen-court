// DamagePopup (Task 39 -> Task 8): floating damage/heal number. Damage lands
// in the Task 8 grammar — gules numeral STRIKES in (one beat), HOLDS (one
// long beat), then DROPS out (one beat), all linear. Heal keeps its green
// (gules is damage-only). Anchored to a board half ('top' = enemy zone,
// 'bottom' = friendly zone) with a deterministic per-entry drift so
// consecutive popups never stack exactly. Self-removing: onDone fires when
// the sequence finishes and the parent drops the entry. Under reduced motion
// the numeral reaches its rest pose immediately and only the hold remains.
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from './animations.js';
import './damagepopup.css';

export interface DamageEntry {
  id: number;
  amount: number;
  kind: 'damage' | 'heal';
  side: 'top' | 'bottom';
}

export interface DamagePopupProps {
  entry: DamageEntry;
  /** Animation duration scale (fast mode 0.5; 0 under reduced motion). */
  scale?: number;
  onDone?: () => void;
}

export default function DamagePopup({ entry, scale = 1, onDone }: DamagePopupProps) {
  const reduced = usePrefersReducedMotion();
  const { amount, kind, side } = entry;
  const sign = kind === 'damage' ? '-' : '+';
  const drift = ((entry.id % 7) - 3) * 26;
  // Strike (140ms) → hold (320ms) → drop (140ms). Reduced motion keeps only
  // the hold: the numeral appears at its rest pose and cuts out at the end.
  const strike = reduced ? 0 : 0.14 * scale;
  const drop = reduced ? 0 : 0.14 * scale;
  const hold = 0.32 * scale;
  const total = strike + hold + drop;
  const strikeEnd = total === 0 ? 1 : strike / total;
  const dropStart = total === 0 ? 1 : (strike + hold) / total;
  return (
    <motion.div
      className={`damagepopup damagepopup--${kind} damagepopup--${side}`}
      style={{ left: `calc(50% + ${drift}px)` }}
      initial={{ opacity: 0, y: 10, x: '-50%', scale: 1.55 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [10, -8, -8, -22],
        x: '-50%',
        scale: [1.55, 1, 1, 0.94],
      }}
      transition={{ duration: Math.max(total, 0.01), times: [0, strikeEnd, dropStart, 1], ease: 'linear' }}
      onAnimationComplete={() => onDone?.()}
    >
      {sign}
      {amount}
    </motion.div>
  );
}
