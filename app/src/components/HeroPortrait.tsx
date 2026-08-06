import type { MouseEvent as ReactMouseEvent } from 'react';
import type { HeroState, PlayerIndex } from '@ashen/core';
import './heroportrait.css';

/**
 * HeroPortrait (Task 31): one hero on the battlefield — name, HP bar with
 * numeric readout, shield count, and (for the viewer's own hero) the hero
 * power button. `active` = this hero's controller's turn; `targetable` =
 * valid targeting-mode target (ember ring, clickable).
 */

export interface HeroPortraitProps {
  hero: HeroState;
  player: PlayerIndex;
  /** True for the viewer's own hero (bottom of the board, interactive). */
  isViewer: boolean;
  /** It is this hero's controller's turn. */
  active: boolean;
  /** Valid targeting-mode target. */
  targetable?: boolean;
  /** Dimmed while waiting (targeting mode, non-target hero). */
  dimmed?: boolean;
  /** Click handler; receives the event so parents can stopPropagation. */
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  /** Hero power interactions — viewer's own hero only. */
  onPowerClick?: () => void;
  powerEnabled?: boolean;
}

const SIGIL = '\u2726'; // four-pointed star (matches the card back sigil)

export default function HeroPortrait({
  hero,
  player,
  isViewer,
  active,
  targetable = false,
  dimmed = false,
  onClick,
  onPowerClick,
  powerEnabled = false,
}: HeroPortraitProps) {
  const pct = Math.max(0, Math.min(100, (hero.hp / Math.max(hero.maxHp, 1)) * 100));
  const hpTone = pct > 50 ? 'ok' : pct > 25 ? 'hurt' : 'critical';
  const classes = [
    'heroportrait',
    isViewer ? 'heroportrait--mine' : 'heroportrait--foe',
    active && 'heroportrait--active',
    targetable && 'heroportrait--target',
    dimmed && 'heroportrait--dimmed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={(e) => onClick?.(e)}>
      <span className="heroportrait-name">{hero.name}</span>
      <div className="heroportrait-circle" aria-hidden="true">
        <span className="heroportrait-sigil">{SIGIL}</span>
        <span className="heroportrait-player">P{player + 1}</span>
      </div>
      <div className={`heroportrait-hpbar heroportrait-hpbar--${hpTone}`}>
        <div className="heroportrait-hpfill" style={{ width: `${pct}%` }} />
        <span className="heroportrait-hpnum">
          {hero.hp}/{hero.maxHp}
        </span>
      </div>
      {hero.shields > 0 && <span className="heroportrait-shield">Shield {hero.shields}</span>}
      {isViewer && (
        <button
          type="button"
          className={`heroportrait-power${powerEnabled ? ' heroportrait-power--ready' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onPowerClick?.();
          }}
          disabled={!powerEnabled}
          title={hero.power.name}
        >
          {hero.power.name}
          <span className="heroportrait-power-cost">{hero.power.cost}</span>
          {hero.usedPower && <span className="heroportrait-power-used">used</span>}
        </button>
      )}
    </div>
  );
}
