import { motion } from 'framer-motion';
import { manaPop } from './animations.js';
import './manatray.css';

/**
 * ManaTray (Task 31): the mana crystal tray for one player. Filled pips =
 * current mana, empty pips = unlocked capacity, plus a numeric readout.
 * Pure presentational.
 */

export interface ManaTrayProps {
  mana: number;
  maxMana: number;
  /** manaChanged sequence counter — remounts the pips and replays the pop. */
  pulse?: number;
  /** Animation duration scale (fast mode 0.5). */
  animScale?: number;
}

const MAX_PIPS = 15;

export default function ManaTray({ mana, maxMana, pulse = 0, animScale = 1 }: ManaTrayProps) {
  const pips = Array.from({ length: Math.min(Math.max(maxMana, 0), MAX_PIPS) }, (_, i) => i < mana);
  return (
    <div className="manatray" title={`${mana}/${maxMana} mana`} aria-label={`Mana ${mana} of ${maxMana}`}>
      {/* Task 39: keyed by the pulse counter so each manaChanged replays the pop */}
      <motion.div
        key={pulse}
        className="manatray-pips"
        variants={manaPop(animScale)}
        initial={pulse ? 'pop' : false}
        animate="enter"
        aria-hidden="true"
      >
        {pips.map((full, i) => (
          <span key={i} className={`manatray-pip${full ? ' manatray-pip--full' : ''}`} />
        ))}
      </motion.div>
      <span className="manatray-readout">
        {mana}/{maxMana}
      </span>
    </div>
  );
}
