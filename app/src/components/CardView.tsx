import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Card as CardSpec } from '@ashen/core';
import Card from './Card.js';
import type { CardSize } from './Card.js';
import './cardview.css';

/**
 * CardView (Task 31): interaction wrapper around the Card base frame
 * (Task 37). Adds the board/hand interaction states Card itself does not
 * know about — targeting highlight (ember ring + pulse while a valid target
 * in targeting mode), muting (unplayable / not your turn / waiting), live
 * board stats (damaged/buffed creatures override the def's pips), and small
 * status badges (shields / frozen). Pure presentational: the parent decides
 * what is targetable/playable and what a click means.
 */

/** Minimal spec for unrevealed cards (enemy hand silhouettes). */
export const FACE_DOWN_CARD: CardSpec = {
  id: 'face-down',
  name: '',
  type: 'creature',
  cost: 0,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: '',
  art: { preset: 'ember', palette: [], seed: 1 },
  author: 'curated',
  version: 1,
};

export interface CardViewStatus {
  /** Can't act this turn (summoned this turn / already attacked). */
  exhausted?: boolean;
  frozen?: boolean;
  shields?: number;
}

export interface CardViewProps {
  card: CardSpec;
  size?: CardSize;
  faceDown?: boolean;
  /** Legal to play right now — golden glow (hand cards). */
  playable?: boolean;
  /** Tap-selected on the board (chosen attacker). */
  selected?: boolean;
  /** Valid targeting-mode target — ember ring, clickable. */
  targetable?: boolean;
  /** Dimmed (unplayable, not your turn, or waiting during targeting). */
  muted?: boolean;
  /** Live board stats override (damage/buffs) — board creatures only. */
  stats?: { attack: number; health: number };
  status?: CardViewStatus;
  /** Click handler; receives the event so parents can stopPropagation. */
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

export default function CardView({
  card,
  size = 'hand',
  faceDown = false,
  playable = false,
  selected = false,
  targetable = false,
  muted = false,
  stats,
  status,
  onClick,
}: CardViewProps) {
  const classes = [
    'cardview',
    `cardview--${size}`,
    targetable && 'cardview--target',
    muted && 'cardview--muted',
    status?.exhausted && !targetable && 'cardview--exhausted',
    status?.frozen && 'cardview--frozen',
  ]
    .filter(Boolean)
    .join(' ');

  // Board creatures carry live stats — override the def's pips so damage and
  // buffs read correctly. faceDown cards never show stats.
  const spec = stats && !faceDown ? { ...card, attack: stats.attack, health: stats.health } : card;
  const badges: string[] = [];
  if (status?.frozen) badges.push('frozen');
  if ((status?.shields ?? 0) > 0) badges.push(`shield ${status!.shields}`);

  return (
    <div
      className={classes}
      onClick={(e) => onClick?.(e)}
      title={targetable ? 'Valid target' : undefined}
    >
      <Card
        card={spec}
        size={size}
        faceDown={faceDown}
        playable={playable && !muted && !faceDown}
        selected={selected}
      />
      {badges.map((b) => (
        <span className="cardview-badge" key={b}>
          {b}
        </span>
      ))}
    </div>
  );
}
