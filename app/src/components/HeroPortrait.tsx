import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import { heroPowerText, type HeroState, type PlayerIndex } from '@ashen/core';
import type { HeroFX } from './animations.js';
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
  /** Damage flash / heal glow sequence counters (Task 39). */
  fx?: HeroFX;
  /** Hero power used sequence counter — glyph flash on the portrait (Task 40). */
  powerFx?: number;
  /** Animation duration scale (fast mode 0.5). */
  animScale?: number;
}

const SIGIL = '\u2726'; // four-pointed star (matches the card back sigil)

/**
 * Tween a changing number toward its target (HP tick-down/up). Tick-based
 * (setTimeout) so it works identically under fake timers in tests and at ~60fps
 * in the browser. Completes by snapping to the target and remembering it as
 * the next tween's start.
 */
function useTween(value: number, ms: number): number {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const ticks = Math.max(1, Math.round(ms / 16));
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      i += 1;
      const p = Math.min(1, i / ticks);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (i < ticks) timer = setTimeout(step, 16);
      else prevRef.current = value;
    };
    timer = setTimeout(step, 16);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      prevRef.current = value;
    };
  }, [value, ms]);
  return display;
}

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
  fx = undefined,
  powerFx = 0,
  animScale = 1,
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

  // Task 39: flash/heal overlay — keyed by the sequence counters so each
  // heroDamaged / heroHealed replays (remount) its tint fade; the color comes
  // from the most recent effect kind. The tweened HP number lives on this
  // component, not the overlay, so remounts never reset it.
  const fxKey = `${fx?.flash ?? 0}:${fx?.heal ?? 0}`;
  const fxActive = (fx?.flash ?? 0) > 0 || (fx?.heal ?? 0) > 0;
  const hpDisplay = useTween(hero.hp, 340 * animScale);

  return (
    <div className={classes} data-player={player} onClick={(e) => onClick?.(e)}>
      <span className="heroportrait-name">{hero.name}</span>
      <div className="heroportrait-circle" aria-hidden="true">
        <span className="heroportrait-sigil">{SIGIL}</span>
        <span className="heroportrait-player">P{player + 1}</span>
        {fxActive && (
          <motion.span
            key={fxKey}
            className={`heroportrait-fx heroportrait-fx--${fx?.kind === 'heal' ? 'heal' : 'damage'}`}
            initial={{ opacity: 0.9, scale: 0.9 }}
            animate={{ opacity: 0, scale: 1.18 }}
            transition={{ duration: 0.55 * animScale, ease: 'easeOut' }}
          />
        )}
        {powerFx > 0 && (
          <motion.span
            key={`power-${powerFx}`}
            className="heroportrait-fx heroportrait-fx--power"
            initial={{ opacity: 0.95, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.6 * animScale, ease: 'easeOut' }}
          />
        )}
      </div>
      <div className={`heroportrait-hpbar heroportrait-hpbar--${hpTone}`}>
        <div className="heroportrait-hpfill" style={{ width: `${pct}%` }} />
        <span className="heroportrait-hpnum">
          {hpDisplay}/{hero.maxHp}
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
          title={`${hero.power.name} — ${heroPowerText(hero.power)}`}
        >
          {hero.power.name}
          <span className="heroportrait-power-cost">{hero.power.cost}</span>
          {hero.usedPower && <span className="heroportrait-power-used">used</span>}
        </button>
      )}
    </div>
  );
}
