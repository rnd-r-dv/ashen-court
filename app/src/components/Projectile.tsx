// Projectile (Task 40): Framer Motion spell FX for the match screen.
//
// A travelling orb from `from` to `to` with kind-specific flight: fireball
// arcs with an ember trail, frost flies as a spinning ice ring, shadow
// slithers on a wavy tendril, starbeam lances as a rotating light-shaft. An
// impact burst (ring + spark in the kind's color) pops at the landing point.
//
// `aoe` entries skip the traveller: an expanding ring erupts from the target
// zone's center with a full-screen tint flash in the spell's color.
//
// Every duration is scaled by the fast-mode `scale` (0.5). Self-removing: the
// last child animation to finish calls onDone and the parent drops the entry.
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';

export type ProjectileKind = 'fireball' | 'frost' | 'shadow' | 'starbeam';

export interface ProjectileEntry {
  id: number;
  kind: ProjectileKind;
  /** Screen-space start (px, relative to the .match root / fx layer). */
  from: { x: number; y: number };
  /** Screen-space landing point (px, same space as `from`). */
  to: { x: number; y: number };
  /** AoE: ring + tint flash at the zone center instead of a traveller. */
  aoe?: boolean;
  /** Board half the FX belongs to ('top' = enemy zone). */
  side?: 'top' | 'bottom';
}

export interface ProjectileProps {
  entry: ProjectileEntry;
  /** Animation duration scale (fast mode 0.5). */
  scale?: number;
  onDone?: () => void;
}

/** Shared flight budget so Match can delay the damage popup to the impact. */
export function flightTime(from: { x: number; y: number }, to: { x: number; y: number }, scale = 1): number {
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return Math.min(0.9, Math.max(0.35, dist / 900)) * scale;
}

export default function Projectile({ entry, scale = 1, onDone }: ProjectileProps) {
  const { kind, from, to, aoe, side = 'bottom' } = entry;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const flight = flightTime(from, to, scale);

  if (aoe) {
    // Expanding ring from the zone center + a full-screen tint flash.
    return (
      <div className={`projectile-aoe projectile-aoe--${side}`}>
        <motion.div
          className={`projectile-aoe-tint projectile-aoe-tint--${kind}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.75 * scale, times: [0, 0.28, 1], ease: 'easeOut' }}
        />
        <motion.div
          className={`projectile-aoe-ring projectile-aoe-ring--${kind}`}
          initial={{ opacity: 0, scale: 0.18 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0.18, 1.75, 1.75] }}
          transition={{ duration: 0.78 * scale, times: [0, 0.3, 1], ease: 'easeOut' }}
          onAnimationComplete={() => onDone?.()}
        />
      </div>
    );
  }

  // Traveller: parent anchors the source point; the orb flies via transform
  // deltas and the impact burst pops at the landing point.
  const flightAnim =
    kind === 'fireball'
      ? {
          x: [0, dx * 0.5, dx],
          y: [0, dy * 0.5 - Math.min(150, Math.max(46, dist * 0.16)), dy],
          scale: [0.35, 1.12, 0.85],
          opacity: [0, 1, 0],
        }
      : kind === 'frost'
        ? {
            x: [0, dx * 0.5, dx],
            y: [0, dy * 0.5 - Math.min(60, Math.max(18, dist * 0.06)), dy],
            rotate: [0, 540, 540],
            scale: [0.3, 1.05, 0.9],
            opacity: [0, 1, 0],
          }
        : kind === 'shadow'
          ? {
              x: [0, dx * 0.32, dx * 0.66, dx],
              y: [0, dy * 0.32 - Math.min(90, Math.max(24, dist * 0.1)), dy * 0.66 + Math.min(70, Math.max(18, dist * 0.08)), dy],
              scale: [0.25, 1.2, 0.95, 0.8],
              opacity: [0, 1, 0.9, 0],
            }
          : // starbeam — a light-shaft stretched along the flight line.
            { scaleX: [0, 1, 1], opacity: [0, 1, 0] };

  const orbStyle =
    kind === 'starbeam'
      ? { width: dist, rotate: angle, transformOrigin: 'left center' as const }
      : kind === 'fireball' || kind === 'shadow'
        ? ({ '--trail-angle': `${angle}deg` } as CSSProperties)
        : undefined;

  return (
    <div className="projectile" style={{ left: from.x, top: from.y }}>
      <motion.div
        className={`projectile-orb projectile-orb--${kind}`}
        style={orbStyle}
        initial={{ x: 0, y: 0, opacity: 0, scale: kind === 'starbeam' ? 1 : 0.4, scaleX: 1 }}
        animate={flightAnim}
        transition={{
          duration: kind === 'starbeam' ? flight * 0.9 : flight,
          times: kind === 'shadow' ? [0, 0.38, 0.72, 1] : [0, 0.5, 1],
          ease: 'easeOut',
        }}
      />
      <motion.div
        className={`projectile-impact projectile-impact--${kind}`}
        style={{ left: dx, top: dy }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 1.9] }}
        transition={{ delay: flight * 0.72, duration: 0.42 * scale, times: [0, 0.35, 1], ease: 'easeOut' }}
        onAnimationComplete={() => onDone?.()}
      />
    </div>
  );
}
