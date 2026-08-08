# Discover, the Armorial Rework, and the Animation Overhaul — Main-Thread Plan

> **For agentic workers:** this plan is deliberately NOT for worker agents. Every task here crosses package boundaries (`core` + `server` + `app`), owns a design contract that cannot be verified by a unit test, or requires visual judgement against a rendered screenshot. Run it in the main thread with `superpowers:executing-plans`.

**Goal:** Ship the Discover mechanic across all three packages, replace the app's visual world with the Armorial, and rebuild the animation layer so the game reads as authored rather than assembled.

**Architecture:** Discover introduces the engine's first *interrupting* state — a pending choice that suspends normal intent legality — which touches the deterministic replay contract, the LAN authorization gate, and the app's interaction state machine at once. The Armorial replaces `theme.css` and `card.css` wholesale and reshapes `Board.tsx`, but touches no engine code. Animation work sits on top of the existing `useAnimationQueue` event loop.

**Tech Stack decisions — no new dependencies are added.**

| Concern | Choice | Why |
|---|---|---|
| Animation | **Framer Motion 11**, already in `app/package.json` | The event-driven `useAnimationQueue` and the variant-factory pattern in `components/animations.ts` are good architecture. The problem is the *content* of the animations, not the library. Adding a second motion library would fragment the timing model. |
| Type | **Cardo, self-hosted** as woff2 in `app/public/fonts/` | LAN play must work with no internet — a Google Fonts `<link>` would blank the type on an offline machine. Cardo is cut for medieval scholarship, so the archaism is derived, not costumed, and it ships regular, italic, and small caps. |
| Styling | **Plain CSS with custom properties**, as today | The project has no CSS framework and no build-time style tooling. Introducing one would be a second migration on top of the visual one. |
| Colour system | CSS custom properties in `theme.css`, one tincture token per archetype | Twelve houses need twelve values addressable by `data-archetype`; custom properties are the only mechanism already in use. |
| Icons | **Hand-authored inline SVG** in the world's own grammar | An icon library would import a foreign line weight and corner language. Heraldic charges have to be drawn, not imported. |
| Layout | CSS Grid for the board registers, flexbox within rows | Already the pattern in `board.css`. |
| 3D / WebGL | **None** | The direction is flat and graphic by decision. Depth effects would reintroduce exactly the gradient-and-glow chrome that reads as AI-generated. |

## Global Constraints

- Desktop and laptop only (`app/PRODUCT.md`). No mobile or tablet layout work.
- All 278 card ids immutable; card art is seeded from `hashId(card.id)`.
- Generated card art and the 5:7 card proportion are binding brand commitments.
- **Gules `#A81E22` is reserved exclusively for damage** and never decorates.
- **Or `#B8913C`** marks legendary rarity and the active turn only.
- No bevels, gradients, glows, drop shadows used as depth, or faux-metal textures. Flat tinctures and hairline rules only.
- `prefers-reduced-motion: reduce` must be honoured by every new animation. `Background.tsx:32` shows the existing pattern.
- The direction contract (below) goes in the emitted markup as an HTML comment and must survive the production build.

---

### Task 1: Discover — engine

**Files:**
- Modify: `core/src/types.ts` (`Intent`, `GameState`), `core/src/engine/game.ts`, `core/src/engine/intents.ts`, `core/src/engine/effects.ts`, `core/src/cardtext.ts`
- Test: `core/tests/discover.test.ts` (create)

**Interfaces:**
- Produces: `Intent` variant `{ kind: 'discover'; choice: number }`; `GameState.pendingChoice: { player: PlayerIndex; cardIds: string[] } | null`; `EffectKind` member `'discover'`.

- [ ] **Step 1: Write the failing tests**

Create `core/tests/discover.test.ts` covering four behaviours:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';
import { legalIntents } from '../src/engine/intents.js';

describe('discover', () => {
  it('offers exactly three candidates', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'discover' });
    expect(game.state.pendingChoice?.cardIds).toHaveLength(3);
    expect(game.state.pendingChoice?.player).toBe(0);
  });

  it('suspends every other intent while a choice is pending', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'discover' });
    const legal = legalIntents(game, 0);
    expect(legal.every(i => i.kind === 'discover')).toBe(true);
    expect(legal).toHaveLength(3);
  });

  it('puts the chosen card in hand and clears the choice', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'discover' });
    const picked = game.state.pendingChoice!.cardIds[1]!;
    const before = game.state.players[0].hand.length;
    game.submit({ kind: 'discover', choice: 1 });
    expect(game.state.players[0].hand).toHaveLength(before + 1);
    expect(game.state.players[0].hand.at(-1)).toBe(picked);
    expect(game.state.pendingChoice).toBeNull();
  });

  it('replays identically from the same seed', () => {
    const run = () => {
      const g = Game.create(makeTestSetup());
      g.state.phase = 'main';
      applyEffect(g, { player: 0, cardId: 'test' }, { kind: 'discover' });
      g.submit({ kind: 'discover', choice: 0 });
      return g.serialize();
    };
    expect(run()).toBe(run());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run core/tests/discover.test.ts` — expect type errors on `pendingChoice` and the `discover` intent.

- [ ] **Step 3: Implement**

Add to `core/src/types.ts`:

```ts
export type Intent =
  | { kind: 'mulligan'; keep: number[] }
  | { kind: 'playCard'; handIndex: number; target?: TargetRef }
  | { kind: 'attack'; attackerId: string; target: TargetRef }
  | { kind: 'heroPower'; target?: TargetRef }
  | { kind: 'discover'; choice: number }
  | { kind: 'endTurn' };
```

and to `GameState`:

```ts
  /** Set while a discover is open. The engine is SUSPENDED: legalIntents
   *  returns only the three discover intents, so no other action can resolve
   *  and the pending choice can never be orphaned by an endTurn. Candidates
   *  are drawn through the seeded RNG, so replay reproduces them exactly. */
  pendingChoice: { player: PlayerIndex; cardIds: string[] } | null;
```

Candidate selection must go through `game.pickRandom` (the counting RNG wrapper) so `serialize()`'s `{seed, calls}` stays accurate. Draw three distinct ids from the registry pool, excluding tokens and `mana-surge`.

In `legalIntents`, before anything else:

```ts
  // A pending discover suspends the game: nothing else is legal, for either
  // player. Returning early here is what stops an endTurn from stranding an
  // unanswered choice, which would deadlock the LAN game.
  const pending = game.state.pendingChoice;
  if (pending) {
    if (pending.player !== player) return [];
    return pending.cardIds.map((_, i) => ({ kind: 'discover' as const, choice: i }));
  }
```

In `Game.submit`, handle the new intent: validate `phase`, that `pendingChoice` exists, that `pendingChoice.player === me`, and that `choice` indexes the array. Emit a `discoverResolved` event; add its `dispatch` case to push the card into hand and null the choice (the `default` branch throws, so the case is required).

Also guard: `submit` must reject every *other* intent kind while `pendingChoice` is set.

`cardtext.ts`: `case 'discover': return 'Discover a card.';`

- [ ] **Step 4-5: Run the file, then `npm test`.** Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests
git commit -m "feat(core): add the discover mechanic"
```

---

### Task 2: Discover — LAN authorization

The server gates intents by socket identity against *the acting player*. A pending choice belongs to a player who may not be the acting player, so the existing gate would reject a legitimate discover.

**Files:**
- Modify: `server/src/index.ts` (or wherever `playerIndex(room, socket)` is compared to the acting player — read it first)
- Test: `server/tests/discover-gate.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's `pendingChoice`.
- Produces: no protocol change. `server/src/protocol.ts` carries `Intent` by import from `@ashen/core`, so the new variant rides the wire for free — **verify this by reading the file rather than assuming it.**

- [ ] **Step 1:** Write a test asserting (a) a discover from the choice-owner's socket is accepted, (b) a discover from the other socket is rejected with an `error` message, (c) a non-discover intent from either socket is rejected while a choice is pending.

- [ ] **Step 2:** Run it; expect the wrong-socket case to pass incorrectly or the right-socket case to be rejected.

- [ ] **Step 3:** Change the authorization check to: when `game.state.pendingChoice` is set, the authorized player is `pendingChoice.player`; otherwise it is the acting player, as today. Add a comment explaining that the engine alone cannot tell who submitted, which is why this gate exists at all.

- [ ] **Step 4-5:** Run `npm test -w server`, then `npm test`.

- [ ] **Step 6: Commit**

```bash
git add server/src server/tests
git commit -m "fix(server): authorize discover against the pending choice owner"
```

---

### Task 3: Discover — app overlay

**Files:**
- Create: `app/src/components/DiscoverOverlay.tsx`, `app/src/components/discover.css`
- Modify: `app/src/screens/Match.tsx`, `app/src/game/useMatch.ts`

- [ ] **Step 1:** Render from `state.pendingChoice`: three full card plates, centred, board dimmed behind. Clicking one submits `{ kind: 'discover', choice: i }`.
- [ ] **Step 2:** Keyboard: `1`/`2`/`3` select; focus lands on the first card; arrow keys move between them. The overlay is a focus trap while open.
- [ ] **Step 3:** When `pendingChoice.player` is not the viewer, show a waiting state naming the opponent rather than the candidates — the choice is hidden information.
- [ ] **Step 4:** Confirm the bot resolves discovers. `bot/policies.ts` enumerates `legalIntents`, so a discover is just another legal intent — verify Grandmaster's depth-2 search does not choke on the suspended state.
- [ ] **Step 5:** `npm test`, then play a local match with a discover card and confirm the flow end to end.
- [ ] **Step 6:** Commit.

---

### Task 4: The Armorial — tokens and type

This is the foundation every later visual task builds on. Nothing renders differently yet.

**Files:**
- Modify: `app/src/theme.css`
- Create: `app/public/fonts/` (Cardo woff2: regular, italic, bold), `app/src/fonts.css`
- Modify: `app/index.html`

**Direction contract** — paste verbatim as the first child of `<body>` in `app/index.html`:

```html
<!--
THESIS: Twelve archetypes are twelve houses; heraldry is already a strict grammar for
  encoding identity in a fixed vocabulary, which is what "cards are data" means here.
  Refuses the torch-lit tavern the category always ships, and its flat-gray opposite.
OWN-WORLD: A roll of arms. Flat heraldic tinctures in a woodcut register on an iron-gall
  ground, cream engraved hairlines, charges drawn as flat SVG. No bevels, gradients,
  glows, or faux metal. Cardo throughout.
STORY: A player reads the field as a page of arms: whose house holds what, what each
  figure is, and what every number means.
FIRST VIEWPORT: The board as a ruled page. Two banded registers divided by an engraved
  rule, each under its house banner in the margin; the token row a subordinate sub-band.
FORM: Blazon x codex (armorial), grounded candidate 5 of 7, user-pinned toward archaic.
  Seed key b730d38a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md.
-->
```

- [ ] **Step 1:** Download Cardo woff2 (SIL Open Font License) into `app/public/fonts/`. Write `app/src/fonts.css` with `@font-face` blocks using `font-display: swap` and local paths only — **no CDN**, because LAN play must work offline.
- [ ] **Step 2:** Rewrite `app/src/theme.css`. Replace the violet/ember/gold tokens entirely:

```css
:root {
  --ground:      #14120F;  /* iron-gall near-black */
  --ground-deep: #0C0B09;
  --ground-rise: #1D1A15;
  --line:        #E8E0CE;  /* cream engraved hairline */
  --line-dim:    rgba(232, 224, 206, 0.38);
  --text:        #E8E0CE;
  --text-dim:    #A79E8A;

  --gules: #A81E22;  /* DAMAGE ONLY. Never decorative. */
  --or:    #B8913C;  /* legendary rarity and active turn ONLY. */

  /* Twelve house tinctures, flat and unmodulated. */
  --house-ember:  #B4341C;
  --house-choir:  #C9BFA4;
  --house-vermin: #6B7A3A;
  --house-dragon: #8C5A1E;
  --house-roots:  #3C6B44;
  --house-dance:  #4A2F63;
  --house-bone:   #8A8578;
  --house-pact:   #6B1F2E;
  --house-coven:  #2F3E6B;
  --house-star:   #3E5C7A;
  --house-vigil:  #A88C3E;
  --house-storm:  #4A6B75;

  --font-display: 'Cardo', Georgia, serif;
  --font-body:    'Cardo', Georgia, serif;
}
```

Keep the existing `--space-*` and `--radius-*` scales, but drop `--radius-lg` to `6px`: a woodcut register has near-square corners.

- [ ] **Step 3:** Delete `--glow-gold` and `--glow-ember` and every rule consuming them. Grep for them across `app/src` and remove each usage rather than leaving dangling references.
- [ ] **Step 4:** `npm run dev`, screenshot the match screen. It will look broken — that is expected at this step; only confirm the fonts load and no CSS variable is undefined.
- [ ] **Step 5:** Commit.

---

### Task 5: The Armorial — the card plate

**Files:**
- Modify: `app/src/components/card.css`, `app/src/components/CardFrame.tsx`, `app/src/components/cardTreatment.ts`

- [ ] **Step 1: Hide the cost gem on board cards.** `CardFrame.tsx:120-122` renders `card__cost` unconditionally. Add a `showCost` prop, defaulting true, passed false from the board size. **This is the direct fix for the reported "defense stat" confusion** — leave a comment saying so.
- [ ] **Step 2: Key the stats.** Attack and health pips gain small-caps labels from Cardo. No number on a board creature may appear bare.
- [ ] **Step 3: Tincture by house.** `data-archetype` on the card root selects `--house-*` as the plate's field colour. The art window keeps its own neutral mount so tinctures never tint the committed illustration.
- [ ] **Step 4: Flatten the frame.** Remove every gradient, inset shadow, and bevel from `card.css`. Rarity is expressed as hairline weight and, for legendary only, an `--or` rule.
- [ ] **Step 5: Rebuild the text well — the truncation defect.**

  `card.css:385-425` clamps by fixed line count: `.card__text` to 4 lines, `.card__flavor` to 2, and `.card--hand .card__flavor` to 1. Those counts were chosen for the worst case and are then applied to every card regardless of the room actually left, while `--card-h: 336px` is fixed. The result is a card that prints "…" with roughly 40% of its own body empty beneath.

  Measured against the real pool: **279 of 285 cards** carry flavor longer than one line at 11.5px in the 220px well, so the one-line hand clamp truncates essentially the entire game. The comment at `card.css:412-417` justifies the clamp as stopping flavor from crowding rules text — but the mechanism it chose makes writing that already exists invisible on 98% of cards.

  Fix the mechanism, not the numbers:

  - `.card__body` becomes a flex column. Rules text sizes to its content and takes priority; flavor takes the remaining space and clips only if it genuinely does not fit.
  - **Remove `-webkit-line-clamp` from `.card__text` entirely.** Generated rules text is what the card *does* — clamping it can silently hide an effect the player is about to pay for, which is a correctness bug, not a layout preference. The longest text in the pool today is `ember-phoenix` at 75 characters over two trigger lines, comfortably inside the well; the rebalance (worker Tasks 13-16 and 18) adds riders to many cards, so several will grow to three lines. Let the well hold them.
  - Delete the `.card--hand .card__flavor` one-line override. Hand and preview use the same rule.
  - Flavor keeps `overflow: hidden` as a backstop for a pathological string, but the backstop must never be the normal case. Verify with `coven-queen` (142 characters, the longest flavor in the pool).

  If rules text plus flavor genuinely cannot both fit for some card, flavor yields — it is the copy that does not affect play. Never the reverse.

- [ ] **Step 6:** Screenshot a hand card and a board card side by side at 1440×900. Verify both read correctly and the art is untinted. Include `coven-queen` and `ember-phoenix` in the shot — the longest flavor and the longest rules text — and confirm neither shows an ellipsis.
- [ ] **Step 7:** Commit.

---

### Task 6: The Armorial — the board as a ruled page

**Files:**
- Modify: `app/src/components/Board.tsx`, `app/src/components/board.css`

- [ ] **Step 1: Add the token row.** Read `creature.token` (worker plan Task 3) and split each side into a creature register and a subordinate token sub-band. Tokens render at a smaller scale with the same plate language.
- [ ] **Step 2: House banners.** Each side's margin carries its archetype's charge as inline SVG plus the house name in Cardo small caps.
- [ ] **Step 3: Engraved rules.** Hairline `--line-dim` rules divide the registers. No panels, no cards-as-containers, no drop shadows.
- [ ] **Step 4: Mana as a pip ledger.** Replace glowing crystals in `ManaTray.tsx` with filled/unfilled pips. Locked mana (overload) renders as a struck-through pip.
- [ ] **Step 5:** Screenshot with a full board plus tokens on both sides. Verify no horizontal overflow at 1280px.
- [ ] **Step 6:** Commit.

---

### Task 7: Card inspect and hero power — the two reported UI bugs

**Files:**
- Create: `app/src/components/InspectPanel.tsx`, `app/src/components/inspect.css`
- Modify: `app/src/components/Board.tsx`, `app/src/components/CardView.tsx`, `app/src/components/Card.tsx`, `app/src/components/CardFrame.tsx`, `app/src/components/HeroPortrait.tsx`

- [ ] **Step 0: Render a board creature's LIVE keywords, not its card definition's.**

  This is a prerequisite for Step 1 and a standing bug in its own right. `Board.tsx:191` passes `card={def}` — the immutable registry definition. Only `attack`/`health` (line 194) and `exhausted`/`frozen`/`shields` (195-199) come from the live `CreatureState`. Everything else is the card as printed:

  ```
  Board.tsx:191   <CardView card={def} …/>        ← card DEFINITION
  Card.tsx:79       keywords={card.keywords}      ← def.keywords, never c.keywords
  Card.tsx:81       text={cardText(card)}         ← def effects, ignores c.silenced
  ```

  This was nearly invisible before, because nothing in the game removed keywords and the one mutator (`giveKeyword`) was itself broken. The worker plan changes that: `silence` (Task 5), `stealth` (Task 8), and a repaired `giveKeyword` all mutate `c.keywords` at runtime, and **not one of them would show on the board**. A silenced creature would keep displaying "Deathrattle: Summon 2 Rats" forever.

  - Thread an optional `keywords` prop through `CardView` → `Card` → `CardFrame`, defaulting to `card.keywords` when absent. `Board.tsx` passes `c.keywords`.
  - Thread an optional `silenced` flag the same way. `Card.tsx` renders `silenced ? '' : cardText(card)` — a silenced creature has no rules text, which is also how the effect reads to a player.
  - Hand cards pass neither: a card in hand has no `CreatureState`, so the defaults keep them rendering from the definition. This is why both props are optional rather than required.
  - Write `app/tests/boardKeywords.test.ts`: build a board creature whose `CreatureState.keywords` differs from its card def (add one, remove one), render the board, and assert the chips match the creature, not the def.

- [ ] **Step 1: Inspect (report #2).** Clicking any board creature — **either side** — opens the full plate with generated `cardText`, keywords with their `KEYWORD_TEXT` (worker plan Task 4), and live stats. Hands stay hidden. This must not collide with attack targeting: while targeting is active, a click targets; otherwise it inspects. Right-click inspects in both states.
- [ ] **Step 2: Hero power (report #1).** Render the power's name, cost, and `heroPowerText` as a permanent blazon in each hero's margin — **for both heroes**. Delete the `title` attribute at `HeroPortrait.tsx:174`; a hover-only tooltip is not an acceptable mechanism and was the whole bug.
- [ ] **Step 3:** Keyboard: `Escape` closes the inspect panel; it is a focus trap while open.
- [ ] **Step 4:** Verify against the original reports — open a match, click an enemy creature, read its text; read both hero powers without hovering.
- [ ] **Step 5:** Commit.

---

### Task 8: The animation overhaul

The existing `useAnimationQueue` event loop and variant-factory pattern are sound. The animations themselves are thin: a slam, a fade, a pop. Rebuild the *content* against the Armorial's native motion — a woodcut world moves in **cuts and strikes**, not eases and glows.

**Files:**
- Modify: `app/src/components/animations.ts`, `app/src/screens/animations.css`, `app/src/components/Projectile.tsx`, `app/src/components/DamagePopup.tsx`

- [ ] **Step 1: Establish the motion grammar.** Document it at the top of `animations.ts`: linear and `steps()` easing over springs; short holds; no fades where a cut will do. Two durations only — `--beat: 140ms` and `--beat-long: 320ms` — so the whole game shares one rhythm.
- [ ] **Step 2: Combat.** Simultaneous damage (worker plan Task 2) needs a *simultaneous* read: both creatures strike inward on the same frame, then both recoil. The current sequential attack animation now actively misrepresents the rules.
- [ ] **Step 3: Damage numerals.** `--gules` numerals that strike in with no fade, hold, then drop away. This is the one place gules appears in motion.
- [ ] **Step 4: Death.** Replace the ember dissolve (`deathFade`) — it belongs to the discarded world. A plate that dies is *struck through* with a gules rule, then removed.
- [ ] **Step 5: Turn change.** Replace `bannerSweep` with a page-turn register shift; the active side's banner takes `--or`.
- [ ] **Step 6: Card draw and play.** Draw slides from the deck edge with no scale-up. Play lands with a single hard step, not a spring overshoot.
- [ ] **Step 7: Discover.** The three candidates deal in sequentially, one `--beat` apart.
- [ ] **Step 8: Reduced motion.** Every new animation collapses to an instant state change under `prefers-reduced-motion: reduce`. Follow `Background.tsx:32`.
- [ ] **Step 9:** Verify `skip()` still drains cleanly and that skipping never desyncs the state mirror.
- [ ] **Step 10:** Commit.

---

### Task 9: The Forge and the Deck Builder

The Forge is a card *authoring* tool that runs curated and player-made cards through the identical path. It currently duplicates the engine's keyword set by hand, which means the mechanics the worker plan added are unreachable to a player. It is also the last screen left in the discarded visual world.

**Files:**
- Modify: `app/src/screens/Forge.tsx`, `app/src/screens/forge.css`, `app/src/screens/DeckBuilder.tsx`, `app/src/screens/deckbuilder.css`, `core/src/index.ts`, `core/tests/publicSurface.test.ts`
- Test: `app/tests/forgeKeywords.test.ts` (create)

- [ ] **Step 1: Stop hand-maintaining the keyword list.**

  `Forge.tsx:39-47` is a literal copy of the `Keyword` union:

  ```ts
  const KEYWORDS: Keyword[] = ["taunt","rush","charge","windfury","lifesteal","ward","shield"];
  ```

  Typed as `Keyword[]`, an **incomplete** list is valid TypeScript, so nothing warned when `venom` (worker Task 7) and `stealth` (worker Task 8) were added to the union — they simply never appear in the picker. Worker Tasks 7 and 8 do not list this file, and the worker plan's architecture note only covers new `EffectKind`s reaching `formState.ts`.

  Derive the list from data instead of restating it. `KEYWORD_COST` in `core/src/validate.ts:22` is a `Record<Keyword, number>`, so its keys are the complete set and are enumerable at runtime — but it is not currently on the public surface (`core/src/index.ts:8` exports `validateCard`, `validateDeck`, `RARITY_COPY_LIMIT`, and `ValidationIssue` only).

  - Add `KEYWORD_COST` to the export on `core/src/index.ts:8`. It belongs there: the Forge implements the same card-authoring contract `validate.ts` enforces, and a keyword's cost is part of that contract.
  - Update `core/tests/publicSurface.test.ts`, which guards that surface deliberately — read it first and add the entry the way the file already expresses them.
  - In `Forge.tsx`, replace the literal with `const KEYWORDS = Object.keys(KEYWORD_COST) as Keyword[];`.

- [ ] **Step 2: Guard it with a test.**

  Create `app/tests/forgeKeywords.test.ts`. The app is type-checked only in the editor (`vite build` strips types without checking), so a compile-time exhaustiveness trick would not fail anything in CI. A runtime assertion is the only guard that actually holds:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { KEYWORD_COST } from '@ashen/core';
  import { KEYWORDS } from '../src/screens/Forge.js';

  describe('forge keyword picker', () => {
    it('offers every keyword the engine defines', () => {
      // Forge.tsx used to restate the Keyword union as a literal. Because an
      // incomplete Keyword[] is still a valid Keyword[], venom and stealth were
      // added to the engine and silently never appeared in the picker. This
      // test is the thing that fails next time.
      expect([...KEYWORDS].sort()).toEqual(Object.keys(KEYWORD_COST).sort());
    });
  });
  ```

  Export `KEYWORDS` from `Forge.tsx` so the test can import it.

- [ ] **Step 3: Check the effect presets against the engine too.** `formState.ts:137` `EFFECT_PRESETS` has the same restatement shape for `EffectKind`. Worker Tasks 5, 6, 9, 10, and 11 each added their preset, so it should be complete — verify by asserting every `EffectKind` appears in at least one preset, in the same test file. If one is missing, add it.

- [ ] **Step 4: Bring both screens into the Armorial.** Apply the Task 4 tokens and Task 5 plate language to `forge.css` and `deckbuilder.css`: `--ground`/`--line`, Cardo, hairline rules instead of panels, no gradients or bevels. The Forge's live card preview already renders through `CardFrame`, so it inherits Task 5 for free — what changes here is the surrounding chrome.

- [ ] **Step 5:** Screenshot the Forge with a creature in progress (keyword chips visible, including `venom` and `stealth`) and the Deck Builder with a full 60-card deck, both at 1440×900.

- [ ] **Step 6:** Commit.

---

### Task 10: Finish review and DESIGN.md

Required by the direction contract's FINISH line. **The build is not done until this task closes.**

- [ ] **Step 1:** Capture desktop screenshots of every changed surface: match (empty board, full board with tokens, targeting, discover overlay, inspect panel), menu, deck builder, Forge.
- [ ] **Step 2:** Run `node .claude/skills/impeccable/scripts/detect.mjs --json` on the changed targets. Fix what is mechanical.
- [ ] **Step 3:** Spawn `impeccable-finish-reviewer` fresh, with no forked history, passing: the original request, the confirmed answers, the artifact paths, the screenshot paths, the direction contract, the detector findings, and the craft-floor reference path.
- [ ] **Step 4:** Apply material fixes in one batch, rebuild once, recapture, and send back for a verdict. Two rounds is the ceiling.
- [ ] **Step 5:** Report the verdict table verbatim, open items included, under the reviewer's own disposition word.
- [ ] **Step 6:** Spawn `impeccable-documenter` to write `DESIGN.md` from the built world.
- [ ] **Step 7:** Commit.

---

## Self-Review

**Spec coverage.** §5.4 Discover → Tasks 1-3 (engine, server gate, app). §7.1 direction contract → Task 4. §7.2 tokens and type → Task 4. §7.3 cost gem and keyed stats → Task 5; card inspect and hero power → Task 7; mana pip ledger → Task 6. Token row rendering → Task 6. Animation overhaul (added by user request, not in the spec) → Task 8. Forge and Deck Builder → Task 9. Finish and DESIGN.md → Task 10.

**Dependencies on the worker plan.** Task 6 needs `CreatureState.token` (worker Task 3). Task 7 needs `KEYWORD_TEXT` (worker Task 4). Task 7 Step 0 exists because of `silence` (worker Task 5), `stealth` (worker Task 8), and the repaired `giveKeyword` (worker Task 5). Task 8 Step 2 needs simultaneous combat (worker Task 2). Task 6 Step 4's struck pip needs `PlayerState.overload` (worker Task 10). Task 9 Step 1 needs `venom` and `stealth` in the `Keyword` union (worker Tasks 7 and 8). **Run the worker plan first, or at minimum its Tasks 2, 3, 4, and 10.**

**The seam between the plans.** Four defects were found only by tracing a worker-plan change into the app, and none would have been caught by either plan's own tests: the board renders `def.keywords` while the workers mutate `c.keywords` (Task 7 Step 0); `Forge.tsx` restates the `Keyword` union by hand so new keywords never reach the picker (Task 9 Step 1); `card.css` clamps flavor to one line, truncating 279 of 285 cards (Task 5 Step 5); and generated rules text is clamped at four lines, which can hide an effect outright (same step). The pattern is the same each time — the engine's data is authoritative, and the app restates it. Anywhere the app holds a second copy of an engine fact is worth checking before Task 10.

**Type consistency.** `pendingChoice` is defined in Task 1 and consumed in Tasks 2 and 3 with the same shape. The `discover` intent variant is defined once, in Task 1.

**Known gap.** Task 8 has no automated test — animation quality is verified by screenshot and play, which is exactly why it is in this plan rather than the worker one.
