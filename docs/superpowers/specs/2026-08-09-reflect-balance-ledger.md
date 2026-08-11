# Reflect Balance Ledger — Task 2 (APPROVED / IMPLEMENTED)

**Status: APPROVED / IMPLEMENTED.** Approved by the user on **2026-08-10**: all 146 creature Reflect values (§2–§4), all 31 buff `value3` deltas (§5), the documented house leans/outliers, and the live Reflect floor-at-zero safety clamp (§5.2 note 3) are approved for implementation. Steps 4–5 are implemented in the adjacent Task 2 commit `balance(core): hand-author creature Reflect values` (commit hash recorded in `.superpowers/sdd/2026-08-09-reflect-dynamic-combat/task-2-report.md`).

- **Date:** 2026-08-11
- **Source revision:** `64538f3` (main; Task 1 Reflect engine + Identity Gate pilot merged)
- **Population:** **exactly 140 curated creatures + 6 token creatures = 146 rows.** `core/src/data/*.ts` holds 140 `creature(` calls (bone-horde 12, dragonflight 14, elder-roots 11, ember-court 13, eternal-vigil 11, grave-pact 9, hollow-choir 10, neutrals 12, night-coven 7, shadow-dancers 8, starforged 11, stormwrought 10, vermin-swarm 12); `tokens.ts` `TOKEN_CARDS` adds 6 creatures (`token-rat`, `token-skeleton`, `token-wisp`, `token-dragon-whelp`, `token-treant`, `token-phoenixash`). Every mean/outlier assertion below states which population it means.
- **Verified against the runtime pool** via `buildPool()` — see the companion validation script in `.superpowers/sdd/2026-08-09-reflect-dynamic-combat/validate-ledger.ts` and the report `task-2-report.md`.

## 1. Method and constraints

### 1.1 What this ledger proposes

This ledger proposes **only two things**:

1. One integer **Reflect** value per creature (146 rows, §2–§4).
2. One explicit **Reflect delta (`value3`)** for every current curated effect that alters combat stats — every `kind: "buff"` effect on cards and the two hero powers that buff (31 rows, §5).

**Everything else is preserved unchanged:** every immutable ID, name, cost, Attack, Health, keyword, trigger, flavor, and deck membership (each archetype's `DECK.sig` + `DECK.neutrals` list) is exactly as shipped at `64538f3`. The ledger does not propose stat or cost changes to any card; later compensating buff deltas are the only additional lever this document may grow.

### 1.2 The shipped budget formula (unchanged)

`validate.ts` prices a creature as (Task 1 curve — Attack and Reflect are complementary halves of one combat axis, so they are averaged, not summed):

```text
spent = health + (attack + reflect) / 2 + Σ KEYWORD_COST
ceiling = statBudget(cost) + STAT_BUDGET_SLACK = (2 + 2*cost) + 4
```

KEYWORD_COST: taunt 1, rush 1, charge 2, windfury 2, lifesteal 1, ward 1, shield 1, venom 2, stealth 1.

The `spend` column in every creature row below is that weighted total **computed from the row's own proposed Reflect**. The validation script re-computes every spend, checks every spend against its ceiling, and fails on any card above the ceiling. Effects and triggers are not priced by the formula — the 4-point slack is the headroom the design reserves for them (see `validate.ts` comment).

### 1.3 Role grammar (hand-authoring, not a formula)

Each Reflect value is a deliberate hand decision per card, following the approved grammar:

- **Aggressor** — Reflect below Attack.
- **Guardian / retaliator** — Reflect above Attack.
- **Flexible / vanilla** — near parity.
- **Utility engine** — lower combat totals to pay for effects.
- **Taunt** may lean toward Reflect; **Charge/Rush** may lean toward Attack.
- **Lifesteal Reflect is priced deliberately** — defensive lifesteal heals its controller, so a high Reflect on a lifestealer is real healing upside.
- **Stealth** may lean below parity — an unattackable creature doesn't need counter-bite.
- **Tokens are valued by the summoning card's paid cost**, not the token's own 0 mana cost.

There is deliberately **no per-house "both directions" rule** (removed on review 2026-08-10): a house whose identity is "never get attacked" may lean entirely one way. Only the **pool-wide** mean constraint (§1.4) is enforced.

### 1.4 Pool-wide mean constraint

The plan's Step 3 gate: the pool-wide mean of `Reflect - Attack` must remain in **[-0.5, +0.5]**.

- Over **all 146 creatures** (curated + tokens): mean ≈ **-0.062**.
- Over the **140 curated creatures only**: mean ≈ **-0.064**.

Both populations are inside the band with a wide margin; the full arithmetic is in §6 and re-verified by the script.

### 1.5 Stabilized pilot identities (consumed as-is)

These three houses were approved and play-tested at `64538f3`; their identities drive their Reflect leans here:

- **Ember Court — aggressor/reach + Ash Toll (overload).** No healing, no sustained draw, runs out of gas. Ember creatures lean **Reflect < Attack** almost without exception; the reach comes from burn, not from walls.
- **Bone Horde — deathrattle recurrence/rebuild, no reach.** Must win on the board. Bone creatures lean **Reflect ≥ Attack** on the recursion pieces — killing a generator should cost the enemy more than a vanilla trade.
- **Vermin Swarm — weak token width + Consume conversion.** Individual units are weak. Vermin creatures lean **Reflect ≤ Attack** on the cheap bodies; the power is in generating fodder and converting it, not in any single rat.

The other nine houses keep the coherent roles the pilot preserved (each section states its lean); no house is forced to contain both an offensive and a defensive creature.

---

## 2. Curated creature ledger — 140 rows, by archetype (DECK_DEFS order)

Column legend: `kw/trg` lists keywords then triggers (short summaries; triggers match the card's actual trigger groups). `spend` is the §1.2 weighted total at the proposed Reflect. `role` is the §1.3 grammar role. Rows appear in deck order (sig rarity groups) to mirror the source files.

### 2.1 Ember Court — 13 creatures, lean Aggressor (house mean -1.15)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ember-cinderling | Cinderling | ember | common | 1 | 2 | 1 | 1 | kw: —; trg: deathrattle dmg(1, randomEnemy) | 2.5 | Aggressor | A 1-mana 2/1 that already pings when it dies needs no counter-bite — Reflect 1 keeps it a cheap attacker whose death is itself the plan. |
| ember-sparkmage | Sparkmage | ember | common | 1 | 1 | 0 | 1 | kw: —; trg: battlecry dmg(1, any) | 1.5 | Utility engine | The battlecry is the card; the 1/1 body is a free spark, so Reflect 0 prices the whole card as a burn spell with a free token attached. |
| ember-ashhunter | Ash Hunter | ember | common | 2 | 2 | 1 | 2 | kw: stealth; trg: — | 4.5 | Evasive aggressor | Stealth already denies the attack-back entirely, so the defensive axis is deliberately underspent at Reflect 1. |
| ember-flamewhelp | Flamewhelp | ember | common | 2 | 2 | 2 | 1 | kw: rush; trg: — | 4 | Rush aggressor | Rush leans Attack: it charges the turn it lands; Reflect 2 is the textless floor, a tempo whelp that still answers a trade. |
| ember-firebrand | Firebrand | ember | common | 3 | 3 | 2 | 3 | kw: —; trg: battlecry spellPower(1, allFriendlyCreatures) | 5.5 | Utility engine | It exists to hand out Spell Power, so its body hedges toward aggression with Reflect 2 beneath Attack 3. |
| ember-igniter | Igniter | ember | common | 3 | 2 | 1 | 3 | kw: —; trg: battlecry dmg(2, any) | 4.5 | Utility engine | A battlecry-burn carrier: 2/3 at Reflect 1 reads "remove it fast or it trades up" — the court's favourite arithmetic. |
| ember-hellhound | Hellhound | ember | common | 4 | 4 | 2 | 3 | kw: charge; trg: — | 8 | Charge aggressor | Charge (2 budget points) on a 4/3 leaves no room for counter-bite; Reflect 2 is the floor for a face-puncher. |
| ember-phoenixwhelp | Phoenix Whelp | ember | rare | 5 | 5 | 3 | 4 | kw: —; trg: deathrattle dmg(2, randomEnemy) | 8 | Aggressor | A 5/4 midrange striker whose death pings; Reflect 3 lets enemies pay a real toll to trigger that ping. |
| ember-flamebringer | Flamebringer | ember | rare | 6 | 5 | 4 | 5 | kw: —; trg: battlecry dmg(2, any) | 9.5 | Aggressor | The burn battlecry is the point; Reflect 4 keeps the 5/5 honest in the mirror without turning it into a wall. |
| ember-ashwing | Ashwing | ember | epic | 7 | 7 | 5 | 6 | kw: charge; trg: — | 14 | Charge finisher | A 7/6 Charge should break faces, not discourage them — Reflect 5 is the textless floor the budget allows a charge finisher. |
| ember-magmasoul | Magmasoul | ember | epic | 8 | 7 | 7 | 7 | kw: windfury; trg: — | 16 | Windfury aggressor | Windfury doubles initiating damage; Reflect 7 sits exactly on the textless floor — the budget pins this windfury bruiser at parity. |
| ember-phoenix | The Phoenix Sovereign | ember | legendary | 9 | 8 | 6 | 8 | kw: —; trg: battlecry dmg(3, allEnemies); deathrattle summon(token-phoenixash) | 15 | Aggressor | A 9-mana finisher whose battlecry and rebirth do the work; Reflect 6 keeps it below Attack 8 — it arrives to end the game, not to sit. |
| ember-emberlord | Emberlord Vharn | ember | legendary | 6 | 5 | 4 | 5 | kw: —; trg: battlecry dmg(2, randomEnemy) | 9.5 | Aggressor | A 6-mana 5/5 with reach; Reflect 4 matches Flamebringer so the deck's two aggressive legs read as one pattern. |

### 2.2 Hollow Choir — 10 creatures, lean Guardian/Control (house mean +0.70)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| choir-acolyte | Acolyte | choir | common | 1 | 1 | 1 | 2 | kw: —; trg: battlecry heal(2) | 3 | Utility engine | A heal-drip 1/2 that tops you off; Reflect 1 parity — it is a body, not a roadblock. |
| choir-sergeant | Sergeant of the Pale | choir | common | 2 | 2 | 2 | 3 | kw: ward; trg: — | 6 | Ward body | Ward already denies one hit, so counter-bite stays equal to the swing at Reflect 2. |
| choir-warden | Warden | choir | common | 3 | 2 | 3 | 4 | kw: taunt; trg: — | 7.5 | Taunt wall | The pale gate: taunt leans Reflect, so attackers pay 3 to pass the 2/4. |
| choir-praetor | Praetor | choir | common | 4 | 3 | 4 | 5 | kw: —; trg: battlecry silence(enemyCreature) | 8.5 | Utility engine | Silence is premium removal; the body holds the line at Reflect 4 so the praetor survives long enough to be answered. |
| choir-luminarch | Luminarch | choir | common | 5 | 4 | 4 | 6 | kw: —; trg: battlecry draw(1) | 10 | Utility engine | A draw-on-play 4/6 at parity Reflect 4 — the card draw is the value, the body is honest board presence. |
| choir-seraph | Seraph of Lament | choir | rare | 6 | 5 | 6 | 6 | kw: lifesteal; trg: — | 12.5 | Lifesteal retainer | Defensive lifesteal heals the controller: Reflect 6 means every forced trade into her refunds health — priced deliberately. |
| choir-martyr | Martyr | choir | rare | 5 | 3 | 4 | 5 | kw: —; trg: deathrattle heal(5) | 8.5 | Sacrifice engine | She wants to die on her own terms; Reflect 4 taxes the kill without making the 5-heal deathrattle too hard to reach. |
| choir-exorcist | Exorcist | choir | epic | 6 | 4 | 5 | 7 | kw: —; trg: battlecry destroy(enemyCreature) | 11.5 | Removal engine | Battlecry destroy is the strongest single clause in the pool; Reflect 5 on a 4/7 makes the carrier a real roadblock. |
| choir-lightbringer | Lightbringer | choir | epic | 7 | 6 | 7 | 8 | kw: taunt; trg: — | 15.5 | Taunt wall | The lightbearer holds the line: taunt plus Reflect 7 above Attack 6 — a wall that bites back. |
| choir-lady | Lady of the Pale Choir | choir | legendary | 9 | 6 | 7 | 8 | kw: taunt; trg: startOfTurn heal(4) | 15.5 | Legendary wall | A healing taunt monarch: Reflect 7 rewards enemies who try to end the chant, and the start-of-turn heal keeps her standing. |

### 2.3 Vermin Swarm — 12 creatures, lean Weak Width/Aggressor (house mean -0.92)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| vermin-squeaker | Squeaker | vermin | common | 1 | 1 | 1 | 1 | kw: venom; trg: — | 4 | Venom trade | Venom is the card; a 1/1 that Reflects 1 is a fair trade piece and nothing more. |
| vermin-scavenger | Scavenger | vermin | common | 1 | 2 | 0 | 1 | kw: —; trg: deathrattle summon(token-rat) | 2 | Aggressor | A 2/1 that refunds a rat on death: Reflect 0 — it should die, and cheaply, so the rat appears. |
| vermin-brute | Mangy Brute | vermin | common | 2 | 3 | 1 | 2 | kw: —; trg: battlecry summon(token-rat) | 4 | Aggressor | A 3/2 that pays a rat for entry; Reflect 1 keeps the brute a tempo body, not a blocker. |
| vermin-swarmlord | Swarmlord | vermin | common | 3 | 2 | 1 | 4 | kw: —; trg: battlecry consume(2) + buff(1,1,allFriendlyCreatures) | 5.5 | Fodder engine | The Consume payoff engine must stay alive but cheap: Reflect 1 on a 2/4 reads "protect it with fodder, not stats." |
| vermin-gnawer | Gnawer | vermin | common | 3 | 3 | 2 | 3 | kw: venom; trg: — | 7.5 | Venom trade | Venom taxes the combat axis twice; Reflect 2 keeps the 3/3 a brawler that prefers to strike first. |
| vermin-warband | Warband | vermin | common | 4 | 5 | 3 | 4 | kw: rush; trg: — | 9 | Rush aggressor | The widest 4-drop in the pool rushes in; Reflect 3 is the concession a 5/4 rush pays for its size. |
| vermin-alpha | Alpha Rat | vermin | rare | 4 | 3 | 2 | 3 | kw: —; trg: battlecry consume(1) + buff(1,2,allFriendlyCreatures) | 5.5 | Fodder engine | Another Consume conduit; Reflect 2 — the alpha leads the charge and eats the retaliation. |
| vermin-breeder | Breeder | vermin | rare | 5 | 3 | 3 | 4 | kw: —; trg: endOfTurn summon(token-rat) | 7 | Engine | A token factory at parity Reflect 3 — neither a wall nor a free trade. |
| vermin-plaguemaster | Plaguemaster | vermin | rare | 5 | 3 | 3 | 5 | kw: —; trg: deathrattle summon(token-rat, 2) | 8 | Rebuild engine | Deathrattle payout wants enemies to kill it; Reflect 3 makes that kill slightly dear while it is alive. |
| vermin-queen | Queen Moulder | vermin | rare | 6 | 4 | 4 | 6 | kw: —; trg: startOfTurn summon(token-rat) | 10 | Engine | A 4/6 generator at parity Reflect 4 — the queen's power is her litter, not her claws. |
| vermin-rattus | Rattus the God | vermin | epic | 8 | 8 | 7 | 8 | kw: taunt; trg: — | 16.5 | Taunt bruiser | The god-rat is the house's one big taunt; Reflect 7 concedes a point of counter-bite to keep it a face-puncher. |
| vermin-plagueking | Plague King | vermin | legendary | 7 | 6 | 5 | 6 | kw: —; trg: startOfTurn summon(token-rat, 2) | 11.5 | Engine | A double-rat factory: Reflect 5 keeps the king attack-leaning so the swarm, not the throne, ends games. |

### 2.4 Dragonflight — 14 creatures, lean Balanced/Defensive (house mean +0.14)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dragon-whelp | Dragon Whelp | dragon | common | 1 | 1 | 1 | 2 | kw: rush; trg: — | 4 | Rush body | A 1/2 rush at parity Reflect 1 — it swings the turn it lands and blocks respectably after. |
| dragon-scaleglider | Scaleglider | dragon | common | 2 | 2 | 1 | 3 | kw: stealth; trg: — | 5.5 | Evasive body | Stealth means it cannot be attacked; Reflect 1 converts the wasted defensive axis into a cheap evasive flyer. |
| dragon-hunter | Sky Hunter | dragon | common | 3 | 3 | 2 | 3 | kw: rush; trg: — | 6.5 | Rush aggressor | Rush leans Attack: Reflect 2 below Attack 3 — a hunter, not a guard. |
| dragon-roost | Roost Guardian | dragon | common | 3 | 2 | 3 | 4 | kw: taunt; trg: — | 7.5 | Taunt wall | The roost's eggs are guarded by a taunt wall that Reflects 3 above its Attack 2. |
| dragon-hatchling | Hatchling | dragon | common | 3 | 3 | 3 | 3 | kw: —; trg: battlecry summon(token-dragon-whelp) | 6 | Summon engine | A 3/3 that pays a whelp at parity Reflect 3 — the body is the floor, the token is the bonus. |
| dragon-elderscale | Elderscale | dragon | common | 4 | 3 | 4 | 5 | kw: taunt; trg: — | 9.5 | Taunt wall | Scars teach endurance: a 3/5 taunt wall at Reflect 4 above Attack 3. |
| dragon-drakeling | Drakeling | dragon | common | 5 | 5 | 4 | 5 | kw: —; trg: battlecry buff(1,1,friendlyDragon) | 9.5 | Buff engine | A 5/5 that pre-buffs the flight; Reflect 4 keeps it a striker rather than a bastion. |
| dragon-matriarch | Matriarch | dragon | rare | 5 | 4 | 5 | 5 | kw: —; trg: battlecry buff(1,1,allFriendlyCreatures) | 9.5 | Buff engine | The flight's heart: Reflect 5 above Attack 4 so the matriarch endures to keep buffing. |
| dragon-seer | Seer | dragon | rare | 4 | 2 | 4 | 5 | kw: —; trg: endOfTurn draw(1) | 8 | Draw engine | A 2/5 that draws every turn: Reflect 4 makes killing the seer an actual investment — the engine tax. |
| dragon-warden | Warden of Skies | dragon | rare | 6 | 5 | 6 | 6 | kw: taunt; trg: — | 12.5 | Taunt wall | The sky-patrol wall at Reflect 6 — the storm steps aside, attackers do not. |
| dragon-prince | Prince of Scales | dragon | rare | 7 | 7 | 6 | 7 | kw: —; trg: battlecry buff(2,2,friendlyDragon) | 13.5 | Buff engine | Heir to the hoard: a 7/7 with a dragon buff; Reflect 6 concedes one point to the offensive plan. |
| dragon-tyrant | Wyrm Tyrant | dragon | epic | 8 | 8 | 8 | 6 | kw: windfury; trg: — | 16 | Windfury aggressor | Windfury doubles the bite: Reflect 8 sits exactly on the textless floor — a tyrant the budget will not underspend. |
| dragon-worldeater | Worldeater | dragon | legendary | 10 | 10 | 11 | 10 | kw: taunt; trg: — | 21.5 | Legendary wall | The oldest of the old: a 10/10 taunt that Reflects 11 — attacking it is the meal. |
| dragon-celestial | Celestial Skywing | dragon | legendary | 6 | 4 | 3 | 4 | kw: windfury; trg: battlecry buff(1,1,allFriendlyCreatures) | 9.5 | Windfury legend | A windfury 4/4 that pre-buffs the flight: Reflect 3 — she strikes twice and folds her wings after. |

### 2.5 Elder Roots — 11 creatures, lean Ramp Wall (house mean +0.36)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| roots-sapling | Sapling | roots | common | 1 | 1 | 2 | 2 | kw: taunt; trg: — | 4.5 | Taunt wall | A 1/2 taunt that Reflects 2 — the first stubborn root costs more to clear than to ignore. |
| roots-sprout | Sprout | roots | common | 2 | 2 | 2 | 2 | kw: taunt; trg: — | 5 | Taunt body | Parity 2/2 taunt: green, patient, and unremarkable — the ramp deck's filler wall. |
| roots-barkhide | Barkhide | roots | common | 3 | 2 | 3 | 4 | kw: taunt; trg: — | 7.5 | Taunt wall | Bark remembers every blade: a 2/4 taunt wall at Reflect 3. |
| roots-forager | Forager | roots | common | 3 | 3 | 3 | 3 | kw: —; trg: battlecry gainMana(1) | 6 | Ramp engine | A 3/3 that ramps at parity Reflect 3 — the empty crystal is the value, the body is honest. |
| roots-ancients | Ancient's Wrath | roots | common | 4 | 4 | 4 | 4 | kw: taunt; trg: — | 9 | Taunt body | Roused ancients at parity 4/4 taunt: hold ground without overpaying. |
| roots-ironwood | Ironwood | roots | common | 5 | 4 | 5 | 6 | kw: taunt; trg: — | 11.5 | Taunt wall | No axe has dulled it: a 4/6 taunt wall at Reflect 5. |
| roots-worldtree | Worldtree Sapling | roots | rare | 6 | 5 | 5 | 5 | kw: —; trg: battlecry gainMana(2) | 10 | Ramp engine | Double ramp on a 5/5 at parity Reflect 5 — the crystals are the payoff, the body is the shield. |
| roots-treant | Elder Treant | roots | rare | 7 | 7 | 7 | 7 | kw: taunt; trg: — | 15 | Taunt body | The mountain grew around it: 7/7 taunt at parity. |
| roots-goliath | Goliath | roots | epic | 8 | 8 | 8 | 8 | kw: —; trg: battlecry gainMana(2) | 16 | Ramp engine | Older than the kingdom's oldest stone: 8/8 with double ramp at parity. |
| roots-titan | Titan of the Deep Roots | roots | epic | 10 | 10 | 11 | 10 | kw: taunt; trg: — | 21.5 | Legendary-grade wall | Nothing passes: 10/10 taunt that Reflects 11 — the deep roots bind. |
| roots-worldmother | Worldmother | roots | legendary | 12 | 12 | 12 | 12 | kw: —; trg: battlecry buff(2,2,allFriendlyCreatures) | 24 | Ramp finisher | The first tree at parity 12/12 — her mass buff is the finisher, and the stats are simply the largest in the game. |

### 2.6 Shadow Dancers — 8 creatures, lean Evasion/Aggressor (house mean -0.88)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dance-acrobat | Acrobat | dance | common | 2 | 2 | 1 | 2 | kw: stealth; trg: — | 4.5 | Evasive body | Stealth denies the attack-back; Reflect 1 spends the saved defensive axis elsewhere. |
| dance-dervish | Dervish | dance | common | 2 | 3 | 1 | 1 | kw: rush; trg: — | 4 | Rush aggressor | A 3/1 rush whirlwind at Reflect 1 — it exists for exactly one swing. |
| dance-bladeweaver | Bladeweaver | dance | common | 4 | 4 | 3 | 4 | kw: stealth; trg: — | 8.5 | Evasive body | Shadow-steel at Reflect 3: stealth already taxes attackers, so the counter-bite drops a point. |
| dance-trickster | Trickster | dance | rare | 5 | 4 | 4 | 4 | kw: —; trg: battlecry draw(1) | 8 | Utility engine | Draw on play at parity Reflect 4 — the trick is the card, the body is honest. |
| dance-illusionist | Illusionist | dance | rare | 6 | 5 | 4 | 5 | kw: —; trg: battlecry returnToHand(enemyCreature) | 9.5 | Bounce engine | Bounce is premium tempo: Reflect 4 — the illusionist strikes and vanishes before the counter. |
| dance-puppet | Puppet Master | dance | epic | 7 | 6 | 5 | 6 | kw: —; trg: battlecry draw(2) | 11.5 | Utility engine | Double draw at Reflect 5 — the strings, not the body, do the work. |
| dance-shadow | Shadow Dancer | dance | epic | 7 | 5 | 4 | 5 | kw: —; trg: deathrattle draw(2) | 9.5 | Rebuild engine | Deathrattle draw at Reflect 4 — she dies and the shadows finish the steps. |
| dance-nyx | Nyx, the Last Dance | dance | legendary | 9 | 8 | 8 | 8 | kw: windfury; trg: — | 18 | Windfury legend | Windfury on an 8/8: Reflect 8 at the textless floor — the last dance is still an attack, but the budget will not underspend her. |

### 2.7 Bone Horde — 12 creatures, lean Rebuild/Defensive (house mean +1.00)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bone-scrapper | Scrapper | bone | common | 1 | 1 | 1 | 2 | kw: —; trg: — | 3 | Vanilla | A 1/2 vanilla at parity — the deck's filler crawls out of the grave exactly as expected. |
| bone-marauder | Marauder | bone | common | 2 | 3 | 3 | 1 | kw: —; trg: — | 4 | Aggressor | A textless 3/1 must sit at the spend floor for its cost; Reflect 3 is parity, keeping the raid cheap without going under budget. |
| bone-gravedigger | Gravedigger | bone | common | 2 | 2 | 2 | 2 | kw: —; trg: deathrattle summon(token-skeleton) | 4 | Rebuild engine | Deathrattle skeleton at parity 2/2 — dying is the plan, so the counter-bite is neutral. |
| bone-cairn | Cairn | bone | common | 3 | 0 | 3 | 4 | kw: taunt; trg: deathrattle summon(token-skeleton, 3) | 6.5 | Taunt wall | A 0/4 taunt that pays out three skeletons: Reflect 3 is the entire deterrent — enemies pay to crack the cairn. |
| bone-raider | Raider | bone | common | 3 | 3 | 4 | 3 | kw: —; trg: deathrattle summon(token-skeleton, 2) | 6.5 | Rebuild engine | Deathrattle double-skeleton at Reflect 4 — the horde wants enemies to trade in and pay for the rebuild. |
| bone-skull | Skull Wall | bone | common | 4 | 2 | 3 | 5 | kw: taunt; trg: — | 8.5 | Taunt wall | A thousand jawless grins: 2/5 taunt at Reflect 3 — a wall that bites a little. |
| bone-necromancer | Necromancer | bone | rare | 5 | 3 | 4 | 4 | kw: —; trg: startOfTurn summon(token-skeleton) | 7.5 | Engine | Daily skeleton production at Reflect 4 keeps the generator alive longer. |
| bone-warlord | Warlord | bone | rare | 6 | 6 | 7 | 6 | kw: —; trg: deathrattle summon(token-skeleton, 2) | 12.5 | Rebuild engine | A 6/6 with a double-skeleton deathrattle at Reflect 7 — killing the warlord funds the next wave. |
| bone-behemoth | Behemoth | bone | rare | 7 | 7 | 8 | 7 | kw: taunt; trg: — | 15.5 | Taunt wall | The barrow's mountain: 7/7 taunt at Reflect 8 above Attack 7. |
| bone-whisper | Whisperer | bone | epic | 5 | 3 | 4 | 6 | kw: —; trg: endOfTurn summon(token-skeleton) | 9.5 | Engine | An end-of-turn factory on a 3/6 at Reflect 4 — the whisperer endures to whisper. |
| bone-overlord | Overlord | bone | epic | 9 | 8 | 9 | 10 | kw: —; trg: deathrattle summon(token-skeleton, 2) | 18.5 | Rebuild engine | An 8/10 with skeleton payout at Reflect 9 — the horde rebuilds from whatever kills it. |
| bone-king | The Bone King | bone | legendary | 10 | 8 | 10 | 10 | kw: taunt; trg: deathrattle summon(token-skeleton, 3) | 20 | Legendary wall | The throne of the horde: taunt with Reflect 10 — dying only raises his court. |

### 2.8 Grave Pact — 9 creatures, lean Aggressor/Self-damage (house mean -1.22)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pact-imp | Blood Imp | pact | common | 2 | 3 | 1 | 2 | kw: —; trg: — | 4 | Aggressor | Small, sharp, eager: a textless 3/2 at the spend floor, Reflect 1 — the pact's opening trade. |
| pact-leech | Leech | pact | common | 2 | 2 | 2 | 2 | kw: lifesteal; trg: — | 5 | Lifesteal body | Lifesteal at parity 2/2: the heal comes from striking, so the counter-bite stays neutral. |
| pact-masochist | Masochist | pact | common | 3 | 3 | 3 | 4 | kw: —; trg: onDamage draw(1) | 7 | Pain engine | onDamage draw wants to be hit: parity Reflect 3 lets trades flow without inviting suicide. |
| pact-ravager | Ravager | pact | common | 4 | 5 | 3 | 3 | kw: —; trg: battlecry dmg(2, self) + draw(1) | 7 | Aggressor | Pays 2 life for a card on a 5/3 at Reflect 3 — an attacker, not a blocker. |
| pact-cultist | Cultist | pact | common | 4 | 4 | 3 | 4 | kw: —; trg: deathrattle draw(1) | 7.5 | Rebuild engine | Deathrattle draw at Reflect 3 — the cultist trades down to cash in. |
| pact-fiend | Fiend | pact | rare | 5 | 6 | 3 | 4 | kw: —; trg: battlecry dmg(2, self) + draw(2) | 8.5 | Aggressor | A 6/4 that pays 2 life for two cards at Reflect 3 — the fiend bites the hand that feeds it, so it doesn't defend. |
| pact-dread | Dreadknight | pact | rare | 6 | 6 | 5 | 6 | kw: —; trg: battlecry dmg(2, self) + refillMana(2) | 11.5 | Aggressor | Refunds 2 mana on a 6/6 at Reflect 5 — midrange aggression with a tempo kick. |
| pact-lord | Lord of the Pact | pact | epic | 8 | 8 | 7 | 8 | kw: —; trg: startOfTurn dmg(1, self) + draw(1) | 15.5 | Engine | A free card a turn for 1 life at Reflect 7 — the lord endures because he pays. |
| pact-morticia | Morticia Gravefall | pact | legendary | 9 | 7 | 6 | 9 | kw: —; trg: battlecry dmg(3, self) + dmg(3, allEnemies) | 15.5 | Aggressor | Mass burn for 3 life at Reflect 6 below Attack 7 — the pact hero swings, then bleeds. |

### 2.9 Night Coven — 7 creatures, lean Control/Debuff (house mean +0.57)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| coven-familiar | Familiar | coven | common | 2 | 2 | 2 | 2 | kw: —; trg: — | 4 | Vanilla | Every witch keeps one: a textless parity 2/2 filler. |
| coven-bog | Bog Hag | coven | common | 3 | 2 | 3 | 4 | kw: —; trg: — | 6.5 | Body | A resilient textless 2/4 at Reflect 3 — the bog keeps what it takes. |
| coven-raven | Raven | coven | common | 4 | 4 | 4 | 4 | kw: —; trg: battlecry buff(-1,-1,enemyCreature) | 8 | Debuff carrier | A 4/4 that hexes on arrival at parity Reflect 4 — the debuff is the card. |
| coven-scare | Scarecrow | coven | common | 4 | 1 | 4 | 7 | kw: taunt; trg: — | 10.5 | Taunt wall | A 1/7 taunt scarecrow: Reflect 4 is the entire point — it doesn't kill, it taxes every swing. |
| coven-eldritch | Eldritch Horror | coven | rare | 6 | 6 | 5 | 6 | kw: venom; trg: — | 13.5 | Venom body | Venom (2 budget) on a 6/6 at Reflect 5 — it kills whatever it touches and shrugs the rest. |
| coven-abyss | Abyssal Gaze | coven | epic | 9 | 8 | 7 | 9 | kw: —; trg: battlecry buff(-2,-2,enemyCreature) | 16.5 | Debuff carrier | A 9-mana 8/9 that withers a target at Reflect 7 — an elder horror, not a wall. |
| coven-queen | The Hex Queen | coven | legendary | 10 | 7 | 9 | 10 | kw: —; trg: battlecry buff(-2,-2,allEnemyCreatures) | 18 | Control finisher | Her mass withering is the finisher: Reflect 9 above Attack 7 — enemies wither, and the queen holds the circle. |

### 2.10 Starforged — 11 creatures, lean Balanced/Utility (house mean -0.09)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| star-acolyte | Star Acolyte | star | common | 2 | 2 | 2 | 3 | kw: taunt; trg: — | 6 | Taunt body | Parity 2/3 taunt: the choir's first ward. |
| star-guardian | Guardian | star | common | 3 | 2 | 3 | 4 | kw: taunt; trg: — | 7.5 | Taunt wall | Wrought from a constellation's core: 2/4 taunt at Reflect 3. |
| star-sentinel | Sentinel | star | common | 4 | 3 | 4 | 5 | kw: taunt; trg: — | 9.5 | Taunt wall | It has watched the void: 3/5 taunt at Reflect 4. |
| star-mage | Starmage | star | common | 5 | 4 | 5 | 6 | kw: —; trg: battlecry spellPower(1, friendlyCreature) | 10.5 | Buff engine | Hands out spell power on a 4/6 at Reflect 5 — the mage endures to empower. |
| star-prophet | Prophet | star | rare | 4 | 3 | 3 | 3 | kw: —; trg: battlecry discountMostExpensive(1) | 6 | Discount engine | Discounts the priciest hand card at parity 3/3 — the prophecy, not the body, is the value. |
| star-oracle | Oracle | star | rare | 5 | 3 | 4 | 4 | kw: —; trg: battlecry discountMostExpensive(1) | 7.5 | Discount engine | A second discount carrier at Reflect 4 — she lingers long enough to be worth killing. |
| star-giant | Star Giant | star | rare | 7 | 7 | 7 | 7 | kw: taunt; trg: — | 15 | Taunt body | Coalesced starlight: 7/7 taunt at parity. |
| star-wanderer | Wanderer | star | epic | 8 | 8 | 6 | 8 | kw: charge; trg: — | 17 | Charge finisher | Unbound charge at Reflect 6 — the wanderer arrives swinging. |
| star-megastar | Megastar | star | epic | 10 | 10 | 8 | 10 | kw: windfury; trg: — | 21 | Windfury finisher | A windfury 10/10 at Reflect 8 — it burns twice and is done. |
| star-archon | Archon Stellara | star | legendary | 12 | 12 | 12 | 12 | kw: taunt; trg: — | 25 | Legendary wall | The sky's own law: 12/12 taunt at parity. |
| star-constellation | Living Constellation | star | legendary | 8 | 7 | 6 | 7 | kw: —; trg: battlecry discountMostExpensive(2) | 13.5 | Discount engine | Double discount on a 7/7 at Reflect 6 — the next summon is already written in its light. |

### 2.11 Eternal Vigil — 11 creatures, lean Healing Wall (house mean +0.82)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| vigil-guard | Guard | vigil | common | 1 | 1 | 2 | 3 | kw: taunt; trg: — | 5.5 | Taunt wall | The first shield: a 1/3 taunt at Reflect 2 — cheap, unglamorous, infuriating. |
| vigil-squire | Squire | vigil | common | 2 | 2 | 2 | 2 | kw: shield; trg: — | 5 | Shield body | A shielded 2/2 at parity — the dawn watch holds one hit and answers in kind. |
| vigil-paladin | Paladin | vigil | common | 3 | 2 | 3 | 4 | kw: taunt; trg: — | 7.5 | Taunt wall | No blade passes: a 2/4 taunt at Reflect 3. |
| vigil-monk | Monk | vigil | common | 3 | 3 | 4 | 3 | kw: lifesteal; trg: — | 7.5 | Lifesteal retainer | Lifesteal priced deliberately: Reflect 4 above Attack 3 — every counter-trade heals the order. |
| vigil-shieldbearer | Shieldbearer | vigil | common | 4 | 1 | 3 | 6 | kw: taunt, shield; trg: — | 10 | Wall | A 1/6 taunt that cannot be one-shotted: Reflect 3 — it wears attackers down one point at a time. |
| vigil-crusader | Crusader | vigil | common | 5 | 4 | 4 | 5 | kw: rush; trg: — | 10 | Rush body | The order's one aggressive tool: 4/5 rush at Reflect 4 — it strikes where the light burns thinnest and still answers one trade. |
| vigil-avenger | Avenger | vigil | rare | 5 | 5 | 5 | 4 | kw: rush; trg: — | 10 | Rush aggressor | Vengeance rides ahead: 5/4 rush at Reflect 5 — the floor-bound exception that proves the wall. |
| vigil-warden | Warden of Dawn | vigil | rare | 6 | 5 | 6 | 6 | kw: lifesteal; trg: — | 12.5 | Lifesteal wall | Every wound repaid: lifesteal at Reflect 6 — the dawn's ledger balances in its favour. |
| vigil-archon | Archon of Dawn | vigil | epic | 7 | 6 | 7 | 7 | kw: taunt, lifesteal; trg: — | 15.5 | Lifesteal wall | Immovable first light: taunt + lifesteal at Reflect 7 — the definition of a bastion. |
| vigil-saint | Saint | vigil | epic | 8 | 6 | 7 | 9 | kw: lifesteal; trg: — | 16.5 | Lifesteal retainer | Suffering passes through her: 6/9 lifesteal at Reflect 7 — killing her funds her controller. |
| vigil-aldric | Ser Aldric | vigil | legendary | 9 | 8 | 9 | 8 | kw: taunt, lifesteal; trg: — | 18.5 | Legendary wall | Dawn waits on his word: taunt + lifesteal at Reflect 9 — the order's last, best wall. |

### 2.12 Stormwrought — 10 creatures, lean Spell Tempo/Aggressor (house mean -0.40)

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| storm-adept | Adept | storm | common | 2 | 2 | 1 | 2 | kw: rush; trg: — | 4.5 | Rush body | Acolytes learn to read the sky: 2/2 rush at Reflect 1. |
| storm-emberwitch | Emberwitch | storm | common | 3 | 3 | 2 | 2 | kw: —; trg: battlecry dmg(1, any) | 4.5 | Utility body | A 3/2 that pings at Reflect 2 — the witch rides the gust, she doesn't block. |
| storm-rider | Storm Rider | storm | common | 4 | 4 | 4 | 3 | kw: rush; trg: — | 8 | Rush aggressor | Arrives with the first crack of thunder: 4/3 rush at Reflect 4 — the textless floor keeps the storm's rider honest. |
| storm-sorcerer | Sorcerer | storm | common | 4 | 3 | 3 | 4 | kw: —; trg: battlecry returnToHand(enemyCreature) | 7 | Bounce engine | Bounce on a 3/4 at parity Reflect 3 — the lesson is the lightning, not the body. |
| storm-mistweaver | Mistweaver | storm | rare | 4 | 3 | 3 | 3 | kw: —; trg: battlecry discountNextSpell(1) | 6 | Discount engine | Hands the storm's loose threads to the next caster at parity 3/3. |
| storm-stormcaller | Stormcaller | storm | rare | 6 | 5 | 4 | 5 | kw: —; trg: battlecry discountNextSpell(2) | 9.5 | Discount engine | Double spell discount at Reflect 4 — the clouds answer his voice, the body stays secondary. |
| storm-leviathan | Leviathan | storm | rare | 7 | 7 | 7 | 7 | kw: taunt; trg: — | 15 | Taunt body | Something vast beneath the storm-torn sea: 7/7 taunt at parity. |
| storm-siren | Siren | storm | epic | 5 | 4 | 4 | 4 | kw: —; trg: battlecry discountNextSpell(1) | 8 | Discount engine | Her song lays the storm at your feet: parity 4/4. |
| storm-thunderhead | Thunderhead | storm | epic | 9 | 9 | 8 | 9 | kw: taunt; trg: — | 18.5 | Taunt wall | A mountain of black cloud: 9/9 taunt at Reflect 8 — the storm's last bastion still leans into the offensive. |
| storm-zephyra | Zephyra | storm | legendary | 10 | 9 | 9 | 9 | kw: windfury; trg: — | 20 | Windfury legend | The sky learns to strike twice: windfury at Reflect 9 — the textless floor pins the ender at parity. |

---

## 3. Neutral creature ledger — 12 rows

Shared staples across all 12 decks (`DECK.neutrals`); mean of `Reflect - Attack` ≈ **+0.17**.

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| neutral-militia | Village Militia | neutral | common | 1 | 1 | 2 | 2 | kw: taunt; trg: — | 4.5 | Taunt wall | The cheapest wall in the game: 1/2 taunt at Reflect 2. |
| neutral-boar | Wild Boar | neutral | common | 1 | 2 | 1 | 1 | kw: rush; trg: — | 3.5 | Rush body | The boar doesn't ask who rules: 2/1 rush at Reflect 1. |
| neutral-hound | Feral Hound | neutral | common | 2 | 2 | 1 | 2 | kw: rush; trg: — | 4.5 | Rush body | Answers to hunger alone: 2/2 rush at Reflect 1. |
| neutral-golem | Stone Golem | neutral | common | 3 | 3 | 3 | 3 | kw: taunt; trg: — | 7 | Taunt body | Neither tires nor questions: 3/3 taunt at parity. |
| neutral-squire | Vanguard Squire | neutral | common | 2 | 2 | 2 | 1 | kw: taunt; trg: — | 4 | Taunt body | Marches first so others live: a 2/1 taunt at Reflect 2 — it dies, but the tax stays. |
| neutral-sentinel | Wall Sentinel | neutral | common | 3 | 1 | 3 | 4 | kw: taunt; trg: — | 7 | Taunt wall | Sentries become the wall: 1/4 taunt at Reflect 3 — a tax wall, not a threat. |
| neutral-ogre | War Ogre | neutral | common | 5 | 5 | 5 | 5 | kw: ward; trg: — | 11 | Ward body | Loyalty for a purse of ash-crowns: 5/5 ward at parity. |
| neutral-bear | Ironclad Bear | neutral | rare | 4 | 4 | 4 | 4 | kw: taunt; trg: — | 9 | Taunt body | Beasts into bulwarks: 4/4 taunt at parity. |
| neutral-swift | Swiftblade | neutral | rare | 2 | 2 | 2 | 1 | kw: rush; trg: — | 4 | Rush body | A blade that moves before the eye: 2/1 rush at Reflect 2 — the textless floor keeps the swiftblade a fair trade. |
| neutral-knight | Bulwark Knight | neutral | rare | 5 | 4 | 5 | 5 | kw: taunt; trg: — | 10.5 | Taunt wall | Holds the line until the ash settles: 4/5 taunt at Reflect 5. |
| neutral-colossus | Colossus | neutral | epic | 7 | 7 | 7 | 7 | kw: taunt; trg: — | 15 | Taunt body | A war-construct of the old kings: 7/7 taunt at parity. |
| neutral-titan | Titan of Ash | neutral | legendary | 9 | 9 | 9 | 9 | kw: taunt; trg: — | 19 | Taunt body | The Court's first servant: 9/9 taunt at parity. |

---

## 4. Token creature ledger — 6 rows

Tokens are valued by the summoning card's paid cost (the tokens' own cost is 0). All six stay at parity with their Attack. `token-treant` and `token-phoenixash` are the pool's two weighted-budget exceptions (§6.4) — they spend above the vanilla budget for a 0-cost body, using the slack the summoning card pays for.

| id | name | archetype | rarity | cost | A | R | H | kw/trg | spend | role | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| token-rat | Giant Rat | token | common | 0 | 1 | 1 | 1 | kw: —; trg: — | 2 | Fodder | Rat fodder at parity 1/1 — it exists to be consumed or traded, priced by the cards that spawn it (1–4 rats for 2–9 mana). |
| token-skeleton | Skeleton | token | common | 0 | 1 | 1 | 1 | kw: —; trg: — | 2 | Rebuild fodder | The horde's rebuild unit at parity 1/1 — quantity, not quality, is the plan. |
| token-wisp | Choir Spirit | token | common | 0 | 1 | 1 | 1 | kw: —; trg: — | 2 | Attrition fodder | A 1/1 song that lingers at parity — choir attrition chips, never threatens. |
| token-dragon-whelp | Dragon Whelp | token | common | 0 | 1 | 1 | 1 | kw: —; trg: — | 2 | Board filler | Flight filler at parity 1/1 — the whelps arrive in twos and threes. |
| token-treant | Root Treant | token | common | 0 | 1 | 1 | 1 | kw: taunt; trg: — | 3 | Taunt token | A 1/1 taunt at parity — its spend (3 vs budget 2) is paid by roots-awaken and roots-heart, not by the token. |
| token-phoenixash | Phoenix Ash | token | common | 0 | 2 | 2 | 2 | kw: —; trg: — | 4 | Reborn threat | A 2/2 at parity — its spend (4 vs budget 2) is paid by the Phoenix Sovereign's 9-mana deathrattle. |

---

## 5. Curated buff ledger — every effect that alters combat stats

Every `kind: "buff"` effect in the curated pool, plus the two hero powers that buff. Wire fields are `value` = Attack delta, `value2` = Health delta, `value3` = Reflect delta (Task 1; card text displays Attack, Reflect, Health). The proposal keeps every current `value`/`value2` **exactly as shipped** and authors `value3` explicitly — no buff silently defaults. Negative debuffs (Night Coven) reduce Reflect on the same axis; note §5.2 on the live floor.

### 5.1 Proposed three-axis values (31 effects)

| id / source | card | target | ΔA (value) now | ΔH (value2) now | ΔA (value) | ΔH (value2) | ΔR (value3) | rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bone-frenzy | Bone Frenzy (spell) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | The horde-wide charge forgets fear on all three axes — it hits harder and bites back just as hard. |
| neutral-drums | War Drums (spell) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | One drum for the march, two for the charge, three for the counter — the rally is complete. |
| neutral-banner | Banner of Courage (spell) | friendlyCreature | 2 | 2 | 2 | 2 | 1 | Courage is attack and endurance; Reflect +1 makes the banner also steady the bearer's guard. |
| dragon-wingmen | Wingmen (spell) | friendlyDragon | 2 | 2 | 2 | 2 | 1 | The flight's wings move as one — the formation adds a modest counter-bite to the size it grants. |
| dragon-drakeling | Drakeling (battlecry) | friendlyDragon | 1 | 1 | 1 | 1 | 1 | Too proud to stay grounded: the whelp's blessing touches all three stats evenly. |
| dragon-matriarch | Matriarch (battlecry) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | Her roar runs hotter in every vein — a symmetric +1 to the whole board. |
| dragon-prince | Prince of Scales (battlecry) | friendlyDragon | 2 | 2 | 2 | 2 | 1 | Heir to the hoard: a big attack/health grant plus a single point of reflect — the crown's confidence, not its bulk. |
| dragon-council | Sky Council (artifact, startOfTurn) | friendlyDragon | 1 | 1 | 1 | 1 | 1 | The elders' wisdom settles evenly: dawn blessing on all three axes. |
| dragon-celestial | Celestial Skywing (battlecry) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | Born of the heavens, she brightens every stat of the flight she leads. |
| hero:dragon | Dragon's Boon (hero power) | friendlyDragon | 1 | 1 | 1 | 1 | 1 | A repeatable +1/+1/+1 keeps the hero power a steady dragon-growth tool without spiking any one axis. |
| vermin-swarmlord | Swarmlord (battlecry) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | The Fodder Toll payoff converts two tokens into a symmetric bump — bulk and bite together. |
| vermin-frenzy | Frenzy (spell) | allFriendlyCreatures | 2 | 0 | 2 | 0 | 1 | Hunger is the war horn: attack surges hardest and the swarm's teeth grow sharp enough to answer a strike — the toll buys offense, not bulk. |
| vermin-alpha | Alpha Rat (battlecry) | allFriendlyCreatures | 1 | 2 | 1 | 2 | 1 | The pack grows bolder (attack) and larger (health) — and now braver in the counter, a small third bonus. |
| vermin-endless | The Endless Swarm (spell) | allFriendlyCreatures | 1 | 1 | 1 | 1 | 1 | The horde finishes counting you on all three axes at once. |
| roots-worldmother | Worldmother (battlecry) | allFriendlyCreatures | 2 | 2 | 2 | 2 | 1 | Her blessing is growth (health) and vigor (attack), with the forest answering blows at +1 reflect. |
| pact-bond | Blood Bond (spell) | friendlyCreature | 3 | 3 | 3 | 3 | 1 | Two hearts beat as one; the second pays for the first's strength — the bound creature now also mirrors blows. |
| storm-charge | Storm Charge (spell) | friendlyCreature | 2 | 2 | 2 | 2 | 1 | The storm lends fury (attack), staying power (health), and a spark of counter — the vessel spends all three. |
| coven-hex | Hex (spell) | enemyCreature | -1 | -1 | -1 | -1 | -1 | The old words dull bone and blood — and the will to strike back. |
| coven-curse | Curse (spell) | enemyCreature | -1 | -1 | -1 | -1 | -1 | A curse with teeth: it takes strength, blood, and retaliation together. |
| coven-wither | Wither (spell) | enemyCreature | -2 | -2 | -2 | -2 | -1 | Withering dries marrow and confidence; the reflect hit is a point lighter than the body hits. |
| coven-nightmare | Nightmare (spell) | enemyCreature | -3 | -3 | -3 | -3 | -2 | Nightmares shatter the will to counter — the largest debuff gains a proportional reflect sting. |
| coven-raven | Raven (battlecry) | enemyCreature | -1 | -1 | -1 | -1 | -1 | It counts the coven's debts in caws and graves — a full three-axis hex. |
| coven-decay | Decay (spell) | allEnemyCreatures | -2 | -2 | -2 | -2 | -1 | Rot preaches to everything that stands too proud — bodies wither, counters flag. |
| coven-transfix | Transfix (spell) | enemyCreature | -1 | -1 | -1 | -1 | -1 | The winter hex stills blood, breath, and the will to move — reflect included. |
| coven-mirrorhex | Mirror Hex (spell) | enemyCreature | -4 | -4 | -4 | -4 | -2 | The looking glass makes the curse fourfold on body and half that on the counter. |
| coven-apathy | Apathy (spell) | allEnemyCreatures | -3 | -3 | -3 | -3 | -2 | Indifference uncurls fists, lowers shields, and stops the answer — a large symmetric debuff with a strong reflect tax. |
| coven-glare | Morwenna's Glare (spell) | allEnemyCreatures | -1 | -1 | -1 | -1 | -1 | The glare is a death sentence with no appeal; the aura it leaves strips counters too. |
| coven-abyss | Abyssal Gaze (battlecry) | enemyCreature | -2 | -2 | -2 | -2 | -1 | It stares back and remembers your face — and withers your counter-bite. |
| coven-queen | The Hex Queen (battlecry) | allEnemyCreatures | -2 | -2 | -2 | -2 | -1 | Her crowning withers the whole world's bodies and a point of every counter. |
| coven-eternal | Eternal Night (artifact, startOfTurn) | allEnemyCreatures | -1 | -1 | -1 | -1 | -1 | The hourglass that never empties: a standing three-axis tax every dawn. |
| hero:coven | Hex (hero power) | enemyCreature | -1 | -1 | -1 | -1 | -1 | A repeatable full-axis wither — the coven's signature stays consistent with its spells. |

### 5.2 Design notes on buff deltas

1. **No buff silently defaults.** Every one of the 31 effects above carries an explicit `value3`. The engine already applies `value3 ?? 0` (`effects.ts` buff case); Task 5's implementation stores these numbers verbatim.
2. **Positive buffs grow a modest reflect component.** Most +1/+1 and +2/+2 buffs gain +1 Reflect. That is the intended three-axis expansion (Decision 5 — buffs may modify all three axes); it is also a slight power increase over today, which is why each row is individually listed for approval rather than defaulted.
3. **Coven debuffs reduce Reflect, and negative live Reflect is a real risk.** `buffRef` today does `c.reflect += refl` with no floor, and combat uses `defender.reflect ?? 0` as counter-damage — a debuffed creature pushed below 0 would deal *negative* damage (heal) if it were ever attacked into. **Implementation note for Step 5:** authored values keep every deck-legal interaction away from this in practice (the largest single-target stack is mirrorhex -2 reflect; no shipped creature starts at reflect 0 with a mirrorhex-able board state reaching -2 and still living), but the implementation should clamp live Reflect at 0 when applying buffs to be safe — mirroring how the game already tolerates negative attack. This is an implementation safety check, not an engine contract change.
4. **Excluded effects.** `giveKeyword` (vigil-hymn, vigil-sanctify, vigil-divine, dance-veil) and `spellPower` (ember-firebrand, star-mage) alter keywords/spell damage, not combat stats, so they are outside this ledger. Lifesteal granted by `giveKeyword` interacts with Reflect damage at combat time but has no stat delta of its own.
5. **Zero-only buffs remain invalid** (Task 1 Step 8): no proposal here is zero-only; every buff keeps at least one non-zero delta.

---

## 6. Pool statistics (computed from the ledger; re-verified by script)

### 6.1 Population

- **140 curated creatures + 6 token creatures = 146 rows.** Assertions that must not be read against the wrong filter: `pool.filter(c => c.type === "creature" && c.archetype !== "token")` yields **140**; adding tokens yields **146**. The 278 immutable non-token IDs and the 285-card inventory (adds `mana-surge`) are unchanged.

### 6.2 Mean of `Reflect - Attack`

- All 146 creatures: **-0.062** (sum -9 over 146) — inside [-0.5, +0.5].
- 140 curated only: **-0.064** — inside the band.
- The 6 tokens contribute 0.

### 6.3 High-Reflect outliers (`Reflect - Attack ≥ +2`) — with justification

| card | A | R | Δ | justification |
| --- | --- | --- | --- | --- |
| bone-cairn | 0 | 3 | +3 | 0-attack taunt wall with a triple-skeleton deathrattle — Reflect is the entire deterrent. |
| coven-scare | 1 | 4 | +3 | 1/7 taunt scarecrow — a pure tax wall; the whole card is its counter-bite. |
| vigil-shieldbearer | 1 | 3 | +2 | 1/6 taunt + shield — a wall that wears attackers down. |
| neutral-sentinel | 1 | 3 | +2 | 1/4 taunt sentry — the archetypal neutral tax wall. |
| dragon-seer | 2 | 4 | +2 | Draw-every-turn engine — killing her must be an investment. |
| bone-king | 8 | 10 | +2 | Legendary taunt + triple-skeleton deathrattle — the horde's throne taxes its own destruction. |
| coven-queen | 7 | 9 | +2 | Legendary mass-wither — the control finisher holds the circle while the world fades. |

Reflect-heavy finishers in absolute terms (all ≥ 9, all with role justification in their rows): roots-worldmother 12, star-archon 12, dragon-worldeater 11, roots-titan 11, bone-king 10, coven-queen 9, bone-overlord 9, vigil-aldric 9, neutral-titan 9.

The mirror-image attack outliers (`Attack - Reflect ≥ 3`): **pact-fiend (6/3, -3)** is the only -3 — a self-damage aggressor by identity. The -2 attack-lean group is led by ember-ashwing (7/5, charge finisher), with hellhound, phoenixwhelp, phoenix, dervish, imp, ravager, wanderer, and megastar.

### 6.4 Weighted-budget exceptions (called out, not hidden)

Every row is within its ceiling (`statBudget(cost) + 4`); the script verifies all 146. The only rows that spend **above the vanilla budget** (`statBudget(cost) = 2 + 2·cost`) are the two 0-cost tokens, exactly as the shipped `validate.ts` comment documents:

| card | cost | spend | budget | slack used | why |
| --- | --- | --- | --- | --- | --- |
| token-treant | 0 | 3 | 2 | 1 | 1/1 taunt token; paid by roots-awaken / roots-heart. |
| token-phoenixash | 0 | 4 | 2 | 2 | 2/2 token; paid by ember-phoenix's deathrattle. |

No curated creature exceeds its vanilla budget under this proposal; several sit near the ceiling with room to spare (max: star-archon 25 vs ceiling 28).

**Textless floor note.** `pool-balance.test.ts` requires creatures with no effect text (including keyword-only bodies — `cardText` reflects triggers only) to stay within 2 of their stat budget. Ten aggressive keyword creatures were authored at that floor rather than at a deeper negative lean, so the existing suite stays green with no test edits: ember-flamewhelp, ember-ashwing, ember-magmasoul, dragon-tyrant, dance-nyx, vigil-crusader, vigil-avenger, storm-rider, storm-zephyra, neutral-swift. Each row's rationale records the floor. The five textless non-keyword creatures (bone-scrapper, bone-marauder, pact-imp, coven-familiar, coven-bog) all remain at or above `statBudget - 2`.

### 6.5 House means (curated population per house)

| house | n | mean A | mean R | mean Δ (R-A) |
| --- | --- | --- | --- | --- |
| ember | 13 | 4.08 | 2.92 | -1.15 |
| choir | 10 | 3.60 | 4.30 | +0.70 |
| vermin | 12 | 3.58 | 2.67 | -0.92 |
| dragon | 14 | 4.21 | 4.36 | +0.14 |
| roots | 11 | 5.27 | 5.64 | +0.36 |
| dance | 8 | 4.63 | 3.75 | -0.88 |
| bone | 12 | 3.83 | 4.83 | +1.00 |
| pact | 9 | 4.89 | 3.67 | -1.22 |
| coven | 7 | 4.29 | 4.86 | +0.57 |
| star | 11 | 5.55 | 5.45 | -0.09 |
| vigil | 11 | 3.91 | 4.73 | +0.82 |
| storm | 10 | 4.90 | 4.50 | -0.40 |
| neutral | 12 | 3.50 | 3.67 | +0.17 |
| token | 6 | 1.17 | 1.17 | 0.00 |

---

## 7. Approval summary (for user review)

### 7.1 One table per house

**Ember Court (13)** - lean Aggressor (R < A). Mean A 4.08 -> mean R 2.92, Δ -1.15. Outliers: hellhound, phoenixwhelp, ashwing, phoenix (-2).
**Hollow Choir (10)** - lean Guardian (R > A). Mean A 3.60 -> mean R 4.30, Δ +0.70. Outliers: none ≥ ±2; exorcist & lady lead at +1.
**Vermin Swarm (12)** - lean Weak Width (R ≤ A). Mean A 3.58 -> mean R 2.67, Δ -0.92. Outliers: scavenger, brute, warband (-2).
**Dragonflight (14)** - lean Balanced (Δ +0.14). Mean A 4.21 -> mean R 4.36. Outliers: seer (+2).
**Elder Roots (11)** - lean Ramp Wall (R ≥ A). Mean A 5.27 -> mean R 5.64, Δ +0.36. Outliers: none ≥ ±2.
**Shadow Dancers (8)** - lean Evasion/Aggressor (R < A). Mean A 4.63 -> mean R 3.75, Δ -0.88. Outliers: dervish (-2).
**Bone Horde (12)** - lean Rebuild/Defensive (R ≥ A). Mean A 3.83 -> mean R 4.83, Δ +1.00. Outliers: cairn (+3), king (+2).
**Grave Pact (9)** - lean Aggressor/Self-damage (R < A). Mean A 4.89 -> mean R 3.67, Δ -1.22. Outliers: imp & ravager (-2), fiend (-3).
**Night Coven (7)** - lean Control (R ≥ A). Mean A 4.29 -> mean R 4.86, Δ +0.57. Outliers: scare (+3), queen (+2).
**Starforged (11)** - lean Balanced (Δ -0.09). Mean A 5.55 -> mean R 5.45. Outliers: wanderer, megastar (-2).
**Eternal Vigil (11)** - lean Healing Wall (R ≥ A). Mean A 3.91 -> mean R 4.73, Δ +0.82. Outliers: shieldbearer (+2).
**Stormwrought (10)** - lean Spell Tempo (R < A). Mean A 4.90 -> mean R 4.50, Δ -0.40. Outliers: none ≥ ±2.
**Neutrals (12)** - lean Balanced (Δ +0.17). Mean A 3.50 -> mean R 3.67. Outliers: sentinel (+2).
**Tokens (6)** - parity (Δ 0.00). Mean A/R 1.17.

Pool (146): mean Δ **-0.062** - inside [-0.5, +0.5] with margin. Pool-wide diversity: **48** creatures have R < A, **54** have R = A, **44** have R > A; the eight largest positive deltas are listed and justified in §6.3.

### 7.2 Decisions the user is approving

1. All 146 authored Reflect values (§2–§4) — including the full **negative lean of the five aggressive houses** (Ember, Vermin, Grave Pact, Shadow Dancers, Stormwrought), the **positive lean of the defensive/control houses** (Bone, Vigil, Choir, Coven, Roots), and balanced houses (Dragonflight, Starforged, Neutrals, Tokens).
2. The **high-Reflect outliers** in §6.3 (cairn, scare, shieldbearer, sentinel, seer, bone-king, coven-queen) and the single attack outlier (fiend).
3. The **31 buff `value3` proposals** in §5 — every combat-stat buff and both buffing hero powers gain an explicit Reflect delta (positive buffs +1/+2, coven debuffs -1/-2), with current `value`/`value2` untouched.
4. The **safety clamp note** (§5.2.3): implementation should floor live Reflect at 0 when applying buffs.
5. No changes to any ID, cost, Attack, Health, keyword, trigger, or deck membership — the ledger proposes Reflect values and buff deltas only.
6. Pool-wide mean **-0.062** (146) / **-0.064** (140) accepted as inside [-0.5, +0.5].

---

## Approval question

**APPROVED 2026-08-10.** The user approved the 146 creature Reflect values (§2–§4) and the 31 buff Reflect deltas (§5), including the house leans, the §6.3 outliers, and the §5.2 clamp note, for implementation in Task 2 Steps 4–5. Task 2 proceeded to Step 4 (explicit `reflect` in the builder signature) and Step 5 (apply values); the implementation and its verification are recorded in the adjacent Task 2 commit and in `.superpowers/sdd/2026-08-09-reflect-dynamic-combat/task-2-report.md`.
