# Match Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the match screen communicate game state — a real battlefield surface per side, mana you can actually see, distinguishable heroes, an in-theme HP gauge, readable enemy-hand backs, and a deck count.

**Architecture:** Almost entirely presentational. One narrow addition to the `@ashen/core` public surface (`BOARD_CAP`), no engine behaviour changes.

**Tech Stack:** React 18, framer-motion, plain CSS, vitest + jsdom.

## Global Constraints

- **No engine behaviour changes.** `core/src/engine/` is off-limits except for adding one existing constant to the public export list. No new state, no new events.
- **jsdom does not lay out CSS.** Tests assert structure, counts and class wiring — never computed geometry.
- **ESM, `.js` extensions on relative imports, `strict` + `noUncheckedIndexedAccess`.**
- **Theme tokens only.** `app/src/theme.css` owns the palette (`--gold`, `--ember`, `--bg-1`, `--bg-2`, `--border`, `--text`, `--text-dim`, `--text-faint`). Do not introduce raw hex for anything that has a token.
- **Existing suite must stay green.** Run `npm test` before every commit.

## Scope correction — read before starting

The design spec §5 lists "deck and discard counts". **Discard is dropped and this is deliberate.**

`PlayerState` is `{ hero, deck, hand, board, artifacts, mana, maxMana, surged }` (`core/src/types.ts:53`). There is no discard pile, graveyard, or played-card list anywhere in the engine — a resolved spell simply ceases to exist. Adding one means a new `PlayerState` field, new `dispatch` handling, and a serialization change, all of which §2 of the spec rules out as engine changes.

**Deck count is implemented (Task 6). Discard is not. Do not invent a discard pile to satisfy the spec text.**

## Current state (verified, do not re-derive)

| Thing | Where | Now |
|---|---|---|
| Empty board row | `Board.tsx:208,216` | `<p className="board-empty">—</p>` |
| Hero sigil | `HeroPortrait.tsx:39` | `const SIGIL = '✦'` — one glyph for all 12 heroes |
| Mana pips | `manatray.css:10-30` | 11px diamonds, 5-column grid, 12px readout |
| Mana render site | `Board.tsx:234` | inside `.board-side--bottom` |
| HP fill | `heroportrait.css:95-97` | green `#7bc96f` / amber `#e0b14d` / red `#e2604f` |
| Enemy hand | `Board.tsx:203` | `size="board"` face-down `CardView`s |
| Board cap | `core/src/engine/effects.ts:29` | `BOARD_CAP = 7`, **not exported** from `core/src/index.ts` |

## File Structure

| File | Responsibility |
|---|---|
| `core/src/index.ts` | Modify — export `BOARD_CAP` |
| `app/src/components/Board.tsx` | Modify — slot outlines, deck count |
| `app/src/components/board.css` | Modify — board surface styling |
| `app/src/components/ManaTray.tsx` | Modify — three pip states |
| `app/src/components/manatray.css` | Modify — larger crystals, readout |
| `app/src/components/HeroPortrait.tsx` | Modify — generated portrait, sigil fallback |
| `app/src/components/heroportrait.css` | Modify — portrait image, HP gauge |
| `app/src/components/DeckCount.tsx` | Create — deck-remaining pill |
| `app/src/components/deckcount.css` | Create |
| `app/tests/boardSurface.test.ts` | Create |
| `app/tests/manaTray.test.ts` | Create |
| `app/tests/heroPortrait.test.ts` | Create |

---

## Task 1: Export BOARD_CAP

**Files:**
- Modify: `core/src/index.ts`
- Test: `core/tests/publicSurface.test.ts`

**Interfaces:**
- Produces: `export { BOARD_CAP } from './engine/effects.js';`

**Why this is allowed:** `core/src/index.ts` is the deliberate public surface and engine internals are not exported. But `BOARD_CAP` is a *rules constant the UI needs to render*, exactly like `RARITY_COPY_LIMIT`, which is already exported from `validate.ts`. Exporting a `const` changes no behaviour. The alternative — hardcoding `7` in the app — would silently desync the board outline from the rule the moment the cap changed.

- [ ] **Step 1: Write the failing test**

```ts
// core/tests/publicSurface.test.ts
import { describe, expect, it } from 'vitest';
import { BOARD_CAP } from '../src/index.js';

describe('public surface', () => {
  it('exports BOARD_CAP so the UI can draw the right number of slots', () => {
    // Hardcoding 7 in the app would desync the outline from the rule.
    expect(BOARD_CAP).toBe(7);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run core/tests/publicSurface.test.ts`
Expected: FAIL — `BOARD_CAP` is not exported from `../src/index.js`.

- [ ] **Step 3: Add the export**

In `core/src/index.ts`, after the `CardRegistry` export, add:

```ts
/** Board capacity (engine/effects.ts). Exported because the UI draws exactly
 *  this many creature slots — hardcoding 7 in the app would let the outline
 *  and the rule drift apart. No other engine internal is exported. */
export { BOARD_CAP } from './engine/effects.js';
```

- [ ] **Step 4: Run the test and the build**

```bash
npx vitest run core/tests/publicSurface.test.ts   # PASS
npm run build -w core                              # tsc --noEmit, clean
```

- [ ] **Step 5: Commit**

```bash
npm test
git add core/src/index.ts core/tests/publicSurface.test.ts
git commit -m "feat(core): export BOARD_CAP for the board surface UI"
```

---

## Task 2: Board surface with slot outlines

**Files:**
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/board.css`
- Test: `app/tests/boardSurface.test.ts`

**Context:** an empty row currently renders `<p className="board-empty">—</p>`, which reads as "nothing here" rather than "your side, room for N".

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/boardSurface.test.ts
import { describe, expect, it } from 'vitest';
import { BOARD_CAP } from '@ashen/core';
import { slotCount } from '../src/components/Board.js';

describe('slotCount', () => {
  it('shows the full capacity when the board is empty', () => {
    expect(slotCount(0)).toBe(BOARD_CAP);
  });

  it('shows only the remaining room once creatures are down', () => {
    expect(slotCount(3)).toBe(BOARD_CAP - 3);
  });

  it('shows no empty slots on a full board', () => {
    expect(slotCount(BOARD_CAP)).toBe(0);
  });

  it('never returns a negative count', () => {
    // Defensive: a future effect could exceed the cap transiently.
    expect(slotCount(BOARD_CAP + 2)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/boardSurface.test.ts`
Expected: FAIL — `slotCount` is not exported from `Board.js`.

- [ ] **Step 3: Add the helper and render the slots**

In `Board.tsx`, add near the top (after the imports):

```ts
import { BOARD_CAP } from '@ashen/core';

/**
 * How many empty slot outlines to draw beside the creatures already down.
 * An empty row used to render a bare em dash, which reads as "nothing here"
 * instead of "your side, room for N" — and gave summon animations nowhere to
 * land. Clamped at zero so a transient over-cap board cannot produce a
 * negative repeat count.
 */
export function slotCount(occupied: number): number {
  return Math.max(0, BOARD_CAP - occupied);
}
```

Then replace **both** empty-row lines. Find (enemy, ~line 208):

```tsx
          {foeP.board.length === 0 && <p className="board-empty">—</p>}
          <AnimatePresence>{foeP.board.map((c) => creatureSlot(c, false))}</AnimatePresence>
```

Replace with:

```tsx
          <AnimatePresence>{foeP.board.map((c) => creatureSlot(c, false))}</AnimatePresence>
          {Array.from({ length: slotCount(foeP.board.length) }, (_, i) => (
            <span className="board-slot" key={`empty-${i}`} aria-hidden="true" />
          ))}
```

Find (friendly, ~line 216):

```tsx
          {meP.board.length === 0 && <p className="board-empty">—</p>}
          <AnimatePresence>{meP.board.map((c) => creatureSlot(c, true))}</AnimatePresence>
```

Replace with:

```tsx
          <AnimatePresence>{meP.board.map((c) => creatureSlot(c, true))}</AnimatePresence>
          {Array.from({ length: slotCount(meP.board.length) }, (_, i) => (
            <span className="board-slot" key={`empty-${i}`} aria-hidden="true" />
          ))}
```

- [ ] **Step 4: Style the surface**

In `board.css`, replace:

```css
.board-empty {
  color: var(--text-faint);
  font-family: var(--font-body);
  font-size: 14px;
}
```

with:

```css
/* ---- battlefield surface -------------------------------------
   Each side gets a defined play area instead of a bare em dash, so
   an empty board reads as "your side, room for N" rather than
   "nothing here". Also gives summon animations somewhere to land. */
.board-zone--top .board-row,
.board-zone--bottom .board-row {
  border-radius: var(--radius-sm);
  background:
    linear-gradient(180deg, rgba(143, 107, 255, 0.05), rgba(0, 0, 0, 0.18)),
    var(--bg-1);
  border: 1px solid var(--border);
  box-shadow: inset 0 2px 14px rgba(0, 0, 0, 0.45);
}

/* Empty capacity marker, sized to a board mini so the row does not reflow
   when a creature lands in a slot.
   
   These are literal px on purpose. A board mini is 240 x 205 at zoom 0.5
   (card.css: --card-w, and .card--board's derived --card-h), but those
   custom properties are scoped to .card and are not in scope here. Copying
   them into :root would create a second copy of a DERIVED value that drifts
   the moment the art ratio changes — the exact failure the card-frame plan
   avoids by deriving --card-art-h. A decorative outline being a few px off
   is harmless; a silently stale duplicate is not. */
.board-slot {
  width: 120px;
  height: 103px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  background: rgba(255, 255, 255, 0.015);
  flex: 0 0 auto;
}

/* The viewer's own side reads as the active one. */
.board-zone--bottom .board-row {
  border-color: var(--gold-dim);
}
```

Do **not** add a `--card-h-board` token to `theme.css`. The slot's dimensions are literal px for the reason given in the comment above.

- [ ] **Step 5: Run the test**

Run: `npx vitest run app/tests/boardSurface.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify visually**

`npm run dev`, start a match. Both rows must show 7 dashed outlines on turn 1. Playing a creature must replace one outline, not push the row wider.

- [ ] **Step 7: Run the suite and commit**

```bash
npm test
git add app/src/components/Board.tsx app/src/components/board.css app/tests/boardSurface.test.ts
git commit -m "feat(board): battlefield surface with capacity slot outlines"
```

---

## Task 3: Promote the mana tray

**Files:**
- Modify: `app/src/components/ManaTray.tsx`
- Modify: `app/src/components/manatray.css`
- Test: `app/tests/manaTray.test.ts`

**Context:** mana is the core resource and currently the least visible element on screen — one 11px diamond with a 12px readout, floating above the hand's left edge. Today pips have two states (`full` / not). Three states carry more: **available**, **spent this turn**, **locked** (beyond `maxMana`).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/manaTray.test.ts
import { describe, expect, it } from 'vitest';
import { pipStates } from '../src/components/ManaTray.js';

describe('pipStates', () => {
  it('marks unspent crystals available and spent ones spent', () => {
    expect(pipStates(3, 5)).toEqual(['full', 'full', 'full', 'spent', 'spent']);
  });

  it('shows every crystal available on a fresh turn', () => {
    expect(pipStates(5, 5)).toEqual(['full', 'full', 'full', 'full', 'full']);
  });

  it('shows every crystal spent when tapped out', () => {
    expect(pipStates(0, 3)).toEqual(['spent', 'spent', 'spent']);
  });

  it('renders nothing before the first crystal is earned', () => {
    expect(pipStates(0, 0)).toEqual([]);
  });

  it('clamps to 15 so a runaway mana effect cannot overflow the rail', () => {
    expect(pipStates(20, 40)).toHaveLength(15);
  });

  it('never reports more available than the player has', () => {
    // Defensive: mana should never exceed maxMana, but the rail must not lie.
    expect(pipStates(9, 3)).toEqual(['full', 'full', 'full']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/manaTray.test.ts`
Expected: FAIL — `pipStates` is not exported.

- [ ] **Step 3: Extract the state logic**

In `ManaTray.tsx`, replace the `pips` line with an exported helper:

```ts
export type PipState = 'full' | 'spent';

/**
 * One entry per unlocked crystal: 'full' = available to spend now, 'spent' =
 * used this turn. Capped at MAX_PIPS so a runaway mana effect cannot overflow
 * the rail. Extracted and exported because jsdom cannot lay out CSS, so this
 * is the part of the tray that is actually testable.
 */
export function pipStates(mana: number, maxMana: number): PipState[] {
  const unlocked = Math.min(Math.max(maxMana, 0), MAX_PIPS);
  const available = Math.min(Math.max(mana, 0), unlocked);
  return Array.from({ length: unlocked }, (_, i) => (i < available ? 'full' : 'spent'));
}
```

Then use it in the component:

```tsx
        {pipStates(mana, maxMana).map((state, i) => (
          <span key={i} className={`manatray-pip manatray-pip--${state}`} />
        ))}
```

- [ ] **Step 4: Enlarge the rail**

In `manatray.css`, replace the whole file body with:

```css
/* ManaTray (Task 31) — mana crystal rail. Theme tokens only.
 *
 * UI pass 2026-08-08: crystals went from 11px to 20px and the rail from a
 * 5-column grid to a single row. Mana is the core resource and was the least
 * visible element on the screen — an 11px diamond with a 12px readout,
 * floating above the hand's left edge. */

.manatray {
  display: flex;
  align-items: center;
  gap: 10px;
}

.manatray-pips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 260px;
}

.manatray-pip {
  width: 20px;
  height: 20px;
  transform: rotate(45deg);
  border-radius: 3px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.7);
}

/* Available to spend right now. */
.manatray-pip--full {
  background: radial-gradient(circle at 35% 30%, #ffe9b8, var(--gold) 60%, #6d4c10);
  border-color: var(--gold);
  box-shadow: 0 0 8px rgba(217, 164, 65, 0.6);
}

/* Unlocked but already spent this turn — visibly a crystal, visibly empty,
   so "how much have I used" is readable at a glance. */
.manatray-pip--spent {
  background: var(--bg-2);
  border-color: var(--gold-dim);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.8);
}

.manatray-readout {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--gold);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run app/tests/manaTray.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verify visually and commit**

`npm run dev` — crystals should be obvious on turn 1, with `1/1` readable from a normal viewing distance. Spend the crystal and confirm it visibly empties.

```bash
npm test
git add app/src/components/ManaTray.tsx app/src/components/manatray.css app/tests/manaTray.test.ts
git commit -m "feat(mana): larger crystal rail with an explicit spent state"
```

---

## Task 4: Hero portraits and HP gauge

**Files:**
- Modify: `app/src/components/HeroPortrait.tsx`
- Modify: `app/src/components/heroportrait.css`
- Test: `app/tests/heroPortrait.test.ts`

**Context:** `HeroPortrait.tsx:39` has `const SIGIL = '✦'` used for all 12 heroes, so both portraits are identical every match. HP fill is generic green/amber/red.

**Depends on** `resolveHeroArt` from the art-pipeline plan (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/heroPortrait.test.ts
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import HeroPortrait from '../src/components/HeroPortrait.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../src/art/resolveArt.js', () => ({
  resolveCardArt: () => null,
  resolveHeroArt: (name: string) =>
    name === 'Vespera Dawnlight' ? '/assets/vespera-abc.jpg' : null,
  heroSlug: (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));

function render(heroName: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(HeroPortrait, {
      hero: { name: heroName, hp: 30, maxHp: 30, shields: 0, power: { name: 'Lullaby', cost: 2, effects: [] }, powerUsed: false },
      player: 0, isViewer: true, active: true,
    } as never));
  });
  return { host, cleanup: () => act(() => root.unmount()) };
}

describe('HeroPortrait art', () => {
  it('renders the generated portrait when one exists', () => {
    const { host, cleanup } = render('Vespera Dawnlight');
    const img = host.querySelector('.heroportrait-portrait');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/vespera-abc.jpg');
    expect(host.querySelector('.heroportrait-sigil')).toBeNull();
    cleanup();
  });

  it('falls back to the sigil for a hero with no portrait', () => {
    // All 12 heroes shared this one glyph before the art pipeline existed;
    // it stays as the fallback, not the default.
    const { host, cleanup } = render('Rat King Moulder');
    expect(host.querySelector('.heroportrait-portrait')).toBeNull();
    expect(host.querySelector('.heroportrait-sigil')).not.toBeNull();
    cleanup();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/heroPortrait.test.ts`
Expected: FAIL — no `.heroportrait-portrait` element.

- [ ] **Step 3: Render the portrait with a sigil fallback**

In `HeroPortrait.tsx`, add the import:

```ts
import { resolveHeroArt } from '../art/resolveArt.js';
```

Change the `SIGIL` comment and replace the sigil line inside `.heroportrait-circle`:

```tsx
        {portrait
          ? <img className="heroportrait-portrait" src={portrait} alt="" />
          : <span className="heroportrait-sigil">{SIGIL}</span>}
```

and compute `portrait` just above the `return`:

```ts
  // Generated portrait (art-pipeline plan). SIGIL was used for all 12 heroes,
  // so both portraits were identical every match; it is now the fallback for
  // heroes whose art has not been generated, not the default.
  const portrait = resolveHeroArt(hero.name);
```

- [ ] **Step 4: Style the portrait and restyle the HP gauge**

In `heroportrait.css`, add after `.heroportrait-sigil`:

```css
/* Generated hero portrait — fills the circle, cropped by the mask. Art is
   requested at 1:1 (scripts/art/prompt.ts buildHeroPrompt) precisely so this
   crop is a no-op. */
.heroportrait-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}
```

Then replace the three HP fill rules:

```css
.heroportrait-hpbar--ok .heroportrait-hpfill { background: linear-gradient(180deg, #7bc96f, #2f6d2a); }
.heroportrait-hpbar--hurt .heroportrait-hpfill { background: linear-gradient(180deg, #e0b14d, #8a5f16); }
.heroportrait-hpbar--critical .heroportrait-hpfill { background: linear-gradient(180deg, #e2604f, #8a1f14); }
```

with:

```css
/* Carved gauge in the theme's own vocabulary. The old green-to-red bar was
   generic game-UI and clashed with the gold-on-purple palette. Thresholds are
   unchanged — only the colours moved into the theme. */
.heroportrait-hpbar {
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7);
}

.heroportrait-hpbar--ok .heroportrait-hpfill {
  background: linear-gradient(180deg, #f0dba4, var(--gold) 55%, #6d4c10);
}
.heroportrait-hpbar--hurt .heroportrait-hpfill {
  background: linear-gradient(180deg, #ffcf9a, var(--ember) 55%, #7a3d10);
}
.heroportrait-hpbar--critical .heroportrait-hpfill {
  background: linear-gradient(180deg, #ff9c8c, #c0392b 55%, #5e1109);
  animation: heroportrait-critical 1.4s ease-in-out infinite;
}

@keyframes heroportrait-critical {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 10px rgba(226, 96, 79, 0.8); }
}
```

- [ ] **Step 5: Run the test, verify, commit**

```bash
npx vitest run app/tests/heroPortrait.test.ts   # PASS, 2 tests
npm test
git add app/src/components/HeroPortrait.tsx app/src/components/heroportrait.css app/tests/heroPortrait.test.ts
git commit -m "feat(hero): generated portraits with sigil fallback, in-theme HP gauge"
```

---

## Task 5: Enemy hand backs

**Files:**
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/board.css`

**Context:** the enemy hand renders four `size="board"` face-down `CardView`s that read as black rectangles. `.card--face-down .card__frame` is `background: #101014` with a heavy inset shadow, and `.card__sigil` is `rgba(210,210,220,0.16)` — nearly invisible.

- [ ] **Step 1: Give the card back a real design**

In `card.css`, replace:

```css
.card--face-down .card__frame {
  border: 1px solid #2a2a33;
  background: #101014;
  box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.75), 0 4px 14px rgba(0, 0, 0, 0.5);
  animation: none;
}
```

with:

```css
/* Card back. Previously a near-black rectangle with a 16%-opacity sigil,
   which read as an empty box rather than a card. Now a woven field with a
   visible border and a legible sigil, so a row of them reads as "cards in
   hand" at a glance. */
.card--face-down .card__frame {
  border: 1px solid var(--gold-dim, #6d4c10);
  background:
    repeating-linear-gradient(45deg, rgba(217, 164, 65, 0.05) 0 6px, transparent 6px 12px),
    radial-gradient(circle at 50% 38%, #2b2340 0%, #171226 60%, #0e0b18 100%);
  box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.6), 0 4px 14px rgba(0, 0, 0, 0.5);
  animation: none;
}

.card--face-down .card__sigil {
  color: rgba(217, 164, 65, 0.42);
  text-shadow: 0 0 14px rgba(217, 164, 65, 0.3);
}
```

- [ ] **Step 2: Tighten the row**

In `board.css`, replace `.board-enemyhand`'s `gap: 8px;` with:

```css
  /* Overlap the backs: this is a "how many cards" indicator, not a set of
     individually meaningful cards, so density beats separation. */
  gap: 0;
```

and add after the `.board-enemyhand` block:

```css
.board-enemyhand .cardview + .cardview {
  margin-left: -46px;
}
```

- [ ] **Step 3: Verify visually**

`npm run dev`. The enemy hand should read as an overlapping fan of patterned card backs with a visible gold sigil, and the count should be countable at a glance.

- [ ] **Step 4: Run the suite and commit**

```bash
npm test
git add app/src/components/card.css app/src/components/board.css
git commit -m "feat(board): real card-back design and a tighter enemy hand row"
```

---

## Task 6: Deck count

**Files:**
- Create: `app/src/components/DeckCount.tsx`
- Create: `app/src/components/deckcount.css`
- Modify: `app/src/components/Board.tsx`

**Reminder:** deck count only. There is no discard pile in the engine — see the Scope correction at the top. Do not add one.

- [ ] **Step 1: Write the component**

```tsx
// app/src/components/DeckCount.tsx
import './deckcount.css';

/**
 * Cards remaining in a player's deck. Neither player could previously see
 * this, so fatigue and card advantage were invisible — you could not tell how
 * close either side was to decking out.
 *
 * Deck only: PlayerState has no discard or graveyard (core/src/types.ts), and
 * adding one is an engine change, which this work explicitly does not make.
 */
export interface DeckCountProps {
  /** Cards left in this player's deck. */
  remaining: number;
  /** Whose deck this is — labels the readout for screen readers. */
  label: string;
}

/** Below this the player is close enough to fatigue that it should be loud. */
const LOW_WATER = 5;

export default function DeckCount({ remaining, label }: DeckCountProps) {
  const low = remaining <= LOW_WATER;
  return (
    <div
      className={`deckcount${low ? ' deckcount--low' : ''}`}
      aria-label={`${label}: ${remaining} cards left in deck`}
      title={`${remaining} cards left in deck`}
    >
      <span className="deckcount-icon" aria-hidden="true">▤</span>
      <span className="deckcount-num">{remaining}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write the stylesheet**

```css
/* DeckCount — cards remaining, beside each hero. Theme tokens only. */

.deckcount {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-2);
  font-family: var(--font-body);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
  white-space: nowrap;
}

.deckcount-icon {
  font-size: 12px;
  color: var(--text-faint);
}

.deckcount-num {
  font-weight: 700;
  color: var(--text);
}

/* Close to fatigue — this is a losing condition, so it should be loud. */
.deckcount--low {
  border-color: var(--ember-dim);
  color: var(--ember);
}
.deckcount--low .deckcount-num,
.deckcount--low .deckcount-icon {
  color: var(--ember);
}
```

- [ ] **Step 3: Render one per side**

In `Board.tsx`, import it:

```ts
import DeckCount from './DeckCount.js';
```

In `.board-side--top`, immediately after the enemy `<HeroPortrait ... />`, add:

```tsx
          <DeckCount remaining={foeP.deck.length} label="Enemy deck" />
```

In `.board-side--bottom`, immediately after the viewer's `<HeroPortrait ... />`, add:

```tsx
          <DeckCount remaining={meP.deck.length} label="Your deck" />
```

- [ ] **Step 4: Verify**

`npm run dev`. Both counts should read `57` on turn 1 (60-card deck minus the opening hand and first draw; the exact number depends on mulligan and play order — what matters is that it decrements as cards are drawn).

- [ ] **Step 5: Run the suite and commit**

```bash
npm test
git add app/src/components/DeckCount.tsx app/src/components/deckcount.css app/src/components/Board.tsx
git commit -m "feat(board): deck-remaining count per player"
```

---

## Self-review notes

- **Spec coverage:** §5 board surface → Task 2; mana → Task 3; heroes → Task 4; HP → Task 4; enemy hand → Task 5; deck count → Task 6. **Discard count is deliberately not implemented** — see the Scope correction; it requires an engine change that §2 forbids.
- **Placeholder scan:** every step contains literal code or literal CSS. No "style appropriately".
- **Type consistency:** `slotCount(occupied)`, `pipStates(mana, maxMana)`, `PipState`, `DeckCountProps` are each defined once and used under those exact names.
- **Dependency:** Task 4 imports `resolveHeroArt` from the art-pipeline plan's Task 11. Tasks 1, 2, 3, 5 and 6 have no cross-plan dependency and can ship first.
- **Known limitation:** Tasks 2, 3, 4 and 5 all have a manual visual acceptance step. jsdom does not render pixels, so "is the mana readable" cannot be asserted in a test.
