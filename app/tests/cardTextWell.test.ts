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

/** Body of a single CSS rule, e.g. block('.card__text') -> the declarations. */
function block(selector: string): string {
  // Escape the selector for use in a regex, then take everything to the first `}`.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1]! : '';
}

describe('card text well', () => {
  it('never clamps generated rules text', () => {
    // Rules text is what the card DOES. A line clamp can hide an effect the
    // player is about to pay mana for, which is a correctness bug rather than
    // a layout preference. Flavor may be clipped; rules text may not.
    expect(block('.card__text')).not.toMatch(/line-clamp/);
  });

  it('does not clamp flavor to a single line in hand', () => {
    // 279 of 285 cards have flavor longer than one line, so the one-line hand
    // clamp truncated almost the entire pool while leaving the card half empty.
    expect(block('.card--hand .card__flavor')).not.toMatch(/line-clamp/);
  });

  it('keeps the card box fixed', () => {
    // The invariant box (card.css:10-18) is what stops cards running ~600px
    // tall and disagreeing with each other. Redistributing space inside the
    // well must not relax it.
    const card = block('.card');
    expect(card).toMatch(/--card-w:\s*240px/);
    expect(card).toMatch(/--card-h:\s*336px/);
  });

  it('lets the body well distribute its own space', () => {
    // This one PASSES before the change — .card__body at card.css:316 is
    // already a flex column. It is here so that a later edit cannot quietly
    // take the property away and reintroduce the clamp-by-necessity problem.
    expect(block('.card__body')).toMatch(/display:\s*flex/);
  });
});
