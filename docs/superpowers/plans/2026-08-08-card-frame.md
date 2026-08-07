# Card Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproportion the card to a 3:2 landscape art panel, fix the stat-pip/ribbon collision, restore flavor text to hand cards, wire in generated art, and add the full-bleed treatment for epic and legendary cards that have art.

**Architecture:** The card keeps its banded structure and its fixed 240×336 box. Two treatments now exist — banded (default) and full-bleed (epic+ **and** art present) — selected by a derived class in `Card.tsx`, never by authored data.

**Tech Stack:** React 18, plain CSS (no framework), vitest + jsdom.

## Global Constraints

- **The fixed-box invariant is not reopened.** Every card is exactly `--card-w` × `--card-h` regardless of type, keyword count, rules length or flavor length. Both treatments obey it.
- **No type-dependent layout.** Do not solve any problem by branching on `card.type`. That is the class of bug the fixed-box work eliminated.
- **ESM, `.js` extensions on relative imports, `strict` + `noUncheckedIndexedAccess`.**
- **jsdom does not lay out CSS.** Tests assert structure and class wiring, never computed pixel geometry. `app/tests/handLayout.test.ts` is the pattern: extract the decision into a pure function and test that.
- **Existing suite must stay green.** Run `npm test` before every commit.
- **This plan depends on `resolveCardArt` from the art-pipeline plan (Task 11).** If it does not exist yet, Tasks 1–3 still work; Tasks 4–6 are blocked.

## Current state (verified, do not re-derive)

`app/src/components/card.css`:
```css
--card-w: 240px;  --card-h: 336px;  --card-pad: 8px;
--card-top-h: 32px;  --card-art-h: 158px;
.card--preview { zoom: 1 }  .card--hand { zoom: 1 }  .card--board { zoom: 0.5 }
.card--board { --card-h: 216px }
```
`.card__stats` is `position: absolute; bottom: -13px` on `.card__artwrap` — **this is the collision.** The type ribbon sits directly below the art, so on every creature the pips overlap its crossed-swords icon and rarity label.

`.card--hand .card__flavor, .card--board .card__flavor { display: none }` — flavor is currently hidden in hand.

`CardFrame.tsx` structure: `.card__frame > .card__top`, `.card__artwrap > (.card__art, .card__stats)`, `.card__ribbon`, `.card__body > (.card__keywords, .card__text, .card__flavor)`.

`CardArt.tsx` already short-circuits to an `<img>` when `recipe.imageUrl` is set — **reuse that path rather than adding a second one.**

## Height budget (the target)

```
 240 x 336 card, banded
+----------------------------+
| (6) [ Seraph of Lament   ] |   38px   32 + 6 margin
+----------------------------+
|      LANDSCAPE ART         |  147px   220 / 1.5, derived not hardcoded
|  (4)                  (6)  |          pips INSIDE the panel
+----------------------------+
| * CREATURE          RARE   |   27px   21 + 6 margin
+----------------------------+
|  [ lifesteal ]             |
|  Rules text, up to 4 lines |  104px   flex: 1
|  plus one flavor line.     |
+----------------------------+
                              = 316px inner (336 - 16 pad - 4 border)
```

## File Structure

| File | Responsibility |
|---|---|
| `app/src/components/card.css` | Modify — panel ratio, pip position, flavor, full-bleed rules |
| `app/src/components/CardFrame.tsx` | Modify — accept and apply the treatment class |
| `app/src/components/Card.tsx` | Modify — derive the treatment, inject generated art |
| `app/src/components/cardTreatment.ts` | Create — the pure treatment decision |
| `app/tests/cardTreatment.test.ts` | Create — tests for the above |

---

## Task 1: Derive the art panel height from the ratio

**Files:**
- Modify: `app/src/components/card.css`

**Interfaces:**
- Produces: `--card-art-h` computed from `--card-art-w` and a named ratio, so the panel and the generated art can never disagree.

- [ ] **Step 1: Replace the hardcoded panel height**

Find this block in `card.css`:

```css
  /* Matches CardArt's VIEW_W/VIEW_H aspect (250/180) at the inner
     width, so the art panel never has to crop in normal layout. */
  --card-art-h: 158px;
```

Replace it with:

```css
  /* ---- art panel geometry -------------------------------------
     ONE decision expressed twice would drift, so the panel height
     is DERIVED from the ratio, never typed in. Generated card art
     is requested at exactly this ratio (scripts/art/prompt.ts,
     aspectForRarity), so panel and image agree and nothing crops.
     Change --card-art-ratio and the panel follows.                */
  --card-art-w: calc(var(--card-w) - 2 * var(--card-pad) - 4px);  /* 220px */
  --card-art-ratio: 1.5;                                          /* 3:2   */
  --card-art-h: calc(var(--card-art-w) / var(--card-art-ratio));  /* 147px */
```

- [ ] **Step 2: Update the board-mini height, which is derived from the panel**

Find:

```css
.card--board {
  --card-h: 216px;   /* pad/border 20 + top 38 + art 158 */
}
```

Replace with:

```css
.card--board {
  /* chrome 20 (pad 16 + border 4) + top row 38 + art panel.
     Derived, so it tracks --card-art-h automatically. */
  --card-h: calc(20px + 38px + var(--card-art-h));   /* 205px at 3:2 */
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm test`
Expected: all green. CSS is not under test, so this proves only that nothing else regressed.

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`, start a match. Confirm: art panel is visibly wider than tall, cards are all the same height, board minis are shorter than before. **The pips still collide with the ribbon — that is Task 2.**

- [ ] **Step 5: Commit**

```bash
git add app/src/components/card.css
git commit -m "fix(card): derive art panel height from a 3:2 ratio instead of hardcoding"
```

---

## Task 2: Fix the stat-pip / ribbon collision

**Files:**
- Modify: `app/src/components/card.css`

**Context:** `.card__stats` is `bottom: -13px` on `.card__artwrap`, hanging the pips *below* the art panel and straight into the type ribbon. Screenshots show the attack pip covering the ribbon's crossed-swords icon and the health pip covering the rarity label.

**The fix is to move the pips fully inside the panel.** Do **not** add horizontal padding to the ribbon on creature cards — that reintroduces a type-dependent layout, which is forbidden by this plan's constraints.

- [ ] **Step 1: Move the pips inside the panel**

Find:

```css
.card__stats {
  position: absolute;
  left: -2px;
  right: -2px;
  bottom: -13px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}
```

Replace with:

```css
/* ---- creature stats pips --------------------------------------
   INSIDE the art panel's lower corners, not straddling its edge.
   The previous rule hung them 13px below the panel, where the type
   ribbon lives, so on every creature the pips covered the ribbon's
   icon and its rarity label. Keeping them inside makes the overlap
   structurally impossible — no per-type padding, no special cases. */
.card__stats {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}
```

- [ ] **Step 2: Verify visually**

```bash
npm run dev
```

Look at any creature card in hand. The `4` and `6` pips must sit over the artwork's bottom corners, and the full `⚔ CREATURE ... RARE` ribbon must be legible with nothing on top of it. Compare a creature and a spell side by side — the two cards must be exactly the same height.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/card.css
git commit -m "fix(card): stat pips no longer collide with the type ribbon"
```

---

## Task 3: Restore flavor text to hand cards

**Files:**
- Modify: `app/src/components/card.css`

**Context:** the well grows from 93px to 104px in Task 1, which is what makes room for a flavor line. Every one of the 285 curated cards carries flavor text that is currently invisible during play.

- [ ] **Step 1: Stop hiding flavor in hand**

Find:

```css
/* Creature stats already say a lot; give rules text the room instead.
   The preview (Forge) always shows flavor — that's where it is authored. */
.card--hand .card__flavor,
.card--board .card__flavor {
  display: none;
}
```

Replace with:

```css
/* Board minis have no text well at all, so flavor cannot show there.
   Hand cards regained the room for one line when the well grew to
   104px (see --card-art-h), and every curated card carries flavor —
   hiding it during play wasted writing that already exists. It is
   clamped to a single line in hand so it can never crowd rules text,
   which is the copy that actually affects play. */
.card--board .card__flavor {
  display: none;
}

.card--hand .card__flavor {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}
```

- [ ] **Step 2: Verify visually**

`npm run dev`. A hand card with short rules text (e.g. a vanilla creature) should now show one italic flavor line. A card with 4 lines of rules text should show rules text in full, with flavor clipped away by the well's `overflow: hidden` — never a half-rendered line of rules text.

- [ ] **Step 3: Run the suite and commit**

```bash
npm test
git add app/src/components/card.css
git commit -m "feat(card): restore a flavor line to hand cards"
```

---

## Task 4: The treatment decision

**Files:**
- Create: `app/src/components/cardTreatment.ts`
- Test: `app/tests/cardTreatment.test.ts`

**Interfaces:**
- Consumes: `Rarity` from `@ashen/core`
- Produces:
  ```ts
  export type Treatment = 'banded' | 'bleed';
  export function treatmentFor(rarity: Rarity, hasGeneratedArt: boolean): Treatment;
  ```

**Both conditions are required for `'bleed'`.** A legendary without generated art must stay banded, or scrim text would float over a two-stop procedural SVG gradient and read as broken rather than premium.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/cardTreatment.test.ts
import { describe, expect, it } from 'vitest';
import { treatmentFor } from '../src/components/cardTreatment.js';

describe('treatmentFor', () => {
  it('gives epic and legendary the full-bleed treatment when art exists', () => {
    expect(treatmentFor('epic', true)).toBe('bleed');
    expect(treatmentFor('legendary', true)).toBe('bleed');
  });

  it('keeps common and rare banded even with art', () => {
    expect(treatmentFor('common', true)).toBe('banded');
    expect(treatmentFor('rare', true)).toBe('banded');
  });

  it('keeps epic and legendary banded when art is missing', () => {
    // Full-bleed over a procedural two-stop gradient would put rules text on
    // a flat colour field and read as broken, not premium. Both conditions
    // are required.
    expect(treatmentFor('epic', false)).toBe('banded');
    expect(treatmentFor('legendary', false)).toBe('banded');
  });

  it('is banded for everything when nothing has been generated yet', () => {
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(treatmentFor(r, false)).toBe('banded');
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/cardTreatment.test.ts`
Expected: FAIL — cannot resolve `../src/components/cardTreatment.js`.

- [ ] **Step 3: Write the implementation**

```ts
// app/src/components/cardTreatment.ts
import type { Rarity } from '@ashen/core';

/**
 * Which of the card's two layouts a card gets. Derived, never authored.
 *
 *   banded — portrait card, landscape art panel on top, text below (default)
 *   bleed  — art fills the box, text on gradient scrims (epic+ WITH art)
 *
 * Both conditions are required for 'bleed'. Full-bleed puts rules text over
 * illustration, so it must never be applied to a card whose art is the
 * procedural SVG: a two-stop gradient behind scrim text reads as broken
 * rather than premium.
 *
 * This deliberately mirrors the 'epic+' coverage mode in the art pipeline —
 * the cards that get full-bleed are exactly the cards that get generated art
 * first if cost forces the pool to be cut.
 */
export type Treatment = 'banded' | 'bleed';

export function treatmentFor(rarity: Rarity, hasGeneratedArt: boolean): Treatment {
  if (!hasGeneratedArt) return 'banded';
  return rarity === 'epic' || rarity === 'legendary' ? 'bleed' : 'banded';
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/tests/cardTreatment.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add app/src/components/cardTreatment.ts app/tests/cardTreatment.test.ts
git commit -m "feat(card): pure treatment decision (banded vs full-bleed)"
```

---

## Task 5: Wire generated art into the card

**Files:**
- Modify: `app/src/components/Card.tsx`
- Modify: `app/src/components/CardFrame.tsx`
- Test: `app/tests/cardArtWiring.test.ts`

**Interfaces:**
- Consumes: `resolveCardArt` (art-pipeline plan Task 11), `treatmentFor` (Task 4)
- Produces: `CardFrame` accepts `treatment?: Treatment` and emits `card--bleed` for `'bleed'`.

**Key insight: do not add a second image-rendering path.** `CardArt.tsx` already short-circuits to an `<img>` when `recipe.imageUrl` is set. Injecting the resolved URL into a copy of the recipe reuses that path entirely.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/cardArtWiring.test.ts
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { buildPool } from '@ashen/core';
import Card from '../src/components/Card.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Pretend exactly one card has generated art.
vi.mock('../src/art/resolveArt.js', () => ({
  resolveCardArt: (id: string) => (id === 'HAS_ART' ? '/assets/has-art-abc123.jpg' : null),
  resolveHeroArt: () => null,
  heroSlug: (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));

function render(card: Parameters<typeof Card>[0]['card']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(createElement(Card, { card, size: 'hand' })); });
  return { host, cleanup: () => act(() => root.unmount()) };
}

const pool = buildPool();
const legendary = pool.find((c) => c.rarity === 'legendary')!;
const common = pool.find((c) => c.rarity === 'common')!;

describe('generated art wiring', () => {
  it('renders an <img> for a card that has generated art', () => {
    const { host, cleanup } = render({ ...common, id: 'HAS_ART' });
    const img = host.querySelector('.card__art img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/has-art-abc123.jpg');
    cleanup();
  });

  it('falls back to the procedural SVG when there is no generated art', () => {
    const { host, cleanup } = render(common);
    expect(host.querySelector('.card__art img')).toBeNull();
    expect(host.querySelector('.card__art svg')).not.toBeNull();
    cleanup();
  });

  it('never overrides a Forge upload with generated art', () => {
    // Custom cards own their imageUrl; generated art must not clobber it.
    const uploaded = {
      ...common, id: 'HAS_ART',
      art: { ...common.art, imageUrl: 'data:image/png;base64,UPLOADED' },
    };
    const { host, cleanup } = render(uploaded);
    expect(host.querySelector('.card__art img')!.getAttribute('src'))
      .toBe('data:image/png;base64,UPLOADED');
    cleanup();
  });

  it('applies full-bleed to a legendary that has art', () => {
    const { host, cleanup } = render({ ...legendary, id: 'HAS_ART' });
    expect(host.querySelector('.card--bleed')).not.toBeNull();
    cleanup();
  });

  it('keeps a legendary banded when it has no art', () => {
    const { host, cleanup } = render(legendary);
    expect(host.querySelector('.card--bleed')).toBeNull();
    cleanup();
  });

  it('keeps a common banded even with art', () => {
    const { host, cleanup } = render({ ...common, id: 'HAS_ART' });
    expect(host.querySelector('.card--bleed')).toBeNull();
    cleanup();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/cardArtWiring.test.ts`
Expected: FAIL — no `.card--bleed` element, no `<img>`.

- [ ] **Step 3: Add the treatment prop to CardFrame**

In `CardFrame.tsx`, add to `CardFrameProps`:

```ts
  /** Layout treatment (cardTreatment.ts). 'bleed' puts art behind the text. */
  treatment?: Treatment;
```

Add the import:

```ts
import type { Treatment } from './cardTreatment.js';
```

Add `treatment = 'banded'` to the destructured params, and extend the class list:

```ts
  const classes = [
    'card',
    className,
    `card--rarity-${rarity}`,
    `card--type-${type}`,
    treatment === 'bleed' && 'card--bleed',
  ]
    .filter(Boolean)
    .join(' ');
```

- [ ] **Step 4: Resolve art and treatment in Card.tsx**

Replace the body of `Card.tsx`'s component with:

```tsx
export default function Card({
  card,
  size = 'hand',
  faceDown = false,
  playable = false,
  selected = false,
  onClick,
}: CardProps) {
  // Generated art (art-pipeline plan). A miss returns null and CardArt renders
  // the procedural SVG, which is what lets the pool be generated a slice at a
  // time and keeps Forge custom cards working.
  //
  // A Forge upload always wins: custom cards own their imageUrl, and a
  // generated file could only collide with one by sharing an id, which
  // saveCustomCard already forbids.
  const generated = card.art.imageUrl ? null : resolveCardArt(card.id);
  const art = generated ? { ...card.art, imageUrl: generated } : card.art;

  // Injecting into the recipe reuses CardArt's existing imageUrl short-circuit
  // rather than adding a second image-rendering path.
  const treatment = treatmentFor(card.rarity, generated !== null);

  const state = [
    `card--${size}`,
    faceDown && 'card--face-down',
    playable && !faceDown && 'card--playable',
    selected && 'card--selected',
  ].filter(Boolean).join(' ');

  return (
    <CardFrame
      className={state}
      treatment={faceDown ? 'banded' : treatment}
      rarity={card.rarity}
      type={card.type}
      name={card.name}
      cost={card.cost}
      attack={card.attack}
      health={card.health}
      keywords={card.keywords}
      flavor={card.flavor}
      text={cardText(card)}
      faceDown={faceDown}
      onClick={onClick ? () => onClick(card) : undefined}
    >
      <CardArt recipe={art} />
    </CardFrame>
  );
}
```

Add the imports at the top of `Card.tsx`:

```ts
import { resolveCardArt } from '../art/resolveArt.js';
import { treatmentFor } from './cardTreatment.js';
```

Note `treatment={faceDown ? 'banded' : treatment}` — a face-down card shows no text, so full-bleed would be meaningless and its scrims would be visible chrome on a card back.

- [ ] **Step 5: Run the test**

Run: `npx vitest run app/tests/cardArtWiring.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the full suite and commit**

```bash
npm test
git add app/src/components/Card.tsx app/src/components/CardFrame.tsx app/tests/cardArtWiring.test.ts
git commit -m "feat(card): render generated art, derive full-bleed treatment"
```

---

## Task 6: Full-bleed CSS

**Files:**
- Modify: `app/src/components/card.css`

**Context:** `.card--bleed` is now emitted by `CardFrame`. Nothing styles it yet.

- [ ] **Step 1: Add the full-bleed rules**

Append to `card.css`:

```css
/* ============================================================
   Full-bleed treatment — epic and legendary cards WITH generated
   art (cardTreatment.ts). Art fills the box; the name row and the
   text well float over it on gradient scrims.

   The card box is unchanged: same --card-w / --card-h as a banded
   card. Only the internal layout differs, so the fixed-box
   invariant still holds across both treatments.
   ============================================================ */

.card--bleed .card__frame {
  padding: 0;
}

/* Art is the backdrop, not a band: it fills the frame and everything
   else stacks on top of it. */
.card--bleed .card__artwrap {
  position: absolute;
  inset: 0;
  flex: none;
  height: auto;
  z-index: 0;
}

.card--bleed .card__art {
  border-radius: inherit;
}

.card--bleed .card__top,
.card--bleed .card__ribbon,
.card--bleed .card__body {
  position: relative;
  z-index: 1;
}

/* Top scrim: dark at the very top, clear by the time it reaches the art. */
.card--bleed .card__top {
  margin: 0;
  padding: var(--card-pad) var(--card-pad) 14px;
  background: linear-gradient(180deg, rgba(8, 6, 14, 0.92) 0%, rgba(8, 6, 14, 0) 100%);
}

/* Bottom scrim: carries the rules text, so it is the denser of the two.
   Pushed to the bottom of the frame by the auto margin. */
.card--bleed .card__ribbon {
  margin: auto var(--card-pad) 0;
  background: rgba(20, 18, 28, 0.82);
}

.card--bleed .card__body {
  flex: 0 0 auto;
  padding: 6px var(--card-pad) var(--card-pad);
  background: linear-gradient(180deg, rgba(8, 6, 14, 0) 0%, rgba(8, 6, 14, 0.9) 26%, rgba(8, 6, 14, 0.96) 100%);
}

/* Legibility is a hard requirement, not a nice-to-have: rules text must
   survive the BRIGHTEST image in the generated set. The scrim does most
   of the work; the shadow covers the rest. */
.card--bleed .card__text,
.card--bleed .card__flavor {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.7);
}

.card--bleed .card__text {
  color: #f2ecdc;
}

/* Pips sit over the bottom scrim; the ribbon's own inset keeps clear of them. */
.card--bleed .card__stats {
  bottom: auto;
  top: calc(var(--card-h) - 92px);
}

/* Full-bleed board minis: art plus the name row only, same as banded minis. */
.card--board.card--bleed .card__ribbon,
.card--board.card--bleed .card__body {
  display: none;
}
```

- [ ] **Step 2: Verify visually — this is the acceptance gate**

```bash
npm run dev
```

You need a legendary with generated art in hand. If the art pipeline has not run, temporarily force the treatment by editing `treatmentFor` to `return 'bleed'`, look, then **revert the edit**.

Check, and do not sign this task off until all four hold:

1. Rules text is readable against the brightest generated image, not just a dark one
2. The card is exactly the same size as a banded card beside it
3. Stat pips do not cover the ribbon or the rules text
4. The name is legible against the top of the art

If a specific generated image defeats the scrim, the fix is to regenerate that card (`scripts/art/overrides.ts` + `--force`), **not** to darken the scrim until the art is invisible on every card.

- [ ] **Step 3: Run the suite and commit**

```bash
npm test
git add app/src/components/card.css
git commit -m "feat(card): full-bleed treatment for epic and legendary cards with art"
```

---

## Self-review notes

- **Spec coverage:** §4.1 → Tasks 4, 5; §4.2 → Tasks 1, 3; §4.3 → Task 6; §4.4 → Task 2; §4.5 → Task 1; §4.6 → Tasks 1, 6.
- **Placeholder scan:** every CSS and TSX step contains the literal text to write. No "add appropriate styling".
- **Type consistency:** `Treatment` is defined once in `cardTreatment.ts` and imported by `CardFrame.tsx` and `Card.tsx` under that exact name. `treatmentFor(rarity, hasGeneratedArt)` keeps that argument order everywhere.
- **Dependency:** Tasks 4–6 import `resolveCardArt` from `app/src/art/resolveArt.ts`, delivered by the art-pipeline plan's Task 11. Tasks 1–3 are independent and can ship first.
- **Known limitation:** Task 6's acceptance is manual. Scrim-versus-art legibility cannot be asserted in jsdom, which does not render pixels.
