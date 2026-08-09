# Reflect, Dynamic Formations, and Combat Theatre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Deferred. Finish `docs/superpowers/plans/2026-08-08-discover-armorial-mainthread.md`, including its review and documentation task, before executing any step here. Revisit this plan with the user before implementation.

**Goal:** Give every creature an independently balanced Reflect stat, replace fixed board slots with centered dynamic formations, restore a restrained looping Legendary foil treatment, and stage simultaneous combat as an attacker impact followed by a visible Reflect counter.

**Architecture:** The deterministic engine remains authoritative and resolves reciprocal creature damage simultaneously, but defenders use live `CreatureState.reflect` instead of Attack. The React board remains accessible DOM; a disposable comparison spike decides whether production combat uses CSS perspective alone or adds a transparent WebGL2 effects layer. Cards share one compact SVG stat language, and occupied creatures form centered normal/token bands with no decorative empty slots.

**Tech Stack:** TypeScript, deterministic `@ashen/core`, React 18, Framer Motion 11, CSS perspective transforms, optional raw WebGL2 effects layer selected by Task 0, Vitest, Testing Library, Vite, Playwright browser verification.

## Global Constraints

- All 278 existing non-token card IDs remain immutable because card art is seeded by ID.
- Reflect applies to creatures only. Spells and artifacts cannot carry creature stats.
- Engine damage remains simultaneous. Staged animation must never change trigger, lifesteal, death, draw, replay, or win-check ordering.
- Preserve Epic and Legendary full-art treatments and their larger artwork area.
- Render stat marks with authored inline SVG or CSS geometry. Never use emoji, platform glyphs, icon fonts, or remote icon assets.
- Visible stat pairs are symbol beside number: blade + Attack, returning arrow + Reflect, heart + Health.
- Use muted gules red for Attack/damage, muted azure for Reflect, and muted green for Health. Gules remains exclusive to damage meaning; `--or` remains exclusive to Legendary rarity and the active turn.
- Color is never the only cue: every stat has a distinct silhouette and an accessible name.
- The board limit remains unchanged. This plan changes formation layout, not capacity.
- Normal creatures and tokens remain separate centered bands; an empty token band collapses.
- Legendary foil may use an animated gradient overlay as a deliberate exception to the flat-frame rule. It must not restore glow, bevel, faux metal, or depth shadow recipes.
- All motion honors `prefers-reduced-motion`; reduced motion removes lunges, shake, particles, and looping foil while preserving state clarity.
- Any WebGL implementation must be optional, locally bundled, unavailable-WebGL safe, and free of CDN/runtime network dependencies for offline LAN play.
- Desktop/laptop support floor remains 1280×900; verify at both 1280×900 and 1440×900.
- Do not modify or execute this plan until the current Discover/Armorial plan is complete and the user explicitly approves revisiting it.

## Decisions Already Approved

1. The new stat is named **Reflect**.
2. In creature combat, Attack determines initiating damage and Reflect determines counter-damage.
3. Damage remains simultaneous in engine rules, but the visual exchange is staged attacker-first, defender-second.
4. Every curated creature receives a hand-authored Reflect value; this is not an automatic permanent mirror of Attack.
5. Preserve average creature power: validation values Attack and Reflect as complementary offensive/defensive axes rather than doubling the old budget.
6. Buffs may modify Attack, Reflect, and Health independently.
7. Forge requires explicit Reflect for custom creatures.
8. Visible card stats use small authored symbols beside numbers, with no printed Attack/Reflect/Health words on the plate.
9. The visual stat colors are restrained red/blue/green.
10. Fixed empty slots disappear; occupied cards center and expand symmetrically.
11. Normal and token formations remain separate.
12. Legendary cards regain a looping foil motion with a visible resting interval.
13. Rendering choice is made through a CSS-only versus hybrid-WebGL comparison spike before production combat work.

---

### Task 0: Build and evaluate the disposable combat comparison spike

**Files:**
- Create temporarily: `app/combat-lab.html`
- Create temporarily: `app/src/dev/combatLab.tsx`
- Create temporarily: `app/src/dev/combatLab.css`
- Create temporarily: `app/src/dev/webglImpact.ts`
- Test: `app/tests/combatLab.test.ts`
- Record decision: `docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md`

**Interfaces:**
- Consumes: real `CardView` board plates and the production Cardo/Armorial tokens.
- Produces: one approved `CombatRenderer = 'css' | 'hybrid-webgl'` decision, exact motion timings, proof artifacts, and no retained spike source files.

- [ ] **Step 1: Write a failing isolation test.** Assert `combat-lab.html` imports only `src/dev/combatLab.tsx`, the normal `app/index.html` does not import the lab, and the production `App.tsx` has no combat-lab branch.

- [ ] **Step 2: Run the focused test and confirm RED.**

Run: `npx vitest run app/tests/combatLab.test.ts`

Expected: FAIL because the temporary lab entry does not exist.

- [ ] **Step 3: Build the comparison harness with real cards.** Use one Legendary full-art attacker and one Epic full-art defender from `buildPool()`. Render the same centered combat lane in two switchable modes:

```ts
export type CombatRenderer = 'css' | 'hybrid-webgl';

export interface CombatLabControls {
  renderer: CombatRenderer;
  reducedMotion: boolean;
  formationCount: 1 | 2 | 7;
  replayToken: number;
}
```

The page must expose Replay, CSS, Hybrid WebGL, Reduced Motion, and 1/2/7 formation controls. Vite serves `combat-lab.html` as a separate development entry; do not wire it into `App.tsx`.

- [ ] **Step 4: Implement one shared staged timeline.** Both renderers use identical DOM-card motion and timing:

```ts
export const COMBAT_TIMELINE = {
  lift: 140,
  attack: 320,
  impact: 140,
  recoil: 140,
  reflect: 320,
  reflectImpact: 140,
  settle: 320,
} as const;
```

The attacker lifts and lunges first, the defender recoils, then the defender lifts and counters. The result is only presentation; no `Game` is mutated in the lab.

- [ ] **Step 5: Implement the CSS renderer.** Use DOM cards, `perspective`, `rotateX`, `rotateY`, `translate3d`, scale, a clipped SVG/CSS impact frame, and a maximum 4px localized board shake. Do not add card drop shadows or glow.

- [ ] **Step 6: Implement the hybrid renderer.** Keep the same DOM cards and add a transparent raw-WebGL2 canvas for particles and a short impact shockwave. `webglImpact.ts` exports:

```ts
export interface ImpactPoint { x: number; y: number; color: readonly [number, number, number, number] }
export interface WebglImpactLayer {
  burst(point: ImpactPoint): void;
  resize(width: number, height: number, dpr: number): void;
  destroy(): void;
}
export function createWebglImpactLayer(canvas: HTMLCanvasElement): WebglImpactLayer | null;
```

Return `null` when WebGL2 is unavailable and immediately use the CSS effect without warning or broken controls. Add no package dependency for this spike.

- [ ] **Step 7: Add reduced-motion behavior.** In both variants, reduced motion uses a 140ms source outline, a cut to the target damage frame, and no perspective, shake, particle, or repeated movement.

- [ ] **Step 8: Verify visually and measure.** At 1280×900 and 1440×900, replay both modes with 1, 2, and 7 cards. Record browser proof for attack impact, Reflect impact, rest state, and reduced motion. Record frame timing with the Performance API; no replay may produce a long task above 50ms on the verification machine.

- [ ] **Step 9: Obtain the user's renderer decision.** Present both live variants or equivalent captured motion. Record the selected renderer, accepted timings, and any requested effect changes in `2026-08-09-reflect-dynamic-combat-decision.md`. Do not infer approval from technical success.

- [ ] **Step 10: Delete the disposable lab.** Remove all four temporary lab files and `combatLab.test.ts`. Confirm `rg -n "combat-lab|CombatLab|webglImpact" app` returns no matches. Keep only the decision document and proof artifacts.

- [ ] **Step 11: Commit the decision artifact.**

```bash
git add docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md
git commit -m "docs: choose the combat rendering direction"
```

---

### Task 1: Add Reflect to the deterministic engine contract

**Files:**
- Modify: `core/src/types.ts`
- Modify: `core/src/data/builders.ts`
- Modify: `core/src/data/neutrals.ts`
- Modify: `core/src/data/tokens.ts`
- Modify: `core/src/data/test-pool.ts`
- Modify: `core/src/engine/effects.ts`
- Modify: `core/src/engine/game.ts`
- Modify: `core/src/validate.ts`
- Modify: `core/src/cardtext.ts`
- Modify: `core/src/bot/heuristic.ts`
- Modify: `core/src/index.ts`
- Test: `core/tests/combat-simultaneous.test.ts`
- Test: `core/tests/effects.test.ts`
- Test: `core/tests/validate.test.ts`
- Test: `core/tests/cardtext.test.ts`
- Test: `core/tests/replay.test.ts`
- Test: `core/tests/bot/heuristic.test.ts`
- Test helpers and fixtures containing literal creature `Card` or `CreatureState` objects under `core/tests/**/*.ts`

**Interfaces:**
- Produces: `Card.reflect?: number`, required by runtime validation for creatures; `CreatureState.reflect: number`; `EffectSpec.value3?: number` as the Reflect delta for `kind: 'buff'`.
- Transitional builder behavior: the existing six-argument creature stat call mirrors `reflect = attack` until Task 2 atomically converts all curated archetype calls to explicit Reflect.

- [ ] **Step 1: Write failing combat tests.** Add cases proving a 5-Attack/2-Reflect attacker hitting a 1-Attack/4-Reflect defender deals 5 to the defender and receives 4, both damage events occur even when one creature dies, defender lifesteal uses Reflect damage, and hero attacks never use Reflect.

- [ ] **Step 2: Write failing type/validation tests.** Assert creatures require integer `reflect >= 0`, non-creatures reject Reflect, live creature state serializes and clones Reflect, and malformed old state cannot silently produce `undefined` counter-damage.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run core/tests/combat-simultaneous.test.ts core/tests/effects.test.ts core/tests/validate.test.ts core/tests/replay.test.ts
npm run build -w core
```

Expected: tests and TypeScript fail because Reflect does not exist.

- [ ] **Step 4: Extend the types.** Add `reflect?: number` beside `attack?/health?` on `Card`, `reflect: number` beside live Attack/Health on `CreatureState`, and `value3?: number` on `EffectSpec`. Document that `value`, `value2`, and `value3` mean Attack, Health, and Reflect deltas for `buff`; retain `value2` as Health for serialized-card compatibility.

- [ ] **Step 5: Initialize and mutate live Reflect only through events/effects.** Creature creation copies `card.reflect!` into `CreatureState.reflect`. Buff application adds `value3 ?? 0` to Reflect in the same event-backed mutation path as Attack and Health. Silence does not erase permanent stat modifications, matching existing Attack/Health behavior.

- [ ] **Step 6: Change combat counter-damage.** In `Game.submit(attack)`, capture `attacker.attack` and `defender.reflect` before either `dealDamage` call. Keep the existing simultaneous-resolution rationale and update it to distinguish initiating Attack from defensive Reflect.

- [ ] **Step 7: Preserve the curve mathematically.** Change creature stat spending to:

```ts
const spent = card.health
  + (card.attack + card.reflect) / 2
  + card.keywords.reduce((sum, keyword) => sum + KEYWORD_COST[keyword], 0);
```

Validation messages must name Attack, Reflect, Health, the weighted total, and the ceiling. `statBudget(cost)` remains `2 + 2 * cost`.

- [ ] **Step 8: Update generated rules text.** Buff text names only non-zero deltas in the visible order Attack, Reflect, Health. Examples: `Give a friendly creature +2 Attack and +1 Reflect.` and `Give all friendly creatures +1 Reflect and +2 Health.` Zero-only buffs remain invalid.

- [ ] **Step 9: Update bot evaluation.** Replace the old `attack * 2 + health` body term with explicit initiating and defensive value:

```ts
c.attack * 1.25 + c.reflect * 0.75 + c.health
```

Retain all existing keyword and enemy-taunt terms. Add a test showing Veteran/Grandmaster prefer a higher-Reflect defender when other dimensions are equal without treating Reflect as hero damage.

- [ ] **Step 10: Add the transitional builder default and update direct literals.** Keep current archetype data compiling by assigning Reflect from Attack inside `archetypeCards().creature`; add explicit Reflect to direct neutral, token, test-pool, and test fixture objects. Stamp newly authored curated and custom cards with schema `version: 2`; version 1 remains readable only through Task 3's compatibility migration.

- [ ] **Step 11: Run focused and workspace verification.**

```bash
npm run build -w core
npm test -w core
npm test
```

Expected: all pass with deterministic snapshots updated intentionally.

- [ ] **Step 12: Commit.**

```bash
git add core/src core/tests
git commit -m "feat(core): add independent Reflect combat damage"
```

---

### Task 2: Hand-author Reflect across the curated pool

**Files:**
- Create: `docs/superpowers/specs/2026-08-09-reflect-balance-ledger.md`
- Modify: `core/src/data/builders.ts`
- Modify: `core/src/data/ember-court.ts`
- Modify: `core/src/data/hollow-choir.ts`
- Modify: `core/src/data/vermin-swarm.ts`
- Modify: `core/src/data/dragonflight.ts`
- Modify: `core/src/data/elder-roots.ts`
- Modify: `core/src/data/shadow-dancers.ts`
- Modify: `core/src/data/bone-horde.ts`
- Modify: `core/src/data/grave-pact.ts`
- Modify: `core/src/data/night-coven.ts`
- Modify: `core/src/data/starforged.ts`
- Modify: `core/src/data/eternal-vigil.ts`
- Modify: `core/src/data/stormwrought.ts`
- Modify: `core/src/data/neutrals.ts`
- Modify: `core/src/data/tokens.ts`
- Modify buff effects in: `core/src/data/night-coven.ts`, `core/src/data/dragonflight.ts`, `core/src/data/vermin-swarm.ts`, `core/src/data/stormwrought.ts`, `core/src/data/bone-horde.ts`, `core/src/data/elder-roots.ts`, `core/src/data/grave-pact.ts`, and `core/src/data/neutrals.ts`
- Test: `core/tests/pool-balance.test.ts`
- Test: `core/tests/data.test.ts`
- Test: `core/tests/decks-1-3.test.ts`
- Test: `core/tests/decks-4-6.test.ts`
- Test: `core/tests/decks-7-9.test.ts`
- Test: `core/tests/decks-10-12.test.ts`

**Interfaces:**
- Consumes: the Reflect engine contract from Task 1.
- Produces: explicit Reflect values for all 146 curated creatures and explicit three-axis values for every curated buff.

- [ ] **Step 1: Generate a review ledger from the runtime pool.** The ledger contains one row per creature with immutable ID, name, archetype, rarity, cost, Attack, proposed Reflect, Health, keywords/triggers, weighted spend, role, and one-sentence rationale. Group by archetype, then neutrals, then tokens.

- [ ] **Step 2: Apply the approved role grammar by hand.** Every row receives a reviewed integer Reflect value:
  - Aggressor: Reflect below Attack.
  - Guardian/retaliator: Reflect above Attack.
  - Flexible or vanilla: values near parity.
  - Utility engine: lower combat totals to pay for effects.
  - Taunt may lean toward Reflect; Charge/Rush may lean toward Attack.
  - Lifesteal Reflect is priced deliberately because defensive lifesteal heals its controller.
  - Tokens are valued by the summoning card's paid cost, not token mana cost alone.

Do not generate Reflect from a formula. The ledger is the auditable hand-authoring artifact.

- [ ] **Step 3: Review the complete ledger with the user before editing card data.** Confirm each archetype retains a coherent identity, the pool-wide mean of `Reflect - Attack` remains between -0.5 and +0.5, and high-Reflect outliers have visible role justification.

- [ ] **Step 4: Make Reflect explicit in the builder signature.** Change the creature factory to:

```ts
creature(
  id: string,
  name: string,
  cost: number,
  attack: number,
  reflect: number,
  health: number,
  rarity: Rarity,
  keywords?: Keyword[],
  triggers?: TriggerSpec[],
  flavor?: string,
): Card;
```

Remove the transitional `reflect = attack` assignment. TypeScript must fail if any curated builder call omits the authored value.

- [ ] **Step 5: Apply all approved creature values and buff deltas.** Keep every card ID unchanged. Preserve costs, Attack, and Health unless the approved ledger explicitly records a compensating adjustment needed to maintain role or budget.

- [ ] **Step 6: Add pool invariants.** Assert 146 curated creatures are present, every creature has an integer Reflect, no non-creature has Reflect, every card is within the weighted validation ceiling, every archetype has at least one `Attack > Reflect` and one `Reflect > Attack` creature where its creature count permits, and the pool mean constraint from Step 3 holds.

- [ ] **Step 7: Run all deck, pool, bot, and determinism suites.**

```bash
npx vitest run core/tests/pool-balance.test.ts core/tests/data.test.ts core/tests/decks-1-3.test.ts core/tests/decks-4-6.test.ts core/tests/decks-7-9.test.ts core/tests/decks-10-12.test.ts core/tests/bot core/tests/determinism.test.ts
npm run build -w core
npm test
```

- [ ] **Step 8: Commit.**

```bash
git add core/src/data core/tests docs/superpowers/specs/2026-08-09-reflect-balance-ledger.md
git commit -m "balance(core): hand-author creature Reflect values"
```

---

### Task 3: Migrate custom cards and expose Reflect in Forge

**Files:**
- Modify: `app/src/forge/formState.ts`
- Modify: `app/src/screens/Forge.tsx`
- Modify: `app/src/screens/forge.css`
- Modify: `app/src/storage.ts`
- Modify: `app/src/components/ImportExport.tsx`
- Modify: `app/src/deckBuild.ts` if fixture cards are constructed there
- Test: `app/tests/forge.test.ts`
- Test: `app/tests/forgeKeywords.test.ts`
- Test: `app/tests/storage.test.ts`
- Test: `app/tests/importExport.test.ts`
- Test: `server/tests/**/*.test.ts` fixtures containing literal custom creatures

**Interfaces:**
- Produces: `ForgeDraft.reflect: string`; custom-card schema version 2; `migrateCard(card): Card` for version-1 creature compatibility.

- [ ] **Step 1: Write failing Forge tests.** Assert creature drafts require explicit Reflect, preview/save carries it, spell/artifact drafts omit it, and buff presets independently edit Attack, Reflect, and Health deltas.

- [ ] **Step 2: Write failing migration tests.** A stored/imported version-1 creature missing Reflect migrates to `reflect = attack` and `version = 2`; a version-2 creature missing Reflect is rejected rather than silently repaired. Spells and artifacts retain no Reflect.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/forge.test.ts app/tests/storage.test.ts app/tests/importExport.test.ts
```

- [ ] **Step 4: Extend Forge state.** Add `reflect: string` between Attack and Health in `ForgeDraft`, initialize it explicitly, and include `reflect: toStat(d.reflect)` only for creatures. Buff editing maps Reflect to `EffectSpec.value3`.

- [ ] **Step 5: Add the visible controls.** The creature stat editor presents Attack, Reflect, and Health in that order. Reflect is required and editable; it does not default from Attack in a new draft. Use plain text labels in the authoring form because the card-space constraint applies to plates, not data-entry accessibility.

- [ ] **Step 6: Add versioned migration.** Centralize migration in `storage.ts` so localStorage load and JSON import share one path. Never mutate IDs. Version-1 migration is deterministic and contains no RNG.

- [ ] **Step 7: Verify LAN custom-card exchange.** Update server/app fixtures and prove a version-2 custom creature retains Reflect across host registration, guest sync, deterministic shadow creation, and reconnect replay.

- [ ] **Step 8: Run app/server/full verification.**

```bash
npx vitest run app/tests/forge.test.ts app/tests/storage.test.ts app/tests/importExport.test.ts server/tests
npx tsc --noEmit -p app/tsconfig.json
npm run build -w server
npm test
```

- [ ] **Step 9: Commit.**

```bash
git add app/src app/tests server/tests
git commit -m "feat(app): author and migrate Reflect cards"
```

---

### Task 4: Replace card stat words with compact authored marks

**Files:**
- Create: `app/src/components/StatMark.tsx`
- Create: `app/src/components/statmark.css`
- Modify: `app/src/components/CardFrame.tsx`
- Modify: `app/src/components/Card.tsx`
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/Board.tsx`
- Create: `app/tests/statMark.test.ts`
- Test: `app/tests/cardTreatment.test.ts`
- Test: `app/tests/boardKeywords.test.ts`
- Test: `app/tests/cardTextWell.test.ts`
- Test: `app/tests/cardArtWiring.test.ts`

**Interfaces:**
- Produces: `StatMark({ kind, value })`, where `kind` is `'attack' | 'reflect' | 'health'`; `CardFrameProps.reflect?: number`; live board stats `{ attack, reflect, health }`.

- [ ] **Step 1: Write failing semantic tests.** A creature card must contain exactly three visible symbol-number pairs in Attack/Reflect/Health order, no visible words `Attack`, `Reflect`, or `Health`, and accessible names `Attack N`, `Reflect N`, `Health N`. A board card must still omit cost.

- [ ] **Step 2: Write failing icon-source tests.** Assert `StatMark.tsx` contains three authored `<svg>` paths, contains no emoji code points, imports no icon package, and references no remote asset. The returning-arrow mark must not use a shield silhouette.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/statMark.test.ts app/tests/cardTreatment.test.ts app/tests/cardTextWell.test.ts
```

- [ ] **Step 4: Implement `StatMark`.** Use `currentColor` inline SVGs with `aria-hidden="true"`; put the accessible label on the outer mark. The icon sits beside the numeral in a horizontal inline-flex row.

```ts
export type StatKind = 'attack' | 'reflect' | 'health';
export interface StatMarkProps { kind: StatKind; value: number }
```

- [ ] **Step 5: Thread live Reflect through the card stack.** Extend `CardView → Card → CardFrame`; definition cards use `card.reflect`, while board cards use `CreatureState.reflect` from `stats`. Preserve the existing live-state-over-definition rule for Attack, Health, keywords, and silence.

- [ ] **Step 6: Build the compact footer.** Replace the two labeled corner pips with one three-cell stat rail. Use muted tokens `--stat-attack`, `--stat-reflect`, and `--stat-health`; `--stat-attack` aliases the canonical damage gules, while blue and green remain distinct from all house fields. No number may be bare in the accessibility tree.

- [ ] **Step 7: Preserve art and text invariants.** Epic/Legendary bleed plates keep their larger image region. Do not add line clamp, do not unhide board text wells, do not tint generated art, and do not reduce the 5:7 hand-card ratio.

- [ ] **Step 8: Browser-verify real cards.** At both supported resolutions, inspect common, rare, Epic full-art, and Legendary full-art creatures in hand, board, Discover preview, and inspect view. Confirm icons remain legible at board zoom and the three-stat row never crowds the artwork.

- [ ] **Step 9: Run tests, type-check, and build.**

```bash
npx vitest run app/tests/statMark.test.ts app/tests/cardTreatment.test.ts app/tests/boardKeywords.test.ts app/tests/cardTextWell.test.ts app/tests/cardArtWiring.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
```

- [ ] **Step 10: Commit.**

```bash
git add app/src/components app/tests
git commit -m "style(app): add compact Reflect stat marks"
```

---

### Task 5: Replace fixed slots with centered dynamic formations

**Files:**
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/board.css`
- Modify: `app/src/screens/Match.tsx` only if the combat-layer mount belongs above `Board`
- Test: `app/tests/boardSurface.test.ts`
- Test: `app/tests/board.test.ts`

**Interfaces:**
- Produces: `BoardFormation({ creatures, kind })` or an equivalent focused internal component; stable `data-creature-id` anchors for combat measurement; one reserved `.board-combat-lane` effects mount.

- [ ] **Step 1: Write failing structure tests.** Assert `slotCount` and `.board-slot--empty` are absent, one normal creature renders once at the center of its band, two retain stable DOM order, seven fit one line at 1280px, tokens render in a separate band, and an empty token band is absent from the DOM.

- [ ] **Step 2: Write targeting regressions.** Prove targetable creatures, attacker selection, right-click inspection, empty-space cancel, and the whole-band summon/target affordance still work without fixed slot elements.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/board.test.ts
```

- [ ] **Step 4: Remove decorative capacity slots.** Delete `slotCount`, empty-span rendering, and `.board-slot--empty`. Do not change the engine's board-capacity checks.

- [ ] **Step 5: Center occupied formations.** Wrap each `AnimatePresence` sequence in a max-content flex formation centered with auto margins. Spacing contracts before card scale; seven normal cards must remain on one line at 1280×900. Do not reorder or overlap cards.

- [ ] **Step 6: Preserve separate token bands.** Normal and token arrays remain stable partitions. Token formations use the same centering rule at the existing subordinate scale, and the token band renders only when non-empty.

- [ ] **Step 7: Reserve the combat lane.** Keep an intentionally empty axis between opposing formations and expose one pointer-transparent effects layer above it. Do not place decorative ornaments in the lane. Continue exposing each card's `data-creature-id` for bounding-box snapshots.

- [ ] **Step 8: Browser-verify formations.** Capture 1, 2, 3, and 7 normal creatures plus 1 and maximum tokens at 1280×900 and 1440×900. The one-card center must align to the board axis; two cards must straddle it symmetrically; no card may wrap, clip, or overlap HUD controls.

- [ ] **Step 9: Run full verification.**

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/board.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
```

- [ ] **Step 10: Commit.**

```bash
git add app/src/components/Board.tsx app/src/components/board.css app/src/screens/Match.tsx app/tests
git commit -m "style(app): center dynamic board formations"
```

---

### Task 6: Restore a restrained looping Legendary foil

**Files:**
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/CardFrame.tsx` only if a dedicated foil overlay element is required
- Test: `app/tests/armorialContract.test.ts`
- Test: `app/tests/cardTreatment.test.ts`
- Test: `app/tests/cardTextWell.test.ts`

**Interfaces:**
- Produces: a Legendary-only `card-foil-pass` loop with a resting interval and a static reduced-motion fallback.

- [ ] **Step 1: Write failing contract tests.** Assert only Legendary plates receive the foil overlay; common/rare/Epic plates do not. Ban non-none `box-shadow`, `text-shadow`, and `filter: drop-shadow` in the treatment. Assert reduced motion disables the animation.

- [ ] **Step 2: Define the foil loop.** Use one narrow, low-opacity iridescent/argent-to-or overlay clipped to the Legendary frame and art. The six-second keyframe includes a clear pause:

```css
@keyframes card-foil-pass {
  0%, 18% { transform: translateX(-130%) skewX(-12deg); opacity: 0; }
  22% { opacity: 0.18; }
  42% { transform: translateX(130%) skewX(-12deg); opacity: 0.08; }
  46%, 100% { transform: translateX(130%) skewX(-12deg); opacity: 0; }
}
```

The motion loops with more than half of each cycle at rest. It evokes the old shimmer behavior without restoring its orange glow, bevel, or depth shadow.

- [ ] **Step 3: Preserve Legendary hierarchy.** Keep the or hairline and full-art image area. The foil may cross art and frame but must not reduce text contrast or make stat colors change meaning.

- [ ] **Step 4: Add reduced-motion fallback.** Legendary cards keep a static or hairline and a fixed low-opacity foil field; no repeated motion.

- [ ] **Step 5: Browser-verify.** Observe at least two complete cycles in hand, board, and inspect sizes. Confirm a visible rest interval, no flashing, no text washout, and no animation on non-Legendary cards.

- [ ] **Step 6: Run verification and commit.**

```bash
npx vitest run app/tests/armorialContract.test.ts app/tests/cardTreatment.test.ts app/tests/cardTextWell.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/components app/tests
git commit -m "style(app): restore restrained Legendary foil"
```

---

### Task 7: Implement the approved staged combat theatre

**Files:**
- Create: `app/src/components/CombatTheatre.tsx`
- Create: `app/src/components/combattheatre.css`
- Create only if Task 0 chose hybrid: `app/src/components/webglImpact.ts`
- Modify: `app/src/components/animations.ts`
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/components/Board.tsx` if measurement registration is not already exposed
- Modify: `core/src/types.ts` only if the completed current plan has not already shipped `combatStarted`
- Modify: `core/src/engine/game.ts` only if the completed current plan has not already shipped `combatStarted`
- Create: `app/tests/combatTheatre.test.ts`
- Test: `app/tests/animations.test.ts`
- Test: `app/tests/matchFx.test.ts`
- Test: `core/tests/combat-simultaneous.test.ts` only for missing `combatStarted` coverage

**Interfaces:**
- Consumes: one log-only `combatStarted { attackerId, defenderId }` event, stable creature element bounds, and the renderer decision from Task 0.
- Produces: `CombatTheatre.play(exchange): Promise<void>` integrated with `useAnimationQueue` without mutating game state.

- [ ] **Step 1: Reconcile with the completed Armorial motion task.** Read the shipped `GameEvent` and animation queue rather than assuming the pre-plan shape. Reuse `combatStarted` if present. If absent, add exactly one log-only event emitted before both reciprocal `dealDamage` calls; do not add separate attack/resolution state mutations.

- [ ] **Step 2: Write failing sequence tests.** With fake timers, prove attacker lift/impact occurs before defender Reflect lift/impact, both source IDs are retained after either creature dies, unrelated damage events remain separate, and skip drains the sequence without desynchronizing the authoritative state mirror.

- [ ] **Step 3: Write reduced-motion and fallback tests.** Reduced motion performs one 140ms emphasis/cut and no transforms or shake. If Task 0 selected hybrid, mocked WebGL2 failure must use the CSS impact path and still complete the queue.

- [ ] **Step 4: Run RED verification.**

```bash
npx vitest run app/tests/combatTheatre.test.ts app/tests/animations.test.ts app/tests/matchFx.test.ts core/tests/combat-simultaneous.test.ts
```

- [ ] **Step 5: Snapshot geometry before animation.** On `combatStarted`, read both `data-creature-id` rectangles from the stable board refs before queued death visuals remove them. Convert positions into combat-lane coordinates. Missing elements produce a damage-only cut, never a thrown error.

- [ ] **Step 6: Stage the DOM cards.** Use fixed overlay facsimiles or portal-mounted real presentation plates so layout does not reflow. Follow the approved Task 0 timeline: attacker lift/lunge/impact/recoil, defender Reflect lift/lunge/impact, both settle. Use CSS perspective transforms but retain crisp text and stat marks.

- [ ] **Step 7: Add only the selected effects renderer.**
  - CSS decision: authored impact frame, ruled cut, and localized maximum-4px shake.
  - Hybrid decision: the same CSS fallback plus the approved transparent WebGL2 particle/shockwave layer using the exact interface recorded by Task 0.

Do not ship both as user-facing settings unless the Task 0 decision document explicitly requires that outcome.

- [ ] **Step 8: Keep rules simultaneous.** Damage popups may appear on their corresponding staged impacts, but underlying Game events and final state are not delayed or reordered. Lifesteal, triggers, deaths, and draw checks remain driven by the engine queue.

- [ ] **Step 9: Integrate queue skip and interruption.** `skip()` cancels active DOM/WebGL animation handles, destroys transient layers, advances through queued callbacks, and lands on the already-authoritative state. Component unmount performs identical cleanup.

- [ ] **Step 10: Browser-verify real matches.** Capture attacker survival, defender survival, mutual death, token combat, lifesteal Reflect, and a seven-card formation. Verify no clipping, stale ghost cards, pointer interception, or frame exceeding 50ms on the verification machine.

- [ ] **Step 11: Run full verification.**

```bash
npx vitest run app/tests/combatTheatre.test.ts app/tests/animations.test.ts app/tests/matchFx.test.ts core/tests/combat-simultaneous.test.ts
npm run build
npm test
```

- [ ] **Step 12: Commit.**

```bash
git add core/src core/tests app/src app/tests
git commit -m "feat(app): stage Attack and Reflect combat"
```

---

### Task 8: Final migration, accessibility, performance, and documentation

**Files:**
- Modify: `app/PRODUCT.md`
- Modify or create: `app/DESIGN.md`
- Modify: `docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md`
- Test: `app/tests/armorialMigration.test.ts`
- Test: `core/tests/pool-balance.test.ts`

**Interfaces:**
- Produces: documented Reflect rules, stat-mark legend, dynamic formation rules, Legendary foil exception, renderer/fallback contract, and final proof checklist.

- [ ] **Step 1: Add whole-tree guards.** Assert no emoji stat glyphs, no fixed board-slot placeholders, no missing creature Reflect, no Reflect on non-creatures, no remote combat assets, no non-Legendary foil selector, and no forbidden shadow/glow recipe introduced by this plan.

- [ ] **Step 2: Audit accessibility.** Keyboard targeting order matches DOM order; all stat marks have names; color is redundant with symbol shape; combat overlays are pointer-inert and `aria-hidden`; reduced motion is complete; no live region repeats every animation frame.

- [ ] **Step 3: Audit performance and cleanup.** Run repeated combats, rematch, navigation away, and skip. Confirm no orphan canvas, animation frame, timer, resize observer, or portal remains. Cap device pixel ratio for an approved WebGL layer at 2.

- [ ] **Step 4: Update product and design documentation.** Explain Attack versus Reflect, simultaneous rules versus staged presentation, the three SVG marks and color tokens, centered formations, token-band collapse, Legendary foil timing, and renderer fallback behavior.

- [ ] **Step 5: Run the mechanical UI detector exactly once after all UI edits.** Use the project Impeccable detector path that exists in the execution checkout. Fix valid findings manually; do not rerun the detector after reviewer fixes unless the then-current Impeccable instructions explicitly require it.

- [ ] **Step 6: Run complete verification.**

```bash
npm run build
npm test
npx tsc --noEmit -p app/tsconfig.json
git diff --check
```

Exclude only checksum-pinned upstream license bytes from whitespace checks if such a file is unchanged by this plan.

- [ ] **Step 7: Perform at most two fresh finish-review rounds.** Review engine determinism, all 146 authored values, Forge migration, card legibility, Epic/Legendary full-art retention, dynamic 1/2/7 formations, Legendary loop/rest behavior, staged combat clarity, reduced motion, fallback, and offline LAN behavior. Stop after two rounds and report remaining subjective issues honestly.

- [ ] **Step 8: Commit documentation and guards.**

```bash
git add app/PRODUCT.md app/DESIGN.md app/tests core/tests docs/superpowers/specs
git commit -m "docs: define Reflect and dynamic combat language"
```

## Self-Review

- Spec coverage: approved Reflect semantics, hand-authored balance, independent buffs, Forge requirements, compact non-emoji stat marks, muted red/blue/green language, full-art preservation, dynamic centered normal/token bands, Legendary paused foil loop, CSS/WebGL comparison, staged simultaneous combat, reduced motion, fallback, determinism, and offline LAN constraints each map to a task.
- Placeholder scan: the renderer is deliberately selected by a tested user decision gate in Task 0 rather than left unspecified; subsequent tasks consume that recorded decision.
- Type consistency: `Card.reflect`, `CreatureState.reflect`, `EffectSpec.value3`, `ForgeDraft.reflect`, `StatKind`, `CombatRenderer`, and `combatStarted` have one stated meaning throughout.
- Dependency order: Task 0 chooses rendering; Task 1 creates the engine contract; Task 2 authors the pool; Task 3 migrates custom cards; Tasks 4–6 build independent visual surfaces; Task 7 consumes all prior interfaces; Task 8 verifies and documents.

## Deferred Execution Handoff

Do not offer or begin execution now. Complete the existing Discover/Armorial main-thread plan first. When the user later asks to revisit this work:

1. Re-read this plan against the then-current source and update stale paths or interfaces.
2. Reconfirm that all approved decisions still stand.
3. Execute Task 0 and obtain the renderer decision before touching production combat code.
4. Use subagent-driven development with a fresh implementation agent and a fresh reviewer per task, honoring the user's then-current model and effort requirements.
