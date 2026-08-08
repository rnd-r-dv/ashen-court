import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Captured in a const: Vite's jsdom transform rewrites the literal
// `new URL(rel, import.meta.url)` asset pattern to resolve against the
// document base (http://localhost:3000/), which fileURLToPath rejects.
// The const escapes the rewrite; the four assertions below are per the
// brief (Task 1 deviation, see task-1-report.md).
const here = import.meta.url;
const css = readFileSync(
  fileURLToPath(new URL('../src/components/card.css', here)),
  'utf8',
);

/** Escape a selector for literal use inside a regex. */
function esc(selector: string): string {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Body of the FIRST rule for a selector, e.g. block('.card__text'). */
function block(selector: string): string {
  const m = new RegExp(`${esc(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1]! : '';
}

/** Bodies of EVERY rule whose selector list contains this selector.
 *  A selector can appear more than once — `.card--bleed .card__body` has one
 *  rule for stacking and another for the scrim — and asserting on only the
 *  first would silently miss the one that carries the layout. */
function blocks(selector: string): string[] {
  // Either the selector ends the list and `{` follows, or a `,` and the rest
  // of the list come between. No nested braces in this stylesheet.
  const re = new RegExp(`${esc(selector)}(?:\\s*,[^{}]*)?\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(re)].map((m) => m[1]!);
}

describe('card text well', () => {
  it('never clamps generated rules text', () => {
    // Rules text is what the card DOES. A line clamp can hide an effect the
    // player is about to pay mana for, which is a correctness bug rather than
    // a layout preference. Flavor may be clipped; rules text may not.
    expect(block('.card__text')).not.toMatch(/line-clamp/);
  });

  it('clamps by line count nowhere in the stylesheet', () => {
    // Asserting on `.card--hand .card__flavor` specifically is the obvious
    // shape and the wrong one: that rule was DELETED, so block() returns ''
    // and the assertion passes against an empty stylesheet — it guards
    // nothing. 279 of 285 cards have flavor longer than one line, so the
    // one-line hand clamp truncated almost the entire pool while leaving the
    // card half empty. Scan the whole file: any new clamp, on any selector,
    // reintroduces that bug.
    expect(css).not.toMatch(/line-clamp/);
  });

  it('keeps the card box fixed', () => {
    // The invariant box (card.css:10-18) is what stops cards running ~600px
    // tall and disagreeing with each other. Redistributing space inside the
    // well must not relax it.
    const card = block('.card');
    expect(card).toMatch(/--card-w:\s*240px/);
    expect(card).toMatch(/--card-h:\s*336px/);
  });

  it('leaves the full-bleed well able to shrink', () => {
    // Full-bleed cards float the well over a bottom scrim inside a fixed,
    // overflow-hidden frame, with the slack held in the ribbon's
    // `margin-top: auto`. Unclamped text eventually outgrows that slack; if
    // the panel cannot shrink it runs off the bottom edge and is cut there —
    // mid-line, across the stat pips, with no ellipsis. Shrinking keeps the
    // overflow inside .card__body, which already clips, so flavor yields
    // instead of the card breaking.
    const bleed = blocks('.card--bleed .card__body');
    expect(bleed.length).toBeGreaterThan(0);
    for (const b of bleed) expect(b).not.toMatch(/flex:\s*0\s+0\s/);
  });

  it('lets the body well distribute its own space', () => {
    // This one PASSES before the change — .card__body at card.css:316 is
    // already a flex column. It is here so that a later edit cannot quietly
    // take the property away and reintroduce the clamp-by-necessity problem.
    expect(block('.card__body')).toMatch(/display:\s*flex/);
  });
});
