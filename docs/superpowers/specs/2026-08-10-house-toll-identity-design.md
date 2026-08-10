# House Toll — Archetype Identity Design

**Date:** 2026-08-10
**Status:** **ROUGH DRAFT / CONCEPT. Not approved. Do not plan or implement from this.**

Captured to preserve the reasoning and the measurements, not to authorise work. The problem section is grounded in counts taken from the tree and is reliable on its own; the Toll system is one candidate answer that came out of a single brainstorm and has not been play-tested, costed, or reviewed. Treat the house assignments as sketches.

Revisit needs: a decision on whether the Toll is the right spine at all, the five-houses-pay-nothing weakness called out below, and the sequencing collision with Reflect authoring.

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

## The Toll

**Each house pays one recurring price for its power.**

This is not imported from another game. It already exists here, on exactly one card: `grave-pact`'s hero power is `[dmg(1, 'self'), draw(1)]` — **Blood Toll**. Pay 1 life, draw a card (`core/src/data/grave-pact.ts:17`). It is the only price-and-payoff card in the pool. The system below is that card, generalised.

A card that charges a toll is a **two-clause card in tension**: the player chooses whether the payoff is worth the price. That is the property the pool currently lacks, and it is what makes a card a decision rather than a number.

### The four tolls

All four are expressible with existing `EffectKind`s. **No new effect kind, no new `GameState` field, no engine change.**

| Toll | Mechanic | Pays with | Verified |
|---|---|---|---|
| **Ash** | `overload(n)` | Next turn's mana | `effects.ts:269` — zero cards today |
| **Blood** | `dmg(n, 'self')` | Life | `effects.ts:322` — live on Blood Toll |
| **Bone** | `consume` | Your own creature | `effects.ts:188` — one card today |
| **Breath** | `returnToHand` on a friendly | Board position and tempo | live, three cards |

### Houses that pay nothing

**Paying no toll is itself an identity.** A house with no price is the fair, honest one — its power is bounded rather than conditional. `eternal-vigil` endures; it does not spend. These houses are distinguished by what they are **denied** instead.

### Uniqueness rule

Four tolls cannot give twelve houses a private one. The rule is therefore:

> **The (toll, payoff) pair is unique. The toll alone need not be.**

Two houses may both pay Blood if one buys draw with it and the other buys buffs. `grave-pact` paying Blood for cards and `night-coven` paying Blood for enhancement are different decks that happen to share a currency — which is a *relationship* between houses, not a collision.

## Scope

### Pilot — three houses, definitive

The three worst offenders, chosen because the toll separates them cleanly:

| House | Toll | Payoff | Why this house |
|---|---|---|---|
| **ember-court** | **Ash** | Damage and reach | Worst single-verb case (dmg:15, nothing else). Burning now and mortgaging next turn is the whole fantasy, and it puts `overload` on a card for the first time. |
| **bone-horde** | **Bone** | Recursion — summon from deaths | Half of the duplicate pair. It eats its own dead to keep swarming. |
| **vermin-swarm** | **None** | Pure width | The other half. It pays nothing and summons from *cards*; each rat is worthless alone. The absence of a toll is what distinguishes it from `bone-horde`. |

`bone-horde` and `vermin-swarm` are both summon:13 today. After the pilot they summon from different fuel, and only one pays for it.

### Provisional — the other nine

Assignments below are **provisional and deliberately not fixed**. They are recorded so the pilot can be judged against a full picture, not so a worker can author against them. They are revisited only after the pilot plays.

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
- **Hero power and curve are in scope.** Role drives all three: an aggressive house gets a cheaper power and curve, a slow one the reverse. All twelve powers costing 2 is the flattest lever in the game.

## Testing

`app/` is not type-checked in CI and card design is not provable by unit test. The tests below prove the *structural* claims only; the identity claim is proven by play.

1. **No duplicate-verb commons within a house.** No two commons in one archetype reduce to the same `(kind, value, target)` triple under different triggers. This fails today on `ember-cinderling` / `ember-sparkmage` / `ember-igniter`.
2. **Toll coverage.** Each piloted house that has a toll charges it on **at least 4 cards**, spread across at least two rarities so the toll is not a legendary-only curiosity. Four is the floor at which a toll is a deck's habit rather than a single card; it is deliberately low for a pilot and should be re-judged from play, not raised speculatively.
3. **Toll exclusivity is per-house, not per-toll.** A house charges its own assigned toll and no *other* toll. Two houses sharing a toll is permitted by design — the uniqueness rule binds the (toll, payoff) pair. `vermin-swarm` charges no toll at all, and that assertion must be written as "charges none", not skipped.
4. **`overload` is used.** Currently zero; a pilot that leaves it at zero has not done the work.
5. **Budget integrity.** Every redesigned card passes `validate.ts`. Note that the ceiling is `statBudget(cost) + STAT_BUDGET_SLACK` where slack is 4 (`validate.ts:20,57`) — a toll is a drawback and should be priced as one, but the slack term must not be dropped.
6. **Decks still work.** All 12 deck suites, the bot heuristic suites, and `replay.test.ts` stay green.
7. **Play-test gate.** The pilot is not done until the three houses have been played. No assertion can close this.

## Sequencing

This spec **must merge with Task 2** of `2026-08-09-reflect-dynamic-combat.md`, which hand-authors a Reflect value for all 146 creatures (140 curated + 6 token) across the same 12 archetype files.

Running them separately means two passes over every card in the pool and two rounds of deck re-testing. Running them together means one larger review per archetype. **One pass is correct** — a card's toll and its Attack/Reflect split are the same design decision, and authoring them apart guarantees rework.

Consequence: the pilot for this spec should be executed as part of Reflect authoring for those three houses, not before it.

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
