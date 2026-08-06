import { useEffect, useRef, useState } from 'react';
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

/**
 * Stable per-hand-slot keys. The hand can hold duplicate card ids (decks
 * carry 3x commons), so keying by id alone collides in React; and
 * index-based keys (`${i}-${id}`) remount every later card when one is
 * played from the middle, replaying the handEnter draw animation on cards
 * that never moved. Instead each slot keeps the key it got at creation:
 * ids pool their keys, so surviving cards keep theirs across a play (no
 * remount) while a newly drawn card — even a second copy of an id already
 * in hand — gets a fresh key (its draw animation replays). Computed on
 * every render (not memoized): the engine mutates state.players[].hand in
 * place, so the array reference is stable while the content changes.
 */
function useStableHandKeys(hand: string[]): string[] {
  // id → keys currently held by that id's slots (first occurrence = first key).
  const poolRef = useRef<Map<string, string[]>>(new Map());
  // id → next fresh key number (monotonic per id; freed keys are dropped).
  const nextRef = useRef<Map<string, number>>(new Map());
  const counts = new Map<string, number>();
  for (const id of hand) counts.set(id, (counts.get(id) ?? 0) + 1);
  const used = new Map<string, number>();
  const keys: string[] = [];
  for (const id of hand) {
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    const pool = poolRef.current;
    const slotKeys = pool.get(id) ?? [];
    while (slotKeys.length < (counts.get(id) ?? 0)) {
      slotKeys.push(`${id}__${nextRef.current.get(id) ?? 0}`);
      nextRef.current.set(id, (nextRef.current.get(id) ?? 0) + 1);
    }
    pool.set(id, slotKeys);
    keys.push(slotKeys[n]!);
  }
  // Drop freed keys so the pool mirrors what is actually in hand (a played
  // card's key is gone; the next draw of that id gets a fresh one).
  for (const [id, slotKeys] of poolRef.current) {
    const c = counts.get(id) ?? 0;
    if (slotKeys.length > c) slotKeys.length = c;
  }
  return keys;
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
  // Stable slot keys: distinct cards keep their key across a play from the
  // middle (no remount → no handEnter replay); fresh draws get new keys.
  const slotKeys = useStableHandKeys(hand);

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
          // before Task 39. Keyed by the stable per-slot key (see
          // useStableHandKeys) so playing a card never remounts the rest.
          <motion.div
            key={slotKeys[i]}
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
