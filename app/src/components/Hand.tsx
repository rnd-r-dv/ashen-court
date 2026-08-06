import type { Card as CardSpec } from '@ashen/core';
import { motion } from 'framer-motion';
import CardView from './CardView.js';
import { handEnter } from './animations.js';
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
  /** Animation duration scale (fast mode 0.5). */
  animScale?: number;
}

/** Fan geometry: overlap shrinks as the hand grows so a full hand fits. */
function fanSpread(n: number): number {
  if (n <= 1) return 0;
  return Math.min(140, 540 / (n - 1));
}

export default function Hand({ hand, getCard, playable, interactive, targeting, onCardClick, animScale = 1 }: HandProps) {
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
          // Task 39: new cards (draws) mount with a fade-and-lift via
          // handEnter; the inner slot keeps the fan rotate transform so the
          // framer animation (on the wrapper) never fights it. The overlap
          // negative margin lives on the wrapper (the flex child) exactly as
          // before Task 39.
          <motion.div
            key={`${i}-${id}`}
            className="hand-slot-anim"
            style={{ marginRight: i < n - 1 ? -spread : 0, zIndex: i + 1 }}
            variants={handEnter(animScale)}
            initial="handIn"
            animate="enter"
          >
            <div
              className="hand-slot"
              style={{
                transform: `rotate(${angle}deg)`,
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
          </motion.div>
        );
      })}
    </div>
  );
}
