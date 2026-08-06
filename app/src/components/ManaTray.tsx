import './manatray.css';

/**
 * ManaTray (Task 31): the mana crystal tray for one player. Filled pips =
 * current mana, empty pips = unlocked capacity, plus a numeric readout.
 * Pure presentational.
 */

export interface ManaTrayProps {
  mana: number;
  maxMana: number;
}

const MAX_PIPS = 15;

export default function ManaTray({ mana, maxMana }: ManaTrayProps) {
  const pips = Array.from({ length: Math.min(Math.max(maxMana, 0), MAX_PIPS) }, (_, i) => i < mana);
  return (
    <div className="manatray" title={`${mana}/${maxMana} mana`} aria-label={`Mana ${mana} of ${maxMana}`}>
      <div className="manatray-pips" aria-hidden="true">
        {pips.map((full, i) => (
          <span key={i} className={`manatray-pip${full ? ' manatray-pip--full' : ''}`} />
        ))}
      </div>
      <span className="manatray-readout">
        {mana}/{maxMana}
      </span>
    </div>
  );
}
