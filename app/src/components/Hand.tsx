import { useEffect, useState } from 'react';
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
 *
 * Task 41 (responsive): the fan geometry is viewport-aware — the overlap
 * (negative margin) widens just enough that a full hand stays inside the
 * window at every breakpoint (hand cards also shrink below 900px via
 * card.css zoom tiers), and the arc angle relaxes on narrow screens so the
 * rotated cards don't dip off-screen. Mirror values (zoom tiers, hand
 * padding) are kept in sync with card.css / hand.css.
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

/** Track the viewport width so the fan can fit on-screen (resize-aware). */
function useViewportWidth(): number {
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vw;
}

/** Rendered hand-card width — CardArt 250px + frame chrome, at zoom 1. */
const HAND_CARD_WIDTH = 264;

/**
 * Fan overlap (negative margin between adjacent cards). Mirrors the card.css
 * zoom tiers (0.82 / 0.7 / 0.6 below 900/700px) and the hand.css side
 * padding, then picks the widest overlap that still (a) fits the whole fan
 * inside the viewport and (b) keeps a fanned-overlap look (≤ 96px) without
 * the old fixed-140 cap that hid ~65% of every card.
 */
function fanSpread(n: number, vw: number): number {
  if (n <= 1) return 0;
  const zoom = vw <= 700 ? 0.6 : vw <= 900 ? 0.7 : 0.82;
  const cardW = HAND_CARD_WIDTH * zoom;
  const pad = Math.max(24, Math.min(48, vw * 0.05)); // hand.css clamp(24px, 5vw, 48px)
  const usable = Math.max(280, vw - 2 * pad);
  const fit = (cardW * n - usable) / (n - 1); // widest overlap that still fits
  return Math.max(fit, Math.min(96, 540 / (n - 1)));
}

export default function Hand({ hand, getCard, playable, interactive, targeting, onCardClick, animScale = 1 }: HandProps) {
  const vw = useViewportWidth();
  const n = hand.length;
  const spread = fanSpread(n, vw);
  const angleStep = vw <= 700 ? 3 : vw <= 900 ? 3.5 : 4;
  const mid = (n - 1) / 2;

  return (
    <div className="hand" aria-label={`Hand: ${n} card${n === 1 ? '' : 's'}`}>
      {n === 0 && <p className="hand-empty">No cards in hand</p>}
      {hand.map((id, i) => {
        const card = getCard(id);
        if (!card) return null;
        const isPlayable = playable.has(i);
        const angle = (i - mid) * angleStep;
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
