# Reflect, Dynamic Formations, and Combat Theatre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Corrected after two implementation-readiness reviews; **not yet approved for execution**. The Discover/Armorial prerequisite is complete and merged (`15b43b0`). The remaining gate is user approval of this corrected plan plus the separate house-identity pilot described below.

**Revision 2026-08-10:** folds in the zero-shot comparison, the user's play findings, and both review passes. The unusable screenshot evidence remains explicitly excluded; source-derived findings are mechanical rather than perceptual.

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
- Normal creatures and tokens remain separate centered bands. Empty token **content** hides, but token capacity remains reserved inside a fixed-height player register so spawning a token adds no external track height.
- Legendary foil uses a moving, clipped **solid-color** band. Gradients, glow, bevel, faux metal, and depth shadows remain banned without exception.
- All motion honors `prefers-reduced-motion`; reduced motion removes lunges, shake, particles, hover transitions, and looping foil while preserving state clarity.
- Any WebGL implementation must be optional, locally bundled, unavailable-WebGL safe, and free of CDN/runtime network dependencies for offline LAN play.
- Desktop/laptop support floor remains 1280×900; verify at both 1280×900 and 1440×900.
- Agent execution must not include long play-tests, bot-match matrices, or multi-turn gameplay grinding. Human gameplay feel and balance play-testing is user-owned, asynchronous, and never blocks an implementation task. Agents verify with deterministic fixtures, direct serialized-state setup, focused runtime scenes, and at most one bounded browser pass per task; they must not advance turns repeatedly to stage a visual matrix.
- Do not execute this plan until the user approves this corrected revision and the Identity Gate between Tasks 1 and 2 is satisfied.
- Do-not-regress criteria apply to every task and are verified in Task 9: reduced-motion and ARIA coverage may only increase, forbidden shadow/glow/gradient recipes stay banned, 1280×900 remains supported, and no match surface becomes `xl`-only. The 5:7 ratio and equal geometry across card types remain invariant; rendered size is responsive.

## Decisions Already Approved

1. The new stat is named **Reflect**.
2. In creature combat, Attack determines initiating damage and Reflect determines counter-damage.
3. Damage remains simultaneous in engine rules, but the visual exchange is staged attacker-first, defender-second.
4. Every curated creature receives a hand-authored Reflect value after its house role is stable.
5. Preserve average creature power: validation values Attack and Reflect as complementary axes rather than doubling the old budget.
6. Buffs may modify Attack, Reflect, and Health independently.
7. Forge requires explicit Reflect for custom creatures.
8. Visible card stats use authored symbol-number pairs with no printed stat words.
9. Stat colors are restrained red/blue/green and never the sole cue.
10. Decorative empty creature slots disappear; occupied cards center and expand symmetrically.
11. Normal and token formations remain separate. Token capacity is absorbed inside a fixed-height player register; empty token content is visually hidden without removing its layout reserve.
12. Legendary cards regain a paused looping foil made from a clipped solid-color band, never a gradient or glow.
13. Task 0 chooses CSS-only versus optional hybrid WebGL before production combat work.
14. The 5:7 ratio is invariant; rendered dimensions are not. One CSS-owned `--hand-card-scale` controls hand rendering and fan math across all supported heights (`0.8` base, `0.74` below 1061px, `0.66` below 984px). Board and preview contexts retain their own explicit scale factors.
15. Consume stays with Vermin Swarm and uses the shared immediate-play affordability contract in `docs/superpowers/specs/2026-08-10-house-toll-identity-design.md`; Bone Horde uses deathrattle/recurrence instead.

## Authoritative Execution Order

This list overrides insertion history and task numbering:

1. Task 0 — renderer comparison and recorded user decision.
2. Task 1 — Reflect engine contract with transitional `reflect = attack` builders.
3. **Identity Gate** — approve, separately plan, and implement the three-house identity pilot; the user supplies the manual play-test verdict asynchronously, and agent execution never runs a match matrix.
4. Task 2 — hand-author final Reflect values against stable card roles.
5. Task 3 — custom-card schema migration and Forge.
6. Task 4 — compact stat marks.
7. Task 5A → 5B → 5C — stable match geometry, board formations, then visual treatment.
8. Task 6 — flat Legendary foil.
9. Task 7 — production combat theatre.
10. Task 8A → 8B; execute optional 8C only after reconfirmation.
11. Task 9 — final migration, evidence, documentation, and review.

---

## Zero-Shot Comparison Findings (2026-08-10)

Source of this section: `docs/superpowers/handoffs/2026-08-09-zero-shot-visual-plan-handoff.md`, which asked for a comparison of the zero-shot build at `/Users/lucas/Downloads/tcgtest/build-ashen-court-game (1)` against this project, routed into this plan.

### Evidence status — READ BEFORE TRUSTING ANY CLAIM HERE

**The screenshot evidence named by the handoff does not support it.** Verified 2026-08-10:

- `.impeccable/critique/evidence/zero-shot-comparison/assessment-b/` is **empty**. `vision/` is **empty**. The handoff describes assessment-b as holding "comparable 1438×679 and 1280×800 states plus measured layout evidence." No such files exist.
- `assessment-a/` holds 10 PNGs, and **all 10 are the current Ashen Court build**, not the zero-shot. The five files prefixed `zs-` show Cardo type, Armorial house fields, the LAN Host/LAN Join menu, the Discover overlay, and a `NORMAL MOTION — Task 8 fixture` / `REDUCED MOTION — Task 8 fixture` debug panel citing `combatStarted`. That panel is this repository's own motion harness. `cur-match-turn1.png` is in fact the menu, and `cur-menu.png` is in fact a Discover overlay.
- Therefore **no pixel-level claim in the handoff's "Preliminary findings" is evidence-backed**, including the "5px hand text at rest" and "7px clipping at 1280×800" measurements.
- `.pi/agents/luna-visual-reviewer.md` exists but is a **Pi** agent pinned to `openai-codex/gpt-5.6-luna`. It is not reachable from the Claude Code harness this revision was written in, so requirement 1 of the handoff ("verify representative screenshots with the Luna visual agent and cite exact image paths") is **not satisfied**.

**What this section is grounded in instead:** direct reading of the zero-shot source tree, which is small (3,257 lines across `src/ui/*.tsx` plus a 262-line `src/index.css`) and states its visual mechanisms explicitly. Source analysis establishes *mechanism* — which is what a plan needs — but cannot establish subjective feel. Every claim below cites a file and line in one of the two trees.

**Before executing any task amended by this section**, either regenerate real side-by-side screenshots of both builds, or accept the source-derived findings as-is on the record that they are mechanical, not perceptual.

### What the zero-shot actually is

A different codebase, not a variant of this one: React 19, Tailwind 4, `peerjs` (WebRTC) instead of a WebSocket server, `vite-plugin-singlefile`, and no test infrastructure (`package.json` has no test script; `src/engine/tests.ts` is hand-rolled). It shares only the game concept and card names. Nothing in it is directly portable.

### Borrow — take the mechanism, it is missing here

1. **A positive "this creature can attack now" marker.** Zero-shot `.attack-ready` (`src/index.css:161`) puts a ring on every creature whose attack is available. This project marks only the negative — `.cardview--exhausted` grayscales creatures that have acted (`app/src/components/cardview.css:22`). Absence of grey is weaker than a positive marker, especially at board scale. Routed into Task 8A.

2. **A persistent action narrative.** Zero-shot renders `state.log.slice(-70)` in a toggleable rail (`src/ui/Match.tsx:640-642`, toggle at 606). This project has no log surface. Routed into optional Task 8C, which must be reconfirmed after the higher-priority geometry, readiness, and hover work.

3. **Modal dimming during targeting.** Zero-shot dims every non-target while targeting (`src/ui/Match.tsx:385,423`) so the legal set is the only lit thing on screen. This project already has the pieces — `.cardview--muted` at `cardview.css:17` and `Board.tsx:299` passes `muted={inTargeting && !targetable}` — so this is **already shipped**; verify coverage rather than build it.

### Reinterpret — the idea is right, the execution is banned here

4. **Attacker lunge timing.** Zero-shot `fx-lunge` (`src/index.css:200-205`) is `420ms ease-out`, peaking at `translateY(-22px) scale(1.1)` at 40%. This plan's `COMBAT_TIMELINE` (Task 0 Step 4) budgets `lift 140 + attack 320 = 460ms` to the same beat. The two agree within 40ms, which is corroboration that the plan's timing is in the right range — **use it as a reference point in the Task 0 spike, not as a target to copy.**

5. **Impact shake.** Zero-shot `fx-shake` displaces 6px over 340ms (`src/index.css:191-198`). This plan caps shake at 4px (Task 0 Step 5, Task 7 Step 7). Keep the 4px cap; the zero-shot value is the upper bound of tasteful, not the goal.

6. **Legendary shimmer cadence.** Zero-shot `shimmer` is `4.5s` with the card at rest for `0%–70%` of the cycle (`src/index.css:143-146`). This plan's `card-foil-pass` is 6s with rest from 46%–100% plus 0%–18%, i.e. ~72% at rest. **The plan's existing cadence is already correct and needs no change** — recorded here so Task 6 is not "improved" toward the zero-shot's shorter loop.

### Do not copy — confirmed anti-references

7. **Rarity-as-glow.** Every rarity in the zero-shot is a coloured `box-shadow` halo: `.rarity-rare` blue, `.rarity-epic` purple, `.rarity-legendary` gold, `.rarity-common` grey (`src/index.css:118-132`). This is precisely the recipe `app/tests/armorialContract.test.ts` and `app/tests/cardTextWell.test.ts` now ban. Rarity here is carried by frame treatment and full-art, not by halo.

8. **Generic purple fantasy ground.** `--ash-violet: #3b2a55` plus a `radial-gradient(1200px 700px at 50% -10%, #241a2c …)` body wash (`src/index.css:9,22-25`). The Armorial house fields replace this deliberately.

9. **Panel gradients, inset shadows, and `text-shadow-hard`.** `src/index.css:61-68,105-107`. All three are banned recipes in the shipped card contract.

10. **Type sized as a fraction of a layout variable.** Zero-shot `CardView.tsx` derives every string from an `em` scalar — `em * 0.52` for the type line, `em * 0.56` for flavor (`src/ui/CardView.tsx:214,219`). There is no floor, so text size collapses with the card. This is the *mechanism* behind the handoff's unverified "5px text" claim, and it is a real design defect regardless of the exact pixel value. Routed into Task 4 as an explicit minimum-size acceptance criterion.

### Corrections to the handoff's preliminary findings

- **"The current Armorial build … may feel too quiet or museum-like during interaction"** is materially overstated for targeting specifically. The Armorial main-thread plan shipped (`15b43b0`) with `.cardview--target` — a 3px cream ring with a stepped 1.3s flash (`cardview.css:34-41`) — plus `.heroportrait--target` (`heroportrait.css:272-281`), `.card--playable` (`card.css:426-430`), `.card--selected`, `.cardview--muted`, `.cardview--exhausted`, and `.cardview--frozen`. The state vocabulary is close to complete. Only **attack-ready** and the **action narrative** are actually absent.
- **"The permanent 220px sidebar"** is not permanent: `src/ui/Match.tsx:617` reads `hidden w-[220px] … xl:flex`, so it appears only at `xl` and above. Still an anti-reference for this project's 1280×900 floor, but describe it accurately.
- **Accessibility and reduced motion** are worse in the zero-shot than the handoff conveyed: its source has zero `prefers-reduced-motion` and zero `aria-` occurrences. This project currently has 69 `aria-` occurrences across `app/src` and five reduced-motion modules at this revision. Re-measure at execution start; nothing borrowed may reduce either baseline.

### Findings from play (user report, 2026-08-10) — higher authority than anything above

The user played both builds and reported the four differences that actually made the zero-shot feel better. These supersede the source-derived guesses where they conflict: they are perceptual evidence from the person the game is for, gathered by playing, which is exactly what the broken screenshot set failed to provide. Each is grounded below in the code that causes it.

11. **Card ability design — archetypes feel more defined, abilities more fun.** This is the largest comparison finding and is intentionally **not implemented inside this plan**. Zero-shot cards routinely carry two clauses in tension, while this pool is overwhelmingly single-clause and often repeats one verb at different numbers. The separate house-identity draft measures that problem. The Identity Gate after Task 1 requires its own approved implementation plan and a user-owned manual verdict before final Reflect authoring; no agent-run match matrix is required.

12. **Layout shift at end of turn. — MISDIAGNOSED; CORRECTED ON REVIEW 2026-08-10.**

    **The actual cause: the app moves the board on purpose, every single turn.** `app/src/screens/Match.tsx:651-656` handles `turnStart` by removing `match-shift`, forcing a reflow, and re-adding it. `app/src/screens/animations.css:28-41` defines `match-page-shift`, which translates the whole `.match-boardwrap` to `translateY(7px)` at 45% and back. The comment calls it "the board registers shift like a page being laid." That is the reported symptom, exactly, on the reported cadence.

    **What was wrong with the original diagnosis, recorded so the mistake is not repeated.** The user reported the movement accurately but attributed it to *"new objects spawning which causes it to scroll"* — a guess. That guess was accepted and a plausible CSS argument was built on top of it (`html, body, #root` carry `min-height: 100%` with no `overflow` rule at `app/src/index.css:13-19`). Nobody grepped for an existing turn-start animation. `.match` already has `height: 100vh; overflow: hidden` (`match.css:3-11`), so document growth was never demonstrated — only asserted. The proposed one-line `body { overflow: hidden }` fix would have shipped, changed nothing the user could see, and left the real cause running.

    **There are up to three independent sources of movement here and they must be measured separately, not merged:**
    1. **The deliberate turn-start shift** — `match-page-shift`. Confirmed, and almost certainly the whole of what the user is reporting.
    2. **Document scrollbar toggling** — plausible but **unproven**. Do not fix it until it is observed.
    3. **Token-band reflow on spawn** — genuinely independent and confirmed (`Board.tsx:407` conditional, `board.css:167-173`). This is finding 16 and it stands.

    Routed into Task 5A, which removes the deliberate transform first and measures other hypotheses separately.

13. **Hover shows card stats.** Zero-shot enlarges a hovered hand card; this build's board minis hide their rules text and require InspectPanel. Routed into Task 8B as a delayed, portal-mounted full-size plate. Inspect remains the explicit keyboard/touch path.

14. **Board UI reads cleaner and less thrown-together.** Two known mechanical causes are already isolated: deliberate turn-start movement and decorative empty slots. Tasks 5A and 5B remove those; Task 5C then re-evaluates the complaint with the user before any broader restyle.

### Findings from play, round 2 (user report, 2026-08-10) — board and hand

15. **Hand cards overflow their row and cover the board.** At 1280×900 the current 336px card plus hover occupies more than the 243px hand row, while `pointer-events: none` only makes the overlap click-through. Task 5A introduces the explicit `0.66` height-aware hand tier, centralizes fan math on that CSS value, and removes the workaround after bounding-rect verification.

16. **Token spawn shifts the whole board.** `.board-row--tokens` currently contributes roughly 90–116px only after the first token appears (`Board.tsx:407`, `board.css:167-173`). This is independent of finding 12's deliberate turn-start transform and would not be fixed by document overflow rules.

    **Resolved in this revision:** absorb token capacity inside each fixed-height player register. The token register remains mounted; only empty content becomes visually and accessibly hidden. Spawning a token adds no external track height. Task 5B owns the DOM/CSS contract and proves player-register bounds remain identical before and after spawn.

17. **The hand area is a bland flat rectangle.** `.match-handwrap` is `background: var(--ground-rise)` (`match.css:60`) — a single flat `#1D1A15` (`theme.css:19`) bled edge to edge by `margin: 0 calc(var(--space-5) * -1)`, with no border, no rule, no corner treatment, no edge at all. It is also the *same* token used for every generic raised surface in the app — deck builder panels, victory screen, shell (`deckbuilder.css`, `victory.css`, `shell.css`). The player's hand, the most important region on the screen, is painted the same flat colour as a settings panel and given no boundary.

    The existing comment correctly rejects the old gradient backdrop. Flat does not mean shapeless: Task 5C adds one engraved battlefield/hand rule and, only if necessary, a named flat field token.

### Do-not-regress acceptance criteria (apply to every task below)

These are added to the existing Global Constraints and are verified in Task 9:

- No task may reduce the count of `prefers-reduced-motion` blocks in `app/src`, and every new animation ships its reduced-motion branch in the same commit.
- No task may remove an existing ARIA name, role, or state. New affordances that carry meaning by colour or ring alone must also carry an accessible name.
- No task may reintroduce `box-shadow`, `text-shadow`, `filter: drop-shadow`, or `gradient(` into `app/src/components/card.css`. `app/tests/cardTextWell.test.ts` enforces this today; keep it green rather than amending it.
- No task may add `line-clamp`, un-hide `.card--board .card__body`, or tint generated art. The rendered card is responsive, but the 5:7 ratio, equal geometry across card types, and readable floor on `--hand-card-scale` remain binding. Task 5A is the only sanctioned rewrite of `cardTextWell.test.ts`'s box assertions; every other failure remains the edit's fault.
- Responsive floor stays 1280×900. Nothing may become `xl`-only.

---

### Task 0: Build and evaluate the disposable combat comparison spike

**Files:**
- Create temporarily: `app/combat-lab.html`
- Create temporarily: `app/src/dev/combatLab.tsx`
- Create temporarily: `app/src/dev/combatLab.css`
- Create temporarily: `app/src/dev/webglImpact.ts`
- Create temporarily: `app/tests/combatLab.test.ts` (delete in Step 10)
- Create: `docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md`

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

**Reference point, not a target.** Comparison finding 4: the zero-shot reaches its lunge peak — `translateY(-22px) scale(1.1)` — at 40% of a 420ms ease-out (`src/index.css:200-205`). The `lift + attack` budget above is 460ms to the same beat, so the two independently landed within 40ms of each other. Treat that as evidence the range is right and spend the spike's attention on the *staging* question this plan actually owns — whether an audience reads two sequential strikes as one simultaneous exchange — rather than on retuning a number that is already in range. Comparison finding 5: keep the 4px shake cap in Step 5; the zero-shot's 6px (`src/index.css:191-198`) is the upper bound of tasteful, not the goal.

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
- Produces: `Card.reflect?: number`, required by runtime validation for creatures; `Card.schemaVersion?: 1 | 2`, distinct from the existing `Card.version` revision value; `CreatureState.reflect: number`; `EffectSpec.value3?: number` as the Reflect delta for `kind: 'buff'`.
- Transitional builder behavior: existing six-argument curated creature calls mirror `reflect = attack` until the Identity Gate stabilizes card roles and Task 2 atomically converts all curated calls to explicit Reflect.

- [ ] **Step 1: Write failing combat tests.** Add cases proving a 5-Attack/2-Reflect attacker hitting a 1-Attack/4-Reflect defender deals 5 to the defender and receives 4, both damage events occur even when one creature dies, defender lifesteal uses Reflect damage, and hero attacks never use Reflect.

- [ ] **Step 2: Write failing type/validation tests.** Assert creatures require integer `reflect >= 0`, non-creatures reject Reflect, live creature state serializes and clones Reflect, and malformed old state cannot silently produce `undefined` counter-damage.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run core/tests/combat-simultaneous.test.ts core/tests/effects.test.ts core/tests/validate.test.ts core/tests/replay.test.ts
npm run build -w core
```

Expected: tests and TypeScript fail because Reflect does not exist.

- [ ] **Step 4: Extend the types.** Add `reflect?: number` beside `attack?/health?` on `Card`, `reflect: number` beside live Attack/Health on `CreatureState`, and `value3?: number` on `EffectSpec`. Add optional `schemaVersion?: 1 | 2` to `Card`; do **not** repurpose `version`, because Forge currently writes `version: Date.now()` as a card revision value. Document that `value`, `value2`, and `value3` mean Attack, Health, and Reflect deltas for `buff`; retain `value2` as Health for serialized compatibility.

- [ ] **Step 5: Initialize and mutate live Reflect only through events/effects.** Creature creation copies `card.reflect!` into `CreatureState.reflect`. Buff application adds `value3 ?? 0` to Reflect in the same event-backed mutation path as Attack and Health. Silence does not erase permanent stat modifications, matching existing Attack/Health behavior.

- [ ] **Step 6: Change combat counter-damage.** In `Game.submit(attack)`, capture `attacker.attack` and `defender.reflect` before either `dealDamage` call. Keep the existing simultaneous-resolution rationale and update it to distinguish initiating Attack from defensive Reflect.

- [ ] **Step 7: Preserve the curve mathematically.** Change creature stat spending to:

```ts
const spent = card.health
  + (card.attack + card.reflect) / 2
  + card.keywords.reduce((sum, keyword) => sum + KEYWORD_COST[keyword], 0);
```

Validation messages must name Attack, Reflect, Health, the weighted total, and the ceiling. `statBudget(cost)` remains `2 + 2 * cost` (`core/src/validate.ts:8`).

**The ceiling is not `statBudget()`.** `core/src/validate.ts:20` defines `STAT_BUDGET_SLACK = 4` and line 57 computes `const ceiling = budget + STAT_BUDGET_SLACK`, with a comment stating that the error message must quote `statBudget(cost) + STAT_BUDGET_SLACK`, "not" the bare budget. Changing how `spent` is computed must leave that slack term intact — dropping it silently tightens every card in the pool by 4 points and would reject cards that are legal today. If Reflect's arrival is judged to warrant a different slack, that is a deliberate balance change requiring the user's approval, not a side effect of rewriting the spend formula.

- [ ] **Step 8: Update generated rules text.** Buff text names only non-zero deltas in the visible order Attack, Reflect, Health. Examples: `Give a friendly creature +2 Attack and +1 Reflect.` and `Give all friendly creatures +1 Reflect and +2 Health.` Zero-only buffs remain invalid.

- [ ] **Step 9: Update bot evaluation.** Replace the old `attack * 2 + health` body term with explicit initiating and defensive value:

```ts
c.attack * 1.25 + c.reflect * 0.75 + c.health
```

Retain all existing keyword and enemy-taunt terms. Add a test showing Veteran/Grandmaster prefer a higher-Reflect defender when other dimensions are equal without treating Reflect as hero damage.

- [ ] **Step 10: Add the transitional builder default and update direct literals.** Keep current archetype data compiling by assigning Reflect from Attack inside `archetypeCards().creature`; add explicit Reflect to direct neutral, token, test-pool, and fixture objects. Stamp newly authored curated cards with `schemaVersion: 2`. Leave custom-card stamping and migration to Task 3. Existing `version` values remain unchanged.

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

### Identity Gate: Stabilize house roles before final Reflect authoring

**This is a blocking approval gate, not an implementation task inside this plan.** It must run after Task 1 and before Task 2.

1. Review and approve `docs/superpowers/specs/2026-08-10-house-toll-identity-design.md`.
2. Write a separate test-first implementation plan for the three-house Ember/Bone/Vermin pilot. That plan owns the shared immediate-Consume affordability helper, card packages, costs, a concise user-owned manual checklist, and commits; it must not assign a match matrix to an agent.
3. Implement the pilot with Task 1's transitional `reflect = attack`; do not hand-author final Reflect concurrently and do not grind live matches to stage evidence.
4. Obtain the user's asynchronous manual verdict on identity. If rejected, revise the identity spec and pilot without proceeding to Task 2; missing per-match telemetry is not an implementation failure.
5. If accepted, expand the approved five-element contract to the remaining nine houses in the separate identity plan, then record the stabilized roles Task 2 consumes.

The identity spec deliberately excludes tribes and any engine change beyond the shared immediate-Consume legality helper. Do not recreate the superseded former Task 10 in this file.

---

### Task 2: Hand-author Reflect across the stabilized curated pool

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
- Consumes: the Reflect engine contract from Task 1 **and the completed Identity Gate's approved, implemented card roles**. Task 2 is blocked until both exist.
- Produces: explicit Reflect values for all **140 curated creatures plus the 6 token creatures (146 total)**, and explicit three-axis values for every curated buff.

**Counted from source 2026-08-10, because the earlier "146 curated" was ambiguous and would have failed the assertion it specifies.** `core/src/data/*.ts` holds 140 `creature(` calls — bone-horde 12, dragonflight 14, elder-roots 11, ember-court 13, eternal-vigil 11, grave-pact 9, hollow-choir 10, neutrals 12, night-coven 7, shadow-dancers 8, starforged 11, stormwrought 10, vermin-swarm 12 — and `tokens.ts`'s `TOKEN_CARDS` adds 6 more creatures (`token-rat`, `token-skeleton`, `token-wisp`, `token-dragon-whelp`, `token-treant`, `token-phoenixash`). A worker who filters `!card.token` gets **140, not 146**. Say which population every assertion means.

The Global Constraints' 278 immutable non-token IDs are confirmed by the same count: 140 creatures + 124 spells + 14 artifacts. Adding 6 tokens and `mana-surge` produces the separate 285-card inventory count.

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

- [ ] **Step 6: Add pool invariants.** Assert **140 curated creatures and 6 token creatures** are present (see the Interfaces note — do not write `146` against a `!card.token` filter), every creature has an integer Reflect, no non-creature has Reflect, every card is within the weighted validation ceiling, and the pool mean constraint from Step 3 holds.

  **The per-archetype both-directions invariant is removed (review, 2026-08-10).** It previously read "every archetype has at least one `Attack > Reflect` and one `Reflect > Attack` creature where its creature count permits." That **forces every house to contain both an offensive and a defensive role**, which is precisely the homogenising pressure the identity work exists to undo — a house whose whole point is that it never wants to be attacked should be allowed to lean entirely one way. Replace it with either a **pool-wide** diversity check, or per-house expectations **derived from that house's approved identity**, once identities exist. Until then, assert pool-wide only.

- [ ] **Step 7: Run all deck, pool, bot, and determinism suites.**

```bash
npx vitest run core/tests/pool-balance.test.ts core/tests/data.test.ts core/tests/decks-1-3.test.ts core/tests/decks-4-6.test.ts core/tests/decks-7-9.test.ts core/tests/decks-10-12.test.ts core/tests/bot core/tests/replay.test.ts
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
- Produces: `ForgeDraft.reflect: string`; custom-card `schemaVersion: 2`; `migrateCard(card): Card` for cards whose `schemaVersion` is absent/1. Existing `Card.version` timestamps/revision values are preserved.

- [ ] **Step 1: Write failing Forge tests.** Assert creature drafts require explicit Reflect, preview/save carries it, spell/artifact drafts omit it, and buff presets independently edit Attack, Reflect, and Health deltas.

- [ ] **Step 2: Write failing migration tests.** A stored/imported custom creature with absent/1 `schemaVersion` and missing Reflect migrates deterministically to `reflect = attack` and `schemaVersion = 2` while retaining `version`; a schema-2 creature missing Reflect is rejected. Spells and artifacts retain no Reflect.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/forge.test.ts app/tests/storage.test.ts app/tests/importExport.test.ts
```

- [ ] **Step 4: Extend Forge state.** Add `reflect: string` between Attack and Health in `ForgeDraft`, initialize it explicitly, and include `reflect: toStat(d.reflect)` only for creatures. Buff editing maps Reflect to `EffectSpec.value3`.

- [ ] **Step 5: Add the visible controls.** The creature stat editor presents Attack, Reflect, and Health in that order. Reflect is required and editable; it does not default from Attack in a new draft. Use plain text labels in the authoring form because the card-space constraint applies to plates, not data-entry accessibility.

- [ ] **Step 6: Add schema migration.** Centralize migration in `storage.ts` so localStorage load and JSON import share one path. Treat missing `schemaVersion` as version 1, migrate custom creatures to 2, and never mutate IDs or the existing `version` revision field. The migration is deterministic and contains no RNG.

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

- [ ] **Step 7a: Floor the stat-mark size in *effective* px, not in a scalar.** Zero-shot comparison finding 10: that build derives every card string from an `em` scalar with no floor (`src/ui/CardView.tsx:214,219`), so its type collapses with the card and becomes unreadable at small sizes. Adding a third stat cell creates exactly that pressure here.

  **Decision 14 changes what "floor" means.** Declared sizes are design-space values multiplied by the context scale before reaching the screen. Task 5A therefore defines the minimum `--hand-card-scale` explicitly (`0.66` at the 1280×900 height floor), and the stat-mark test checks both declared size and effective rendered size. Board minis use their separate context scale and must remain legible in browser evidence.

  Never shrink the three-stat rail's type to make it fit; contract spacing first, as Task 5B does for formations. If the rail fails at the minimum context scale, raise the relevant scale and adjust surrounding geometry rather than hiding or clamping content.

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

### Task 5A: Stop match movement and make hand geometry truthful

**Files:**
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/screens/animations.css`
- Modify: `app/src/screens/match.css`
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/Hand.tsx`
- Modify: `app/src/screens/deckbuilder.css`
- Modify: `app/src/components/keywordchip.css`
- Modify: `app/src/index.css` only if measurement proves document overflow
- Modify: `app/tests/animations.test.ts`
- Modify: `app/tests/cardTextWell.test.ts`
- Modify: `app/tests/handLayout.test.ts`
- Create: `app/tests/matchGeometry.test.ts`

**Interfaces:**
- Produces: CSS-owned `--hand-card-scale`; `handStep(count, viewportWidth, renderedCardWidth)`; a stationary `.match-boardwrap`; a hand row that contains cards and hover lift at every supported height, explicitly verified at 1280×900, 1440×900, and 1920×1080.

- [ ] **Step 1: Write failing turn-stability tests.** Drive `turnStart` and assert `.match-boardwrap` never receives `match-shift`; assert no keyframe translates the whole board wrapper. Update the existing animation test that currently requires that deliberate movement.

- [ ] **Step 2: Write failing scale/containment tests.** Assert `--card-h` derives from `--card-w * --card-ratio`; `.card--hand` reads one CSS variable; `handStep` receives rendered width rather than breakpoint numbers; and the supported-height tiers satisfy the row equation: 900px uses `0.66` (`237.68 < 243`), 1000px uses `0.74` (`265.52 < 270`), 1080px uses `0.80` (`286.4 < 291.6`), and taller windows remain below the 300px row cap (`286.4 < 300`). Test boundary heights 983/984 and 1060/1061 so a one-pixel gap cannot reintroduce overflow.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/animations.test.ts app/tests/cardTextWell.test.ts app/tests/handLayout.test.ts app/tests/matchGeometry.test.ts
```

Expected: failures on the turn-shift class/keyframe, duplicated scale tiers, independent height literal, and 1280×900 containment.

- [ ] **Step 4: Remove the deliberate turn-start board shift.** Delete the `match-shift` retrigger from `Match.tsx` and the `match-page-shift` keyframe/rule from `animations.css`. This is an approved removal of the movement the user reported, not a speculative scrollbar fix.

- [ ] **Step 5: Measure before touching document overflow.** At 1280×900, record `body.scrollHeight`, `window.innerHeight`, board-register bounds, and hand bounds before/after turn start. Modify `index.css` only if `scrollHeight > innerHeight` is reproduced; if it is, fix the overflowing child and add the guard rather than hiding clipped content.

- [ ] **Step 6: Centralize responsive hand scale in CSS.** Keep the design-space width token and derive height:

```css
:root {
  --card-w: 240px;
  --card-ratio: 1.4;
  --card-h: calc(var(--card-w) * var(--card-ratio));
  --hand-card-scale: 0.8;
  --board-card-scale: 0.5;
}

.card--hand { zoom: var(--hand-card-scale); }
.card--board { zoom: var(--board-card-scale); }

@media (max-height: 1060px) and (min-width: 1201px) {
  :root { --hand-card-scale: 0.74; }
}

@media (max-height: 983px) and (min-width: 1201px) {
  :root { --hand-card-scale: 0.66; }
}
```

Retune the below-floor width tiers so they never enlarge the `0.8` base; keep existing board-width tiers under `--board-card-scale`. Remove the old hand-only height tiers at 800/680px, which would otherwise become a second authority. CSS owns every number; do not add `ResizeObserver` or JS-authored breakpoints.

- [ ] **Step 7: Make fan math consume the CSS value.** Replace `useViewportWidth` with a resize-aware hook that reads `window.innerWidth` and `getComputedStyle(document.documentElement).getPropertyValue('--hand-card-scale')` in one state update. The initial state performs the same read, with validated fallback `0.8`. Pass `HAND_CARD_WIDTH * scale` into pure `handStep`; remove its four-number breakpoint tree.

- [ ] **Step 8: Remove stale fixed-width assumptions.** Re-express card tests around derived 5:7 ratio and equal geometry across types. Audit `240`/`120` in `app/src`; update hidden-hand overlap, deck-builder tracks, animation fixture dimensions, and keyword-popover maximums to use the relevant card tokens or document why a value is independent.

- [ ] **Step 9: Contain the hand instead of making it click-through.** Ensure hand-row height includes rendered card height, top padding, and scaled 12px hover lift across every supported height, not only the two minimum proof viewports. Remove `.match-handwrap { pointer-events: none; }` and retain pointer behavior only where semantically needed. Assert no hand-card rect intersects the board register.

- [ ] **Step 10: Browser-verify and commit 5A.** Capture turn transitions and maximum hands at 1280×900, 1440×900, and 1920×1080. Confirm no turn-start shift, overlap, clipping, or first-paint scale jump.

```bash
npx vitest run app/tests/animations.test.ts app/tests/cardTextWell.test.ts app/tests/handLayout.test.ts app/tests/matchGeometry.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/screens/Match.tsx app/src/screens/animations.css app/src/screens/match.css app/src/components/card.css app/src/components/Hand.tsx app/src/screens/deckbuilder.css app/src/components/keywordchip.css app/src/index.css app/tests/animations.test.ts app/tests/cardTextWell.test.ts app/tests/handLayout.test.ts app/tests/matchGeometry.test.ts
git commit -m "fix(app): stabilize match and hand geometry"
```

---

### Task 5B: Center dynamic board formations without spawn reflow

**Files:**
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/board.css`
- Modify: `app/src/screens/Match.tsx` only if the combat effects mount belongs above `Board`
- Modify: `app/tests/boardSurface.test.ts`
- Modify: `app/tests/board.test.ts`
- Create: `app/tests/boardFormation.test.ts`

**Interfaces:**
- Consumes: Task 5A's stationary match geometry and responsive card context scales.
- Produces: centered normal/token formations; stable `.board-player-register`; always-present `.board-token-register` whose empty content is hidden; `data-creature-id` anchors; pointer-inert `.board-combat-lane`.

- [ ] **Step 1: Write failing formation tests.** Assert `slotCount` and `.board-slot--empty` are absent; 1/2/7 normal creatures render once in stable DOM order; tokens remain a separate partition; and normal capacity remains seven.

- [ ] **Step 2: Write failing spawn-stability tests.** Assert each player register always contains a token register, empty token content is `visibility: hidden`/pointer-inert rather than `display: none`, the outer player-register row definition is unchanged when a token appears, and no `{tokens.length > 0 && ...}` mount controls external height.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/board.test.ts app/tests/boardFormation.test.ts
```

- [ ] **Step 4: Remove decorative capacity slots.** Delete `slotCount`, empty-span rendering, and `.board-slot--empty`. Do not change engine board-capacity checks.

- [ ] **Step 5: Center occupied formations.** Use max-content flex formations centered with auto margins. Contract spacing before scale; seven normal cards remain on one line at 1280×900. Never reorder or overlap cards.

- [ ] **Step 6: Absorb token growth inside a fixed-height register.** Always mount the token register inside each player register. When empty, hide only its content and accessibility exposure while retaining the internal reserve. A token spawn must add zero external track height.

- [ ] **Step 7: Reserve the combat lane.** Keep an empty axis between opponents with one pointer-transparent effects layer. Preserve `data-creature-id` for bounding-box snapshots and add no decorative ornament in this lane.

- [ ] **Step 8: Re-run targeting regressions.** Prove target selection, attacker selection, right-click inspection, empty-space cancel, whole-band summon targeting, and face-down information rules survive slot removal.

- [ ] **Step 9: Browser-verify and commit 5B.** Capture 1, 2, 3, and 7 normal creatures plus empty/1/maximum tokens at both supported viewports. Compare player-register bounds before and after token spawn; they must be identical.

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/board.test.ts app/tests/boardFormation.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/components/Board.tsx app/src/components/board.css app/src/screens/Match.tsx app/tests/boardSurface.test.ts app/tests/board.test.ts app/tests/boardFormation.test.ts
git commit -m "style(app): center stable board formations"
```

---

### Task 5C: Finish the hand boundary and reassess board treatment

**Files:**
- Modify: `app/src/screens/match.css`
- Modify: `app/src/theme.css` only if a dedicated hand-field token is necessary
- Modify: `app/tests/armorialContract.test.ts`
- Create: `app/tests/matchTreatment.test.ts`

**Interfaces:**
- Consumes: accepted 5A/5B browser evidence.
- Produces: a flat, explicit hand/battlefield boundary without reopening general board restyling.

- [ ] **Step 1: Write failing treatment tests.** Require an engraved rule between battlefield and hand, ban raw colors and every gradient/shadow/glow recipe, and require a canonical theme token if the hand field differs from `--ground-rise`.

- [ ] **Step 2: Run RED verification.**

```bash
npx vitest run app/tests/armorialContract.test.ts app/tests/matchTreatment.test.ts
```

- [ ] **Step 3: Implement the minimal flat boundary.** Add one cream engraved rule and, only if needed for separation, one named flat field token. Do not add decoration to the combat lane.

- [ ] **Step 4: Re-evaluate the user's “clunky board” complaint.** Present post-5A/5B captures before proposing further styling. If the complaint is resolved, stop; if not, record a new bounded design decision rather than expanding 5C ad hoc.

- [ ] **Step 5: Verify and commit 5C.**

```bash
npx vitest run app/tests/armorialContract.test.ts app/tests/matchTreatment.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/screens/match.css app/src/theme.css app/tests/armorialContract.test.ts app/tests/matchTreatment.test.ts
git commit -m "style(app): define the hand battlefield boundary"
```

---

### Task 6: Restore a restrained looping Legendary foil

**Files:**
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/CardFrame.tsx` only if a dedicated foil overlay element is required
- Test: `app/tests/armorialContract.test.ts`
- Test: `app/tests/cardTreatment.test.ts`
- Test: `app/tests/cardTextWell.test.ts`
- Test: `app/tests/armorialMigration.test.ts`

**Interfaces:**
- Produces: a Legendary-only `card-foil-pass` loop with a resting interval and a static reduced-motion fallback.

- [ ] **Step 1: Write failing contract tests.** Assert only Legendary plates receive the foil overlay; common/rare/Epic plates do not. Keep the existing whole-app gradient ban green and also ban non-none `box-shadow`, `text-shadow`, and `filter: drop-shadow`. Assert reduced motion disables the loop.

- [ ] **Step 2: Define the flat foil loop.** Use one narrow, clipped solid band with a single `color-mix()` field between `--line` and Legendary-only `--or`; it is a computed flat color, **not** `linear-gradient()`. Optional adjacent 1px solid rules may create an argent/or pass without interpolation. The six-second keyframe includes a clear pause:

```css
.card--legendary .card__foil {
  background: color-mix(in srgb, var(--line) 72%, var(--or));
  border-inline: 1px solid var(--or);
}

@keyframes card-foil-pass {
  0%, 18% { transform: translateX(-130%) skewX(-12deg); opacity: 0; }
  22% { opacity: 0.18; }
  42% { transform: translateX(130%) skewX(-12deg); opacity: 0.08; }
  46%, 100% { transform: translateX(130%) skewX(-12deg); opacity: 0; }
}
```

The loop rests for roughly 72% of each cycle. It evokes the old pass without restoring its material. Do not whitelist gradients in `cardTextWell.test.ts` or `armorialMigration.test.ts`.

- [ ] **Step 3: Preserve Legendary hierarchy.** Keep the or hairline and full-art image area. The solid band may cross art and frame but must not wash out text or alter stat-color meaning.

- [ ] **Step 4: Add reduced-motion fallback.** Keep the static or hairline and park one narrow solid foil mark at the frame edge with opacity at or below `0.08`; no repeated motion.

- [ ] **Step 5: Browser-verify.** Observe at least two complete cycles in hand, board, and inspect sizes. Confirm a visible rest interval, no flashing, no text washout, and no animation on non-Legendary cards.

- [ ] **Step 6: Run verification and commit.**

```bash
npx vitest run app/tests/armorialContract.test.ts app/tests/cardTreatment.test.ts app/tests/cardTextWell.test.ts app/tests/armorialMigration.test.ts
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

- [ ] **Step 10: Browser-verify deterministic combat scenes.** Automated runtime tests own attacker survival, defender survival, mutual death, token combat, lifesteal Reflect, and seven-card-formation semantics. In one bounded browser pass, load those states through direct serialized/test-fixture setup rather than playing turns, capture the representative pass-through and reduced-motion scenes at both supported viewports, and verify no clipping, stale ghost cards, pointer interception, or frame exceeding 50ms. Do not run live matches or advance turns to assemble the matrix.

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

### Task 8A: Announce attack-readiness

**Files:**
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/cardview.css`
- Create: `app/tests/attackReady.test.ts`
- Modify: `app/tests/boardSurface.test.ts`
- Modify: `app/tests/armorialContract.test.ts`

**Interfaces:**
- Consumes: `Board`'s existing `attackers: Set<string>`, already derived from the `legal` prop's attack intents.
- Produces: `CardViewProps.attackReady?: boolean`.

- [ ] **Step 1: Write failing readiness tests.** Build the ready set from `legalIntents` attack entries, not duplicated Rush/Charge/frozen rules. Friendly creatures with at least one legal attack target are ready; enemies, frozen/summoning-sick/already-acted creatures, and creatures during a pending choice are not. The marker disappears after attack and while targeting.

- [ ] **Step 2: Write failing material/precedence tests.** Require a visible and accessible “Ready to attack” state; require `var(--line)`, never `--or`; ban glow/halo/shadow; and assert `selected > target > ready > exhausted/frozen` precedence explicitly rather than relying on CSS source order.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/attackReady.test.ts app/tests/boardSurface.test.ts app/tests/armorialContract.test.ts
```

- [ ] **Step 4: Reuse existing engine legality.** `Board.tsx` already collects attacker IDs from its `legal` prop. Pass `attackReady={friendly && attackers.has(c.id) && !inTargeting}` into `CardView`; do not add another `legalIntents()` call or duplicate Rush/Charge/frozen rules.

- [ ] **Step 5: Draw a distinct cream marker.** Use two inset corner brackets or a double engraved cream rule with design-space thickness that remains at least 1px after board zoom. It must be geometrically distinct from the continuous 3px targeting outline. `--or` remains reserved for Legendary and active turn.

- [ ] **Step 6: Preserve accessibility and reduced motion.** Include “Ready to attack” in the card's accessible state without duplicating the card name. The marker is static under reduced motion and absent during targeting.

- [ ] **Step 7: Browser-verify and commit 8A.** Capture mixed ready/exhausted friendly creatures and the same board during targeting at both supported viewports.

```bash
npx vitest run app/tests/attackReady.test.ts app/tests/boardSurface.test.ts app/tests/armorialContract.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/components/Board.tsx app/src/components/CardView.tsx app/src/components/cardview.css app/tests/attackReady.test.ts app/tests/boardSurface.test.ts app/tests/armorialContract.test.ts
git commit -m "feat(app): announce attack-ready creatures"
```

---

### Task 8B: Add non-disruptive card hover previews

**Files:**
- Create: `app/src/components/CardHoverPreview.tsx`
- Create: `app/src/components/cardhoverpreview.css`
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/hand.css`
- Modify: `app/src/screens/Match.tsx`
- Create: `app/tests/cardHoverPreview.test.ts`
- Modify: `app/tests/cardTextWell.test.ts`

**Interfaces:**
- Produces: `CardHoverPreview` portal; `HOVER_PREVIEW_DELAY_MS = 250`; `CardViewProps.previewEnabled?: boolean`; suppression props `{ targeting, modalOpen }`.

- [ ] **Step 1: Write failing runtime tests.** Use fake timers to prove pointer hover opens after exactly 250ms, leaving before the delay cancels, unmount removes the portal/timer, targeting and modal ownership suppress it, focus on a revealed source may reveal it without moving focus, blur/Escape closes it, and reduced motion preserves the preview while removing transition.

- [ ] **Step 2: Write failing plate tests.** Require a full `CardView size="preview" previewEnabled={false} staticKeywords` plate rather than unhiding `.card--board .card__body`; the duplicate is pointer-inert and `aria-hidden`, contains no interactive KeywordChip buttons, and cannot recursively spawn another preview. InspectPanel remains available.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/cardHoverPreview.test.ts app/tests/cardTextWell.test.ts
```

- [ ] **Step 4: Implement the portal.** Reuse KeywordChip's viewport-clamped portal positioning pattern. Mount under `document.body`, use retained source-card bounds, set `pointer-events: none`, and never shift board or hand layout.

- [ ] **Step 5: Implement interaction rules.** Pointer hover uses the 250ms delay. Add focusability only for revealed cards where preview reading is enabled; focus reveals without stealing focus, and Escape/blur closes. Targeting or any modal prevents mounting. Reduced motion sets transition duration to zero; it does **not** disable the reading feature.

- [ ] **Step 6: Tune board and hand placement.** Board previews choose the side with more viewport space. Hand previews rise above the source without covering the originating card's interactive rectangle. Preserve InspectPanel as the explicit click/context/touch detail surface; focus preview adds visual keyboard access without replacing it.

- [ ] **Step 7: Browser-verify and commit 8B.** At both viewports, cover board and hand cards near every edge, a seven-creature board, targeting suppression, modal suppression, focus behavior, and reduced motion. Confirm no clipping, layout shift, or accidental target click.

```bash
npx vitest run app/tests/cardHoverPreview.test.ts app/tests/cardTextWell.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/components/CardHoverPreview.tsx app/src/components/cardhoverpreview.css app/src/components/CardView.tsx app/src/components/card.css app/src/components/hand.css app/src/screens/Match.tsx app/tests/cardHoverPreview.test.ts app/tests/cardTextWell.test.ts
git commit -m "feat(app): preview cards on hover and focus"
```

---

### Task 8C: Add an optional action narrative

**Gate:** Reconfirm this is still wanted after Tasks 5A–5C and 8A–8B have been played. If not approved, record “skipped by user decision” in Task 9 and do not create these files.

**Files:**
- Create: `app/src/components/ActionLog.tsx`
- Create: `app/src/components/actionlog.css`
- Create: `app/src/game/actionLog.ts`
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/game/useMatch.ts` only if it does not already retain the resolved event stream
- Modify: `app/src/storage.ts`
- Create: `app/tests/actionLog.test.ts`
- Modify: `app/tests/storage.test.ts`

**Interfaces:**
- Produces: `LogEntry { id: number; text: string }`; `eventToLogEntry(event): LogEntry | null`; `ActionLog({ entries, open, onToggle })`.

- [ ] **Step 1: Write failing formatter tests.** Map known `GameEvent`s through one pure function; unknown/log-only-uninteresting events return `null` and may warn in development but never throw. Assert stable IDs, newest-last order, and a fixed entry cap.

- [ ] **Step 2: Write failing surface tests.** Require persisted open/closed preference, `aria-live="polite"`, one announcement per resolved event rather than animation frame, newest-entry scrolling, modal silence, and no focus stealing.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/actionLog.test.ts app/tests/storage.test.ts
```

- [ ] **Step 4: Implement the pure event formatter and bounded history.** Derive text centrally from event payloads. Never accept hand-written log strings from screens. Keep unknown events cosmetic and non-fatal.

- [ ] **Step 5: Implement a collapsible overlay rail.** It must not consume board width at 1280×900, become `xl`-only, or cover primary controls. Store only the open preference, not match history.

- [ ] **Step 6: Browser-verify and commit 8C.** Inject one deterministic multi-event history fixture containing death and Discover; capture closed/open states and verify keyboard toggle, modal silence, and reduced motion. Do not play through a multi-turn match to manufacture the log.

```bash
npx vitest run app/tests/actionLog.test.ts app/tests/storage.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
git add app/src/components/ActionLog.tsx app/src/components/actionlog.css app/src/game/actionLog.ts app/src/screens/Match.tsx app/src/game/useMatch.ts app/src/storage.ts app/tests/actionLog.test.ts app/tests/storage.test.ts
git commit -m "feat(app): add optional resolved-action narrative"
```

---

### Task 9: Final migration, accessibility, performance, and documentation

**Files:**
- Modify: `app/PRODUCT.md`
- Modify: `DESIGN.md` (repo ROOT — `app/DESIGN.md` does not exist and never did)
- Modify: `.impeccable/design.json` (the `DESIGN.md` sidecar; both move together when responsive card geometry and the flat Legendary foil revise current canon)
- Modify: `docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md`
- Test: `app/tests/armorialMigration.test.ts`
- Test: `core/tests/pool-balance.test.ts`

**Interfaces:**
- Produces: documented Reflect rules, stat-mark legend, responsive geometry, stable token reserve, flat Legendary foil treatment, readiness/hover behavior, renderer/fallback contract, and final proof checklist.

- [ ] **Step 1: Add whole-tree guards.** Assert no emoji stat glyphs, fixed board-slot placeholders, missing creature Reflect, Reflect on non-creatures, remote combat assets, non-Legendary foil selector, gradient, or forbidden shadow/glow recipe enters the tree.

- [ ] **Step 1a: Add do-not-regress guards from the comparison.**
  - Re-measure before editing, then require at least the current five reduced-motion modules and explicit reduced-motion coverage for every animation added by this plan.
  - Re-measure before editing, then require at least the current 69 `aria-` occurrences in `app/src`; record the exact baseline commit and command in the test.
  - Keep `cardTextWell.test.ts` and `armorialMigration.test.ts` gradient/shadow bans green without a foil whitelist.
  - No match surface may be hidden behind an `xl:`-equivalent breakpoint or unsupported below 1280×900.
  - Attack readiness uses cream geometry plus an accessible name, never a glow or `--or`.

- [ ] **Step 2: Audit accessibility.** Keyboard targeting order matches DOM order; all stat marks have names; color is redundant with shape; combat and hover-preview duplicates are pointer-inert/`aria-hidden`; reduced motion is complete; no live region repeats each animation frame.

- [ ] **Step 3: Audit performance and cleanup without play-testing.** Use automated mount/unmount, fake-timer, queue-skip, portal, and listener-lifecycle tests plus one bounded synthetic replay profile. Confirm no orphan animation frame, timeout, resize listener, portal, or transient layer remains. Do not run repeated live combats, rematches, navigation loops, or bot matches; the user owns longer manual play-testing.

- [ ] **Step 4: Update product and design documentation.** Explain Attack versus Reflect, simultaneous rules versus staged presentation, SVG marks and color tokens, responsive hand scale, centered formations, the fixed-height token reserve with visually hidden empty content, flat Legendary foil timing, hover preview, readiness marker, optional-action-log disposition, and renderer fallback.

- [ ] **Step 5: Run the mechanical UI detector exactly once after all UI edits.** Use the project Impeccable detector path that exists in the execution checkout. Fix valid findings manually; do not rerun the detector after reviewer fixes unless the then-current Impeccable instructions explicitly require it.

- [ ] **Step 6: Run complete verification.**

```bash
npm run build
npm test
npx tsc --noEmit -p app/tsconfig.json
git diff --check
```

Exclude only checksum-pinned upstream license bytes from whitespace checks if such a file is unchanged by this plan.

- [ ] **Step 7: Perform at most two fresh finish-review rounds.** Review engine determinism, all 146 authored values (140 curated + 6 token), Forge migration, card legibility, Epic/Legendary full-art retention, dynamic 1/2/7 formations, Legendary loop/rest behavior, staged combat clarity, reduced motion, fallback, and offline LAN behavior. Stop after two rounds and report remaining subjective issues honestly.

- [ ] **Step 8: Commit documentation and guards.**

```bash
git add app/PRODUCT.md DESIGN.md .impeccable/design.json app/tests/armorialMigration.test.ts core/tests/pool-balance.test.ts docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md
git commit -m "docs: define Reflect and dynamic combat language"
```

## Self-Review

- **Spec coverage:** Reflect semantics, transitional and final authoring, custom migration, compact stats, stable responsive geometry, fixed-height token reserve, flat Legendary foil, renderer decision, staged combat, readiness, hover preview, optional narrative, reduced motion, fallback, determinism, and offline LAN constraints each map to a task.
- **Authoritative dependency order:** Task 0 → Task 1 → Identity Gate → Task 2 → Task 3 → Task 4 → Task 5A → 5B → 5C → Task 6 → Task 7 → Task 8A → 8B → optional 8C → Task 9. No later paragraph overrides this sequence.
- **Type consistency:** `Card.reflect`, `CreatureState.reflect`, `EffectSpec.value3`, `Card.schemaVersion`, `ForgeDraft.reflect`, `StatKind`, `CombatRenderer`, `readyCreatureIds`, `CardHoverPreview`, `LogEntry`, and `combatStarted` each have one meaning. `Card.version` remains the existing revision/timestamp field.
- **Task boundaries:** 5A/5B/5C and 8A/8B/8C each have independent files, RED command, implementation, browser gate, verification, and commit. Optional 8C is skipped cleanly when not approved.
- **Material consistency:** no task permits gradients, glows, depth shadows, bevels, or faux metal. Legendary uniqueness comes from a clipped moving solid band and existing or hairline.
- **Geometry proof:** tiers cover the full supported height range: 900px uses `0.66` (`237.68 < 243`), 1000px uses `0.74` (`265.52 < 270`), 1080px and taller use `0.80` (`286.4 < 291.6`, then `< 300` after the row caps). Boundary tests cover 983/984 and 1060/1061. Browser verification remains required because arithmetic does not prove typography or control clearance.
- **Identity separation:** this plan does not duplicate card redesign. The Identity Gate points to the rough spec, requires a separate approved implementation plan, and blocks Task 2 until roles are stable.
- **Placeholder scan:** renderer selection, identity approval, optional action log, and any further board restyle are explicit decision gates with stop conditions; no worker is instructed to improvise them.

## Execution Handoff

Do not begin implementation until the user reviews and approves this corrected plan. When approved:

1. Re-read paths and interfaces against the then-current source and re-measure the Task 9 ARIA/reduced-motion baselines.
2. Record whether the source-derived zero-shot findings are accepted as mechanical evidence or replace them with correctly captured side-by-side evidence; never cite the existing mislabeled screenshot set.
3. Execute Task 0 and obtain the renderer decision before production combat work.
4. Execute Task 1, then stop at the Identity Gate. Approve and separately plan the house-identity pilot before Task 2.
5. Use subagent-driven development with a fresh implementation agent and fresh reviewer per task, honoring the user's current model and effort requirements.
6. Preserve the untracked `core/tests/__def.test.ts` scratch file and other pre-existing untracked artifacts unless the user separately authorizes cleanup.
