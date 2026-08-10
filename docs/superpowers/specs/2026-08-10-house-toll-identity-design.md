# House Identity Contract and Toll Technique — Design Draft

**Date:** 2026-08-10
**Status:** **ROUGH DRAFT / CONCEPT. Not approved. Do not implement from this document.**
**Revised 2026-08-10 after two reviews.** The Toll is one technique inside the broader identity contract, option (a1) is the narrow legality mechanism, and `consume` stays with `vermin-swarm`.

Captured to preserve the reasoning and measurements, not to authorise work. **The Problem section is durable**: it is counted from the tree and holds regardless of which solution wins. Everything after it remains a candidate answer until the three-house contract is explicitly approved and play-tested.

The reviews found three defects and this revision folds all three in: shipped `consume` silently underpays, five no-toll houses do not form an identity system, and assigning Consume to `bone-horde` contradicted the existing `vermin-swarmlord`. The chosen response is a pre-play affordability gate for immediate Consume costs, a five-element identity contract, and preservation of Consume as Vermin's resource relationship.

**Blocking before this becomes executable:** approve the three-house contract and convert it into its own test-first implementation plan. The engine semantics below are decided; the card packages, costs, and play-test protocol are not.

**Origin:** Extracted from the former Task 10 of `docs/superpowers/plans/2026-08-09-reflect-dynamic-combat.md`. That plan now carries only an ordering/dependency gate for this separate identity work; it must not duplicate or improvise the card redesign.

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

Review verified three defects against the tree.

**1. Consume is not currently a payable cost.** `consume` (`core/src/engine/effects.ts:188-196`) filters `p.board.filter(c => c.token)` — **tokens only**, oldest first, no player choice — and silently consumes fewer than requested when insufficient tokens exist. A sibling payoff still resolves. A `[consume, payoff]` card therefore needs the chosen pre-play affordability gate before Consume can function as a Toll.

**2. Five houses paying no toll is not an identity system.** "Pays nothing" can distinguish one deliberately fair house, not five. A Toll can support identity but cannot replace a complete strategic contract.

**3. Consume belongs to Vermin, not Bone.** The only shipped Consume card is `vermin-swarmlord`; moving the mechanic to `bone-horde` would discard the one existing identity signal while trying to make the two summon houses less alike.

**Consequence: the Toll is demoted from spine to technique.** It produces useful two-clause cards in tension, but it is one possible resource relationship rather than a universal law.

### The replacement spine: a house identity contract

Each house declares five things. Compare houses in a side-by-side matrix: no pair may share the same **signature verbs + resource relationship + payoff** combination, and each house must state a weakness that materially changes deck construction or play. This is a reviewable contract, not a numeric similarity score.

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

All four use existing `EffectKind`s — **no new effect kind, no new `GameState` field, no serialization change.** Only Consume needs the chosen (a1) affordability gate. Breath already uses the engine's ordinary choice-target legality.

| Toll | Mechanic | Pays with | Status |
|---|---|---|---|
| **Ash** | `overload(n)` | Next turn's mana | **Usable.** `effects.ts:269`, zero cards today. Charged unconditionally at resolution. |
| **Blood** | `dmg(n, 'self')` | Life | **Usable.** `effects.ts:323`, live on Blood Toll. Charged unconditionally. |
| **Breath** | choice-target `returnToHand` on a friendly | Board position and tempo | **Already gated.** `validateEffectTargets` rejects an absent/invalid friendly target and `targetVariants` omits the play when none exists. Do not add a second Toll-specific gate. |
| **Fodder** | `consume` | Friendly tokens | **Needs (a1).** Resolution remains tokens-only, oldest-first, but the card is illegal unless the full immediate cost exists before play. This Toll belongs to `vermin-swarm`. |

Before the gate: three dependable tolls. After it: four. The gate repairs Consume specifically; it must not become a generalized conditional-effects system.

### DECIDED 2026-08-10: option (a1), the legality gate

The user permitted a narrow engine change:

- **(a1) Legality gate — CHOSEN.** A card charging immediate Consume is unplayable unless the entire token cost can be paid from pre-play state.
- **(a2) Conditional effect — rejected.** A legal card whose payoff disappears reads as a bug and requires new conditional resolution semantics.
- **Drop Consume as a Toll — rejected.** It would remove Vermin's one shipped price-and-payoff signal rather than repair it.

**Why the gate is the mechanic.** Requiring fodder before a Consume card can be played forces the loop: generate tokens, then convert them. The gate creates deckbuilding and sequencing tension without adding state or changing resolution order.

#### Exact affordability contract

1. Toll scanning covers only effects that resolve immediately on play: `card.effects` plus effects from `when === 'battlecry'` trigger groups. Consume inside deathrattle, start/end-of-turn, or on-damage triggers is **not** a play cost and never gates the card.
2. `requiredConsumeTokens(card: Card): number` returns the sum of every immediate `consume` clause's `value ?? 1`.
3. `immediateConsumeAffordability(state: GameState, player: PlayerIndex, card: Card)` is the one shared pure helper. It returns `{ required, available, payable }`, where `available` is the pre-play count of `CreatureState.token === true` and `payable` is `available >= required`.
4. Tokens summoned earlier in the same effect list do not make an otherwise unaffordable play legal: affordability always reads state before the play intent resolves.
5. Toll content places all immediate Consume clauses before payoff clauses. Add a structural data test for this ordering; do not infer payment from post-resolution state.
6. Both `validatePlayCard` and the `playCard` branch of `legalIntents` call `immediateConsumeAffordability`. Validation reports `Need {required} friendly tokens to consume (have {available})`; enumeration uses the same `payable` value. Do not copy the predicate into two branches.
7. The initial identity work may not put Consume on hero powers. Hero powers have a separate validation/enumeration path; supporting that later requires an explicit extension and tests rather than silently bypassing the gate.

**No `GameState` field, serialization change, dispatch case, RNG call, or new `EffectKind` is permitted.** Replay and LAN determinism remain unchanged because the helper reads existing state only.

**Keep Consume tokens-only** (`effects.ts:190`). Consuming arbitrary creatures would require player choice and a much larger targeting design. Oldest-first token removal remains resolution behavior.

Consume remains valid as a later trigger or payoff. Only immediate play-time Consume clauses are treated as costs.

### DECIDED — Consume stays with Vermin

`vermin-swarmlord` already uses `[consume(2), buff(1, 1, 'allFriendlyCreatures')]` (`core/src/data/vermin-swarm.ts:32`), and that file already describes Consume as a price. Preserve that identity:

- `vermin-swarm` generates expendable token width, then spends tokens through the **Fodder Toll** for collective payoff.
- `bone-horde` profits from creatures dying and rebuilds through deathrattle/recursion. It does **not** receive Consume merely because both houses currently summon often.

This separates conversion from recurrence without moving an existing card between houses or renaming its permanent ID.

### Houses without a Toll

**A house with no Toll is not thereby an identity.** It must still fill all five elements of the contract, and its **explicit weakness** (element 4) is what distinguishes it. `eternal-vigil` endures rather than spends — but "endures" is only a design once it is paired with a stated denial, such as no reach to the enemy hero.

### Uniqueness rule

Four tolls cannot give twelve houses a private one. The rule is therefore:

> **The (toll, payoff) pair is unique. The toll alone need not be.**

Two houses may both pay Blood if one buys draw with it and the other buys buffs. `grave-pact` paying Blood for cards and `night-coven` paying Blood for enhancement are different decks that happen to share a currency — which is a *relationship* between houses, not a collision.

## Scope

### Pilot — three-house proposal

The three worst offenders are retained because they test three different resource relationships. The pilot is not definitive until its contract is approved and played.

Each pilot house must fill **all five contract elements**, not just a Toll. Weakness is mandatory.

| House | Signature verbs | Resource relationship | Payoff | **Weakness (mandatory)** | Curve / power |
|---|---|---|---|---|---|
| **ember-court** | Direct damage, reach | **Ash Toll** — `overload` | Burst the enemy hero | No healing or sustained draw; runs out of gas | Cheap curve, aggressive power |
| **bone-horde** | Deathrattle, rebuilding after deaths | Death as an engine signal; no Toll in the pilot | Recursion; the board rebuilds itself | No reach to the enemy hero; must win on board | Midrange |
| **vermin-swarm** | Token generation, wide-board conversion | **Fodder Toll** — immediate `consume`, gated by (a1) | Convert expendable tokens into swarm-wide pressure | Individual units are weak; vulnerable to sweepers | Cheap curve |

`bone-horde` and `vermin-swarm` are both summon:13 today. The pilot separates them by loop: Bone benefits when ordinary creatures die and recurs board presence; Vermin deliberately creates token fodder and spends it. The card redesign must make those loops mechanically true rather than relying on prose.

### Provisional — the other nine

The table below remains a sketch of one contract element only. It is **not** an implementation target. After the three-house pilot is accepted, each remaining house needs all five elements, a distinct weakness, and its own approval before card authoring.

| House | Provisional toll | Provisional payoff |
|---|---|---|
| grave-pact | Blood | Draw (already true) |
| night-coven | Blood | Buff / enhance |
| shadow-dancers | Breath | Re-trigger battlecries, evasion |
| stormwrought | Breath | Spell chaining, disruption |
| dragonflight | Ash | Large bodies |
| starforged | None | Spell payoff, Discover, discounts |
| hollow-choir | None | Removal — destroy, freeze, silence |
| eternal-vigil | None | Defence — heal, taunt, ward |
| elder-roots | None | Ramp; pays in time, not resources |

A house without a Toll is acceptable only when the other four contract elements make its decisions and weakness distinct. Do not invent a fifth Toll merely to fill the table.

### Out of scope

- **Tribes.** Deferred until after the pilot by explicit decision.
- **Broad conditional-threshold mechanics.** Rejected for this phase because they expand content and legality semantics beyond the one approved affordability repair.
- **Any new `EffectKind`.** The vocabulary is already 19 wide and used five deep.
- **Any engine change beyond (a1).** The shared immediate-Consume affordability helper may touch `validatePlayCard` and `legalIntents`; it may not add tracked state, serialization, dispatch, RNG, targeting, or conditional-resolution machinery.

## Changes permitted

Approved: **rewrite effects, and adjust stats and costs where the ability demands it** — not wholesale.

- **Card IDs are immutable.** All 278 non-token IDs stay. Art is seeded from `hashId(card.id)`, so a rename repaints the card.
- Names, art and flavour stay unless the redesigned card contradicts them.
- Costs and stats move only where a toll changes what the card is worth.
- **Hero power and curve are in scope, but cost is not the point.** Review correctly noted that twelve powers costing 2 is not by itself evidence they *should* vary — a distinct *effect* differentiates a house more than a distinct price does, and Hearthstone runs nine classes at 2 mana successfully. Change a power's **effect** to match the house's contract; change its **cost** only where the effect genuinely warrants it. The flat-cost observation is a symptom worth noticing, not a defect to fix directly.

## Testing

`app/` is not type-checked in CI and card design is not provable by unit test. Tests establish structural and engine claims; play establishes identity and balance.

1. **Duplicate-verb review report.** Detect duplicate `(kind, value, target)` commons within a house, but treat trigger context as meaningful. The report fails until every duplicate is either redesigned or explicitly waived with a recorded strategic reason.
2. **Toll coverage.** Each pilot house with a Toll charges it on at least four cards across at least two rarities. For this pilot that means Ash in Ember and Fodder/Consume in Vermin; Bone is not required to invent a Toll.
3. **Toll exclusivity is per house, not per mechanic.** Ember charges Ash and Vermin charges Fodder; Bone's pilot identity is death/recurrence without a Toll. Future houses may share a Toll only when their payoff differs.
4. **`overload` is used.** It appears on zero curated cards today; an Ember pilot that leaves it at zero has not implemented Ash.
5. **Budget integrity is necessary, not sufficient.** Every redesigned card passes `validate.ts` using `statBudget(cost) + STAT_BUDGET_SLACK`, where slack remains 4. Validation prices stats and keywords, not effect packages; play-test two-clause cards rather than claiming a green budget proves balance.
6. **Immediate Consume affordability.** Cover 0, 1, and 2 available tokens for `consume(2)`; multiple immediate Consume clauses sum; `value` omission costs one; a Consume in a later trigger does not gate play; and same-card token generation does not satisfy the pre-play cost.
7. **Legality paths agree.** For every generated `playCard` intent, `validatePlayCard` accepts the same hand/target selection. An unaffordable Consume card appears in neither path. Scope this agreement test to `playCard` intents; hero powers use another validator.
8. **Toll ordering.** Curated Toll cards place immediate Consume clauses before payoff clauses. Trigger-only Consume is exempt.
9. **Hero-power exclusion.** The pilot contains no hero power with Consume. This prevents an un-gated third path from entering accidentally.
10. **Determinism remains unchanged.** Replay a match containing both rejected and affordable Toll opportunities and confirm seed + accepted intent log reproduces byte-identical state.
11. **Decks and bots still work.** All 12 deck suites and bot policy/heuristic suites stay green; bots receive affordability through `legalIntents`.
12. **Play-test gate.** The pilot is not done until all three houses have been played and separately approved. No assertion closes this gate.

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

Not commitments — these record the current direction so a revisit does not restart from zero.

| Question | Leaning |
|---|---|
| Change scope | Rewrite effects and adjust stats/costs where necessary |
| Tribes | Deferred until after the pilot |
| Identity basis | Five-element house contract: verbs, resource, payoff, weakness, curve/power |
| Role reach | Verbs + hero power + curve |
| Mechanism complexity | One shared immediate-Consume legality helper; no conditional resolution or tracked state |
| Uniqueness | Native, not novel — built from Ashen Court's own parts |
| Toll role | Optional resource technique, not the identity spine |
| Consume owner | Vermin Swarm; Bone Horde uses deathrattle/recurrence |

## Rejected, and why

- **Conditional gates for all 12 houses** (Shadowverse model). Strongest identity available, but twelve new pieces of tracked state against a deterministic engine whose replay and LAN mirroring depend on exact serialization.
- **Role grid + denial lists** (Hearthstone roles + MTG color pie). Rejected in review as re-deriving roles the houses already have, in borrowed vocabulary.
- **Reflect as the identity axis.** Rejected on a false premise: counter-damage is standard across Hearthstone, MTG and Yu-Gi-Oh. Only the *decoupling* of counter-damage from Attack is uncommon, which is too thin to carry a whole system.
