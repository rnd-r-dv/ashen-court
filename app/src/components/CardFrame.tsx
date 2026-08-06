import type { CSSProperties, ReactNode } from 'react';
import type { CardType, Keyword, Rarity } from '@ashen/core';
import './card.css';

/**
 * Card chrome (Task 37): layered rarity frames, type ribbon, cost gem,
 * attack/health pips and name plate. The art slot (`children`) is filled
 * by Card.tsx with CardArt — CardFrame only knows the frame and text.
 *
 * Rarity treatments:
 *  - common:    flat charcoal + thin border
 *  - rare:      gilded gradient edge (padding-box/border-box trick)
 *  - epic:      gem accent (::after facet) + soft purple glow
 *  - legendary: animated shimmer — the border gradient and a face sheen
 *               sweep via `background-position` keyframes (alternate)
 *
 * faceDown renders the card back: the art is grayscaled into a silhouette
 * and every chrome element (name, cost, ribbon, stats) is suppressed.
 */

export interface CardFrameProps {
  rarity: Rarity;
  type: CardType;
  name: string;
  cost: number;
  /** Creature stats — attack/health pips render only for creatures. */
  attack?: number;
  health?: number;
  keywords?: readonly Keyword[];
  flavor?: string;
  /** Generated rules text (Task 43) — Card.tsx passes cardText(card). */
  text?: string;
  /** Unrevealed enemy card: grayscale silhouette, no name/art (spec §12). */
  faceDown?: boolean;
  /** Extra classes from Card.tsx (`card--hand|board|preview`, state flags). */
  className?: string;
  onClick?: () => void;
  /** The art slot — Card.tsx passes <CardArt/> here. */
  children?: ReactNode;
}

/** Controller-pinned rarity palette (Task 37). */
const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8a8a8a',
  rare: '#d4af37',
  epic: '#a855f7',
  legendary: '#ff9d2e',
};

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
  attack,
  health,
  keywords,
  flavor,
  text,
  faceDown = false,
  className,
  onClick,
  children,
}: CardFrameProps) {
  const isCreature = type === 'creature';
  const classes = ['card', className, `card--rarity-${rarity}`, `card--type-${type}`]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-rarity={rarity}
      data-type={type}
      onClick={onClick}
      style={{ '--rarity-color': RARITY_COLOR[rarity] } as CSSProperties}
    >
      <div className="card__frame">
        {!faceDown && (
          <div className="card__top">
            <span className="card__cost" aria-label={`${cost} mana`}>
              {cost}
            </span>
            <span className="card__nameplate">{name || 'Unnamed card'}</span>
          </div>
        )}

        <div className={faceDown ? 'card__art card__art--face-down' : 'card__art'}>
          {children}
          {faceDown && (
            <span className="card__sigil" aria-hidden="true">
              {BACK_SIGIL}
            </span>
          )}
        </div>

        {!faceDown && (
          <>
            <div className="card__ribbon">
              <span className="card__ribbon-icon" aria-hidden="true">
                {TYPE_ICON[type]}
              </span>
              <span className="card__ribbon-label">{TYPE_LABEL[type]}</span>
              <span className="card__ribbon-rarity">{RARITY_LABEL[rarity]}</span>
            </div>

            {keywords && keywords.length > 0 && (
              <div className="card__keywords">
                {keywords.map((k) => (
                  <span className="card__keyword" key={k}>
                    {k}
                  </span>
                ))}
              </div>
            )}

            {text && <p className="card__text">{text}</p>}

            {isCreature && attack !== undefined && health !== undefined && (
              <div className="card__stats">
                <span className="card__stat card__stat--attack" title="Attack">
                  {attack}
                </span>
                <span className="card__stat card__stat--health" title="Health">
                  {health}
                </span>
              </div>
            )}

            {flavor && <p className="card__flavor">“{flavor}”</p>}
          </>
        )}
      </div>
    </div>
  );
}
