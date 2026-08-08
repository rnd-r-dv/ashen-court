# Ashen Court — Rebalance, Mechanics, and the Armorial Rework

Date: 2026-08-08
Status: awaiting user review

## 1. Why this work exists

Seven complaints from play, investigated in code before any design was drawn:

| # | Report | Verdict | Evidence |
|---|---|---|---|
| 1 | Hero skills not shown | Confirmed | `app/src/components/HeroPortrait.tsx:174` — power text lives only in a native `title` tooltip; the enemy's power is never readable |
| 2 | Board creatures have no descriptions | Confirmed | `app/src/components/Board.tsx:203` — creature `onClick` is wired to targeting/attacker-select only; no inspect path |
| 3 | Some cards don't work | Partly confirmed | Root causes are #6 and #7; the remainder is a balance problem, not a defect |
| 4 | Defense doesn't trigger | **Not a bug** | See §2 |
| 5 | Cards don't feel fun | Confirmed, quantified | 106 of 278 non-token cards carry zero rules text; `dealDamage` is 75 of ~200 effect instances; high-cost vanillas sit 4-6 under `statBudget` |
| 6 | Ramp artifact resets mana | Confirmed | `core/src/engine/game.ts:564-565` |
| 7 | Summon 9 Rats onto 7 slots | Confirmed | `core/src/engine/effects.ts:379` |

### 1.1 The stat-curve inversion (#5)

`statBudget(cost) = 2 + 2 * cost`. Measured against it, expensive vanilla
creatures are systematically underpowered:

| Card | Cost | Spent | Budget | Deficit |
|---|---|---|---|---|
| Zephyra | 10 | 18 | 22 | −4 |
| Overlord | 9 | 16 | 20 | −4 |
| Nyx, the Last Dance | 9 | 16 | 20 | −4 |
| Abyssal Gaze | 9 | 16 | 20 | −4 |
| Wyrm Tyrant | 8 | 14 | 18 | −4 |
| Prince of Scales | 7 | 11 | 16 | −5 |

No card in the pool exceeds the ceiling. The curve only errs downward, so
late-game cards are strictly worse per mana than early ones and games are
decided before expensive cards matter.

## 2. Bug #4 resolved: there is no defense stat

The report was "a creature hit another creature with positive defense and it
didn't deal damage back / receive the damage."

Ashen Court has no defense, armor, or block stat. A board creature renders
three numbers, and `CardFrame.tsx:120-122` draws the mana-cost gem
unconditionally — including on the board, where cost is meaningless. On Bulwark
Knight that reads `5` (cost, top-left), `4` (attack), `5` (health). The cost
gem was read as a defense stat.

Retaliation is real but comes from the defender's **attack**
(`core/src/engine/game.ts:196-197`):

```ts
this.dealDamage(attacker, defender, attacker.attack);
if (defender.health > 0) this.dealDamage(defender, attacker, defender.attack);
```

The `defender.health > 0` gate is the actual anomaly and explains the
"sometimes": a defender killed outright deals nothing back. Neither Hearthstone
nor Magic works this way. Verified across five engine cases — shielded
defender, shielded attacker, warded defender, zero-attack defender, and a
lethal trade — every one behaved as written; nothing was broken.

**Resolution:** make combat simultaneous, hide the cost gem on board
creatures, and key every remaining number.

## 3. Decisions taken

| Decision | Choice |
|---|---|
| Rebalance depth | Retune + de-vanilla + new mechanics |
| Over-cap summons | Separate token row with its own cap |
| Card IDs | All 278 stay stable (art seeds and saved decks depend on them) |
| Retaliation | Simultaneous — defenders swing even when killed |
| Board stats | MTG-style power/toughness; cost gem hidden once played |
| Discover | In scope, with its own phase |
| Visual world | The Armorial (§7) |

## 4. Engine fixes

### 4.1 Mana clobber (#6)

`beginTurn` computes `maxMana`, emits `turnStart` — whose dispatch fires
startOfTurn triggers, so a ramp artifact's `gainMana` lands — and *then* emits
a `manaChanged` built from the pre-trigger value, overwriting the ramp.

**Fix:** emit `manaChanged` before `turnStart`, so trigger effects stack on top
of the turn's baseline rather than being overwritten.

**Test:** with Sylvan Grove on board, `maxMana` rises by 2 per turn (+1 turn,
+1 artifact). Currently 1. Covers `roots-sylvan` and `neutral-idol`.

### 4.2 Simultaneous combat (#4)

Capture `defender.attack` into a local **before** the attacker's damage
resolves, then apply it unconditionally. The captured value matters: the
defender may be removed from the board mid-resolution, so re-reading it after
the fact is unsafe.

Retaliation damage must still route through `EffectCtx` with the defender as
source, so retaliation lifesteal continues to heal the defender's controller.

**Tests:** a lethal trade kills both; a 0-attack wall still deals nothing; ward
and shield behave unchanged; retaliation lifesteal heals correctly.

### 4.3 Token row (#7)

Add `token: boolean` to `CreatureState` and a `TOKEN_CAP` beside `BOARD_CAP`.
`BOARD_CAP` counts non-token creatures only; tokens fill their own cap.

Keeping one `board` array — rather than a second collection — means every
existing `find`, targeting, AoE, and serialization path continues to work
untouched. The split is a render concern plus two cap checks.

`makeCreature` marks tokens from the card's presence in `TOKEN_CARDS`.
Serialization gains the field; `deserialize` defaults it to `false` so older
saved states still load.

### 4.4 Ward and Shield disambiguated

Today Ward fizzles targeted spells only (`game.ts:237-240`) and Shield absorbs
one damage instance — overlapping, and neither is stated on any card.

- **Ward:** absorbs the next enemy *spell or effect* that targets this creature.
- **Shield:** absorbs the next *damage* instance from any source.

Both gain generated rules text so the distinction is visible in play.

## 5. New mechanics

Each requires a coordinated change across `effects.ts` (behavior),
`cardtext.ts` (generated text), and the Forge preset list, per the existing
architecture rule.

### 5.1 Effect kinds

| Kind | Behavior | Home |
|---|---|---|
| `silence` | Strip a creature's keywords and triggers | Neutral, Coven |
| `returnToHand` | Bounce a creature to its owner's hand | Neutral, Dance, Storm |
| `consume` | Destroy a friendly token for a payoff | Vermin, Bone, Pact |
| `discover` | Choose 1 of 3 generated candidates | Neutral, Star, Choir |

### 5.2 Keywords

| Keyword | Behavior | Cost | Home |
|---|---|---|---|
| `venom` | Any creature this damages is destroyed | 2 | Vermin, Coven |
| `stealth` | Untargetable by the enemy until it attacks | 1 | Dance, Coven |

`venom` is deliberately strong under simultaneous combat: a cheap venomous body
now genuinely threatens a large one, which is the pressure release the inverted
curve needs.

### 5.3 State-carried mechanics

- **`spellPower`** — a `CreatureState` field summed across the controller's
  board and added to spell `dealDamage`. Ember, Storm, Star build-arounds.
- **`overload`** — a card is cheap now and locks N mana next turn. Stored on
  `PlayerState`, applied in `beginTurn` after the baseline `manaChanged`
  (§4.1's ordering makes this correct by construction).

### 5.4 Discover

The only mechanic needing new plumbing.

- `Intent` gains `{ kind: 'discover'; choice: number }`.
- `GameState` gains a `pendingChoice` holding the acting player and three
  candidate card ids, drawn via the seeded RNG so replay stays deterministic.
- While `pendingChoice` is set, `legalIntents` returns only the three discover
  intents — no other action is legal.
- **The wire needs no protocol change.** `server/src/protocol.ts` carries
  `Intent` by import from `@ashen/core`, so a new variant rides for free. The
  server must extend its identity gate to check `pendingChoice.player` rather
  than only the acting player.
- App: a choice overlay rendered from `pendingChoice`.

**Tests:** replay determinism across serialize/deserialize with a pending
choice; the server rejecting a discover from the wrong socket; no other intent
legal while a choice is pending.

## 6. Rebalance

Constraints: all 278 ids stable; `validateCard` must keep passing; every card's
text stays generated.

1. **Correct the curve.** Raise high-cost creatures to sit within
   `statBudget ± STAT_BUDGET_SLACK` instead of 4-6 below it.
2. **De-vanilla.** Cut blank cards from 106 to at most 45 (≈16% of the pool)
   using the kit in §5 plus existing kinds. Vanilla bodies are retained
   deliberately at the low end of the curve, where a plain 2/3 is a real play
   and a pool of nothing but text reads as noise; the cards that gain text are
   the mid- and high-cost ones, which is where the deficit in §1.1 sits.
3. **Archetype identity.** Each of the twelve gets one payoff loop and one
   burst turn it builds toward, addressing the "more bursty turns" request:
   Ember (spellPower burn), Choir (heal-to-value + discover), Vermin (token
   flood + consume), Dragon (tribal buff), Roots (ramp into oversized threats),
   Dance (cheap-spell chains + stealth), Bone (deathrattle recursion), Pact
   (self-damage payoff), Coven (silence/venom control), Star (cost reduction
   into a huge turn), Vigil (defensive lifesteal), Storm (spell cost reduction
   + overload).
4. **Summon counts** fall within `TOKEN_CAP` so no card is a partial lie.

Regenerate `graphify-out/CARDS.md` from `buildPool()` afterward as the record.

## 7. The Armorial — visual world

### 7.1 Direction contract

- **THESIS.** Twelve archetypes are twelve houses; heraldry is already a strict
  grammar for encoding identity in a fixed vocabulary, which is what "cards are
  data" means here. Refuses the torch-lit tavern the category always ships —
  no carved wood, no gold filigree, no ember glow — and refuses its flat-gray
  opposite.
- **OWN-WORLD.** A roll of arms: flat heraldic tinctures in a woodcut register
  on an iron-gall ground, cream engraved hairlines, charges drawn as flat SVG
  in the world's own grammar. No bevels, gradients, glows, or faux metal.
- **STORY.** A player reads the field as a page of arms: whose house holds
  what, what each figure is, and what every number means.
- **FIRST VIEWPORT.** The board as a ruled page — two banded registers divided
  by an engraved rule, each under its house banner in the margin, the token row
  a visibly subordinate sub-band.
- **FORM.** Blazon × codex (armorial), fused from grounded candidates 4 and 6
  under an explicit user pin toward archaic/MTG. Seed key `b730d38a`.
- **FINISH.** unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.

### 7.2 Tokens

- Ground: iron-gall near-black `#14120F`.
- Line: cream `#E8E0CE` hairlines and rules.
- Twelve flat house tinctures, one per archetype, unmodulated.
- **Gules `#A81E22` is reserved exclusively for damage.** It never decorates.
- **Or `#B8913C`** marks legendary rarity and the active turn only.
- Type: **Cardo** throughout — cut for medieval scholarship, so the archaism is
  derived rather than costumed. Regular for generated rules text, italic for
  flavour, small caps for keywords and house names, tabular figures for stats.
  Deliberately not the Trajan/Cinzel fantasy reflex.

### 7.3 UI fixes carried by the rework

- **Cost gem struck on play.** Board creatures show two keyed numbers.
- **Keyed stats.** Attack and health carry small-caps keys, so no number is
  ever bare. This is the direct fix for §2.
- **Card inspect (#2).** Clicking any board creature — either side — opens the
  full plate with generated rules text. Hands stay hidden.
- **Hero power visible (#1).** The power's name, cost, and generated text
  render as a permanent blazon in the margin for *both* heroes. No hover-only
  affordance; the existing `title` tooltip is not the mechanism.
- Mana reads as a filled/unfilled pip ledger, not glowing crystals.

Scope is desktop and laptop only, per PRODUCT.md.

## 8. Sequencing

1. Engine fixes (§4) — independently testable, no UI dependency.
2. New mechanics (§5.1-5.3).
3. Discover (§5.4) — engine, server gate, app overlay.
4. Rebalance (§6) — depends on 1-3 existing.
5. The Armorial (§7) — depends on 4 only for final card text.

Phases 1-4 are verified by `npm test`. Phase 5 ends with the finish review and
DESIGN.md, per the contract above.

## 9. Risks

- **Simultaneous combat invalidates existing balance intuitions.** It is a
  deliberate rule change, and §6 retunes on top of the new rule, not the old.
- **Discover touches the LAN identity gate.** The wire type is free, the
  authorization check is not; it needs its own test.
- **The tincture system must not fight the committed card art.** The art keeps
  its own window; tinctures are the mount, never the image.
- **Token row changes board geometry**, which every match-screen layout assumes.
