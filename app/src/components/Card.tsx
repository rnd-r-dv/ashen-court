import type { Card as CardSpec } from '@ashen/core';
import { cardText } from '@ashen/core';
import { resolveCardArt } from '../art/resolveArt.js';
import { treatmentFor } from './cardTreatment.js';
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
  // Generated art (art-pipeline plan). A miss returns null and CardArt renders
  // the procedural SVG, which is what lets the pool be generated a slice at a
  // time and keeps Forge custom cards working.
  //
  // A Forge upload always wins: custom cards own their imageUrl, and a
  // generated file could only collide with one by sharing an id, which
  // saveCustomCard already forbids.
  const generated = card.art.imageUrl ? null : resolveCardArt(card.id);
  const art = generated ? { ...card.art, imageUrl: generated } : card.art;

  // Injecting into the recipe reuses CardArt's existing imageUrl short-circuit
  // rather than adding a second image-rendering path.
  const treatment = treatmentFor(card.rarity, generated !== null);

  const state = [
    `card--${size}`,
    faceDown && 'card--face-down',
    playable && !faceDown && 'card--playable',
    selected && 'card--selected',
  ].filter(Boolean).join(' ');

  return (
    <CardFrame
      className={state}
      treatment={faceDown ? 'banded' : treatment}
      rarity={card.rarity}
      type={card.type}
      name={card.name}
      cost={card.cost}
      attack={card.attack}
      health={card.health}
      keywords={card.keywords}
      flavor={card.flavor}
      text={cardText(card)}
      faceDown={faceDown}
      onClick={onClick ? () => onClick(card) : undefined}
    >
      <CardArt recipe={art} />
    </CardFrame>
  );
}
