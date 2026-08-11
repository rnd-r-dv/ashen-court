# Three-House Identity Pilot — Play-test Protocol (final gate)

**Date:** 2026-08-10
**Status:** CLOSED — accepted by the user's completed external play-test and explicit direction to proceed. See `docs/superpowers/plans/2026-08-10-three-house-identity-pilot.md`.

## Purpose

Prove the three pilot houses feel distinct and fill their approved
five-element contracts. Structural and engine tests establish legality; only
human play establishes identity. Each house needs a SEPARATE user verdict,
and the pilot is accepted only when all three approve.

## Setup (exactly this, every match)

- App, bot mode, Grandmaster difficulty (Mode Select -> Grandmaster).
- Human always pilots the pilot house (player 0).
- Curated sig decks only — no custom cards, no custom decks.
- The app picks a fresh random curated bot deck whenever `buildMatchEntry` runs (`app/src/game/matchSetup.ts:59-68`). To reach the matrix-specified opponent, return to Mode Select and start a new match; do **not** rely on Rematch to reroll a persisted setup. Hero -> house: Pyra Emberveil -> Ember, Baron Von Bone -> Bone, Rat King Moulder -> Vermin.
- The seed is not exposed in the UI. Record it when captured from the driver
  (devtools session state), else record "not exposed". Each matrix slot is
  one match at one seed; each new match entry uses a fresh seed.

## Match matrix (12 matches)

| Slot | Pilot (human) | Opponent (bot) | What this tests |
| --- | --- | --- | --- |
| E1 | Ember | Bone | reach vs midrange board |
| E2 | Ember | Vermin | burn vs token width |
| E3 | Ember | Grave Pact | distinct from burn + draw |
| E4 | Ember | Eternal Vigil | no-heal weakness under pressure |
| B1 | Bone | Ember | rebuild vs reach |
| B2 | Bone | Vermin | the two summon houses separate |
| B3 | Bone | Hollow Choir | removal vs recursion |
| B4 | Bone | Dragonflight | midrange mirror |
| V1 | Vermin | Ember | token width vs burn |
| V2 | Vermin | Bone | the two summon houses separate |
| V3 | Vermin | Stormwrought | sweeper vulnerability |
| V4 | Vermin | Night Coven | width vs buffs |

## Record per match (exact template)

- Slot, observed opponent hero, seed (or "not exposed"), W/L/Draw, turns,
  both heroes' final HP.
- Toll ledger — for every toll card SEEN, note price paid / declined and the
  outcome:
  - Ember (Ash = overload): Blast, Cauterize, Pyroblast, Conflagration —
    which turns were overload-locked, and whether that cost a play.
  - Vermin (Fodder = consume): Nibble, Frenzy, Swarmlord, Alpha Rat — tokens
    generated before the play, tokens consumed, and the payoff delivered.
  - Bone (no toll): Legion Call — which friendly creature was sacrificed and
    what its deathrattle added; note when the spell was unplayable (no
    friendly creature) and whether that mattered.
- Board evidence: Ember — overload-locked turns; Bone — which deaths spawned
  skeletons and whether the board visibly rebuilt; Vermin — the
  generate-then-consume cycle in sequence.
- One-line feel note per match.

## Success/failure questions (answer after each house's block of 4)

### Ember

1. Did overload create real sequencing decisions (you skipped a play to avoid
   a locked turn, or regretted a locked turn)? FAIL if "no" in 3+ matches.
2. Did the deck run out of gas / fail to recover from behind? FAIL if it
   never felt starved.
3. Was direct reach to the enemy hero decisive at least once?
4. Did it feel distinct from Grave Pact's burn + draw?

### Bone

1. Did the board visibly rebuild itself after ordinary creature deaths?
2. With a lost board, was there genuinely no route to the enemy hero?
3. Did the midrange curve feel right (not a rush deck, not a control deck)?
4. Did it feel distinct from Vermin?

### Vermin

1. Did generate-then-consume feel like a loop, not an accident?
2. Were toll decisions (spend fodder vs keep width) real choices?
3. Did sweepers punish the wide board?
4. Did it feel distinct from Bone?

## Verdict

Per house, record APPROVE or REJECT with a one-line reason. The pilot is
accepted only when all three houses are played and separately approved. STOP
after the verdicts — the nine-house expansion is a separate design and
approval, not part of this pilot.

---

# User play-test attestation (CLOSED)

On 2026-08-10, the user stated that they had already completed the play-test and directed the implementation to proceed without an agent-run 12-match matrix.

The agent-run browser attempt was stopped immediately. Its partial E1 state is discarded and is not presented as play-test evidence. No missing matrix result, seed, turn count, HP value, toll ledger, or feel note is inferred or fabricated.

## Evidence scope

- Human play-test: completed independently by the user.
- Detailed matrix records: not supplied to this execution session.
- Agent-run matrix: explicitly waived by the user and not completed.
- Acceptance authority: the user's direct instruction to proceed to final Reflect authoring.

## Separate house verdicts

- **Ember — APPROVE:** the user completed the pilot play-test and explicitly authorized proceeding with Ember's approved damage-plus-Overload identity.
- **Bone — APPROVE:** the user completed the pilot play-test and explicitly authorized proceeding with Bone's approved deathrattle-recurrence identity.
- **Vermin — APPROVE:** the user completed the pilot play-test and explicitly authorized proceeding with Vermin's approved token-generation-and-Consume identity.

**Pilot acceptance status:** ACCEPTED (3/3 houses approved by explicit user direction).

STOP after this pilot gate. The remaining nine-house identity expansion remains separate and out of scope.
