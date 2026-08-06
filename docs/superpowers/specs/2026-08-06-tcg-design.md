# Design: Dark Fantasy Trading Card Game ("Ashen Court")

Date: 2026-08-06
Status: Draft for review

## 1. Overview

A two-player digital trading card game in the Hearthstone mold, set in a dark fantasy world. Players build/select 60-card decks, spend growing mana each turn, and reduce the opponent's hero to 0 HP. Ships with 12 curated archetype decks (each with a named hero + signature hero power), a card forge for custom cards (palette-based keywords, custom image upload), a deck builder, and three play modes: vs bot (3 difficulties), hotseat on one device, and LAN on two devices.

Platform: web app (React + TypeScript + Vite), Node WebSocket server for LAN.

## 2. Goals

- Gameplay that feels like a real TCG (mana curve, tempo, board control, combos) but is approachable and fast.
- 12 curated decks that each express a distinct, well-known archetype game plan and are fun against each other.
- Custom cards that actually work in-game, validated, shareable via JSON.
- Exciting presentation: dramatic animations, cohesive dark-fantasy visual identity, procedural card art so 250+ cards need no external assets.
- One shared, deterministic rules engine drives bot / hotseat / LAN — no mode-specific rule drift.

## 3. Non-Goals (explicit scope cuts)

- No deck-size > 60 rules, no sideboards, no tournament/ranked mode, no accounts.
- No card packs / collection economy / currency.
- No free-text card effect parser (palette-based effects only by design; see §9).
- No AI training, no MCTS with neural networks — bot uses heuristics + bounded lookahead.
- No mobile/touch-specific layout (desktop-first, degrades to tablet).
- Custom cards are not claimed to be balance-competitive; they're for fun.

## 4. Core Rules (Hearthstone-style)

- **Heroes**: 30 HP. Archetype heroes have a signature hero power (2 mana, once per turn, may cost life instead for some).
- **Mana**: start 1 crystal, +1 each turn, **cap 15**. Second player receives a 0-cost "Mana Surge" spell token (the Coin) usable once.
- **Hand/deck**: 60-card decks, draw 1 per turn; empty deck = stop drawing (no fatigue damage). Opening hand 3 cards, one-time mulligan (choose any number to redraw; opponents' keeps hidden).
- **Turn**: draw → play cards / hero power / attack in any order → end. No timers by default.
- **Card types**:
  - **Creature**: cost, attack, health, keywords/effects. Plays to battlefield; may attack once per turn (created/played creatures need Rush to attack the same turn, Charge to hit heroes immediately).
  - **Spell**: one-shot effect, then discarded.
  - **Artifact**: permanent ongoing effect on the battlefield (persistent enchantment).
- **Keywords** (the full curated set; doubles as the editor palette):
  - Static: **Taunt** (must be attacked first), **Rush** (attack same turn, creatures only), **Charge** (attack hero immediately), **Windfury** (attacks twice per turn), **Lifesteal** (heal hero = damage dealt), **Ward** (first spell fizzles), **Shield** (absorbs one hit; Shield from any source).
  - Trigger: **Battlecry** (on play), **Deathrattle** (on death), **Start of turn**, **End of turn**, **On damage**.
- **Effect library** (composable by keywords, spells, artifacts): deal N damage (target / all enemies / random enemy / all), draw N, heal N (hero or creature), buff +N/+N (target or all friendly), summon token creature, gain +N mana crystals (empty or filled), freeze (skip next attack), destroy a creature (no damage), copy a card.
- **Interaction rules**: attacker chooses targets; Taunt restricts. Damage is dealt in full (no MTG damage-on-the-stack). When a creature dies mid-resolution, its Deathrattle fires before the queue advances. Spell targeting obeys current board state.
- **Win**: reduce opponent hero to 0 HP. Draws are possible only if both die simultaneously (count as both win, styled as "mutual destruction").
- **Mulligan rules**: one pass; keep any subset; redraws are randomized from the remaining deck; both players mulligan simultaneously, each sees only their own.

## 5. Engine Architecture

The core is a framework-free TypeScript module (`core/`) with **zero DOM/IO dependencies** — the same instance runs in tests, bot matches, hotseat, and as the authoritative engine in a LAN room.

### 5.1 Event-driven action system

Following the proven CCG pattern (event bus + handler queues), every game action (play card, attack, hero power, end turn, draw) is an **Intent** that the engine validates and resolves into a sequence of **Events**:

```
Intent (e.g. PlayCard(id=42, target=creature X))
  → validate (cost, legal target, phase)
  → apply cost, mutate state
  → emit events: CardPlayed, BattlecryResolve (→ DealDamage(3, X) → DamageTaken → OnDamage triggers → Deathrattle...)
  → resolve trigger queue deterministically until empty
```

- Each mutation emits typed events; keyword/effect handlers subscribe and enqueue follow-up events.
- **Deterministic resolution**: fixed handler ordering (defined per event type in the engine, not by insertion order), no reliance on JS object key order, seeded RNG for all randomness so a game can be replayed byte-for-byte from its seed.
- **Serializable**: the entire GameState (boards, hands, decks as card IDs, counters, RNG seed/stream) serializes to JSON; intents are plain objects. This is what makes LAN sync (and replays, and bot lookahead) trivial.

### 5.2 Module layout

- `core/game.ts` — Game state, phase machine, turn flow.
- `core/engine.ts` — intent validation + resolution, event queue.
- `core/events.ts` — event type definitions + trigger registry.
- `core/effects.ts` — effect library implementations (pure functions over state).
- `core/keywords.ts` — keyword handler wiring.
- `core/cards.ts` — card model, validation (against the same rules the Forge uses), card registry.
- `core/bot.ts` — AI policies (§10).
- `core/serialize.ts` — state ↔ JSON, seed management.
- `server/` — tiny WebSocket server, room registry (§11).
- `app/` — React frontend (§12).

### 5.3 Testing contract

- Engine is 100% testable headless: tests construct states, submit intents, assert state/events.
- Every keyword and effect has unit tests; turn/phase/mulligan/win rules have integration tests; bot tests assert legal intents only; LAN tests do message round-trips against a real server.

## 6. Card Model

```
{
  id: string,            // stable, e.g. "ember-rage-014"
  name: string,
  type: 'creature' | 'spell' | 'artifact',
  cost: 0..15,
  attack?: 0..N, health?: 1..N,     // creatures
  keywords: Keyword[],
  effect: EffectSpec | null,         // battlecry/deathrattle/aura/ongoing
  effectTriggers: 'battlecry'|'deathrattle'|'startOfTurn'|'endOfTurn'|'onDamage'|null,
  rarity: 'common'|'rare'|'epic'|'legendary',
  archetype: ArchetypeId | 'neutral',   // for flavor + deck metadata
  art: ArtRecipe,                      // procedural recipe OR uploaded image ref
  flavor?: string,
  author?: 'curated' | 'custom',
  version: number                      // custom-card edit versioning
}
```

- **Copy limits by rarity**: common ×3, rare ×2, epic/legendary ×1 per deck (supersedes the generic "3 copies" rule).
- **Card pool**: ~250–350 unique curated cards (12 archetypes × signature cards + shared neutral staples: removal, draw, ramp, heals).
- **Balance skeleton**: each archetype's game plan maps to a mana-curve shape (aggro front-loaded, control back-loaded) and a signature mechanic (see §7). Card stats follow a linear cost→stat formula (e.g. vanilla creature ≈ 1 mana per 1/1 + modifiers) so nothing is wildly off; the formula is enforced for curated cards too.

## 7. The 12 Archetype Decks

Each deck: 60 cards, hero + hero power, explicit **game plan statement**. Staples (removal/draw/ramp) shared across decks where the plan calls for them.

| # | Deck | Archetype | Game plan | Hero power (2 mana, 1/turn) |
|---|------|-----------|-----------|------------------------------|
| 1 | The Ember Court | Burn/Aggro | Cheap bodies + direct damage to face; race, then burn out | Deal 1 damage to any target |
| 2 | The Hollow Choir | Control | Remove everything early, heal, drop late-game bombs | Heal 2 |
| 3 | The Vermin Swarm | Zoo | Flood cheap creatures, buff the wide board | Summon a 1/1 Rat |
| 4 | The Dragonflight | Midrange tribal | Curve dragons; dragon-in-hand synergy | Give a friendly dragon +1/+1 |
| 5 | The Elder Roots | Ramp | Gain mana crystals, play giants early | Gain an empty mana crystal |
| 6 | The Shadow Dancers | Combo | Cycle cheap cards, discounts, one explosive turn | Draw a card (costs 2 life too) |
| 7 | The Bone Horde | Token swarm | Deathrattles spawn tokens, board-wide buffs | Summon a 1/1 Skeleton |
| 8 | The Grave Pact | Self-damage / life-swap | Pay HP for power; punish low life totals | Take 1 damage, draw a card |
| 9 | The Night Coven | Debuff control | Shrink enemy creatures permanently, hex | Give an enemy creature −1/−1 |
| 10 | The Starforged | Big-mana cheat | Reduce costs, play titans ahead of curve | Cheapest card in hand costs 1 less this turn |
| 11 | The Eternal Vigil | Sustain grind | Lifesteal, shields, outlast anything | Heal 1 to all friendly creatures |
| 12 | The Stormwrought | Tempo spells | Spells that leave a body, swingy momentum | Your next spell this turn costs 1 less |

Neutral staples pool spans all plans: 2–4 cost removal, 2–3 cost draw, ramp cards, small heals.

## 8. Rarity + Collection Feel

- Rarity tints card frames (common plain → legendary animated glow) and drives copy limits (§6).
- Every deck ships with a "legendary" centerpiece creature that embodies the archetype (e.g. Ember Court's phoenix).

## 9. Card Forge (custom cards)

- **Editor**: pick type; set name/cost/stats; pick keywords and effects from the same curated library as the engine (§4); targets and values via pickers/sliders; art = procedural preset (element/style) or **uploaded image**; flavor text.
- **Validation** (shared module used by engine AND editor):
  - cost/stat sanity (e.g. no 0-cost 15/15; cost↔stat formula warnings, hard caps)
  - illegal keyword combos (e.g. Taunt+Ward on a spell)
  - effect target/card-type mismatches (e.g. "gain +N/+N" on a spell with no target)
  - blockers: no cards that reference cards/decks outside the pool (custom cards can't self-reference future cards)
  - All errors surface as human-readable messages in the Forge before save.
- **Storage**: localStorage (survives refresh); **export/import as JSON** to share between machines (LAN play works because decks are serialized with the match).
- Custom cards can be used in the deck builder like any card. No balance guarantee vs curated pool (§3).

## 10. Bot AI

All difficulties produce *legal intents only* (validated by the engine before apply — bots can never cheat):

- **Recruit**: random legal play each step (great for learning the UI).
- **Veteran**: greedy heuristic — for each legal action, score resulting state (board value = Σ(attack+health weighted), tempo, hero life totals, card advantage), take best; attacks optimally favorable; uses hero power when it improves score.
- **Grandmaster**: heuristic + bounded search — enumerate action sequences to depth ~2-3 with a time budget (~1s/turn), score leaf states with the same heuristic + minor random tiebreak (seeded so games are replayable). No ML.

Bot module is pure over GameState → Intent; testable headless.

## 11. Game Modes

### 11.1 Bot
- Deck pick → difficulty pick → match. Bot runs the same engine in-process.

### 11.2 Hotseat (2 players, 1 device)
- Pass-and-play: "hand conceal" overlay + "pass device" prompt between turns; no timers; match stats tracked.
- Both players pick decks at match setup (can see each other's choice — fine on one device).

### 11.3 LAN (2 players, 2 machines)
- Small Node WebSocket server (no external deps beyond `ws`).
- **Host** creates match → 4-letter room code (styled display). **Join** enters code.
- **Server-authoritative**: server owns the room's GameState; clients send intents; server validates, applies, broadcasts resulting state/events (state deltas or full snapshots — full snapshot each action is fine at LAN scale).
- **Deck sync**: host's chosen deck (incl. custom cards) serializes into the match; joiner receives it on join (before mulligan). Custom cards work across machines without prior sharing.
- **Disconnect**: banner + keep room alive N minutes for reconnect (joiner re-enters via code); rematch button after match.
- Cheating not a concern on trusted LAN; server-authoritative remains the single source of truth.

### 11.4 Flow
Menu → mode select → deck pick → match → victory/defeat screen (turns, damage dealt, cards played) → rematch/new game.

## 12. Frontend & Animation

- **Identity**: dark fantasy — deep violet/indigo/black, ember-gold accents, gothic frames, animated ambient background (floating embers, fog). One design language across screens.
- **Procedural card art**: layered recipe per card — element palettes (fire/ice/shadow/nature/arcane), silhouette/shape compositions, runic glyphs, rarity frame treatment. Uploaded images override the art layer. All curated cards get art recipes in data (no external assets).
- **Battlefield**: board with drop-zone glow for playable cards; enemy row grayscaled until revealed; fanned hand with hover-lift; mana tray with crystal glow; hero portraits with ticking HP counters.
- **Animation system** (all skippable + "fast mode"):
  - draw: slide-in whoosh; play: slam + ripple; attack: lunge + impact shake + damage popups; death: dissolve to embers/soul wisps; spells: projectiles (fireball arc, frost ring), screen tint flash; hero power: glyph flash; turn change: banner sweep + board pulse; win: slow-mo + bloom + ember burst.
- **Screens**: menu, mode select, deck pick, deck builder, Forge (card editor), match, victory/defeat, LAN host/join.
- **Responsive**: desktop-first, degrades to tablet; keyboard shortcuts (end turn, mulligan).

## 13. Tech Stack (locked)

- TypeScript everywhere.
- `app/`: React + Vite + CSS/Framer-Motion for animation (no heavy game libs; custom canvas for particles if needed).
- `server/`: Node + `ws` (WebSocket).
- Tests: Vitest (engine/bot/validator unit + integration), supertest-style WS round-trip tests against the real server.
- Storage: localStorage for custom cards/decks; import/export JSON.
- Monorepo layout: `core/`, `server/`, `app/` in one repo, shared TS config; engine bundled into server via plain TS build (no framework).

## 14. Build Phases

1. **Engine + tests** (event system, keywords, effects, phases, mulligan, win) — TDD, headless.
2. **Card data + 12 decks** (pool, recipes, balance skeleton; validator shared with Forge).
3. **Bot** (3 policies on engine).
4. **Forge + deck builder** (UI, validation UX, localStorage, JSON import/export).
5. **Hotseat + LAN** (modes, server, room codes, reconnect).
6. **Visual polish** (theme, art recipes, full animation system, responsive).

Each phase ends runnable and tested; UI exists from phase 4, phases 1–3 are engine/data/bot.

## 15. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Event-queue ordering bugs (trigger chains) | Deterministic handler registry + exhaustive keyword/effect unit tests; seeded replays |
| 250+ card design effort | Data-driven generation w/ balance formula; staples reuse; recipe-based art |
| Bot too weak/strong | Three tiers; Grandmaster time-budgeted lookahead; tune via test matches |
| LAN flakiness (NAT/network) | LAN-only scope; room code + reconnect grace; full-state sync keeps it simple |
| Custom-card breaking the engine | Shared validator at Forge + engine; palette restricts to known-good mechanics |
| Scope creep | Non-goals list (§3); phase gates |
