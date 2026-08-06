import type { Card as CardSpec } from '@ashen/core';
import CardArt from './CardArt.js';
import CardFrame from './CardFrame.js';
import './card.css';

/**
 * Card (Task 37): full-styled card composing CardFrame (rarity frames,
 * ribbon, cost gem, pips, name plate) + CardArt (procedural art / upload)
 * + creature stats. Pure render component.
 *
 * Sizes:
 *  - hand:    hover-lift transform, playable glow
 *  - board:   compact (zoom) with tap-to-select
 *  - preview: full Forge preview size
 *
 * faceDown (unrevealed enemy cards, spec §12): the art renders as a
 * grayscaled silhouette inside a darkened frame and all chrome (name,
 * cost, ribbon, stats) is suppressed by CardFrame.
 */

export type CardSize = 'hand' | 'board' | 'preview';

export interface CardProps {
  card: CardSpec;
  /** Layout context: hand (hover-lift), board (compact, tap-to-select), preview (Forge). */
  size?: CardSize;
  /** Unrevealed enemy card: grayscale silhouette, no name/art. */
  faceDown?: boolean;
  /** Legal to play right now — golden glow. */
  playable?: boolean;
  /** Tap-selected on the board. */
  selected?: boolean;
  /** Click handler receives the card (identity for play/target logic). */
  onClick?: (card: CardSpec) => void;
}

export default function Card({
  card,
  size = 'hand',
  faceDown = false,
  playable = false,
  selected = false,
  onClick,
}: CardProps) {
  const state = [
    `card--${size}`,
    faceDown && 'card--face-down',
    playable && !faceDown && 'card--playable',
    selected && 'card--selected',
  ].filter(Boolean).join(' ');

  return (
    <CardFrame
      className={state}
      rarity={card.rarity}
      type={card.type}
      name={card.name}
      cost={card.cost}
      attack={card.attack}
      health={card.health}
      keywords={card.keywords}
      flavor={card.flavor}
      faceDown={faceDown}
      onClick={onClick ? () => onClick(card) : undefined}
    >
      <CardArt recipe={card.art} imageUrl={card.art.imageUrl} />
    </CardFrame>
  );
}
