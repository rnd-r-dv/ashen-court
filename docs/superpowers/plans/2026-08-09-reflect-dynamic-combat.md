# Reflect, Dynamic Formations, and Combat Theatre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Deferred, prerequisite now met. `docs/superpowers/plans/2026-08-08-discover-armorial-mainthread.md` is complete and merged (`15b43b0 docs(app): finish and document the Armorial`), so the blocking condition below is satisfied. This plan is still **not approved for execution** — revisit it with the user first, and read the Zero-Shot Comparison Findings section before starting any task, because several of its amendments change acceptance criteria rather than adding steps.

**Revision 2026-08-10:** amended from the zero-shot comparison assignment in `docs/superpowers/handoffs/2026-08-09-zero-shot-visual-plan-handoff.md`. Added the findings section, added Task 8 (attack-readiness and action narrative), renumbered the old Task 8 to Task 9, and added acceptance criteria to Tasks 0, 4, and 6. **The screenshot evidence that assignment cites is unusable — see the evidence status subsection before treating any perceptual claim as verified.**

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
- Normal creatures and tokens remain separate centered bands. ~~An empty token band collapses.~~ **Contested as of 2026-08-10 — see finding 16.** A collapsing band is the direct cause of the reported whole-board shift on token spawn. Decision 11 predates that observation and must be reconfirmed or replaced before Task 5 Step 6 is implemented.
- Legendary foil may use an animated gradient overlay as a deliberate exception to the flat-frame rule. It must not restore glow, bevel, faux metal, or depth shadow recipes.
- All motion honors `prefers-reduced-motion`; reduced motion removes lunges, shake, particles, and looping foil while preserving state clarity.
- Any WebGL implementation must be optional, locally bundled, unavailable-WebGL safe, and free of CDN/runtime network dependencies for offline LAN play.
- Desktop/laptop support floor remains 1280×900; verify at both 1280×900 and 1440×900.
- Do not modify or execute this plan until the current Discover/Armorial plan is complete and the user explicitly approves revisiting it. The first half of that condition is met as of `15b43b0`; the user's approval is not.
- The do-not-regress criteria in the Zero-Shot Comparison Findings section apply to every task in this plan and are verified in Task 9. In short: reduced-motion coverage and ARIA count may only go up, the banned shadow/glow/gradient recipes stay banned, the 1280×900 floor stays fixed, and no surface becomes `xl`-only. The card box is **no longer** among the fixed things — see Decision 14; what stays fixed there is the 5:7 ratio and the fact that all card types share one size.

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
11. Normal and token formations remain separate. **The collapse-when-empty half of this decision is contested as of 2026-08-10** — it causes the whole-board shift the user reported on token spawn. See finding 16; reconfirm or replace before Task 5 Step 6.
12. Legendary cards regain a looping foil motion with a visible resting interval.
13. Rendering choice is made through a CSS-only versus hybrid-WebGL comparison spike before production combat work.
14. **The card's 5:7 ratio is invariant; its absolute dimensions are not.** Approved 2026-08-10. The box scales with the viewport at a fixed ratio and a readable floor instead of being pinned at 240×336, and `--card-h` is derived from `--card-w` and `--card-ratio` rather than typed as a second literal. This supersedes the "invariant 240×336 box" as previously written — the invariant that actually mattered was *every card type is the same size as every other*, and that is preserved. Implemented in Task 5 Step 7b; the floors in Task 4 Step 7a are re-expressed against it.

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

1. **A positive "this creature can attack now" marker.** Zero-shot `.attack-ready` (`src/index.css:161`) puts a ring on every creature whose attack is available. This project marks only the *negative* — `.cardview--exhausted` grayscales creatures that have already acted (`app/src/components/cardview.css:22`). Absence of grey is a much weaker signal than presence of a ring, and at board `zoom: 0.5` it is weaker still. **This is the single largest genuine gap.** Routed into new Task 8.

2. **A persistent action narrative.** Zero-shot renders `state.log.slice(-70)` in a toggleable rail (`src/ui/Match.tsx:640-642`, `Hide Log`/`Show Log` at 606). `app/src/screens/Match.tsx` contains **no log surface at all** — grep for `log` returns nothing. A player who looks away during an animation currently has no way to recover what happened. Routed into new Task 8.

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
- **Accessibility and reduced motion** are worse in the zero-shot than the handoff conveys, and this is worth stating as a hard number: `grep -rn "prefers-reduced-motion" src/` returns **0**, and `grep -rn "aria-" src/ui/` returns **0**. Two of its animations (`.valid-target` pulse, `.ember-particle`) are `infinite` with no escape. This project currently carries 65 ARIA attributes across `app/src` and honors reduced motion in five modules. **Nothing borrowed from the zero-shot may regress either number.**

### Findings from play (user report, 2026-08-10) — higher authority than anything above

The user played both builds and reported the four differences that actually made the zero-shot feel better. These supersede the source-derived guesses where they conflict: they are perceptual evidence from the person the game is for, gathered by playing, which is exactly what the broken screenshot set failed to provide. Each is grounded below in the code that causes it.

11. **Card ability design — archetypes feel more defined, abilities more fun.** This is the largest finding in the entire comparison and **no task in this plan addresses it.** The mechanical difference is legible in the data. Zero-shot cards routinely carry *two clauses in tension*: `em_brand` is `[buff(2,0,'friendlyCreature'), grant('charge','friendlyCreature')]`; `em_scorch` is `[dmg(3,'any'), overload(1)]`; `em_sacrifice` is `[dmg(2,'friendlyCreature'), draw(1)]` — damage your *own* creature to draw; `ch_silence` is `[silence('enemyCreature'), draw(1)]`; `ch_frostbind` is `[dmg(1,'enemyCreature'), freeze('enemyCreature')]`; `em_meteor` is `[dmg(5,'allEnemyCreatures'), dmg(3,'enemyHero')]` (all `src/engine/cards/setA.ts`, `setB.ts`). Ours are overwhelmingly single-clause: `core/src/data/ember-court.ts` has 10 multi-effect cards, and three separate commons — `Cinderling` (deathrattle), `Sparkmage` (battlecry), `Igniter` (battlecry) — all resolve to *deal 1 damage*, differing only in the trigger that wraps them. An archetype built from one verb at different numbers reads as one card printed eleven times. Additionally the zero-shot has a **tribe axis** (`elemental`, `demon`, `beast`, `spirit`, `dragon`) that ours lacks entirely — `grep -rn "tribe" core/src/` returns nothing, and our only gesture at it is the orphan `friendlyDragon` target. Routed into new Task 10.

12. **Layout shift at end of turn. — MISDIAGNOSED; CORRECTED ON REVIEW 2026-08-10.**

    **The actual cause: the app moves the board on purpose, every single turn.** `app/src/screens/Match.tsx:651-656` handles `turnStart` by removing `match-shift`, forcing a reflow, and re-adding it. `app/src/screens/animations.css:28-41` defines `match-page-shift`, which translates the whole `.match-boardwrap` to `translateY(7px)` at 45% and back. The comment calls it "the board registers shift like a page being laid." That is the reported symptom, exactly, on the reported cadence.

    **What was wrong with the original diagnosis, recorded so the mistake is not repeated.** The user reported the movement accurately but attributed it to *"new objects spawning which causes it to scroll"* — a guess. That guess was accepted and a plausible CSS argument was built on top of it (`html, body, #root` carry `min-height: 100%` with no `overflow` rule at `app/src/index.css:13-19`). Nobody grepped for an existing turn-start animation. `.match` already has `height: 100vh; overflow: hidden` (`match.css:3-11`), so document growth was never demonstrated — only asserted. The proposed one-line `body { overflow: hidden }` fix would have shipped, changed nothing the user could see, and left the real cause running.

    **There are up to three independent sources of movement here and they must be measured separately, not merged:**
    1. **The deliberate turn-start shift** — `match-page-shift`. Confirmed, and almost certainly the whole of what the user is reporting.
    2. **Document scrollbar toggling** — plausible but **unproven**. Do not fix it until it is observed.
    3. **Token-band reflow on spawn** — genuinely independent and confirmed (`Board.tsx:407` conditional, `board.css:167-173`). This is finding 16 and it stands.

    Routed into Task 5 Step 7a, rewritten accordingly.

13. **Hover shows card stats.** Zero-shot `.hand-card:hover` is `translateY(-26px) scale(1.09)` (`src/index.css:152-155`) — hovering makes the card bigger, so it is simply readable. Ours lifts `translateY(-12px)` with **no scale** (`card.css:410-412`), and board cards lift only 5px (`card.css:415-417`) while `.card--board .card__body { display: none }` hides their rules text entirely at `zoom: 0.5`. Reading a board creature therefore costs an explicit action to open the `InspectPanel` modal (`Match.tsx:116`). The zero-shot asks for a hover; we ask for a click and a modal. Routed into Task 8.

14. **Board UI reads cleaner and less thrown-together.** Shares a root cause with finding 12 and with the fixed empty slots that **Task 5 already removes**. Treat Task 5 as the primary remedy and re-evaluate this finding after Task 5 and finding 12's fix land, before adding any further visual change on account of it. Do not open speculative restyle work against a subjective complaint whose two known mechanical causes are already scheduled.

### Findings from play, round 2 (user report, 2026-08-10) — board and hand

15. **Hand cards overflow their row and cover the board.** Arithmetic, not taste. A hand card is the full fixed box — `--card-w: 240px`, `--card-h: 336px`, and `.card--hand { zoom: 1 }` (`card.css:24-25,80`). The row that holds them is `.match-handwrap { min-height: clamp(190px, 27vh, 300px) }` (`match.css:54`), capped at **300px**. At the 1280×900 floor, 27vh is 243px — **a 336px card in a 243px row, overflowing 93px upward over the board**, and 105px while hovered (`.card--hand:hover` lifts 12px, `card.css:410`). Under `max-height: 760px` the row drops to `clamp(150px, 24vh, 190px)` while the card only scales to `zoom: 0.88` ≈ 296px, so the overflow *grows* to ~106px. The existing code already knows: `match.css:63-66` sets `pointer-events: none` on the wrapper so "board controls (End Turn, mana tray) stay clickable even when the board briefly underlaps the hand area." That is a workaround for the symptom — clicks pass through — and it does nothing about the cards visually covering the board, which is what the user is reporting. **The hand row has never been large enough to contain its cards.** Routed into Task 5.

16. **Token spawn shifts the whole board — and an approved decision is the cause.** `.board-row--tokens` contributes `min-height: clamp(74px, 9vh, 104px)` plus `margin-top: 6px`, `padding-top: 6px`, and a `border-top` (`board.css:167-173`), so roughly 90–116px of layout appears the first time a token lands. This is **a second, independent cause from finding 12** — that one is a scrollbar toggling, this one is real content growth, and fixing `body { overflow: hidden }` will not touch it.

    **This directly contradicts Approved Decision 11 and the matching Global Constraint**, both of which require that "an empty token band collapses." A band that collapses when empty *must* shift the board when it fills. The two cannot both hold. This is a user decision, not something to resolve by implementation cleverness. The options:
    - **Reserve the band always** — no shift ever, at the cost of permanent empty space in a layout that is already too short for its hand cards (finding 15).
    - **Keep it collapsing but animate the growth** — the shift remains, it just stops being abrupt. Cheapest, least honest.
    - **Absorb the growth elsewhere** — reserve the token height inside the parent register so the band's appearance consumes slack rather than adding height. Only viable if finding 15's fix frees vertical room first.

    Routed into Task 5 with the decision left explicitly open.

17. **The hand area is a bland flat rectangle.** `.match-handwrap` is `background: var(--ground-rise)` (`match.css:60`) — a single flat `#1D1A15` (`theme.css:19`) bled edge to edge by `margin: 0 calc(var(--space-5) * -1)`, with no border, no rule, no corner treatment, no edge at all. It is also the *same* token used for every generic raised surface in the app — deck builder panels, victory screen, shell (`deckbuilder.css`, `victory.css`, `shell.css`). The player's hand, the most important region on the screen, is painted the same flat colour as a settings panel and given no boundary.

    The comment at `match.css:57-59` records that a gradient backdrop was deliberately removed here for the flat Armorial direction, so **the remedy is not to restore a gradient** — that recipe is banned world-wide and the flat direction is correct. The remedy is that flat does not mean shapeless: the region needs an *edge and an identity* — an engraved rule where it meets the battlefield, a distinct field value from generic panel chrome, and a defined boundary rather than a full-bleed fill. Routed into Task 5.

### Do-not-regress acceptance criteria (apply to every task below)

These are added to the existing Global Constraints and are verified in Task 9:

- No task may reduce the count of `prefers-reduced-motion` blocks in `app/src`, and every new animation ships its reduced-motion branch in the same commit.
- No task may remove an existing ARIA name, role, or state. New affordances that carry meaning by colour or ring alone must also carry an accessible name.
- No task may reintroduce `box-shadow`, `text-shadow`, `filter: drop-shadow`, or `gradient(` into `app/src/components/card.css`. `app/tests/cardTextWell.test.ts` enforces this today; keep it green rather than amending it.
- No task may add `line-clamp`, un-hide `.card--board .card__body`, or tint generated art. **The card box itself is now scalable (Decision 14)** — what may not be relaxed is the 5:7 ratio, the one-size-for-every-card-type invariant, and the readable floor on `--card-scale`. Task 5 Step 7b Sub-step 3 is the only sanctioned edit to `cardTextWell.test.ts`'s box assertions; every other failure of that file is still the edit's fault.
- Responsive floor stays 1280×900. Nothing may become `xl`-only.

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

Validation messages must name Attack, Reflect, Health, the weighted total, and the ceiling. `statBudget(cost)` remains `2 + 2 * cost` (`core/src/validate.ts:8`).

**The ceiling is not `statBudget()`.** `core/src/validate.ts:20` defines `STAT_BUDGET_SLACK = 4` and line 57 computes `const ceiling = budget + STAT_BUDGET_SLACK`, with a comment stating that the error message must quote `statBudget(cost) + STAT_BUDGET_SLACK`, "not" the bare budget. Changing how `spent` is computed must leave that slack term intact — dropping it silently tightens every card in the pool by 4 points and would reject cards that are legal today. If Reflect's arrival is judged to warrant a different slack, that is a deliberate balance change requiring the user's approval, not a side effect of rewriting the spend formula.

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
- Produces: explicit Reflect values for all **140 curated creatures plus the 6 token creatures (146 total)**, and explicit three-axis values for every curated buff.

**Counted from source 2026-08-10, because the earlier "146 curated" was ambiguous and would have failed the assertion it specifies.** `core/src/data/*.ts` holds 140 `creature(` calls — bone-horde 12, dragonflight 14, elder-roots 11, ember-court 13, eternal-vigil 11, grave-pact 9, hollow-choir 10, neutrals 12, night-coven 7, shadow-dancers 8, starforged 11, stormwrought 10, vermin-swarm 12 — and `tokens.ts`'s `TOKEN_CARDS` adds 6 more creatures (`token-rat`, `token-skeleton`, `token-wisp`, `token-dragon-whelp`, `token-treant`, `token-phoenixash`). A worker who filters `!card.token` gets **140, not 146**. Say which population every assertion means.

The Global Constraints' figure of 278 immutable non-token IDs is confirmed correct by the same count: 140 creatures + 124 spells + 14 artifacts. Adding the 6 tokens and `mana-surge` gives the ~285 total quoted in Task 10.

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

- [ ] **Step 7a: Floor the stat-mark size in *effective* px, not in a scalar.** Zero-shot comparison finding 10: that build derives every card string from an `em` scalar with no floor (`src/ui/CardView.tsx:214,219`), so its type collapses with the card and becomes unreadable at small sizes. Adding a third stat cell creates exactly that pressure here.

  **Decision 14 changes what "floor" means, so state it carefully.** The card box now scales, so a declared `font-size` in `card.css` is a *design-space* value that gets multiplied by `--card-scale` before it reaches a screen. A floor written as "13px in the stylesheet" therefore guarantees nothing. Express the floor as **rendered size after scale**, and put the guarantee where it can hold: on `--card-scale`'s own clamp, in Task 5 Step 7b. The stat-mark assertion then checks two things — that the declared size is on the type ramp, and that `declared × minimum scale` still clears the readable bar.

  Bars to clear, unchanged in intent: hand-card stat numerals stay legible at the smallest supported scale, and board minis compensate for their half-scale relationship the way `.card--board .card__stat-label` already does — `app/tests/cardTextWell.test.ts` holds that label at 16px declared today, and the stat-mark numerals must clear the same effective bar once both are multiplied by the scale factor.

  Never let the three-stat rail shrink type to fit; contract spacing first, as Task 5 Step 5 does for formations. If the rail cannot fit at the minimum scale, the minimum scale is wrong — raise it and let the hand hold fewer cards on screen.

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

### Task 5: Match and board geometry

> **SPLIT REQUIRED BEFORE EXECUTION (review, 2026-08-10).** This task accumulated eight deliverables across three different kinds of work and its declared file list was missing most of what its own steps touch. It must be executed as three separately reviewable tasks. The steps below are already grouped and labelled; a worker should take **one group at a time** and commit at the end of each, not run 4→10 as a single pass.
>
> | Split | Steps | Deliverable |
> |---|---|---|
> | **5A — Match geometry correctness** | 7a, 7a-2, 7b | Remove the deliberate turn shift, establish one card scale, contain the hand row. All testable geometry. |
> | **5B — Board formations** | 4, 5, 6, 7 | Remove empty slots, center occupants, settle token-band geometry, reserve the combat lane. |
> | **5C — Visual treatment** | 7c, 7d | Hand-region boundary, and the post-geometry re-evaluation of the "clunky board" complaint. Subjective; do last, after the user has seen 5A and 5B. |
>
> 5A must precede 5B — the reclaimed slot height from 5B is measured *against* a match that has stopped moving, and doing it in the other order means measuring a moving target.

**Files:**

*Task 5A — match geometry:*
- Modify: `app/src/screens/Match.tsx` (turn-shift class toggle, `turnStart` handler)
- Modify: `app/src/screens/animations.css` (`match-page-shift` keyframe)
- Modify: `app/src/screens/match.css` (hand row geometry, the `pointer-events` workaround)
- Modify: `app/src/components/card.css` (card box, ratio, scale tiers)
- Modify: `app/src/components/Hand.tsx` (**`handStep` duplicates the card.css zoom tiers — see Step 7b**)
- Modify: `app/src/index.css` **only if** Step 7a-2's measurement proves document overflow
- Test: `app/tests/cardTextWell.test.ts` (the sanctioned box-assertion rewrite)
- Test: `app/tests/handLayout.test.ts` (hardcodes `CARD_W = 240`)
- Create: `app/tests/matchGeometry.test.ts`

*Task 5B — board formations:*
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/board.css`
- Modify: `app/src/screens/Match.tsx` only if the combat-layer mount belongs above `Board`
- Test: `app/tests/boardSurface.test.ts`
- Test: `app/tests/board.test.ts`

*Task 5C — treatment:*
- Modify: `app/src/screens/match.css`
- Modify: `app/src/theme.css` (a hand-region token, if one is needed rather than borrowing `--ground-rise`)
- Test: `app/tests/armorialContract.test.ts`

*Consumers of the card box that go stale when it scales (Step 7b Sub-step 4):* `app/src/screens/deckbuilder.css`, `app/src/screens/animations.css`, `app/src/components/keywordchip.css`.

**Interfaces:**
- Produces: `BoardFormation({ creatures, kind })` or an equivalent focused internal component; stable `data-creature-id` anchors for combat measurement; one reserved `.board-combat-lane` effects mount.

- [ ] **Step 1: Write failing structure tests.** Assert `slotCount` and `.board-slot--empty` are absent, one normal creature renders once at the center of its band, two retain stable DOM order, seven fit one line at 1280px, and tokens render in a separate band. **Do not assert that an empty token band is absent from the DOM** until Step 6's contested decision is settled — that assertion encodes the behavior finding 16 identifies as the cause of the board shift, and writing it now would lock in the bug as a test.

- [ ] **Step 2: Write targeting regressions.** Prove targetable creatures, attacker selection, right-click inspection, empty-space cancel, and the whole-band summon/target affordance still work without fixed slot elements.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/board.test.ts
```

- [ ] **Step 4: Remove decorative capacity slots.** Delete `slotCount`, empty-span rendering, and `.board-slot--empty`. Do not change the engine's board-capacity checks.

- [ ] **Step 5: Center occupied formations.** Wrap each `AnimatePresence` sequence in a max-content flex formation centered with auto margins. Spacing contracts before card scale; seven normal cards must remain on one line at 1280×900. Do not reorder or overlap cards.

- [ ] **Step 6: Preserve separate token bands — but settle the collapse question first (user finding 16).** Normal and token arrays remain stable partitions, and token formations use the same centering rule at the existing subordinate scale.

  **The "renders only when non-empty" half of this step is now contested.** Approved Decision 11 requires the empty token band to collapse; the user reports that the whole board shifts when a token spawns, which is exactly what a collapsing band guarantees — roughly 90–116px appearing at once (`board.css:167-173`). Both cannot hold. Note that this is a *different* cause from finding 12's scrollbar and is not fixed by Step 7a.

  **Reviewer's position, 2026-08-10 — take option three: absorb the growth.** Reserve token capacity *inside* a fixed-height player register, and hide the empty token content visually rather than removing it from layout. **A token spawning must never add external track height.** This keeps the band visually collapsed when empty — which is what Decision 11 was actually after — while making the spawn cost zero layout movement.

  That reading reconciles Decision 11 with finding 16 rather than choosing between them, so no user decision is needed unless they disagree with it. Confirm, then implement; do not implement the naive `{tokens.length > 0 && …}` conditional that exists today (`Board.tsx:407`).

- [ ] **Step 7: Reserve the combat lane.** Keep an intentionally empty axis between opposing formations and expose one pointer-transparent effects layer above it. Do not place decorative ornaments in the lane. Continue exposing each card's `data-creature-id` for bounding-box snapshots.

- [ ] **Step 7a: Remove the deliberate turn-start board shift (user finding 12, corrected).** **This is the first thing to do in this task and the only confirmed cause.**

  `Match.tsx:651-656` re-triggers the `match-shift` class on every `turnStart`; `animations.css:28-41` translates `.match-boardwrap` 7px down and back. Write the failing regression first: drive a `turnStart` and assert the board wrapper does **not** receive a class that animates `transform` — a runtime DOM assertion, plus a stylesheet assertion that no `@keyframes` in `animations.css` translates the board wrapper. Then remove the animation and the class toggle that drives it.

  **This is deleting a deliberate feature, not fixing a bug**, so confirm with the user before removing rather than after. It was authored on purpose (Task 8, "the board registers shift like a page being laid") and someone liked it. The user's report is that it reads as the screen shifting every turn — which is what it is. If they want the beat kept, the alternative is to make it not move layout: animate something that is not the board's transform, or gate it behind `--anim-scale` at a value low enough to be subliminal.

- [ ] **Step 7a-2: Measure the other two candidate causes separately — do not fix on suspicion.** After 7a lands, re-observe. Two other movement sources were hypothesised and only one is confirmed:

  - **Document scrollbar toggling — UNPROVEN. Do not fix speculatively.** The theory was that `html, body, #root { min-height: 100% }` with no `overflow` rule (`index.css:13-19`) lets the document grow. But `.match` is `height: 100vh; overflow: hidden` (`match.css:3-11`), so nothing has been shown to overflow. Instrument first: log `document.body.scrollHeight` against `window.innerHeight` across a full match at 1280×900. **Only if it exceeds** should the guard be added — and then it is `overflow: hidden` plus a fix for whatever actually overflowed, never the guard alone, because hiding overflow silently clips content, the failure mode this project already rejected for card text.
  - **Token-band reflow on spawn — CONFIRMED and independent.** `Board.tsx:407` renders the band only when non-empty; `board.css:167-173` gives it ~90–116px. This is finding 16 and Step 6 owns it. `body { overflow: hidden }` would not have touched it.

- [ ] **Step 7b: Make the card box scalable at a fixed ratio (user decision, 2026-08-10).** This is the resolution of finding 15 and it replaces the either/or that stood here before. The user's decision: **the 5:7 ratio is invariant; the absolute dimensions are not.** The card stops being 240×336 and becomes "5:7 at whatever size this viewport affords," so the hand row can contain its cards at 1280×900 without the type collapsing at a floor.

  **Sub-step 1 — derive the height, stop typing it.** `card.css:24-25` declares `--card-w: 240px` and `--card-h: 336px` as two independent literals with the 5:7 relationship asserted only in a trailing comment. Ten lines below, the same file derives `--card-art-h` from a ratio and explains why: *"ONE decision expressed twice would drift, so the panel height is DERIVED from the ratio, never typed in."* Apply the file's own rule to its own card box:

```css
--card-w: 240px;                                    /* base, scaled below */
--card-ratio: 1.4;                                  /* 7/5 — invariant */
--card-h: calc(var(--card-w) * var(--card-ratio));
```

  After this the ratio cannot drift, because there is no second number to disagree with.

  **Sub-step 2 — centralise the scale into one `--card-scale`. Do NOT add a `ResizeObserver` by default.** Corrected on review, 2026-08-10; the earlier text here recommended driving `--card-scale` from JS, which would have made things worse.

  **The tiers are already duplicated in two places.** `card.css:79-100` declares four `zoom` tiers (1 / 0.88 / 0.76 / 0.66 at 1200 / 900 / 700px), and `app/src/components/Hand.tsx:142-144` **hardcodes the same four numbers again** in `handStep`, with its own `resize` listener at `:110-114` and a comment at `:136` admitting the mirror. Adding a JS-driven `--card-scale` would create a **third** scaling authority and a second resize path, risking first-paint movement as CSS and JS disagree for a frame.

  **Do this instead:** define `--card-scale` once in CSS, keep the existing breakpoint tiers as its values, and have both `card.css` and `handStep` read that single source. That removes the existing duplication rather than adding to it, needs no observer, and has no first-paint hazard. **Continuous scaling is not yet a requirement** — the user asked for dimensions that scale, not for them to scale smoothly during a drag-resize.

  **If continuous scaling is later shown to be required**, the plan must first name: which hook or component owns the observer, what the value is on first render before any measurement, how it is torn down, and how `handStep` receives the identical effective scale. Do not start that without those four answers.

  Keep `zoom` as the mechanism rather than refactoring card internals to `em`. Rationale, in order:
  - `zoom` already scales the box *and the type* together, which is the whole reason this file chose it (`card.css:76-78`); a fluid `--card-w` alone would leave 108 px literals and 11 `font-size` declarations at fixed size, breaking proportion at every scale.
  - The alternative — fluid `--card-w` plus converting those literals to `em` off a card-local `font-size` — is exactly the zero-shot's architecture, including the failure mode recorded as comparison finding 10: type derived from a scalar with **no floor**, unreadable at small sizes. A `clamp()` floor fixes that, but it is a 108-literal refactor of a file that shipped four commits ago.
  - `zoom` is already accounted for downstream: `KeywordChip.tsx:19-24` relies on `getBoundingClientRect` reporting post-zoom coordinates, and Task 7 Step 5 snapshots creature rects the same way. A different scaling mechanism would invalidate both.
  - Pure-CSS *continuous* `zoom` is not expressible — `zoom` takes a number and `clamp()` cannot mix `vh` with a unitless value. That is an argument against **continuous** scaling, not an argument for JS: discrete tiers in a single custom property are pure CSS and sufficient for the stated requirement.

  Keep `.card--board`'s `0.5` as a *relationship* (board minis are half a hand card), not as an absolute — it multiplies the scale rather than replacing it.

  **Sub-step 3 — update the test that this deliberately breaks.** `app/tests/cardTextWell.test.ts:66-67` asserts `--card-w: 240px` and `--card-h: 336px` as literals and **will fail**. This is the one sanctioned exception to the standing rule that a change tripping that file is wrong; the rule exists to stop flatten passes from quietly deleting guards, and this is a specified change to the guarded value itself. Do not delete the test — re-express its *intent*, which was never the number 240:
  - the ratio is derived from `--card-ratio`, not typed twice;
  - a floor exists, so the box cannot scale to unreadability;
  - the box is still invariant **across card types** — a creature with a stats row, a spell without one, and a long-flavor card are all the same size at the same scale. That was the original point and it survives unchanged.

  **Sub-step 4 — chase the baked-in halves of 240.** Several files hard-code the current box or a fraction of it, and each becomes wrong the moment it scales: `app/tests/handLayout.test.ts:12` (`CARD_W = 240`), `match.css:88` (`margin-right: -120px`, half a card), `deckbuilder.css:89` (tracks "sized to the rendered card (240px × 0.74)"), `animations.css:58-60` (240/240/−120), `keywordchip.css:77` (`max-width: 240px`). `board.css:197-198` (`120px`/`103px`) disappears with the empty slots in Step 4. Convert each to derive from `--card-w` or state explicitly why it is independent of it. **Grep for `240` and `120` across `app/src` before declaring this done** — a stale half-card is invisible until the scale moves.

  **Sub-step 5 — then verify the hand actually contains its cards.** The original failing assertion still applies: at every supported size, the hand row's height is at least the rendered card height plus its hover lift, and no hand card's bounding rect intersects the board register's. Because the card now scales, this is satisfiable at 1280×900 without stealing height from the board — which is what made findings 15 and 16 compete for the same pixels.

  **Do not resolve this by leaving the overflow and hiding the symptom.** `pointer-events: none` on the wrapper (`match.css:63-66`) makes the cards click-through; they still cover the board, which is the actual complaint. Removing that workaround once the geometry is right is part of this step, not a follow-up.

- [ ] **Step 7c: Give the hand region an edge (user finding 17).** It is currently a full-bleed rectangle of `--ground-rise`, the same flat token used for generic panels across the app. Keep it flat — the Armorial world has no gradients and Task 6's foil is the single deliberate exception — but give it a boundary: an engraved rule where the hand meets the battlefield, a field value distinct from generic panel chrome, and a defined edge instead of a bled fill. Verify against the shipped `card.css` bans: no gradient, box-shadow, text-shadow, or drop-shadow enters the match surface to achieve this. If the region needs its own token rather than borrowing `--ground-rise`, add it to `theme.css` rather than hard-coding a hex.

- [ ] **Step 7d: Re-evaluate user finding 14 before acting on it.** The "clunky, thrown-together" board complaint has two known mechanical causes already scheduled: the fixed empty slots removed in Step 4, and the layout shift fixed in Step 7a. Capture the board again once both have landed and ask the user whether the complaint survives. Do not open speculative restyle work against it beforehand.

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

**Do not retune this toward the zero-shot.** Comparison finding 6: that build's `shimmer` is 4.5s with rest across `0%–70%` (`src/index.css:143-146`). The keyframe above is 6s with roughly 72% at rest — the same idea, slightly calmer, and already correct. The zero-shot pairs its shimmer with `.rarity-legendary`'s gold `box-shadow` halo (`src/index.css:127-129`); that halo is the banned recipe, and the shimmer is only acceptable here *because* it arrives without it.

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

### Task 8: Announce attack-readiness, make cards readable, and (optionally) narrate actions

Added 2026-08-10 from the zero-shot comparison. This task exists because findings 1 and 2 of that section are the only two state-announcement mechanisms the zero-shot has that this project genuinely lacks; everything else in its affordance vocabulary is already shipped or deliberately rejected.

> **SPLIT REQUIRED BEFORE EXECUTION (review, 2026-08-10).** Three unrelated features were bundled here. Execute as three tasks, in this priority order:
>
> | Split | Steps | Priority |
> |---|---|---|
> | **8A — Attack-ready state** | 1, 5, 6 | High. Smallest change, fixes a real gap: the board marks only the negative (`cardview--exhausted`), never the positive. |
> | **8B — Card hover preview** | 8a | High. Directly answers user finding 13; reading a board creature currently costs a click and a modal. |
> | **8C — Action narrative** | 2, 4, 7 | **Optional, and lowest priority.** Re-confirm it is still wanted after 8A/8B and the Task 5 splits have been played. It is the largest of the three and the least connected to a reported complaint. |
>
> **8B's file list must add** `app/src/components/card.css` and `app/src/components/hand.css` — the preview changes hover treatment on both surfaces, and neither appears in the list below.
>
> **8B needs runtime tests it does not currently specify:** the open delay, portal cleanup on unmount, suppression during targeting, suppression while a modal owns the screen, focus behaviour, and the reduced-motion branch. jsdom cannot measure layout but it can assert every one of those.

**Files:**
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/cardview.css`
- Modify: `app/src/components/Board.tsx`
- Create: `app/src/components/ActionLog.tsx`
- Create: `app/src/components/actionlog.css`
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/game/useMatch.ts` only if the resolved event tree is not already retained for a log consumer
- Create: `app/tests/attackReady.test.ts`
- Create: `app/tests/actionLog.test.ts`
- Test: `app/tests/boardSurface.test.ts`
- Test: `app/tests/armorialContract.test.ts`

**Interfaces:**
- Consumes: live `CreatureState` including the Task 1 `reflect`, the existing `useAnimationQueue`, and the resolution tree already delivered to `onEvents` by both `MatchDriver` implementations.
- Produces: `CardViewProps.attackReady?: boolean`; `ActionLog({ entries, open, onToggle })`; `LogEntry { id: number; text: string }` derived from `GameEvent`, never hand-written at call sites.

- [ ] **Step 1: Write failing attack-ready tests.** Assert a friendly creature that may legally attack this turn renders `cardview--ready`; a summoning-sick creature, an already-acted creature, a frozen creature, and every enemy creature do not; the marker disappears the moment the creature attacks; and the marker is absent entirely during targeting so it cannot compete with `cardview--target`. Assert the state carries an accessible name, not colour alone.

- [ ] **Step 2: Write failing action-log tests.** Assert log text is derived from `GameEvent` through one pure function and that the component renders no string a call site passed in directly; that the newest entry is last and the view is scrolled to it; that the list is capped; that the toggle persists through `tcg.settings`; and that the region is `aria-live="polite"` and announces once per resolved event rather than once per animation frame.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run app/tests/attackReady.test.ts app/tests/actionLog.test.ts
```

- [ ] **Step 4: Derive log text from events, not from screens.** Put the mapping beside the engine's own generated-text convention: rules text is generated in `core/src/cardtext.ts`, so log text is generated the same way rather than authored per call site.

  **The `default` branch must NOT throw.** Corrected on review, 2026-08-10 — the earlier text here specified a throwing default "for the same reason `dispatch` throws," and that reasoning was wrong. `dispatch` throws because a missed event means a missed *state mutation*, which is a correctness bug that must surface loudly. A missed **log line** is cosmetic. Throwing there would crash a live match — over a caption. Return an empty entry, skip the line, and surface unknown events through a dev-only warning if anything at all.

- [ ] **Step 5: Implement the attack-ready marker in Armorial materials.** A flat engraved hairline in the existing ready/or register, matched to `.card--playable`'s treatment at `card.css:426-430`. **No glow, no halo, no drop-shadow** — the zero-shot's `.attack-ready` gold bloom is the anti-reference, not the target. The marker must survive board `zoom: 0.5`, so specify its geometry in px that remain visible when halved.

- [ ] **Step 6: Resolve marker precedence explicitly.** One creature can be simultaneously ready, selected, exhausted, frozen, and a valid target. Define and test the precedence order rather than letting CSS source order decide it. Targeting outranks readiness; selection outranks both.

- [ ] **Step 7: Implement the log surface.** A collapsible rail that does not consume board width at 1280×900 — the zero-shot's `xl`-only 220px column (`src/ui/Match.tsx:617`) is the anti-reference. Default state is the user's stored preference. The rail is scrollable, capped, and never steals focus mid-match.

- [ ] **Step 8: Add reduced-motion and accessibility branches.** The ready marker is static under `prefers-reduced-motion` — it may not pulse. The log's live region stays `polite` and is silenced entirely while a modal (Discover, mulligan) owns the screen.

- [ ] **Step 8a: Make hover read the card (user finding 13).** Reading a board creature currently costs a click and a modal: `.card--board .card__body` is `display: none` at `zoom: 0.5`, board hover lifts only 5px (`card.css:415-417`), and stats/keywords live behind `InspectPanel` (`Match.tsx:116`). The zero-shot asks only for a hover — `translateY(-26px) scale(1.09)` (`src/index.css:152-155`) — and the card becomes legible on its own.

  Add a hover preview that scales the card back to a readable size in place. Requirements, in this order of authority:
  - **Do not un-hide `.card--board .card__body`.** That rule exists because an 11px chip renders at 5.5px under the half zoom, and `app/tests/cardTextWell.test.ts` asserts it. The preview must present a *full-size* plate, not an unhidden miniature.
  - Hover is an addition to `InspectPanel`, not a replacement. Keyboard and touch users have no hover; the existing explicit-action path stays and keeps its ARIA.
  - The preview may not shift layout — it floats above the board, like `KeywordChip`'s portal, which already solves the identical clipped-fixed-size-parent problem (`KeywordChip.tsx:19-24`). Reuse that approach rather than inventing a second one.
  - Open on a short intent delay, not instantly, or sweeping the hand strobes previews.
  - Suppress it entirely during targeting, while a modal owns the screen, and under `prefers-reduced-motion` (where it appears without transition rather than not at all).
  - Hand cards get the scale their hover lift currently lacks; keep the lift modest so a hovered card does not cover the board it is about to be played onto.

- [ ] **Step 9: Browser-verify.** At 1280×900 and 1440×900, capture: a board where some friendly creatures are ready and others are exhausted; the same board mid-targeting showing readiness suppressed; a full seven-card formation with the log open; the log after a multi-event turn including a death and a Discover; and the hover preview over both a board creature and a hand card. Confirm the ready hairline is legible at board zoom and the preview never clips or covers the hand it was raised from.

- [ ] **Step 10: Run verification.**

```bash
npx vitest run app/tests/attackReady.test.ts app/tests/actionLog.test.ts app/tests/boardSurface.test.ts app/tests/armorialContract.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
npm test
```

- [ ] **Step 11: Commit.**

```bash
git add app/src/components app/src/screens app/tests
git commit -m "feat(app): announce attack-readiness and log resolved actions"
```

---

### Task 9: Final migration, accessibility, performance, and documentation

**Files:**
- Modify: `app/PRODUCT.md`
- Modify: `DESIGN.md` (repo ROOT — `app/DESIGN.md` does not exist and never did)
- Modify: `.impeccable/design.json` (the DESIGN.md sidecar; both must move together when the scalable card box and the Legendary foil exception revise current canon)
- Modify: `docs/superpowers/specs/2026-08-09-reflect-dynamic-combat-decision.md`
- Test: `app/tests/armorialMigration.test.ts`
- Test: `core/tests/pool-balance.test.ts`

**Interfaces:**
- Produces: documented Reflect rules, stat-mark legend, dynamic formation rules, Legendary foil exception, renderer/fallback contract, and final proof checklist.

- [ ] **Step 1: Add whole-tree guards.** Assert no emoji stat glyphs, no fixed board-slot placeholders, no missing creature Reflect, no Reflect on non-creatures, no remote combat assets, no non-Legendary foil selector, and no forbidden shadow/glow recipe introduced by this plan.

- [ ] **Step 1a: Add the do-not-regress guards from the zero-shot comparison.** These are counted assertions, not prose, because the criteria they enforce are stated as counts:
  - `prefers-reduced-motion` block count in `app/src` is greater than or equal to the pre-plan baseline (5 modules at `15b43b0`: `keywordchip.css`, `discover.css`, `Background.tsx`, `background.css`, `animations.ts`), and every animation this plan adds appears inside one.
  - Total `aria-` attribute count in `app/src` is greater than or equal to the pre-plan baseline (65 at `15b43b0`).
  - `app/src/components/card.css` still matches none of `box-shadow`, `text-shadow`, `drop-shadow`, `gradient(` outside comments — this is `app/tests/cardTextWell.test.ts`'s existing assertion; confirm it is still green rather than amending it.
  - No `xl:`-gated or otherwise breakpoint-gated match surface exists below 1280×900.
  - The new attack-ready marker matches no glow recipe and carries an accessible name.

  Record both baselines as literals in the test with a comment naming `15b43b0`, so a future regression is a failed assertion rather than a judgement call.

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

- [ ] **Step 7: Perform at most two fresh finish-review rounds.** Review engine determinism, all 146 authored values (140 curated + 6 token), Forge migration, card legibility, Epic/Legendary full-art retention, dynamic 1/2/7 formations, Legendary loop/rest behavior, staged combat clarity, reduced motion, fallback, and offline LAN behavior. Stop after two rounds and report remaining subjective issues honestly.

- [ ] **Step 8: Commit documentation and guards.**

```bash
git add app/PRODUCT.md DESIGN.md .impeccable/design.json app/tests core/tests docs/superpowers/specs
git commit -m "docs: define Reflect and dynamic combat language"
```

### Task 10: Give archetypes distinct ability identities

Added 2026-08-10 from user finding 11 — the difference the user named **first**, and the only one of the four that no existing task touches.

> ## ⚠ SUPERSEDED IN DRAFT — read this before doing anything with Task 10
>
> **A dedicated draft now exists: [`docs/superpowers/specs/2026-08-10-house-toll-identity-design.md`](../specs/2026-08-10-house-toll-identity-design.md).** Read it before touching this task. It carries a brainstorm's worth of measurement and rejected alternatives that are not repeated here.
>
> **Do not execute Task 10 as written below**, and do not delete it either. The draft is explicitly **not approved** — it is one candidate answer, unplayed and uncosted — so this task remains the only *scheduled* home for the work until the draft is either accepted or dropped.
>
> **What the draft settles.** The diagnosis is now measured, not asserted: 12 houses collapse into ~5 identities, `vermin-swarm` and `bone-horde` are both summon:13, the pool leans on 5 of 19 `EffectKind`s, `overload` is implemented and used on **zero** cards, and all 12 hero powers cost exactly 2. That diagnosis holds regardless of which solution wins, so **Step 1 below is largely already done** — do not re-derive it.
>
> **What the draft proposes.** The Toll: each house pays one recurring price for its power, generalised from `grave-pact`'s existing Blood Toll hero power (`core/data/grave-pact.ts:17`), the only price-and-payoff card in the pool. Data-only by construction — no new `EffectKind`, no new `GameState`, no engine change. Piloted on three houses before the other nine.
>
> **What the draft rejects, with reasons** — so they are not re-proposed: conditional gates for all 12 houses (twelve pieces of new tracked state against a deterministic engine whose LAN replay depends on exact serialization), a Hearthstone-style role grid with MTG-style denial lists (re-derives roles the houses already have, in borrowed vocabulary), and Reflect as the identity axis (rests on a false premise — counter-damage is standard across Hearthstone, MTG and Yu-Gi-Oh).
>
> **Open questions the draft does not answer**, and which block promoting it to a plan: whether the Toll is the right spine at all; that five of twelve houses provisionally pay no toll, which may read as five bland houses; and the sequencing collision below.
>
> **Sequencing REVERSED on review, 2026-08-10 — identity comes BEFORE Reflect authoring.** This previously said Task 10's natural slot is *after* Task 2, merged into one pass over the 12 files to avoid duplicated work. That was wrong. **Abilities determine a creature's role, and role determines its correct Reflect value** — authoring Reflect against roles that are still moving guarantees rework. Worse, the identity pilot's only real gate is a play-test, and a play-test of two simultaneous changes cannot tell you which one helped. That confound defeats the gate.
>
> Correct order: approve the identity contract → implement and play-test ability packages with **transitional Reflect defaults** (`reflect = attack`, already Task 1 Step 10's transitional builder behaviour) → approve or reject the direction → expand to the remaining nine houses → **then** Task 2 hand-authors final Reflect against stable roles. Batch per house for efficiency if you like; keep the ability review and the Reflect review as **separate approval gates**.
>
> **Scope warning, unchanged.** This task edits all 12 archetype files, `cardtext.ts`, `validate.ts`, and the balance of ~285 cards. It is *content design* — a different activity from the engine and layout work in Tasks 0–9 — and it belongs in its own plan. Once the identity direction is approved, create that plan and **reduce this task to a dependency pointer** rather than leaving a second copy of the work here.

**Files:**
- Create: `docs/superpowers/specs/2026-08-10-archetype-identity.md`
- Modify: all 12 files in `core/src/data/` plus `neutrals.ts` and `tokens.ts`
- Modify: `core/src/types.ts`, `core/src/cardtext.ts`, `core/src/validate.ts`, `core/src/index.ts`
- Modify: `app/src/forge/formState.ts` if a new effect kind or tribe reaches the Forge preset list
- Test: `core/tests/data.test.ts`, `core/tests/cardtext.test.ts`, `core/tests/validate.test.ts`, `core/tests/pool-balance.test.ts`, the four `decks-*.test.ts` files, `core/tests/bot/*`

**Interfaces:**
- Produces: `Card.tribe?: Tribe`; an archetype-identity spec naming each of the 12 archetypes' mechanical verb set; revised curated card data.
- Consumes: nothing from Tasks 0–9. This task is independent of Reflect and could execute first.

- [ ] **Step 1: Write the identity spec before touching data.** For each of the 12 archetypes, name in one paragraph: its two or three characteristic *verbs*, the tension it asks the player to accept, and what it is bad at. The failure this fixes is concrete and measurable — Ember Court currently spends three separate commons (`ember-cinderling`, `ember-sparkmage`, `ember-igniter`) on *deal 1 damage*, varying only the trigger. An archetype whose whole vocabulary is one verb at different numbers cannot feel distinct from another archetype that also deals damage. Review this spec with the user before any card edit; it is the auditable artifact, exactly as Task 2's ledger is.

- [ ] **Step 2: Write failing tests for the identity invariants.** Assert per archetype: at least N cards carry two or more effect clauses; the archetype's characteristic verbs appear on cards outside its rare/epic slots; and no two commons within an archetype reduce to the same `(kind, value, target)` triple under different triggers. That last one is the direct test for the Cinderling/Sparkmage/Igniter collision and it should fail today.

- [ ] **Step 3: Run RED verification.**

```bash
npx vitest run core/tests/data.test.ts core/tests/pool-balance.test.ts
```

- [ ] **Step 4: Design for tension, not for more text.** The zero-shot's fun comes from cards that make the player give something up: `[dmg(2,'friendlyCreature'), draw(1)]` damages your own board to draw; `[dmg(3,'any'), overload(1)]` mortgages next turn. **This project already owns most of that vocabulary and underuses it** — `overload` and `consume` are already `EffectKind`s (`core/src/types.ts:18`) and already handled in `effects.ts` and `cardtext.ts`. Prefer recombining the existing 19 kinds over adding new ones. Every new `EffectKind` costs an `effects.ts` case, a `cardtext.ts` case, and a Forge preset, and the `dispatch` default throws by design.

- [ ] **Step 5: Add the tribe axis.** Add `tribe?: Tribe` to `Card` with a small closed union, and give the existing tribal gestures something to stand on — `friendlyDragon` is currently an orphan `EffectTarget` with no tribe system behind it. Tribes are a *targeting and payoff* axis, so a tribe with no card that rewards it is decoration; each tribe introduced needs at least one payoff card. Generated rules text must name the tribe, so `cardtext.ts` changes with it.

- [ ] **Step 6: Reprice everything the new clauses touch.** `statBudget`/`KEYWORD_COST` in `validate.ts` price stats and keywords, not effect clauses. A second clause is real power and the ceiling has to see it, or two-clause design silently inflates the curve. If Task 2 has already landed, the weighted Attack/Reflect spend from its Step 7 is the formula to extend — do not fork a second budget model.

- [ ] **Step 7: Hold the immutable-ID line.** All 278 existing non-token card IDs stay exactly as they are; card art is seeded from `hashId(card.id)`, so renaming a card repaints it. Redesigning a card's *effects* under its existing ID is fine and expected. Introducing a genuinely new card means a genuinely new ID and new art.

- [ ] **Step 8: Re-verify decks, bot, and determinism.** Every one of the 12 decks must still be legal and still play out; the bot heuristic must not regress against cards whose value moved from stats into clauses; determinism snapshots change intentionally and are reviewed, not blanket-updated.

```bash
npm run build -w core
npm test -w core
npm test
```

- [ ] **Step 9: Play-test before declaring it done.** This finding came from playing, and it is the one finding in this plan that **no automated test can confirm**. The invariants in Step 2 prove the cards stopped being duplicates; they cannot prove the archetypes became fun. Return to the user for a play session against at least three redesigned archetypes before commit.

- [ ] **Step 10: Commit.**

```bash
git add core/src core/tests docs/superpowers/specs/2026-08-10-archetype-identity.md
git commit -m "feat(core): give archetypes distinct ability identities"
```

---

## Self-Review

- Spec coverage: approved Reflect semantics, hand-authored balance, independent buffs, Forge requirements, compact non-emoji stat marks, muted red/blue/green language, full-art preservation, dynamic centered normal/token bands, Legendary paused foil loop, CSS/WebGL comparison, staged simultaneous combat, reduced motion, fallback, determinism, and offline LAN constraints each map to a task.
- Placeholder scan: the renderer is deliberately selected by a tested user decision gate in Task 0 rather than left unspecified; subsequent tasks consume that recorded decision.
- Type consistency: `Card.reflect`, `CreatureState.reflect`, `EffectSpec.value3`, `ForgeDraft.reflect`, `StatKind`, `CombatRenderer`, `LogEntry`, and `combatStarted` have one stated meaning throughout.
- Dependency order: Task 0 chooses rendering; Task 1 creates the engine contract; Task 2 authors the pool; Task 3 migrates custom cards; Tasks 4–6 build independent visual surfaces; Task 7 consumes all prior interfaces; Task 8 adds state announcement and the action narrative; Task 9 verifies and documents.

### Revision self-review, 2026-08-10 (part 2: user play findings)

- **Coverage:** finding 11 creates Task 10. Finding 12 becomes Task 5 Steps 7a. Finding 13 becomes Task 8 Step 8a. Finding 14 becomes Task 5 Step 7b, deliberately as a re-evaluation rather than new work, because both of its known causes are already scheduled.
- **Priority conflict, stated not hidden:** the user named ability design (11) first, and it is the finding with the largest effect on whether the game is fun. This plan's headline feature is Reflect. Both hand-author values across the same 12 archetype files. **RESOLVED on review, 2026-08-10: identity first, Reflect second, as separate approval gates.** The efficiency argument for a single pass loses to a correctness one — abilities determine a creature's role, role determines its right Reflect value, and a play-test of both changes at once cannot attribute the improvement to either. See the External review pass above and Task 10's banner.
- ~~**Finding 12 is a bug and is cheap.** The guaranteed cause is one missing `overflow` rule at `app/src/index.css:13-19`…~~ **RETRACTED, 2026-08-10.** There was no guaranteed cause; there was an unverified hypothesis stated as a fact. The real cause is the deliberate `match-page-shift` animation. This bullet also recommended shipping the `overflow` rule immediately, ahead of plan approval — which would have shipped a fix for an unobserved problem and left the actual one running. See the External review pass above and the rewritten finding 12.
- **Finding 11 has no test that can close it.** Task 10 Step 2's invariants prove the duplicate-verb problem is gone; only play proves the archetypes became distinct. Step 9 makes that explicit rather than letting a green suite imply success.
- **Task numbering caveat:** Task 10 is numbered last but is independent of Tasks 0–9 and reads best right after Task 2. The numbers record insertion order, not execution order; execution order is the bullet above and the dependency line below.
- **Round-2 coverage:** finding 15 becomes Task 5 Step 7b, finding 16 amends Task 5 Step 6 and flags Decision 11, finding 17 becomes Task 5 Step 7c.
- **Task 5 is now split into 5A/5B/5C — see its banner.** (This bullet previously read "should probably be split.") The review made the split mandatory and corrected the seam: *match geometry correctness* (7a/7a-2/7b) is its own task and must run **ahead of** formations, because the height reclaimed by removing empty slots has to be measured against a match that has stopped moving. Treatment (7c/7d) goes last, after the user has seen the geometry land.
- **Findings 15 and 16 are no longer competing for the same pixels.** They were: finding 15's fix wanted vertical room for the hand, finding 16's "reserve the band always" option wanted it for the board, and the layout had neither. **Decision 14 dissolves that** — a card that scales can shrink to fit the room available instead of demanding a fixed 336px, so the token band can be reserved *and* the hand can contain its cards. Still measure after Step 4 and settle 16 before implementing, but the conflict is now a budget question rather than an either/or.
- **Decision 14 supersedes a constraint stated three times.** "The invariant 240×336 box" appears in Task 4 Step 7's invariants, in the Global Constraints, and in `card.css`'s own header comment. All three meant *cards do not disagree with each other in size*, which survives. None of them meant *240 specifically*, and the plan now says so once, in Decision 14, rather than leaving three literals to be reconciled during execution.
- **`cardTextWell.test.ts` gets broken on purpose, exactly once.** The standing rule for that file — an edit that trips it is wrong, not the test — exists to stop flatten passes from silently deleting guards. Task 5 Step 7b Sub-step 3 is a specified change to the guarded value itself, and it re-expresses the assertion rather than removing it. Any *other* failure of that file during this plan is still the edit's fault.
- ~~**The scale factor is one number and it comes from JS.**~~ **RETRACTED, 2026-08-10.** `Hand.tsx:142-144` already duplicates `card.css`'s zoom tiers and `:110-114` already carries a resize listener, so a JS-driven `--card-scale` would have been a *third* scaling authority. The scale is one number in **CSS**, read by both consumers; continuous scaling is not a stated requirement. Testability was the right instinct and survives — discrete tiers in a custom property are just as assertable, and `app/` still is not type-checked in CI.
- **One workaround gets removed, not preserved.** `pointer-events: none` on `.match-handwrap` exists to make overflowing hand cards click-through. Once Step 7b makes the row contain its cards, that rule is a leftover; leaving it in place would hide any future regression of the same bug.

### External review pass, 2026-08-10 — changes required, accepted

An independent review verified a baseline of 705 tests / 88 files at `b405cbf` (700/87 tracked, excluding the untracked scratch `core/tests/__def.test.ts`) and returned **changes required**. Both blocking findings were re-verified here and are correct. Every item below is now folded into the plan.

**Blocking, accepted:**

1. **The turn shift was misdiagnosed.** The real cause is `match-page-shift` — a deliberate 7px board translate re-triggered on every `turnStart` (`Match.tsx:651-656`, `animations.css:28-41`). The original diagnosis accepted the user's *guess* at a cause and built a CSS argument on it without grepping for an existing animation. The proposed `body { overflow: hidden }` fix would have shipped, changed nothing visible, and left the cause running. Finding 12 rewritten; Task 5 Steps 7a / 7a-2 replaced.
2. **Bone Toll is not a payable cost.** `consume` (`effects.ts:188-196`) takes tokens only, oldest-first, with no player choice, silently pays nothing when there are no tokens, and does not gate the payoff. Handled in the spec, which now demotes the Toll from spine to technique.

**Also accepted:**

3. **Task 5 split into 5A/5B/5C**, and its file list corrected — it was missing `index.css`, `match.css`, `card.css`, `Hand.tsx`, `theme.css`, and the hand/card tests that its own steps require.
4. **Task 8 split into 8A/8B/8C**, with the action log demoted to optional and re-confirmed after play.
5. **The action log must not throw** on an unknown `GameEvent`. The earlier reasoning-by-analogy to `dispatch` was wrong: a missed mutation is a correctness bug, a missed caption is cosmetic, and crashing a match over a caption is not a trade worth making.
6. **`app/DESIGN.md` does not exist.** Canon is root `DESIGN.md` with `.impeccable/design.json` as its sidecar. Both now named in Task 9's files and commit.
7. **The scale factor should not come from JS.** `Hand.tsx:142-144` already mirrors `card.css`'s four zoom tiers with its own resize listener at `:110-114` — so a JS `--card-scale` would have been a *third* scaling authority and a second resize path. Centralise the existing CSS tiers into one variable instead; continuous scaling is not a stated requirement.
8. **The per-archetype both-directions Reflect invariant is removed** — it forced every house to contain both an offensive and a defensive role, which is the homogenising pressure this work exists to undo.
9. **Sequencing reversed**: identity before final Reflect authoring, as separate approval gates, because a play-test of two simultaneous changes cannot attribute the improvement.
10. **Token band**: take "absorb the growth" — reserve capacity inside a fixed-height register and hide empty content visually. This reconciles Decision 11 with finding 16 instead of choosing between them.

**Review positions retained without change:** no twelve-state conditional gate system; no borrowed role grid; Reflect is not the identity spine; tribes stay deferred.

### Code-grounded verification pass, 2026-08-10

Every path, quoted symbol, and number in this plan was checked against the tree at `0a42748`.

**Verified correct:** all 18 referenced source files exist. `c.attack * 2 + c.health` is quoted exactly from `core/src/bot/heuristic.ts:8`. `statBudget(cost) = 2 + 2 * cost` is exact (`validate.ts:8`). `Card.version: number` already exists (`types.ts:35`), so Task 3's schema-version migration has a field to move. `EffectSpec.value2` exists and is consumed at `effects.ts:133`, so Task 1's `value3` sits beside a real precedent. `slotCount` (`Board.tsx:24`) and `.board-slot--empty` (`Board.tsx:404,432`, `board.css:196`) exist exactly as Task 5 Step 4 describes. The token band is conditional — `{foeTokens.length > 0 && (…)}` at `Board.tsx:407` — confirming finding 16's diagnosis. `combatStarted` is **already shipped** (`types.ts:120`, emitted `game.ts:254`, dispatched as log-only `game.ts:499`, consumed `Match.tsx:150`), so Task 7 Step 1's "reuse if present" branch is the live one and its "if absent" branch is dead. 278 immutable non-token IDs confirmed by count.

**Defects found and fixed in this pass:**
1. `core/tests/determinism.test.ts` **does not exist** — the file is `core/tests/replay.test.ts`. Task 2 Step 7's command would have failed on a fresh checkout. Corrected in both places.
2. "146 curated creatures" was wrong as written — 140 curated + 6 token. An assertion filtering `!card.token` would have failed. Corrected in three places with the per-archetype breakdown.
3. `STAT_BUDGET_SLACK = 4` was unmentioned. Task 1 Step 7 rewrites the spend formula and speaks of "the ceiling", but the real ceiling is `statBudget(cost) + STAT_BUDGET_SLACK` (`validate.ts:20,57`), and `validate.ts:17` explicitly says the error message must quote the slack-inclusive value. Dropping it would have tightened every card in the pool by 4 points. Called out in Step 7.

**Known-weak, not fixed:** Task 10 is the least specified task in this plan — a scope warning and ten steps, with no per-archetype verb assignment and no card list, because its Step 1 output *is* that specification. By this repo's own planning standard that makes it a placeholder, and it is the task addressing the user's first-named complaint. It should be split into its own plan and specced properly before execution rather than handed to a worker in this form.

### Revision self-review, 2026-08-10 (part 1: source comparison)

- **Zero-shot coverage:** each of the 10 numbered comparison findings routes somewhere. Borrow 1 and 2 create Task 8. Borrow 3 is already shipped and becomes a verification, not a build. Reinterpret 4 and 5 amend Task 0. Reinterpret 6 amends Task 6. Do-not-copy 7, 8, and 9 are already enforced by shipped tests and are recorded so a future agent does not "restore" them. Do-not-copy 10 amends Task 4 as Step 7a.
- **Borrow / reinterpret / do-not-copy is stated explicitly** as the handoff required, in three labelled subsections rather than inline.
- **Task 8 dependency:** it touches `CardView`/`Board`, which Tasks 4 and 5 also touch, so it must land after Task 5 to avoid re-resolving the same files. It does not depend on Task 7 and could run before it; the numbering reflects file-contention order, not a hard interface dependency. Stated here rather than left implied.
- **Known incomplete:** handoff requirement 1 (Luna visual verification with cited image paths) is **not met** and cannot be met from this harness with the evidence on disk. Requirements 2–7 are met. This is the one open item for the review this plan is being handed back for.
- **Baseline literals** used in Task 9 Step 1a — 5 reduced-motion modules, 65 ARIA attributes — were measured at `15b43b0` on 2026-08-10. Re-measure before executing if `main` has moved.

## Deferred Execution Handoff

Do not offer or begin execution now. Complete the existing Discover/Armorial main-thread plan first. When the user later asks to revisit this work:

1. Re-read this plan against the then-current source and update stale paths or interfaces.
2. Reconfirm that all approved decisions still stand.
3. Decide the open evidence question first: either regenerate real side-by-side screenshots of both builds and re-verify the perceptual claims, or accept the Zero-Shot Comparison Findings as source-derived-only and record that. Do not cite `.impeccable/critique/evidence/zero-shot-comparison/` as support for anything — its `assessment-a/` images are all the current build and its other two directories are empty.
4. Execute Task 0 and obtain the renderer decision before touching production combat code.
5. Use subagent-driven development with a fresh implementation agent and a fresh reviewer per task, honoring the user's then-current model and effort requirements.
