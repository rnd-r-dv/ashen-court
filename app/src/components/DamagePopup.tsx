// DamagePopup (Task 39): floating damage/heal number. Framer Motion float-up
// + fade; red for damage, green for heal. Anchored to a board half ('top' =
// enemy zone, 'bottom' = friendly zone) with a deterministic per-entry drift
// so consecutive popups never stack exactly. Self-removing: onDone fires when
// the float-up finishes and the parent drops the entry.
import { motion } from 'framer-motion';
import './damagepopup.css';

export interface DamageEntry {
  id: number;
  amount: number;
  kind: 'damage' | 'heal';
  side: 'top' | 'bottom';
}

export interface DamagePopupProps {
  entry: DamageEntry;
  /** Animation duration scale (fast mode 0.5). */
  scale?: number;
  onDone?: () => void;
}

export default function DamagePopup({ entry, scale = 1, onDone }: DamagePopupProps) {
  const { amount, kind, side } = entry;
  const sign = kind === 'damage' ? '-' : '+';
  const drift = ((entry.id % 7) - 3) * 26;
  const dur = 0.8 * scale;
  return (
    <motion.div
      className={`damagepopup damagepopup--${kind} damagepopup--${side}`}
      style={{ left: `calc(50% + ${drift}px)` }}
      initial={{ opacity: 0, y: 14, x: '-50%', scale: 0.7 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [14, -10, -26, -44],
        x: '-50%',
        scale: [0.7, 1.15, 1, 0.92],
      }}
      transition={{ duration: dur, times: [0, 0.12, 0.6, 1], ease: 'easeOut' }}
      onAnimationComplete={() => onDone?.()}
    >
      {sign}
      {amount}
    </motion.div>
  );
}
