# Handoff: review the revised combat plan and the house-toll draft

## Assignment

**Review two documents. Do not implement anything.** Neither is approved for execution and one is explicitly a rough draft. Report findings; propose changes; do not make them without asking.

State: `main` at **`712ee09`**, two commits ahead of `origin/main`. **Nothing is pushed.** If you are working from a clone rather than this machine, fetch first or you will review stale files.

## What to review

### 1. `docs/superpowers/plans/2026-08-09-reflect-dynamic-combat.md` — 972 lines, Tasks 0–10

The deferred Reflect / dynamic-formations / combat-theatre plan, heavily revised on 2026-08-10. Its prerequisite (`2026-08-08-discover-armorial-mainthread.md`) is complete and merged at `15b43b0`, so the blocking condition in its Status line is satisfied. **User approval to execute is not.**

### 2. `docs/superpowers/specs/2026-08-10-house-toll-identity-design.md` — 149 lines

**ROUGH DRAFT. Not approved.** One candidate answer to the archetype-identity problem, from a single brainstorm. Unplayed, uncosted, unreviewed.

## Read these before forming an opinion

- The plan's **Zero-Shot Comparison Findings** section (10 findings) and **Findings from play** (7 more, rounds 1 and 2).
- The plan's **Code-grounded verification pass** — records what was checked against the tree and the three defects that were found and fixed.
- The spec's **Rejected, and why** table. Three alternatives were considered and dropped with reasons. Re-proposing one without engaging that table is the most likely way to waste a review.

## Ground truth you should not re-derive

These were counted from the tree at `0a42748`, not asserted. They are the durable part of both documents and hold regardless of which solution wins:

- 12 archetypes collapse into ~5 identities. `vermin-swarm` and `bone-horde` are **both summon:13**.
- Of 19 `EffectKind`s the pool leans on five. `overload` is implemented, dispatched at `core/src/engine/effects.ts:269`, and used on **zero cards**.
- All 12 hero powers cost exactly **2**. Average card cost clusters 4.1–5.4 across every house.
- The pool is **140 curated creatures + 6 token creatures**, and **278 immutable non-token IDs** (140 creature + 124 spell + 14 artifact).
- `grave-pact`'s hero power `[dmg(1,'self'), draw(1)]` at `core/src/data/grave-pact.ts:17` is the **only** price-and-payoff card in the pool.

## Evidence warning — this bit matters

`.impeccable/critique/evidence/zero-shot-comparison/` **does not contain what the earlier handoff claims.** Verified 2026-08-10:

- `assessment-b/` and `vision/` are **empty**.
- `assessment-a/` holds 10 PNGs and **all 10 are the current Ashen Court build**, including the five prefixed `zs-`. Two are misnamed on top of that (`cur-match-turn1.png` is the menu; `cur-menu.png` is a Discover overlay).
- Consequently **no perceptual claim in `2026-08-09-zero-shot-visual-plan-handoff.md` is evidence-backed**, including its "5px hand text" and "7px clipping" measurements.
- The zero-shot findings in the plan were derived by **reading its source** at `/Users/lucas/Downloads/tcgtest/build-ashen-court-game (1)` (React 19 + Tailwind 4 + peerjs, 3,257 lines of UI, 262-line `index.css`, zero test files). Source analysis establishes mechanism, not feel. Every such finding cites a file and line; check a few.

Do not cite that evidence directory as support for anything. If you want perceptual claims verified, regenerate screenshots of both builds yourself.

## Specific things worth your scrutiny

1. **Decision 11 is marked contested and that is unresolved.** The approved decision says the empty token band collapses; a collapsing band is the direct cause of the whole-board shift the user reported on token spawn (`board.css:167-173`, conditional render at `Board.tsx:407`). Three options with costs are written out in finding 16. **This needs a user decision before Task 5 Step 6 is implemented**, and Task 5 Step 1 is explicitly instructed *not* to write the "empty band absent from DOM" assertion until it is settled.

2. **Task 5 is overloaded.** It now carries slot removal, formation centering, token bands, the combat lane, the layout-shift fix, the hand-row geometry fix, and the hand-region treatment. The stated seam is geometry (Steps 4–7b, testable) versus treatment (7c–7d, subjective). Judge whether that split is right.

3. **Decision 14 changes a long-standing invariant.** The card box is no longer 240×336; it scales at a fixed 5:7 ratio with a floor. This **deliberately breaks** `app/tests/cardTextWell.test.ts:66-67`, which is the single sanctioned exception to the rule that an edit tripping that file is wrong. Check that Task 5 Step 7b Sub-step 3 re-expresses the assertion rather than deleting it, and that Sub-step 4's list of baked-in `240`/`120` literals is complete.

4. **The scale factor comes from JS.** Pure-CSS continuous `zoom` is not expressible (`zoom` takes a number; `clamp()` cannot mix `vh` with a unitless value). If you know a pure-CSS route that preserves the box-and-type-together property `card.css:76-78` depends on, say so — it would remove a moving part.

5. **Task 10 versus the spec.** Task 10 opens with a superseded banner pointing at the draft. It is deliberately **not deleted** — the draft is unapproved, so Task 10 remains the only scheduled home for the work. Confirm that arrangement still makes sense to you, or propose a better one.

6. **Five of twelve houses provisionally pay no toll** in the draft. This is called out in the spec as its weakest point. It may read as five bland houses. No remedy is chosen — deliberately.

7. **Sequencing collision.** The draft's pilot must merge with the plan's Task 2, which hand-authors Reflect across the same 12 archetype files. Separate passes mean two rounds over every card and two rounds of deck re-testing; a merged pass means one much larger review per archetype. Not resolved.

## Constraints on any change you propose

- **Card IDs are immutable.** Art is seeded from `hashId(card.id)`; a rename repaints the card.
- **`app/` is not type-checked in CI.** `vite build` strips types without checking. Invariants need runtime tests.
- Reduced-motion coverage (5 modules) and ARIA count (65 attributes) may only go up, measured at `15b43b0`.
- `card.css` stays free of `gradient(`, `box-shadow`, `text-shadow`, `drop-shadow` — enforced by `cardTextWell.test.ts`.
- Responsive floor is 1280×900. Nothing becomes `xl`-only.
- No new `EffectKind`, no new `GameState` field in the draft's scope — determinism and LAN replay depend on exact serialization.

## Baseline

`npm test` was **586 tests / 80 files green** at `1e56fe7`. Re-measure at `712ee09` before trusting it; several commits have landed since.

## Workspace caution

Untracked artifacts belong to other tooling: `.codex/`, `.pi/`, `.impeccable/critique/`, `graphify-out/`, and `core/tests/__def.test.ts` (scratch, contains `console.log`). **Do not delete or commit them.** There are also ~40 stale `task/*` and `pi-agent-*` branches; leave them alone.

## Deliverable

A written review of both documents. No code, no doc edits without asking. Where you disagree, say what you would change and why — and for the seven items above, an explicit position rather than silence.
