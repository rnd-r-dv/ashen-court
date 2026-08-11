import type { ReactNode } from 'react';
import type { CardType, Keyword, Rarity } from '@ashen/core';
import type { Treatment } from './cardTreatment.js';
import KeywordChip from './KeywordChip.js';
import StatMark from './StatMark.js';
import './card.css';

/**
 * Card chrome (Task 37): layered rarity frames, type ribbon, cost gem,
 * three-cell stat rail (attack/reflect/health) and name plate. The art slot
 * (`children`) is filled by Card.tsx with CardArt — CardFrame only knows
 * the frame and text.
 *
 * Rarity treatments (Armorial, Task 5): hairline weight only, declared in
 * card.css — common = 1px dim hairline, rare = 1px cream, epic = 2px cream,
 * legendary = 2px --or (the one reserved gold). No gradients, bevels, glows,
 * or depth shadows anywhere on the plate.
 *
 * faceDown renders the card back: the art is grayscaled into a silhouette
 * and every chrome element (name, cost, ribbon, stats) is suppressed.
 *
 * The frame is a FIXED box (card.css --card-w/--card-h): the art panel has a
 * fixed height, the stat pips are absolutely positioned corner ornaments, and
 * all variable-length copy lives in one clipped `.card__body` well. Card type,
 * keyword count and flavor length therefore cannot change the card's size.
 */

export interface CardFrameProps {
  rarity: Rarity;
  type: CardType;
  name: string;
  cost: number;
  /** House archetype id ('ember', 'coven', …; '' for neutrals/tokens). Rendered
   *  as data-archetype so card.css can map it to one --house-* tincture for
   *  frame/register identity; the art mount stays neutral (Task 5). */
  archetype?: string;
  /** Show the mana-cost gem. Default true. CardView passes false at board
   *  size: a board creature's cost is already paid, and a rendered gem reads
   *  as a third defense stat — the exact misread recorded in app/PRODUCT.md.
   *  The cost must leave the DOM, not merely be styled away. */
  showCost?: boolean;
  /** Creature stats — the three-cell stat rail renders only for creatures.
   *  Reflect defaults to 0 when absent (the engine treats undefined
   *  CreatureState reflect as 0 counter-damage; every curated creature
   *  carries an explicit value). */
  attack?: number;
  reflect?: number;
  health?: number;
  /** Keyword chips — card-definition keywords, unless Card.tsx overrides them
   *  with the creature's LIVE board keywords (silence empties the engine's
   *  array, giveKeyword appends). Hand cards always pass the definition.
   *  staticKeywords renders the chips as non-interactive spans (no describe
   *  affordance, no popover) — for surfaces where a nested <button> would be
   *  invalid DOM, e.g. inside a discover choice button. */
  keywords?: readonly Keyword[];
  /** Render keyword chips non-interactively (plain spans, no popover). */
  staticKeywords?: boolean;
  flavor?: string;
  /** Rules text (Task 43) — Card.tsx passes cardText(card), or '' for a
   *  silenced board creature: its triggers live on the CARD, so only a flag
   *  can suppress the def's generated text. */
  text?: string;
  /** Unrevealed enemy card: grayscale silhouette, no name/art (spec §12). */
  faceDown?: boolean;
  /** Layout treatment (cardTreatment.ts). 'bleed' puts art behind the text. */
  treatment?: Treatment;
  /** Extra classes from Card.tsx (`card--hand|board|preview`, state flags). */
  className?: string;
  onClick?: () => void;
  /** The art slot — Card.tsx passes <CardArt/> here. */
  children?: ReactNode;
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const TYPE_LABEL: Record<CardType, string> = {
  creature: 'Creature',
  spell: 'Spell',
  artifact: 'Artifact',
};

/**
 * Type ribbon glyphs — text-presentation variation selectors keep the
 * sword/gear from rendering as emoji on Apple platforms.
 */
const TYPE_ICON: Record<CardType, string> = {
  creature: '\u2694\uFE0E', // crossed swords
  spell: '\u2726', // four-pointed star
  artifact: '\u2699\uFE0E', // gear
};

const BACK_SIGIL = '\u2726';

export default function CardFrame({
  rarity,
  type,
  name,
  cost,
  archetype,
  showCost = true,
  attack,
  reflect,
  health,
  keywords,
  staticKeywords = false,
  flavor,
  text,
  faceDown = false,
  treatment = 'banded',
  className,
  onClick,
  children,
}: CardFrameProps) {
  const isCreature = type === 'creature';
  const classes = [
    'card',
    className,
    `card--rarity-${rarity}`,
    `card--type-${type}`,
    treatment === 'bleed' && 'card--bleed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-rarity={rarity}
      data-type={type}
      data-archetype={archetype}
      onClick={onClick}
    >
      <div className="card__frame">
        {!faceDown && (
          <div className="card__top">
            {showCost && (
              <span className="card__cost" aria-label={`${cost} mana`}>
                {cost}
              </span>
            )}
            <span className="card__nameplate">{name || 'Unnamed card'}</span>
          </div>
        )}

        {/* The art wrapper is the positioning context for the stat pips, which
            straddle the panel's bottom edge. It must NOT clip (the pips hang
            outside it) — the inner .card__art does the clipping instead. */}
        <div className="card__artwrap">
          <div className={faceDown ? 'card__art card__art--face-down' : 'card__art'}>
            {children}
            {faceDown && (
              <span className="card__sigil" aria-hidden="true">
                {BACK_SIGIL}
              </span>
            )}
          </div>

          {/* Three-cell stat rail, not a layout row: a creature and a spell
              must occupy the SAME box, so stats are lifted out of the flow
              entirely. Each cell is a glyph beside its numeral (StatMark) in
              Attack → Reflect → Health order — no stat word is printed, and
              each mark's aria-label names it for AT, so no number on the
              plate is ever bare or ambiguous (PRODUCT.md). The plan's muted
              stat tokens color the glyphs; gules appears only as the attack
              mark's alias, never as a frame decoration. */}
          {!faceDown && isCreature && attack !== undefined && health !== undefined && (
            <div className="card__stats">
              <StatMark kind="attack" value={attack} />
              <StatMark kind="reflect" value={reflect ?? 0} />
              <StatMark kind="health" value={health} />
            </div>
          )}
        </div>

        {!faceDown && (
          <>
            <div className="card__ribbon">
              <span className="card__house-mark" aria-hidden="true" />
              <span className="card__ribbon-icon" aria-hidden="true">
                {TYPE_ICON[type]}
              </span>
              <span className="card__ribbon-label">{TYPE_LABEL[type]}</span>
              <span className="card__ribbon-rarity">{RARITY_LABEL[rarity]}</span>
            </div>

            {/* One fixed-height text well. It is a flex column: rules text
                sizes to content and flavor takes the remainder, so nothing is
                truncated while the card still has room. The card box itself
                stays invariant — see --card-h in card.css. */}
            <div className="card__body">
              {keywords && keywords.length > 0 && (
                <div className="card__keywords">
                  {keywords.map((k) => (
                    <KeywordChip key={k} keyword={k} variant={staticKeywords ? 'plain' : 'card'} />
                  ))}
                </div>
              )}

              {text && <p className="card__text">{text}</p>}

              {flavor && <p className="card__flavor">“{flavor}”</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
