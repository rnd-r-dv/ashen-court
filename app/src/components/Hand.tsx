import type { Card as CardSpec } from '@ashen/core';
import CardView from './CardView.js';
import './hand.css';

/**
 * Hand (Task 31): the viewer's fanned hand. Cards overlap along an arc with
 * the middle on top; hover lift comes from Card's `card--hand` state.
 * Playable cards (legal playCard intent this turn) get the golden glow;
 * everything else is dimmed (opponent's turn / targeting in progress).
 * Pure presentational — clicking reports the hand index, Match decides.
 */

export interface HandProps {
  /** Card ids in hand order. */
  hand: string[];
  /** Resolve a card id to its spec (unknown ids → undefined, skipped). */
  getCard: (id: string) => CardSpec | undefined;
  /** Hand indices with a legal playCard intent right now. */
  playable: ReadonlySet<number>;
  /** Viewer's main turn — cards are clickable. */
  interactive: boolean;
  /** A targeting mode is active — the hand stands down. */
  targeting: boolean;
  onCardClick: (handIndex: number) => void;
}

/** Fan geometry: overlap shrinks as the hand grows so a full hand fits. */
function fanSpread(n: number): number {
  if (n <= 1) return 0;
  return Math.min(140, 540 / (n - 1));
}

export default function Hand({ hand, getCard, playable, interactive, targeting, onCardClick }: HandProps) {
  const n = hand.length;
  const spread = fanSpread(n);
  const mid = (n - 1) / 2;

  return (
    <div className="hand" aria-label={`Hand: ${n} card${n === 1 ? '' : 's'}`}>
      {n === 0 && <p className="hand-empty">No cards in hand</p>}
      {hand.map((id, i) => {
        const card = getCard(id);
        if (!card) return null;
        const isPlayable = playable.has(i);
        const angle = (i - mid) * 4;
        return (
          <div
            key={`${i}-${id}`}
            className="hand-slot"
            style={{
              marginRight: i < n - 1 ? -spread : 0,
              transform: `rotate(${angle}deg)`,
              zIndex: i + 1,
            }}
          >
            <CardView
              card={card}
              size="hand"
              playable={isPlayable && interactive && !targeting}
              muted={!interactive || targeting || !isPlayable}
              onClick={() => onCardClick(i)}
            />
          </div>
        );
      })}
    </div>
  );
}
