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

/** CSS with block comments stripped — prose may name the dead recipes; only
 *  executable rules are a regression. Same idiom as armorialContract.test.ts. */
const executableCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

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

  it('keeps the card box a derived 5:7 ratio — no independent height literal', () => {
    // The invariant box (Task 5A): design-space tokens live at :root so every
    // consumer (hand scale, board scale, deck-builder tracks, fan math) reads
    // ONE source. --card-h is DERIVED from --card-w × --card-ratio (240 × 1.4
    // = 336, the 5:7 TCG proportion) — a literal height would let one side of
    // the ratio drift silently, which is exactly the failure this plan audits.
    const root = block(':root');
    expect(root).toMatch(/--card-w:\s*240px/);
    expect(root).toMatch(/--card-ratio:\s*1\.4/);
    expect(root).toMatch(/--card-h:\s*calc\(var\(--card-w\)\s*\*\s*var\(--card-ratio\)\)/);
    // The plate consumes the derived tokens; it declares nothing of its own.
    const card = block('.card');
    expect(card).toMatch(/width:\s*var\(--card-w\)/);
    expect(card).toMatch(/height:\s*var\(--card-h\)/);
    expect(card).not.toMatch(/--card-h:\s*\d+px/);
  });

  it('gives the hand context ONE scale authority — a CSS variable', () => {
    // .card--hand reads --hand-card-scale; a numeric zoom in the base rule
    // would create a second authority the media tiers could silently split.
    // Board minis read --board-card-scale the same way.
    expect(block('.card--hand')).toMatch(/zoom:\s*var\(--hand-card-scale\)/);
    expect(block('.card--board')).toMatch(/zoom:\s*var\(--board-card-scale\)/);
    // Base values: 0.8 hand / 0.5 board — the plan's constants.
    const root = block(':root');
    expect(root).toMatch(/--hand-card-scale:\s*0\.8/);
    expect(root).toMatch(/--board-card-scale:\s*0\.5/);
  });

  it('declares the height tiers on :root, guarded to wide windows', () => {
    // The responsive hand scale is height-owned: below 1061px height (wide
    // windows) 0.74, below 984px 0.66. Setting the VARIABLE (not the rule) is
    // what lets Hand.tsx read the same number the CSS renders. min-width
    // 1201 keeps narrow windows on the width tiers instead.
    const tier1060 =
      css.match(
        /@media \(max-height:\s*1060px\) and \(min-width:\s*1201px\)\s*\{\s*:root\s*\{([^}]*)\}/,
      )?.[1] ?? '';
    expect(tier1060).toMatch(/--hand-card-scale:\s*0\.74/);
    const tier983 =
      css.match(
        /@media \(max-height:\s*983px\) and \(min-width:\s*1201px\)\s*\{\s*:root\s*\{([^}]*)\}/,
      )?.[1] ?? '';
    expect(tier983).toMatch(/--hand-card-scale:\s*0\.66/);
  });

  it('keeps numeric zooms below the bases and removes the old hand-only height tiers', () => {
    // Width tiers (narrow windows) may only shrink relative to the 0.8 hand
    // base — a tier above 0.8 would ENLARGE hand cards on narrower screens.
    // Board width tiers stay under --board-card-scale (0.5). The old hand
    // height tiers at max-height 800/680 are gone: they would be a second
    // authority competing with the :root variable.
    for (const [, z] of css.matchAll(/\.card--hand\s*\{[^}]*zoom:\s*([\d.]+)/g)) {
      expect(Number(z), `hand zoom ${z}`).toBeLessThanOrEqual(0.8);
    }
    for (const [, z] of css.matchAll(/\.card--board\s*\{[^}]*zoom:\s*([\d.]+)/g)) {
      expect(Number(z), `board zoom ${z}`).toBeLessThanOrEqual(0.5);
    }
    expect(css).not.toMatch(/max-height:\s*800px\) and \(min-width:\s*1201px\)/);
    expect(css).not.toMatch(/max-height:\s*680px\) and \(min-width:\s*901px\)/);
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

  it('keeps the board mini text well hidden', () => {
    // Board minis are zoom 0.5 — an 11px chip renders at 5.5px, unreadable
    // and unclickable. Their keywords/rules live in the inspect panel
    // (main-thread plan, Task 7); un-hiding this reintroduces noise, not
    // information. Do not make this pass by dropping the rule: the body must
    // be OFF the board mini, not merely clipped.
    expect(block('.card--board .card__body')).toMatch(/display:\s*none/);
  });

  it('floors the board stat numeral in effective px under the half zoom', () => {
    // Board minis render at zoom 0.5 (card.css), halving every declared px
    // on screen. The three-cell rail numeral must stay readable: 32px
    // declared lands at exactly 16px effective — the plan's floor for the
    // rail type (Task 4 Step 7a). Never shrink the rail's type to fit;
    // contract spacing instead.
    const value = block('.card--board .card__stat-value');
    const size = Number(/font-size:\s*([\d.]+)px/.exec(value)?.[1]);
    expect(size).toBeGreaterThanOrEqual(32);
  });

  it('keeps the card plate flat: no gradients, glows, or depth shadows', () => {
    // Armorial direction contract (Task 5): flat heraldic tinctures, cream
    // engraved hairlines. The frame regions were stripped of gradients,
    // inset/depth shadows, bevels, and every filter: drop-shadow recipe
    // (including the old card-playable-glow pulse); a reintroduction is a
    // direction regression, not a style tweak. Box/text shadows count too —
    // the flat world has no depth system for them to belong to. Face-down
    // grayscale filters (filter: grayscale…) are fine; drop-shadow is not.
    expect(executableCss).not.toMatch(/gradient\(/);
    expect(executableCss).not.toMatch(/card-playable-glow/);
    expect(executableCss).not.toMatch(/drop-shadow/);
    expect(executableCss).not.toMatch(/box-shadow/);
    expect(executableCss).not.toMatch(/text-shadow/);
  });
});
