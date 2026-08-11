import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Card as CardSpec } from '@ashen/core';
import { motion } from 'framer-motion';
import CardView from './CardView.js';
import { handEnter } from './animations.js';
import './hand.css';

/**
 * Hand (Task 31): the viewer's hand, laid out as a straight ordered row.
 * Hover lift comes from Card's `card--hand` state. Playable cards (legal
 * playCard intent this turn) get the golden glow; everything else is dimmed
 * (opponent's turn / targeting in progress). Pure presentational — clicking
 * reports the hand index, Match decides.
 *
 * UI pass 2026-08-07: the arc fan is gone. Cards used to be rotated ±(i-mid)
 * degrees and always overlapped, which made the hand read as a shuffled pile
 * (hand order was there, but you had to infer it from the z-stack) and made
 * the outermost cards dip below the viewport's bottom edge. They now sit
 * upright in index order with a real gap whenever the row fits, tightening
 * into an overlap only when the viewport actually runs out of width.
 *
 * The geometry is viewport-aware; mirror values (zoom tiers, hand padding)
 * are kept in sync with card.css / hand.css.
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
 * that never moved.
 *
 * A card in hand has no engine-side instance identity — a hand is literally
 * `string[]` — so which slot survived has to be recovered from how the array
 * changed. The engine only ever removes a played/discarded card in place
 * (splice) and appends draws to the end, so a new hand is always the old hand
 * with entries deleted plus fresh entries appended. Matching each new id to
 * the earliest still-unconsumed occurrence of that id in the previous hand
 * (a left-to-right cursor, never rewound — the engine never reorders a hand)
 * therefore identifies the survivors exactly: a survivor keeps its key, so
 * React reuses its node (no remount, no replayed draw lift), and anything
 * left unmatched is genuinely new and gets a fresh key so its draw animation
 * plays.
 *
 * This replaces an earlier scheme that pooled keys per id by occurrence
 * index. That one also never changed a live key, but it released the LAST key
 * of an id rather than the key of the copy that actually left. Invisible when
 * a duplicate is merely played (the copies are interchangeable), but when one
 * copy is played and another copy of the same id is drawn in the SAME
 * resolution — one state-mirror update, e.g. a spell that damages and draws —
 * the id's count is unchanged, no fresh key is minted, and the newly drawn
 * card silently inherits the played card's mounted node and never animates in.
 *
 * Computed on every render (not memoized): the engine mutates
 * state.players[].hand in place, so the array reference is stable while the
 * content changes. Re-running on an unchanged hand is idempotent (every entry
 * matches itself), so a repeated or discarded render cannot shuffle keys.
 */
function useStableHandKeys(hand: string[]): string[] {
  const prevHandRef = useRef<string[]>([]);
  const prevKeysRef = useRef<string[]>([]);
  // Monotonic key counter — a freed key is never handed out again.
  const nextRef = useRef(0);

  const prevHand = prevHandRef.current;
  const prevKeys = prevKeysRef.current;
  const keys: string[] = [];
  // Cursor into the previous hand; only ever moves forward, so each previous
  // slot is claimed by at most one new slot and survivors keep their order.
  let cursor = 0;
  for (const id of hand) {
    let found = -1;
    for (let j = cursor; j < prevHand.length; j++) {
      if (prevHand[j] === id) {
        found = j;
        break;
      }
    }
    if (found === -1) {
      keys.push(`${id}__${nextRef.current++}`); // newly drawn → animates in
    } else {
      cursor = found + 1;
      keys.push(prevKeys[found]!); // survivor → same node, no remount
    }
  }
  prevHandRef.current = [...hand];
  prevKeysRef.current = keys;
  return keys;
}

/** Read the CSS-owned hand scale (:root --hand-card-scale, media-resolved) with
 *  a validated 0.8 fallback. jsdom (and any environment that cannot cascade
 *  stylesheet custom properties) returns an empty string → parse fails → 0.8,
 *  the plan's base scale; a garbage value (NaN/0/negative) is equally rejected. */
function readHandScale(): number {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--hand-card-scale');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.8;
}

/** Track viewport width + the computed CSS hand scale in one resize-aware update. */
function useViewportGeometry(): { vw: number; scale: number } {
  const [viewport, setViewport] = useState(() => ({ vw: window.innerWidth, scale: readHandScale() }));
  useEffect(() => {
    const onResize = () => setViewport({ vw: window.innerWidth, scale: readHandScale() });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return viewport;
}

/** Design-space card width — card.css `--card-w` at :root (the ONLY number
 *  Hand.tsx owns; the rendered width is HAND_CARD_WIDTH × the CSS scale). */
const HAND_CARD_WIDTH = 240;

/** Gap between cards when the whole row fits without overlapping. */
const HAND_GAP = 10;

/**
 * Never hide more than this fraction of a card behind its neighbour, however
 * large the hand gets. Past roughly two thirds only the cost gem is left and
 * the row stops being readable at all; overflowing the container is the
 * lesser evil, and `.hand` centres so the overflow splits evenly.
 */
const MAX_OVERLAP_FRACTION = 0.66;

/**
 * Horizontal step between adjacent cards, as a MARGIN: positive values are a
 * real gap, negative values an overlap. Task 5A: pure in the rendered card
 * WIDTH, not viewport breakpoints — the caller passes HAND_CARD_WIDTH × the
 * computed CSS --hand-card-scale, so CSS owns every scale number and this
 * function's only viewport input is the side padding (hand.css clamp).
 *
 * Cards are only pulled together once the row genuinely cannot fit, and never
 * past MAX_OVERLAP_FRACTION. Previously the hand overlapped unconditionally
 * (≤96px, and more when tight) even with three cards on a wide screen.
 */
export function handStep(n: number, vw: number, renderedCardWidth: number): number {
  if (n <= 1) return 0;
  const pad = Math.max(24, Math.min(48, vw * 0.05)); // hand.css clamp(24px, 5vw, 48px)
  const usable = Math.max(280, vw - 2 * pad);
  if (renderedCardWidth * n + HAND_GAP * (n - 1) <= usable) return HAND_GAP;
  const overlap = (renderedCardWidth * n - usable) / (n - 1); // tightest fit that still fits
  return -Math.min(overlap, renderedCardWidth * MAX_OVERLAP_FRACTION);
}

export default function Hand({ hand, getCard, playable, interactive, targeting, onCardClick, animScale = 1 }: HandProps) {
  const { vw, scale } = useViewportGeometry();
  const n = hand.length;
  // Rendered width = design-space width × the CSS-resolved scale — the same
  // number zoom renders, so the fan math is truthful to the pixels.
  const step = handStep(n, vw, HAND_CARD_WIDTH * scale);
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
        return (
          // Task 39: new cards (draws) mount with a fade-and-lift via
          // handEnter. The horizontal step lives on the wrapper (the flex
          // child) exactly as before Task 39. Keyed by the stable per-slot key
          // (see useStableHandKeys) so playing a card never remounts the rest.
          //
          // z-index ascends with the hand index so an overlapping row still
          // stacks left-to-right in order; `--z` (not an inline z-index) so
          // hand.css can lift the hovered card above its neighbours — an
          // inline value would outrank the :hover rule.
          <motion.div
            key={slotKeys[i]}
            className="hand-slot-anim"
            style={{ marginRight: i < n - 1 ? step : 0, ['--z' as string]: i + 1 } as CSSProperties}
            variants={handEnter(animScale)}
            initial="handIn"
            animate="enter"
          >
            <div className="hand-slot">
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
