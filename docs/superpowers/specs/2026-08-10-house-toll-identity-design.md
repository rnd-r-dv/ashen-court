# House Toll — Archetype Identity Design

**Date:** 2026-08-10
**Status:** **ROUGH DRAFT / CONCEPT. Not approved. Do not plan or implement from this.**
**Revised 2026-08-10 after review — see "Review outcome" below. The Toll is no longer the spine.**

Captured to preserve the reasoning and the measurements, not to authorise work. **The Problem section is the durable part** — it is counted from the tree and holds regardless of which solution wins. Everything after it is a candidate answer that has not been play-tested or costed.

Review found two breaking defects, both verified and both now folded in: `consume` cannot serve as a price (so Bone Toll does not exist), and five houses paying no toll is an absence rather than a design. The Toll survives as *one technique* inside a five-element identity contract.

**Blocking before this can become a plan:** the (a)/(b) decision on whether a narrow engine change is permitted to make tolls actually payable, and bone-horde's resource relationship, which depends on it.

**Origin:** Extracted from Task 10 of `docs/superpowers/plans/2026-08-09-reflect-dynamic-combat.md`, which was too large and too under-specified to execute in place. **Task 10 stays where it is for now** — do not delete it on the strength of this draft.

## Problem

The 12 archetypes do not feel distinct in play. This is measurable, not a matter of taste. Counted from `core/src/data/*.ts` at `0a42748`:

**Twelve houses collapse into roughly five identities.**

| Symptom | Evidence |
|---|---|
| Two houses are the same deck | `vermin-swarm` and `bone-horde` are both summon:13 |
| Four houses are "burn + draw" at different scales | `grave-pact` dmg:19/draw:11, `stormwrought` dmg:11/draw:3, `shadow-dancers` dmg:9/draw:9, `starforged` dmg:7 |
| One house has one verb | `ember-court` is dmg:15 and almost nothing else |
| One house has no identity | `elder-roots` is 2 summon / 2 draw / 2 dmg / 1 heal / 1 buff |
| Two houses overlap a third | `dragonflight` shares buff with `night-coven` and summon with `bone-horde` |

**The engine's vocabulary is unused.** Of 19 `EffectKind`s the pool leans on five — damage ~78 uses, summon ~35, draw ~32, buff ~28, heal ~21. `consume`, `copyCard`, `silence`, `discountMostExpensive` and `discountNextSpell` are used **once each**. `overload` is implemented, dispatched at `core/src/engine/effects.ts:269`, and used on **zero cards**.

**The decks are strategically flat too.** All 12 hero powers cost exactly 2. Average card cost clusters 4.1–5.4 across every house. The only real variation is the creature/spell ratio (`dragonflight` 14/6, `night-coven` 7/13).

**Consequence.** Cards are single-clause: an effect attached to a stat line, with no decision in playing them. Three `ember-court` commons — `ember-cinderling`, `ember-sparkmage`, `ember-igniter` — all resolve to *deal 1 damage*, differing only in which trigger wraps them.

## Review outcome, 2026-08-10 — the Toll is demoted

A review of this draft found two things that break it as written. Both verified against the tree.

**1. Bone Toll is not a payable cost.** `consume` (`core/src/engine/effects.ts:188-196`) filters `p.board.filter(c => c.token)` — **tokens only**, oldest first, no player choice — and if the player has no tokens the loop simply does nothing. The payoff is a sibling effect in the same array, so it resolves regardless. A `[consume, payoff]` card **hands out the payoff without charging the price**. That contradicts both the "price-and-payoff" premise and the "no engine change" premise, since making it a real toll requires either a legality gate or a conditional effect — an engine change.

**2. Five houses paying no toll is not an identity system.** "Pays nothing" can distinguish *one* deliberately fair house. It cannot distinguish five. The draft asserted those houses would be defined by what they are denied, then never defined the denials.

**Consequence: the Toll is demoted from spine to technique.** It is a good technique — it produces two-clause cards in tension, which is the property the pool lacks — but "every house has a Toll" was a forced universal law derived from a sample of one card.

### The replacement spine: a house identity contract

Each house declares five things. A house is complete when all five are filled and no two houses match on more than two.

| # | Element | Notes |
|---|---|---|
| 1 | **Signature verbs** | What this house does that others do rarely or not at all |
| 2 | **Resource relationship** | What it spends, hoards, or converts. **A Toll goes here when one fits** — it is one option, not a requirement |
| 3 | **Payoff** | What the house is building toward |
| 4 | **Explicit weakness** | What it is denied. Mandatory. A house with no stated weakness is not designed |
| 5 | **Curve and hero-power role** | Where it wants the game to end, expressed in mana |

Element 4 is the one the draft skipped and the one that does the work — it is what makes "pays nothing" a design rather than an absence.

## The Toll (one technique, not the spine)

**A house that has a Toll pays one recurring price for its power.**

This is not imported from another game. It already exists here, on exactly one card: `grave-pact`'s hero power is `[dmg(1, 'self'), draw(1)]` — **Blood Toll**. Pay 1 life, draw a card (`core/src/data/grave-pact.ts:17`). It is the only price-and-payoff card in the pool. The system below is that card, generalised.

A card that charges a toll is a **two-clause card in tension**: the player chooses whether the payoff is worth the price. That is the property the pool currently lacks, and it is what makes a card a decision rather than a number.

### The four tolls

All four are expressible with existing `EffectKind`s. **No new effect kind, no new `GameState` field, no engine change.**

| Toll | Mechanic | Pays with | Status |
|---|---|---|---|
| **Ash** | `overload(n)` | Next turn's mana | **Usable.** `effects.ts:269`, zero cards today. Charged unconditionally at resolution — a real price. |
| **Blood** | `dmg(n, 'self')` | Life | **Usable.** `effects.ts:322`, live on Blood Toll. Charged unconditionally — a real price. |
| **Breath** | `returnToHand` on a friendly | Board position and tempo | **Usable but weak as a price.** Fizzles when the player has no friendly creature; same class of hole as Bone, smaller. Needs a legality gate to be a true toll. |
| **Bone** | `consume` | ~~Your own creature~~ | **NOT USABLE AS A TOLL.** Tokens only, oldest first, no player choice, silently pays nothing when the player has no tokens, and does not gate the payoff. See the review outcome above. |

So there are **two** dependable tolls, not four. Any design assuming four is wrong.

**Required decision before this draft goes further.** Either:

- **(a)** permit a narrow engine change — a legality gate so a card charging a toll is unplayable unless the toll can be paid, or a conditional effect that withholds the payoff when it is not. This is small and contained but it ends the "data-only, zero engine change" property that made this draft cheap and determinism-safe; or
- **(b)** drop `consume` as a toll and design Bone's identity from semantics that already guarantee payment.

**(b) is the cheaper answer and is preferred** unless a play-test shows a gated toll is worth the engine risk. Note that `consume` remains perfectly good as a *payoff* or a *trigger* — the finding is only that it cannot serve as a price.

### Houses without a Toll

**A house with no Toll is not thereby an identity.** It must still fill all five elements of the contract, and its **explicit weakness** (element 4) is what distinguishes it. `eternal-vigil` endures rather than spends — but "endures" is only a design once it is paired with a stated denial, such as no reach to the enemy hero.

### Uniqueness rule

Four tolls cannot give twelve houses a private one. The rule is therefore:

> **The (toll, payoff) pair is unique. The toll alone need not be.**

Two houses may both pay Blood if one buys draw with it and the other buys buffs. `grave-pact` paying Blood for cards and `night-coven` paying Blood for enhancement are different decks that happen to share a currency — which is a *relationship* between houses, not a collision.

## Scope

### Pilot — three houses, definitive

The three worst offenders, chosen because the toll separates them cleanly:

Each pilot house must fill **all five contract elements**, not just a toll. Weakness is mandatory.

| House | Signature verbs | Resource relationship | Payoff | **Weakness (mandatory)** | Curve / power |
|---|---|---|---|---|---|
| **ember-court** | direct damage, reach | **Ash toll** — `overload` | Burst the hero down | No heal, no card draw — runs out of gas if the game goes long | Cheap curve, cheap power |
| **bone-horde** | summon from *deaths*, deathrattle | **Toll TBD — Bone is unusable**, see review outcome. Candidate: Blood | Recursion; the board rebuilds itself | No reach to the enemy hero; must win on board | Midrange |
| **vermin-swarm** | summon from *cards*, wide boards | No toll | Overwhelm by count | Each unit is worthless alone — collapses to a single sweeper | Cheap curve |

`bone-horde` and `vermin-swarm` are both summon:13 today. The distinction is **fuel**, not price: one summons from creatures that died, the other from cards in hand. That separation survives the Bone toll's removal, which is why the pilot pair is still the right choice.

**Open:** bone-horde's resource relationship is unresolved pending the (a)/(b) decision above. Do not start the pilot until it is settled — it is half of that house's identity.

### Provisional — the other nine

**Superseded in shape by the review.** The table below assigns tolls only, which is now one of five contract elements — and it lists Bone, which does not work. It is kept as a record of the first sketch, not as a target. When these nine are reached, each needs all five elements filled, weakness included.

Assignments below are **provisional and deliberately not fixed**. They are recorded so the pilot can be judged against a full picture, not so a worker can author against them.

| House | Provisional toll | Provisional payoff |
|---|---|---|
| grave-pact | Blood | Draw (already true) |
| night-coven | Blood | Buff / enhance |
| shadow-dancers | Breath | Re-trigger battlecries, evasion |
| stormwrought | Breath | Spell chaining, disruption |
| dragonflight | Ash | Large bodies |
| starforged | None | Spell payoff, discover, discounts |
| hollow-choir | None | Removal — destroy, freeze, silence |
| eternal-vigil | None | Defence — heal, taunt, ward |
| elder-roots | None | Ramp; pays in time, not resources |

Five houses provisionally pay no toll. If the pilot shows that reads as "five bland houses," the remedy is a fifth toll or a denial list — decided then, not now.

### Out of scope

- **Tribes.** Deferred until after the pilot by explicit decision.
- **Conditional gates** (Shadowverse-style state thresholds). Rejected: each would need new `GameState`, serialize/deserialize support and dispatch cases, which is direct risk to determinism and LAN replay.
- **Any new `EffectKind`.** The vocabulary is already 19 wide and used five deep.
- **Any engine change at all.** This is a data-only spec.

## Changes permitted

Approved: **rewrite effects, and adjust stats and costs where the ability demands it** — not wholesale.

- **Card IDs are immutable.** All 278 non-token IDs stay. Art is seeded from `hashId(card.id)`, so a rename repaints the card.
- Names, art and flavour stay unless the redesigned card contradicts them.
- Costs and stats move only where a toll changes what the card is worth.
- **Hero power and curve are in scope, but cost is not the point.** Review correctly noted that twelve powers costing 2 is not by itself evidence they *should* vary — a distinct *effect* differentiates a house more than a distinct price does, and Hearthstone runs nine classes at 2 mana successfully. Change a power's **effect** to match the house's contract; change its **cost** only where the effect genuinely warrants it. The flat-cost observation is a symptom worth noticing, not a defect to fix directly.

## Testing

`app/` is not type-checked in CI and card design is not provable by unit test. The tests below prove the *structural* claims only; the identity claim is proven by play.

1. **No duplicate-verb commons within a house.** No two commons in one archetype reduce to the same `(kind, value, target)` triple under different triggers. This fails today on `ember-cinderling` / `ember-sparkmage` / `ember-igniter`.

   **Caveat raised on review, and it is fair.** Trigger context is sometimes strategically meaningful — a battlecry that deals 1 and a deathrattle that deals 1 are genuinely different cards to play around. A blanket ban risks outlawing useful repetition. Treat this as a **review prompt, not a hard gate**: it should fail loudly and be waived per-case with a recorded reason, rather than forcing a redesign every time it trips. The three Ember commons it catches today are a real defect; the mechanism that catches them is blunter than the defect.
2. **Toll coverage.** Each piloted house that has a toll charges it on **at least 4 cards**, spread across at least two rarities so the toll is not a legendary-only curiosity. Four is the floor at which a toll is a deck's habit rather than a single card; it is deliberately low for a pilot and should be re-judged from play, not raised speculatively.
3. **Toll exclusivity is per-house, not per-toll.** A house charges its own assigned toll and no *other* toll. Two houses sharing a toll is permitted by design — the uniqueness rule binds the (toll, payoff) pair. `vermin-swarm` charges no toll at all, and that assertion must be written as "charges none", not skipped.
4. **`overload` is used.** Currently zero; a pilot that leaves it at zero has not done the work.
5. **Budget integrity — necessary, not sufficient.** Every redesigned card passes `validate.ts`, and the ceiling is `statBudget(cost) + STAT_BUDGET_SLACK` where slack is 4 (`validate.ts:20,57`); the slack term must not be dropped.

   **But passing validation does not mean a two-clause card is balanced.** `validate.ts` prices *stats and keywords*. It does not price effect clauses at all, so a card with two strong clauses and modest stats passes cleanly while being far above rate. Do not cite a green `validate.ts` as evidence that this redesign is balanced — it is evidence only that the stat lines are legal. Clause balance is a play-test question and, for now, has no automated proxy.
6. **Decks still work.** All 12 deck suites, the bot heuristic suites, and `replay.test.ts` stay green.
7. **Play-test gate.** The pilot is not done until the three houses have been played. No assertion can close this.

## Sequencing

**Reversed on review, 2026-08-10.** This spec previously said the pilot must merge with Task 2 of `2026-08-09-reflect-dynamic-combat.md` into one pass, on the grounds that two passes over the same 12 files is wasteful. That was wrong, for a reason that outweighs the efficiency argument:

**Abilities determine a creature's role, and role determines its correct Reflect value.** Authoring Reflect first, or simultaneously, means authoring it against roles that are still moving. Worse, the pilot's only real gate is a play-test — and a play-test of two simultaneous changes **cannot tell you which one helped**. That confound is fatal to the one gate this work has.

Correct sequence:

1. Define and approve the three-house identity contract.
2. Implement and play-test the ability packages, with **transitional Reflect defaults** (`reflect = attack`, already specified as Task 1's transitional builder behavior).
3. Approve or reject the identity direction on that evidence alone.
4. Expand the accepted system to the remaining nine houses.
5. **Then** hand-author final Reflect values against card roles that have stopped moving.

Efficiency can still come from batching per house. The ability review and the Reflect review stay **separate approval gates**.

## Direction leanings from the brainstorm

Not commitments — where the conversation landed, recorded so a revisit does not restart from zero.

| Question | Leaning |
|---|---|
| Change scope | Rewrite effects and stats/costs where necessary |
| Tribes | Deferred until after the pilot |
| Identity basis | Strategic role first, verbs follow |
| Role reach | Verbs + hero power + curve |
| Mechanism complexity | Keep it simple — no conditional gates, no engine change |
| Uniqueness | Native, not novel — built from Ashen Court's own parts |
| Spine | The Toll, generalised from the existing Blood Toll card |

## Rejected, and why

- **Conditional gates for all 12 houses** (Shadowverse model). Strongest identity available, but twelve new pieces of tracked state against a deterministic engine whose replay and LAN mirroring depend on exact serialization.
- **Role grid + denial lists** (Hearthstone roles + MTG color pie). Rejected in review as re-deriving roles the houses already have, in borrowed vocabulary.
- **Reflect as the identity axis.** Rejected on a false premise: counter-damage is standard across Hearthstone, MTG and Yu-Gi-Oh. Only the *decoupling* of counter-damage from Attack is uncommon, which is too thin to carry a whole system.
