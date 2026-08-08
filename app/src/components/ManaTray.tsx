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

export type PipState = 'full' | 'spent';

/**
 * One entry per unlocked crystal: 'full' = available to spend now, 'spent' =
 * used this turn. Capped at MAX_PIPS so a runaway mana effect cannot overflow
 * the rail. Extracted and exported because jsdom cannot lay out CSS, so this
 * is the part of the tray that is actually testable.
 */
export function pipStates(mana: number, maxMana: number): PipState[] {
  const unlocked = Math.min(Math.max(maxMana, 0), MAX_PIPS);
  const available = Math.min(Math.max(mana, 0), unlocked);
  return Array.from({ length: unlocked }, (_, i) => (i < available ? 'full' : 'spent'));
}

export default function ManaTray({ mana, maxMana, pulse = 0, animScale = 1 }: ManaTrayProps) {
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
        {pipStates(mana, maxMana).map((state, i) => (
          <span key={i} className={`manatray-pip manatray-pip--${state}`} />
        ))}
      </motion.div>
      <span className="manatray-readout">
        {mana}/{maxMana}
      </span>
    </div>
  );
}
