// UI pass 2026-08-07: the hand is a straight ordered row, not an arc fan.
//
// The visual half of that change (upright cards, fixed card box, opaque
// muting) lives in CSS, which jsdom does not lay out — but the spacing rule
// is a pure function, so the part that decides whether the row reads as an
// ordered row or a shuffled pile IS testable. `handStep` returns a margin:
// positive is a real gap, negative is an overlap.
import { describe, expect, it } from 'vitest';
import { handStep } from '../src/components/Hand.js';

const WIDE = 1600;
const CARD_W = 240; // card.css --card-w at zoom 1

describe('handStep', () => {
  it('gives a single card no neighbour to space against', () => {
    expect(handStep(1, WIDE)).toBe(0);
    expect(handStep(0, WIDE)).toBe(0);
  });

  it('spaces cards apart — not overlapping — when the row fits', () => {
    // 5 cards at 240px is 1200px of card inside ~1440px of usable width.
    expect(handStep(5, WIDE)).toBeGreaterThan(0);
  });

  it('overlaps only once the row genuinely cannot fit', () => {
    // The old fan overlapped unconditionally; this is the regression that
    // matters, since it is what made a small hand look like a pile.
    const step = handStep(4, WIDE);
    expect(step).toBeGreaterThan(0);
    expect(handStep(12, WIDE)).toBeLessThan(0);
  });

  it('keeps the whole row inside the viewport when it overlaps', () => {
    const vw = 1000;
    const n = 9;
    const step = handStep(n, vw);
    expect(step).toBeLessThan(0);
    const zoom = 0.88; // card.css tier for vw <= 1200
    const cardW = CARD_W * zoom;
    const pad = Math.max(24, Math.min(48, vw * 0.05));
    const width = cardW * n + step * (n - 1);
    expect(width).toBeLessThanOrEqual(vw - 2 * pad + 0.001);
  });

  it('never hides more than two thirds of a card, even at absurd hand sizes', () => {
    const vw = 720;
    const zoom = 0.76; // card.css tier for 700 < vw <= 900
    const cardW = CARD_W * zoom;
    // Past this the row is allowed to overflow instead: a strip of cost gems
    // is not a readable hand.
    expect(handStep(40, vw)).toBeGreaterThanOrEqual(-cardW * 0.66);
  });

  it('mirrors the card.css zoom tiers, so crossing one hides LESS of a card', () => {
    // Straddle the 900px breakpoint, where card.css drops hand zoom .88 → .76.
    // If handStep ever stops mirroring those tiers, the narrower viewport
    // starts compressing harder than the wider one — the inversion this pins.
    const n = 8;
    const hidden = (vw: number, zoom: number) => -handStep(n, vw) / (240 * zoom);
    expect(hidden(901, 0.88)).toBeGreaterThan(0);
    expect(hidden(900, 0.76)).toBeLessThan(hidden(901, 0.88));
  });
});
