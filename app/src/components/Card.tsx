import type { Card as CardSpec, Keyword } from '@ashen/core';
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
  /** Live board keywords override — board creatures only (Task 0). `keywords`
   *  is the creature's CURRENT keyword array (silence empties it, giveKeyword
   *  appends); omitted on hand cards, which render the immutable definition. */
  keywords?: readonly Keyword[];
  /** Render keyword chips non-interactively (plain spans, no popover). */
  staticKeywords?: boolean;
  /** Live silenced flag — board creatures only (Task 0). Suppresses the
   *  cardText rules text, whose triggers live on the CARD and so cannot be
   *  removed by clearing the creature's keyword array. */
  silenced?: boolean;
  /** Click handler receives the card (identity for play/target logic). */
  onClick?: (card: CardSpec) => void;
}

export default function Card({
  card,
  size = 'hand',
  faceDown = false,
  playable = false,
  selected = false,
  keywords,
  staticKeywords = false,
  silenced,
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

  // Live board state wins over the immutable definition (Task 0): keywords
  // are the creature's CURRENT array (already emptied by silence / appended by
  // giveKeyword in the engine), and a silenced creature renders no rules text
  // at all — its triggers live on the CARD, which silence cannot touch.
  const shownKeywords = keywords ?? card.keywords;
  const shownText = silenced ? '' : cardText(card);

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
      keywords={shownKeywords}
      staticKeywords={staticKeywords}
      flavor={card.flavor}
      text={shownText}
      faceDown={faceDown}
      onClick={onClick ? () => onClick(card) : undefined}
    >
      <CardArt recipe={art} />
    </CardFrame>
  );
}
