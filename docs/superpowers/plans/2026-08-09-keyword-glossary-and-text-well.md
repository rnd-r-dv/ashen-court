# Keyword Glossary and Card Text Well Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every keyword explain itself on click, stop the card frame truncating text it has room to show, and make the Forge offer every keyword the engine defines.

**Architecture:** Three independent app-side fixes, all instances of the same root cause — the app keeps a second, hand-maintained copy of a fact the engine already owns. `KEYWORD_TEXT` exists in `core/src/cardtext.ts` and nothing renders it; `Forge.tsx` restates the `Keyword` union as a literal and so silently omits new keywords; `card.css` clamps text by fixed line counts chosen for a worst case that almost never occurs. Each task derives from engine data instead of restating it.

**Tech Stack:** React 18 (`createPortal` from `react-dom`, already a dependency), plain CSS with custom properties, Vitest + jsdom for `app/tests/`. **No new dependencies.**

## Global Constraints

- ESM throughout: relative imports carry the `.js` extension even in `.ts`/`.tsx` source.
- `strict` + `noUncheckedIndexedAccess`. The `!` assertions on indexed access are intentional.
- Desktop and laptop only. A wide viewport, a mouse, and hover may be assumed.
- **Hover-only affordances are forbidden.** `app/PRODUCT.md` records the hero power's `title` tooltip as a known weakness that must not be extended. Keyword descriptions open on **click**, not hover.
- No linter. `npm test` runs the full Vitest workspace (core + server + app).
- `app/` is type-checked only in the editor — `vite build` strips types without checking — so any invariant that must hold in CI needs a **runtime** test, not a compile-time trick.
- Card art is seeded from `hashId(card.id)`. Never rename a card id.

## Prerequisites

This plan consumes work from `docs/superpowers/plans/2026-08-08-engine-rebalance-workers.md`:

- `KEYWORD_TEXT` — worker Task 4, exported from `core/src/cardtext.ts` and re-exported from `core/src/index.ts`.
- `venom` — worker Task 7. `stealth` — worker Task 8. Both are members of the `Keyword` union and have `KEYWORD_TEXT` entries and `KEYWORD_COST` entries.

If `import { KEYWORD_TEXT } from '@ashen/core'` does not resolve, worker Task 4 has not landed; stop and run it first.

## File Structure

| File | Responsibility |
|---|---|
| `app/src/components/KeywordChip.tsx` (new) | One keyword chip. Owns its own open/closed state and renders its description in a portalled popover. The single place any keyword is displayed. |
| `app/src/components/keywordchip.css` (new) | Chip and popover styling. Separate from `card.css` because the chip is used outside cards (the Forge picker). |
| `app/src/components/CardFrame.tsx` | Renders `KeywordChip` instead of a bare `<span>`. |
| `app/src/components/card.css` | The text well: flex distribution instead of fixed line clamps. |
| `app/src/forge/formState.ts` | Gains `KEYWORDS`, derived from `KEYWORD_COST`. Card-authoring data belongs here beside `EFFECT_PRESETS`, not in a screen component. |
| `app/src/screens/Forge.tsx` | Imports `KEYWORDS` instead of restating it; its picker chips gain descriptions. |
| `core/src/index.ts` | Exports `KEYWORD_COST` so the app can derive the keyword set from data. |

---

### Task 1: The card text well

`card.css` clamps by fixed line count: `.card__text` to 4 lines (line 393), `.card__flavor` to 2 (line 408), and `.card--hand .card__flavor` to 1 (line 423). Those counts were chosen for a worst case and are then applied to every card regardless of the room actually left, so a card prints "…" with roughly 40% of its own body empty beneath it.

Measured against the real pool: **279 of 285 cards** carry flavor longer than one line at 11.5px in the 220px well. The one-line hand clamp truncates essentially the whole game.

Clamping `.card__text` is the more serious half. That is *generated rules text* — what the card does. Hiding a line of it means a player pays mana for an effect they were never shown. The longest text in the pool today is `ember-phoenix` at 75 characters across two trigger lines, and the rebalance (worker Tasks 13-16 and 18) adds riders that push more cards to three.

**The card box stays exactly 240×336.** `card.css:10-18` records why: before it was fixed, cards ran ~600px tall and no two matched. This task redistributes the space *inside* the existing well; it must not change `--card-w`, `--card-h`, or `--card-art-h`.

**Files:**
- Modify: `app/src/components/card.css:382-425`
- Test: `app/tests/cardTextWell.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. `.card__body` becomes a flex column; Task 2 renders chips inside it and relies on it being `display: flex; flex-direction: column`.

- [ ] **Step 1: Write the failing test**

CSS line-clamping does not change the DOM — jsdom sees the full string either way — so a render test cannot catch this. The invariant is about the stylesheet itself, so assert on the stylesheet.

Create `app/tests/cardTextWell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('../src/components/card.css', import.meta.url)),
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/tests/cardTextWell.test.ts`
Expected: FAIL on exactly **two** of the four — `.card__text` contains `line-clamp: 4`, and `.card--hand .card__flavor` contains `line-clamp: 1`. The card-box and flex-column assertions pass already and must keep passing.

- [ ] **Step 3: Rebuild the well**

**Do not add a `.card__body` rule.** One already exists at `card.css:316` and is already `display: flex; flex-direction: column; min-height: 0; overflow: hidden`. A second copy in a later block would be a duplicate that silently wins on cascade order. Leave it alone.

Two variant rules also exist and must both be left intact:
- `.card--board .card__body { display: none; }` (line ~465) — board minis have no text well at all.
- `.card--bleed .card__body { flex: 0 0 auto; … }` (line ~526) — on full-bleed epic/legendary cards the well sizes to content and sits over a bottom scrim. Removing the clamps makes that panel grow *upward* into the art as text lengthens, which is correct for a bottom-anchored scrim. The longest rules text in the pool is `ember-phoenix` at 75 characters, so verify that card specifically in Step 5.

In `app/src/components/card.css`, replace only the region from the `/* ---- rules text ---- */` comment (line 382) through the `.card--hand .card__flavor` rule (line 425) with:

```css
/* ---- rules text and flavor -------------------------------------
   These live inside .card__body (line 316), which is already a flex
   column that absorbs whatever height the art panel and ribbon leave
   over. They used to clamp by FIXED LINE COUNT — rules text at 4
   lines, flavor at 2, flavor in hand at 1 — counts chosen for a worst
   case and then applied to every card regardless of the room actually
   left. The result was an ellipsis with ~40% of the card empty
   beneath it, on 279 of 285 cards.

   Now the two share the well: rules text takes exactly what it needs,
   flavor takes the remainder, and only a pathological string is
   clipped. Rules text is never clamped at all — it is what the card
   DOES, and hiding a line of it makes a player pay for an effect they
   were never shown. If both genuinely cannot fit, FLAVOR yields; it
   is the copy that does not affect play.                           */
.card__text {
  flex: 0 0 auto;         /* sizes to content, and wins the space race */
  margin: 7px 4px 0;
  font-size: 12.5px;
  color: #e6e0d0;
  line-height: 1.32;
  text-align: center;
}

.card__flavor {
  flex: 0 1 auto;         /* takes what is left, yields first when short */
  min-height: 0;
  margin: 5px 4px 0;
  font-size: 11.5px;
  font-style: italic;
  color: #a79e88;
  line-height: 1.3;
  text-align: center;
  overflow: hidden;
}

/* Board minis are rendered at zoom 0.5, where 11.5px flavor is
   unreadable and would only crowd the stats. */
.card--board .card__flavor {
  display: none;
}
```

Note what is deliberately absent: no `-webkit-line-clamp` anywhere, and no `.card--hand .card__flavor` override at all. Hand and preview now use the same rule.

Also update the stale comment at `CardFrame.tsx:165-167`, which currently claims the text is "clamped inside" the well:

```tsx
            {/* One fixed-height text well. It is a flex column: rules text
                sizes to content and flavor takes the remainder, so nothing is
                truncated while the card still has room. The card box itself
                stays invariant — see --card-h in card.css. */}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/tests/cardTextWell.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Verify by eye**

Run `npm run dev`, open the Forge, and preview these two cards — the extremes of the pool:

- `coven-queen` — 142 characters of flavor, the longest in the game.
- `ember-phoenix` — the longest rules text, two trigger lines.

Neither may show an ellipsis. Neither may overflow the card's border. If `coven-queen`'s flavor does clip, that is acceptable *only* if the well is visibly full; clipping with empty space beneath it means `min-height: 0` is missing somewhere.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all pass. If `app/tests/cardTreatment.test.ts` or `app/tests/boardSurface.test.ts` asserted on the removed rules, update the expectation to the new one and say why in a comment.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/card.css app/src/components/CardFrame.tsx app/tests/cardTextWell.test.ts
git commit -m "fix(card): stop truncating text the card has room to show"
```

---

### Task 2: Keyword descriptions on click

`KEYWORD_TEXT` has existed since worker Task 4 and nothing renders it. Keywords appear as bare word-chips — `CardFrame.tsx:169-177` — with no way to learn what they mean. Ward and Shield are the sharpest case: they read as the same thing and are not.

Descriptions open on **click**. Not hover: `app/PRODUCT.md` records the hero power's `title` tooltip as a known weakness that must not be extended, and a hover-only mechanism cannot be reached from a board creature at `zoom: 0.5` anyway.

**Files:**
- Create: `app/src/components/KeywordChip.tsx`, `app/src/components/keywordchip.css`
- Modify: `app/src/components/CardFrame.tsx:169-177`, `app/src/components/card.css:325-345`
- Test: `app/tests/keywordChip.test.tsx` (create)

**Interfaces:**
- Consumes: `KEYWORD_TEXT` from `@ashen/core` (worker Task 4); `.card__body` as a flex column (Task 1).
- Produces: `KeywordChip`, default export of `app/src/components/KeywordChip.tsx`:
  ```tsx
  export interface KeywordChipProps {
    keyword: Keyword;
    /** Visual scale. 'card' is the in-frame chip; 'picker' is the larger
     *  Forge selection chip, which also carries a selected state. */
    variant?: 'card' | 'picker';
    /** Picker only: whether this keyword is currently chosen. */
    selected?: boolean;
    /** Picker only: fired on the SELECT affordance, not the describe one. */
    onToggle?: () => void;
  }
  export default function KeywordChip(props: KeywordChipProps): JSX.Element;
  ```
  Task 3 renders this with `variant="picker"`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/keywordChip.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { KEYWORD_TEXT } from '@ashen/core';
import KeywordChip from '../src/components/KeywordChip.js';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(node); });
}

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  host = null;
  root = null;
});

describe('KeywordChip', () => {
  it('shows no description until clicked', () => {
    render(createElement(KeywordChip, { keyword: 'taunt' }));
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.taunt);
  });

  it('reveals the engine text on click', () => {
    render(createElement(KeywordChip, { keyword: 'ward' }));
    const btn = host!.querySelector('button')!;
    act(() => { btn.click(); });
    // The popover is portalled to document.body, so query the document.
    expect(document.body.textContent).toContain(KEYWORD_TEXT.ward);
  });

  it('closes on a second click', () => {
    render(createElement(KeywordChip, { keyword: 'shield' }));
    const btn = host!.querySelector('button')!;
    act(() => { btn.click(); });
    act(() => { btn.click(); });
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.shield);
  });

  it('closes on Escape', () => {
    render(createElement(KeywordChip, { keyword: 'lifesteal' }));
    act(() => { host!.querySelector('button')!.click(); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.lifesteal);
  });

  it('does not let the click reach an enclosing card', () => {
    // Board creatures are clickable for attack targeting. A chip click must
    // describe the keyword WITHOUT also selecting an attacker.
    let outer = 0;
    render(
      createElement(
        'div',
        { onClick: () => { outer += 1; } },
        createElement(KeywordChip, { keyword: 'rush' }),
      ),
    );
    act(() => { host!.querySelector('button')!.click(); });
    expect(outer).toBe(0);
  });

  it('describes every keyword the engine defines', () => {
    for (const k of Object.keys(KEYWORD_TEXT) as (keyof typeof KEYWORD_TEXT)[]) {
      expect(KEYWORD_TEXT[k].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/tests/keywordChip.test.tsx`
Expected: FAIL — `Cannot find module '../src/components/KeywordChip.js'`.

- [ ] **Step 3: Write the component**

Create `app/src/components/KeywordChip.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Keyword } from '@ashen/core';
import { KEYWORD_TEXT } from '@ashen/core';
import './keywordchip.css';

/**
 * A keyword and, on click, what it means.
 *
 * The text comes from KEYWORD_TEXT in core — the same generated source the
 * engine documents itself with — so a chip can never describe a rule the
 * engine does not implement.
 *
 * CLICK, not hover. app/PRODUCT.md records the hero power's `title` tooltip
 * as a known weakness that must not be extended; hover also cannot be reached
 * on a board creature, which renders at zoom 0.5.
 *
 * The popover is PORTALLED to document.body. The chip lives inside
 * `.card__body`, which is `overflow: hidden` inside a fixed 240x336 box, so an
 * in-flow popover would be clipped by its own parent. Fixed positioning from
 * the chip's client rect escapes that, and because `zoom` scales the layout
 * box, getBoundingClientRect already reports the on-screen position at any
 * card size.
 */

export interface KeywordChipProps {
  keyword: Keyword;
  /** Visual scale. 'card' is the in-frame chip; 'picker' is the larger Forge
   *  selection chip, which also carries a selected state. */
  variant?: 'card' | 'picker';
  /** Picker only: whether this keyword is currently chosen. */
  selected?: boolean;
  /** Picker only: fired on the SELECT affordance, not the describe one. */
  onToggle?: () => void;
}

export default function KeywordChip({
  keyword,
  variant = 'card',
  selected = false,
  onToggle,
}: KeywordChipProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    // Any click that is not on this chip dismisses it. Capture phase so it
    // runs before a card's own handler can act on the same click.
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick, true);
    // The card fan scrolls and the board reflows; a stale fixed popover would
    // detach from its chip, so close rather than chase it.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  function describe(e: ReactMouseEvent<HTMLButtonElement>) {
    // A board creature is clickable for attack targeting and a hand card is
    // clickable to play. Describing a keyword must do neither.
    e.stopPropagation();
    e.preventDefault();
    const next = !open;
    if (next) setRect(e.currentTarget.getBoundingClientRect());
    setOpen(next);
  }

  function toggle(e: ReactMouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    onToggle?.();
  }

  const classes = [
    'kwchip',
    `kwchip--${variant}`,
    selected ? 'kwchip--selected' : '',
    open ? 'kwchip--open' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className="kwchip-wrap">
      {/* In the picker the chip has TWO jobs — choose the keyword, and explain
          it — so they get two separate controls. On a card there is only one. */}
      <button
        type="button"
        ref={btnRef}
        className={classes}
        aria-expanded={open}
        aria-label={`${keyword} — what does this do?`}
        onClick={onToggle ? toggle : describe}
      >
        {keyword}
      </button>
      {onToggle && (
        <button
          type="button"
          className="kwchip__help"
          aria-expanded={open}
          aria-label={`What does ${keyword} do?`}
          onClick={describe}
        >
          ?
        </button>
      )}
      {open && rect && createPortal(
        <div
          className="kwpop"
          role="dialog"
          aria-label={keyword}
          style={{ top: rect.bottom + 6, left: rect.left + rect.width / 2 }}
        >
          <span className="kwpop__name">{keyword}</span>
          <span className="kwpop__text">{KEYWORD_TEXT[keyword]}</span>
        </div>,
        document.body,
      )}
    </span>
  );
}
```

Note the `onClick={onToggle ? toggle : describe}` split. In the Forge the chip already means "select this keyword", so describing moves to a separate `?` control; on a card the chip's only job is to describe, so it takes the click directly.

- [ ] **Step 4: Write the stylesheet**

Create `app/src/components/keywordchip.css`:

```css
/* Keyword chip + its click-to-open description.
   The popover is position: fixed because it is portalled to document.body to
   escape the card's clipped, fixed-size body well. */

.kwchip-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.kwchip {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 8px;
  background: #2c2c36;
  border: 1px solid #43434f;
  color: #d8d2c2;
  font-family: system-ui, sans-serif;
  font-size: 11px;
  letter-spacing: 0.3px;
  white-space: nowrap;
  cursor: help;
}

.kwchip--open,
.kwchip:hover {
  border-color: #6d6d80;
  color: #f2ecdc;
}

.kwchip--picker {
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}

.kwchip--selected {
  background: #3f3a2a;
  border-color: #8a7742;
  color: #f5e9c8;
}

.kwchip__help {
  width: 15px;
  height: 15px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  border: 1px solid #43434f;
  color: #a79e88;
  font-size: 10px;
  line-height: 1;
  cursor: help;
}

.kwpop {
  position: fixed;
  z-index: 60;
  transform: translateX(-50%);
  max-width: 240px;
  padding: 8px 10px;
  border: 1px solid #5a5468;
  border-radius: 6px;
  background: #14131a;
  color: #e6e0d0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  pointer-events: none;   /* the doc-level dismiss handler owns every click */
}

.kwpop__name {
  display: block;
  margin-bottom: 3px;
  color: #c8b98a;
  font-variant: small-caps;
  letter-spacing: 0.5px;
}

.kwpop__text { display: block; }

@media (prefers-reduced-motion: no-preference) {
  .kwpop { animation: kwpop-in 90ms ease-out; }
  @keyframes kwpop-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-2px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
}
```

- [ ] **Step 5: Render it from the card frame**

In `app/src/components/CardFrame.tsx`, replace the keyword block at lines 169-177:

```tsx
              {keywords && keywords.length > 0 && (
                <div className="card__keywords">
                  {keywords.map((k) => (
                    <KeywordChip key={k} keyword={k} />
                  ))}
                </div>
              )}
```

Add the import beside the existing component imports:

```tsx
import KeywordChip from './KeywordChip.js';
```

In `app/src/components/card.css`, the `.card__keyword` rule at line 334 is now dead — `KeywordChip` carries its own styling. Delete it, and change `.card__keywords` so a second chip row is allowed to exist:

```css
/* ---- keyword chips --------------------------------------------
   Chips used to be `nowrap; overflow: hidden`, which silently ATE
   the second and third keyword. venom and stealth make multi-keyword
   creatures common, and a keyword you cannot see is a rule you cannot
   play around. The well is a flex column now (see .card__body), so a
   wrapped second row costs flavor space, not rules text.            */
.card__keywords {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px;
  margin-top: 5px;
  flex: 0 0 auto;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run app/tests/keywordChip.test.tsx`
Expected: PASS, all six.

- [ ] **Step 7: Verify against the reported problem**

Run `npm run dev`, start a match against a bot, and check:

1. A hand card with a keyword — click the chip, read the description, press Escape.
2. A full-bleed epic or legendary in hand (its body panel sits over a scrim) — the popover must render *above* the card, not behind it. `.kwpop` has `z-index: 60`; raise it if some card chrome outranks it.
3. Click a chip on a card in hand while it is playable. The description opens and **the card is not played**. This is what the `stopPropagation` test covers; confirm it by eye too, because a synthetic click cannot prove the real screen wiring.

**Board creatures are deliberately not in that list.** `card.css:465` sets `.card--board .card__body { display: none; }`, so a board mini renders no text well at all — no rules text, no flavor, and **no keyword chips**. A keyword on a played creature is currently invisible, which is a larger gap than the missing descriptions and is *not* fixed by this task.

Do not fix it by un-hiding the well. A board mini renders at `zoom: 0.5`, where an 11px chip becomes 5.5px — unreadable and effectively unclickable. The right home for a board creature's keywords is the inspect panel in `docs/superpowers/plans/2026-08-08-discover-armorial-mainthread.md` Task 7, which opens on click at full size and can render `KeywordChip` directly. Leave a comment at `card.css:465` recording that, so the next reader does not "fix" the hidden well:

```css
/* Board minis hide the whole text well: at zoom 0.5 an 11px chip is 5.5px,
   which is unreadable and unclickable. A board creature's keywords and rules
   text are reached through the inspect panel instead — see the main-thread
   plan, Task 7. Do not un-hide this; make the inspect panel better. */
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: all pass. `app/tests/boardSurface.test.ts` or `app/tests/cardTreatment.test.ts` may query `.card__keyword`; update those selectors to `.kwchip` and note the rename in a comment.

- [ ] **Step 9: Commit**

```bash
git add app/src/components/KeywordChip.tsx app/src/components/keywordchip.css \
        app/src/components/CardFrame.tsx app/src/components/card.css \
        app/tests/keywordChip.test.tsx
git commit -m "feat(card): keyword chips explain themselves on click"
```

---

### Task 3: Derive the Forge's keyword list from the engine

`Forge.tsx:39-47` restates the `Keyword` union as a literal:

```ts
const KEYWORDS: Keyword[] = ["taunt","rush","charge","windfury","lifesteal","ward","shield"];
```

Because an *incomplete* `Keyword[]` is still a valid `Keyword[]`, nothing warned when `venom` (worker Task 7) and `stealth` (worker Task 8) joined the union — they simply never appear in the picker, so no player can author a card using them.

`KEYWORD_COST` in `core/src/validate.ts:22` is a `Record<Keyword, number>`. `core` **is** type-checked (`npm run build -w core` is `tsc --noEmit`), so the compiler already forces that record to hold every keyword. Its keys are therefore the complete set, and they are enumerable at runtime.

**Files:**
- Modify: `core/src/index.ts:8`, `core/tests/publicSurface.test.ts`, `app/src/forge/formState.ts`, `app/src/screens/Forge.tsx:39-47` and its keyword-chip block at 433-460
- Test: `app/tests/forgeKeywords.test.ts` (create)

**Interfaces:**
- Consumes: `KeywordChip` with `variant="picker"` (Task 2).
- Produces: `KEYWORD_COST` on the `@ashen/core` public surface; `KEYWORDS: Keyword[]` exported from `app/src/forge/formState.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/forgeKeywords.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { KEYWORD_COST } from '@ashen/core';
import { KEYWORDS } from '../src/forge/formState.js';
import { EFFECT_PRESETS } from '../src/forge/formState.js';

describe('forge authoring surface', () => {
  it('offers every keyword the engine defines', () => {
    // Forge.tsx used to restate the Keyword union as a literal. An incomplete
    // Keyword[] is still a valid Keyword[], so venom and stealth were added to
    // the engine and silently never reached the picker. This is the test that
    // fails next time.
    expect([...KEYWORDS].sort()).toEqual(Object.keys(KEYWORD_COST).sort());
  });

  it('offers a preset for every effect kind', () => {
    // EFFECT_PRESETS has the same restatement shape for EffectKind. Adding an
    // EffectKind without a preset makes the mechanic unreachable in the Forge
    // even though the engine executes it.
    const kinds = new Set(EFFECT_PRESETS.map(p => p.spec.kind));
    for (const kind of [
      'dealDamage', 'draw', 'heal', 'buff', 'summon', 'gainMana', 'refillMana',
      'freeze', 'destroy', 'copyCard', 'giveKeyword', 'discountMostExpensive',
      'discountNextSpell', 'silence', 'returnToHand', 'spellPower', 'overload',
      'consume',
    ]) {
      expect(kinds, `no Forge preset for ${kind}`).toContain(kind);
    }
  });
});
```

If the second test names an `EffectKind` that does not exist in `core/src/types.ts` — because a worker task was cut — delete that entry from the list rather than inventing the preset. If it names one that exists and has no preset, add the preset in Step 4.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/tests/forgeKeywords.test.ts`
Expected: FAIL — `KEYWORD_COST` is not exported from `@ashen/core`, and `KEYWORDS` is not exported from `formState.ts`.

- [ ] **Step 3: Put `KEYWORD_COST` on the public surface**

`core/src/index.ts:8` currently reads:

```ts
export { validateCard, validateDeck, RARITY_COPY_LIMIT, type ValidationIssue } from './validate.js';
```

Change it to:

```ts
// KEYWORD_COST is exported because the Forge implements the same card-authoring
// contract validate.ts enforces: it needs the keyword SET as data rather than
// as a hand-copied literal, and a keyword's cost is part of that contract.
export { validateCard, validateDeck, RARITY_COPY_LIMIT, KEYWORD_COST, type ValidationIssue } from './validate.js';
```

`core/tests/publicSurface.test.ts` guards this surface deliberately. Read it first and add `KEYWORD_COST` the way that file already expresses its entries — do not restructure it.

- [ ] **Step 4: Derive the list in `formState.ts`**

Add to `app/src/forge/formState.ts`, beside `EFFECT_PRESETS`:

```ts
/**
 * Every keyword a Forge card may carry, DERIVED from the engine rather than
 * restated. KEYWORD_COST is a Record<Keyword, number> and core is type-checked,
 * so the compiler guarantees it holds the complete set.
 *
 * Order follows KEYWORD_COST's declaration order, which is also the order the
 * picker renders in. Reordering KEYWORD_COST reorders the UI — if that matters,
 * sort here rather than editing core for a layout reason.
 */
export const KEYWORDS = Object.keys(KEYWORD_COST) as Keyword[];
```

Add `KEYWORD_COST` to the existing `@ashen/core` import in that file, and `Keyword` to its existing `import type` list if not already present (it is imported at line 6).

- [ ] **Step 5: Consume it in the Forge**

In `app/src/screens/Forge.tsx`, delete the literal at lines 39-47 and import instead:

```ts
import { KEYWORDS } from '../forge/formState.js';
```

Then replace the chip render inside the keywords `<section>` (around line 438) so the picker chips describe themselves too — a player authoring a card is exactly who most needs to know what `venom` does:

```tsx
							<div className="forge-chips">
								{KEYWORDS.map((k) => (
									<KeywordChip
										key={k}
										keyword={k}
										variant="picker"
										selected={form.keywords.includes(k)}
										onToggle={() =>
											set(
												"keywords",
												form.keywords.includes(k)
													? form.keywords.filter((x) => x !== k)
													: [...form.keywords, k],
											)
										}
									/>
								))}
							</div>
```

Add `import KeywordChip from "../components/KeywordChip.js";` beside the existing component imports. Read the surrounding code first and keep the existing `set(...)` call shape exactly — the snippet above reproduces the current toggle logic from lines 445-451 and must stay equivalent.

The old `.forge-chip` rules in `app/src/screens/forge.css` become dead once nothing renders that class. Delete them.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run app/tests/forgeKeywords.test.ts`
Expected: PASS, both.

- [ ] **Step 7: Verify by eye**

Run `npm run dev`, open the Forge, choose Creature. The keyword picker must show **nine** chips including `venom` and `stealth`. Click a chip to select it; click its `?` to read the description. Selecting and describing must be independent — describing must never toggle selection.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: all pass, `core/tests/publicSurface.test.ts` included. `app/tests/forge.test.ts` may query `.forge-chip`; update those selectors to `.kwchip` and note the rename.

- [ ] **Step 9: Commit**

```bash
git add core/src/index.ts core/tests/publicSurface.test.ts \
        app/src/forge/formState.ts app/src/screens/Forge.tsx \
        app/src/screens/forge.css app/tests/forgeKeywords.test.ts
git commit -m "fix(forge): derive the keyword picker from the engine"
```

---

## Self-Review

**Coverage.** Keyword descriptions on click → Task 2, rendered on hand cards, board creatures, and the Forge picker. Card text truncation → Task 1. Forge missing `venom`/`stealth` → Task 3. The `EFFECT_PRESETS` completeness check rides along in Task 3 Step 1 because it is the same restatement defect in the same file.

**Type consistency.** `KeywordChip`'s props are declared once in Task 2 and consumed in Task 3 with the same names (`keyword`, `variant`, `selected`, `onToggle`). `KEYWORDS` is produced by Task 3 Step 4 in `formState.ts` and imported by Task 3 Step 5 and the Task 3 Step 1 test from that same path. `KEYWORD_TEXT` and `KEYWORD_COST` both come from `@ashen/core`; `KEYWORD_TEXT` is worker Task 4's, `KEYWORD_COST` is added here.

**Ordering.** Task 1 must precede Task 2: Task 2's wrapped chip row assumes `.card__body` is a flex column that can absorb a second row, which Task 1 establishes. Task 3 must follow Task 2, which defines `KeywordChip`. Run them 1 → 2 → 3.

**Interaction with the main-thread plan.** `docs/superpowers/plans/2026-08-08-discover-armorial-mainthread.md` covers overlapping ground and must be updated once this lands: its Task 5 Step 5 (the text well) is superseded by Task 1 here; its Task 7 Step 1 no longer needs to invent a keyword-text mechanism, since the inspect panel can render `KeywordChip`; its Task 9 Steps 1-3 are superseded by Task 3 here. The Armorial restyle of the Forge and Deck Builder (Task 9 Step 4 there) is **not** covered by this plan and still stands.

**Known gap 1.** Task 1's guard asserts on the *stylesheet text* rather than on rendered layout, because jsdom does not implement `-webkit-line-clamp` and cannot measure text. It catches a regression that re-adds a clamp; it cannot catch a well that fails to distribute space for some other reason. Step 5's visual check with `coven-queen` and `ember-phoenix` is the real verification, which is why it names specific cards rather than saying "check some cards".

**Known gap 2 — keywords are invisible on the board.** `card.css:465` hides the entire text well on board minis, so a played creature shows no keyword chips at all. This plan does not fix that, and deliberately does not try: at `zoom: 0.5` a chip is 5.5px. The fix belongs to the inspect panel (main-thread plan, Task 7), which opens at full size on click. Task 2 Step 7 records this at the point of temptation so nobody un-hides the well instead.

**Baseline verified against merged `main` (commit `df038be`).** `Keyword` carries all nine members; `KEYWORD_TEXT` is exported from `core/src/index.ts:10`; `KEYWORD_COST` is not exported, so Task 3 Step 3 is still required. The full suite is green at 572 tests across 77 files. Flavor remains over one line on 279 of 285 cards after the rebalance, and the longest rules text is `ember-phoenix` at 75 characters — both figures in this plan are post-merge measurements, not carried over from before.
