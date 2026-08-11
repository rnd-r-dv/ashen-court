// UI pass 2026-08-07: the hand is a straight ordered row, not an arc fan.
// Task 5A (reflect plan): the scale is CSS-owned now — Hand.tsx reads the
// computed `--hand-card-scale` and passes the RENDERED card width into the
// pure `handStep`, whose only viewport input is the side padding. The old
// four-number breakpoint tree is gone; a same-width viewport whose cards
// render at different scales must space them differently.
//
// The visual half of the change (upright cards, fixed card box, opaque
// muting) lives in CSS, which jsdom does not lay out — but the spacing rule
// is a pure function, so the part that decides whether the row reads as an
// ordered row or a shuffled pile IS testable. `handStep` returns a margin:
// positive is a real gap, negative is an overlap.
import { describe, expect, it } from 'vitest';
import { handStep } from '../src/components/Hand.js';

const WIDE = 1600;
/** Design-space card width (card.css `--card-w` at :root). */
const CARD_W = 240;
/** Rendered width at the 0.8 base hand scale (card.css `--hand-card-scale`). */
const BASE_RENDERED = CARD_W * 0.8;
/** Rendered width at the 0.66 height-floor tier (the 1280×900 minimum). */
const FLOOR_RENDERED = CARD_W * 0.66;

describe('handStep', () => {
  it('gives a single card no neighbour to space against', () => {
    expect(handStep(1, WIDE, BASE_RENDERED)).toBe(0);
    expect(handStep(0, WIDE, BASE_RENDERED)).toBe(0);
  });

  it('spaces cards apart — not overlapping — when the row fits', () => {
    // 5 cards at the 0.8 rendered width is 960px of card inside ~1440px of
    // usable width.
    expect(handStep(5, WIDE, BASE_RENDERED)).toBeGreaterThan(0);
  });

  it('overlaps only once the row genuinely cannot fit', () => {
    // The old fan overlapped unconditionally; this is the regression that
    // matters, since it is what made a small hand look like a pile.
    const step = handStep(4, WIDE, BASE_RENDERED);
    expect(step).toBeGreaterThan(0);
    expect(handStep(12, WIDE, BASE_RENDERED)).toBeLessThan(0);
  });

  it('keeps the whole row inside the viewport when it overlaps', () => {
    const vw = 1000;
    const n = 9;
    const cardW = BASE_RENDERED; // CSS-owned scale, passed in as the rendered width
    const step = handStep(n, vw, cardW);
    expect(step).toBeLessThan(0);
    const pad = Math.max(24, Math.min(48, vw * 0.05)); // hand.css clamp(24px, 5vw, 48px)
    const width = cardW * n + step * (n - 1);
    expect(width).toBeLessThanOrEqual(vw - 2 * pad + 0.001);
  });

  it('consumes the rendered card width instead of guessing from viewport breakpoints', () => {
    // The scale is CSS-owned (--hand-card-scale). handStep must take the
    // RENDERED width and let it decide: two same-width viewports whose cards
    // render at different scales must not be spaced identically. (The old
    // breakpoint tree returned the same margin for both.)
    const vw = 1000;
    expect(handStep(8, vw, BASE_RENDERED)).toBeLessThan(handStep(8, vw, FLOOR_RENDERED));
  });

  it('never hides more than two thirds of a card, even at absurd hand sizes', () => {
    const vw = 720;
    const cardW = FLOOR_RENDERED;
    // Past this the row is allowed to overflow instead: a strip of cost gems
    // is not a readable hand.
    expect(handStep(40, vw, cardW)).toBeGreaterThanOrEqual(-cardW * 0.66);
  });
});
