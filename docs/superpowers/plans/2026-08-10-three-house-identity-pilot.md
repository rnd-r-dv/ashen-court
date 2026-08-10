# Three-House Identity Pilot Implementation Plan (Ember / Bone / Vermin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ember Court, Bone Horde, and Vermin Swarm mechanically and feelably distinct by implementing the approved five-element identity contract for exactly those three houses — Ash Toll (overload) in Ember, deathrattle/rebuild with no reach in Bone, and Fodder Toll (gated immediate Consume) in Vermin — with no engine change beyond the shared immediate-Consume affordability gate, then play-testing all three to a separate user verdict per house.

**Architecture:** One narrow engine change — a pure, shared `immediateConsumeAffordability` helper consumed by `validatePlayCard` and `legalIntents` — makes Consume a real pre-play cost. House identity then lives entirely in card data (existing `EffectKind`s only: `overload`, `consume`, `destroy`, `dealDamage`, `buff`, `summon`) plus structural tests that make the approved contract executable. Reflect stays transitional (`reflect = attack`) through the existing builder; final Reflect authoring is deliberately deferred to the parent plan's Task 2.

**Tech Stack:** TypeScript (ESM, `.js` extension on relative imports), Vitest (node environment), existing `@ashen/core` engine and data modules. No new dependencies.

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-10-house-toll-identity-design.md` and the pilot brief. Every task's requirements implicitly include this section.

- **Card IDs are immutable.** All 278 non-token IDs stay (140 creatures + 124 spells + 14 artifacts). Art is seeded from `hashId(card.id)` — a rename repaints the card. Names, art, and flavor stay unless the redesigned card contradicts them. The baseline sorted-ID SHA-256 is `135705962902e62ca7443fb204c28544e0dfb8777715ea61b9605c69f7b29fa7`; count-only assertions are insufficient.
- **Reflect stays TRANSITIONAL.** `reflect = attack` via `archetypeCards().creature` (Task 1 of the parent plan). Do NOT hand-author final Reflect — the parent plan's Identity Gate runs this pilot precisely so Task 2 can author Reflect against stabilized roles. Do not add explicit Reflect to any curated card.
- **The ONLY engine change is the shared immediate-Consume affordability helper** in `core/src/engine/intents.ts`, consumed by `validatePlayCard` and `legalIntents`. No `GameState` field, no serialization change, no dispatch case, no RNG call, no new `EffectKind`, no targeting machinery, no conditional-resolution machinery.
- **Consume stays tokens-only, oldest-first** (`core/src/engine/effects.ts:188`). Immediate Consume clauses always precede payoff clauses on curated Toll cards; a Consume inside a later trigger (deathrattle/start/endOfTurn/onDamage) is a payoff, never a play cost.
- **No hero power may carry Consume.** Hero powers use a separate validation path; Consume there would silently bypass the gate.
- **Budget integrity is necessary, not sufficient.** `statBudget(cost)` and `STAT_BUDGET_SLACK = 4` are unchanged; deck size stays 60; `RARITY_COPY_LIMIT` stays. Validation prices stats and keywords, not effect packages — two-clause cards are balanced by play-test, never by claiming a green budget.
- **Scope is the three-house pilot only.** `ember-court`, `bone-horde`, `vermin-swarm`, plus shared tests and the shared legality behavior. The other nine houses stay untouched.
- **Deterministic replay and LAN mirroring stay byte-identical.** The gate filters legality only; it never mutates state.
- **Only existing `EffectKind`s** (`dealDamage`, `draw`, `heal`, `buff`, `summon`, `overload`, `consume`, `destroy`, `spellPower`, ...) may appear on redesigned cards.
- **Do not modify or delete untracked files** outside this plan's file lists.
- **One commit per independently reviewable task.** Each task ends with a full-suite green.

The approved `requiredConsumeTokens(card)` / `immediateConsumeAffordability(state, player, card)` contract (spec, "Exact affordability contract", items 1–7):

1. Toll scanning covers only effects that resolve immediately on play: `card.effects` plus effects from `when === 'battlecry'` trigger groups. Consume inside deathrattle, start/end-of-turn, or on-damage triggers is not a play cost and never gates the card.
2. `requiredConsumeTokens(card: Card): number` returns the sum of every immediate `consume` clause's `value ?? 1`.
3. `immediateConsumeAffordability(state: GameState, player: PlayerIndex, card: Card)` returns `{ required, available, payable }`, where `available` is the pre-play count of `CreatureState.token === true` and `payable` is `available >= required`.
4. Tokens summoned earlier in the same effect list do not make an otherwise unaffordable play legal: affordability always reads state before the play intent resolves.
5. Toll content places all immediate Consume clauses before payoff clauses (enforced by structural test, Task 4).
6. Both `validatePlayCard` and the `playCard` branch of `legalIntents` call `immediateConsumeAffordability`. Validation reports `Need {required} friendly tokens to consume (have {available})`; enumeration uses the same `payable` value. One shared predicate — no copied branches.
7. No Consume on hero powers.

---

### Task 1: Immediate-Consume affordability gate (option a1)

**Files:**

- Modify: `core/src/engine/intents.ts`
- Test: `core/tests/consume-affordability.test.ts` (Create)

**Interfaces:**

- Consumes: `Card`, `GameState`, `PlayerIndex`, `EffectSpec` types; the existing `battlecryEffects(card)` helper; the existing mana gate in `validatePlayCard` / `legalIntents`.
- Produces (engine-internal, exported from `core/src/engine/intents.js` so tests and later tasks import them — `core/src/index.ts` is NOT touched):
  - `requiredConsumeTokens(card: Card): number`
  - `immediateConsumeAffordability(state: GameState, player: PlayerIndex, card: Card): { required: number; available: number; payable: boolean }`
  - `validatePlayCard` returns `Need {required} friendly tokens to consume (have {available})` for unaffordable plays; `legalIntents` omits them entirely. Later tasks rely on this so Vermin's Toll cards become playable exactly when funded.

- [ ] **Step 1: Write the failing tests**

Create `core/tests/consume-affordability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';
import { immediateConsumeAffordability, requiredConsumeTokens, validatePlayCard } from '../src/engine/intents.js';
import type { Card, EffectSpec, Intent, PlayerIndex } from '../src/types.js';

/** Synthetic card factory: a spell by default, a creature when triggers are given. */
const toll = (id: string, effects: EffectSpec[], triggers?: Card['triggers']): Card => ({
  id,
  name: `Toll ${id}`,
  type: triggers ? 'creature' : 'spell',
  cost: 2,
  attack: triggers ? 2 : undefined,
  health: triggers ? 2 : undefined,
  reflect: triggers ? 2 : undefined,
  keywords: [],
  effects,
  triggers,
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
  author: 'custom',
  version: 1,
});

const consume = (value?: number): EffectSpec => ({ kind: 'consume', ...(value !== undefined ? { value } : {}) });

/** Main-phase game; `player` has `hand`, 10 mana, and exactly `tokens`
 *  friendly token creatures on board (via the real summon path). */
const setup = (hand: string[], tokens: number, player: PlayerIndex = 0): Game => {
  const game = Game.create(makeTestSetup());
  game.state.phase = 'main';
  game.state.players[player].mana = 10;
  game.state.players[player].maxMana = 10;
  game.state.players[player].hand = hand;
  if (tokens > 0) {
    applyEffect(game, { player, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: tokens });
  }
  return game;
};

describe('requiredConsumeTokens', () => {
  it('sums every immediate consume clause, defaulting omitted values to 1', () => {
    const spell = toll('toll-sum', [consume(1), consume(2), { kind: 'dealDamage', value: 3, target: 'any' }]);
    expect(requiredConsumeTokens(spell)).toBe(3);
  });
  it('counts battlecry consumes as immediate', () => {
    const creature = toll('toll-bc', [], [{ when: 'battlecry', effects: [consume(2), { kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }] }]);
    expect(requiredConsumeTokens(creature)).toBe(2);
  });
  it('ignores consume in later triggers (deathrattle is a payoff, not a cost)', () => {
    const creature = toll('toll-dr', [], [{ when: 'deathrattle', effects: [consume(2)] }]);
    expect(requiredConsumeTokens(creature)).toBe(0);
  });
});

describe('immediateConsumeAffordability', () => {
  const card = toll('toll-2', [consume(2), { kind: 'dealDamage', value: 3, target: 'any' }]);
  it('reports 0, 1, 2 available tokens against a consume(2) cost', () => {
    expect(immediateConsumeAffordability(setup([], 0).state, 0, card)).toEqual({ required: 2, available: 0, payable: false });
    expect(immediateConsumeAffordability(setup([], 1).state, 0, card)).toEqual({ required: 2, available: 1, payable: false });
    expect(immediateConsumeAffordability(setup([], 2).state, 0, card)).toEqual({ required: 2, available: 2, payable: true });
  });
});

describe('validatePlayCard gates immediate Consume', () => {
  const card = toll('toll-2', [consume(2), { kind: 'dealDamage', value: 3, target: 'any' }]);
  // The affordability gate intentionally runs before target validation, so an
  // unfunded Toll reports its missing resource even when the target is absent.
  it('rejects with the exact approved message at 0 and 1 tokens', () => {
    let g = setup(['toll-2'], 0);
    g.registry.register(card);
    expect(validatePlayCard(g, { kind: 'playCard', handIndex: 0 }, 0))
      .toBe('Need 2 friendly tokens to consume (have 0)');
    g = setup(['toll-2'], 1);
    g.registry.register(card);
    expect(validatePlayCard(g, { kind: 'playCard', handIndex: 0 }, 0))
      .toBe('Need 2 friendly tokens to consume (have 1)');
  });
  it('accepts at 2 tokens once the remaining target validation is also satisfied', () => {
    const g = setup(['toll-2'], 2);
    g.registry.register(card);
    expect(validatePlayCard(g, { kind: 'playCard', handIndex: 0, target: { type: 'hero', player: 1 } }, 0)).toBeNull();
  });
  it('tokens summoned by the same card never satisfy the cost', () => {
    // summon first, THEN consume: with 0 pre-play tokens the card is
    // unplayable even though it would create a rat before consuming one.
    const selfSummon = toll('toll-selfsummon', [{ kind: 'summon', cardId: 'token-rat' }, consume(1), { kind: 'dealDamage', value: 2, target: 'any' }]);
    const g = setup(['toll-selfsummon'], 0);
    g.registry.register(selfSummon);
    expect(validatePlayCard(g, { kind: 'playCard', handIndex: 0 }, 0))
      .toBe('Need 1 friendly tokens to consume (have 0)');
  });
});

describe('legalIntents omits unaffordable Consume plays', () => {
  it('excludes the toll spell at 0 tokens, includes it at 2', () => {
    const card = toll('toll-spell', [consume(2), { kind: 'dealDamage', value: 3, target: 'any' }]);
    let g = setup(['toll-spell'], 0);
    g.registry.register(card);
    expect(g.legalIntents(0).filter(i => i.kind === 'playCard')).toHaveLength(0);
    g = setup(['toll-spell'], 2);
    g.registry.register(card);
    // `target: 'any'` yields one playCard intent per legal ref — both heroes
    // are always legal, plus the 2 friendly token rats = 4 variants, so a
    // count of 1 is impossible under the engine's enumeration (Fix round 1,
    // review ruling; engine target enumeration kept as-is). The sibling
    // battlecry-creature test below is targetless and legitimately stays 1.
    expect(g.legalIntents(0).filter(i => i.kind === 'playCard')).toHaveLength(4);
  });
  it('excludes a consume battlecry creature at 0 tokens, includes it at 2', () => {
    const card = toll('toll-creature', [], [{ when: 'battlecry', effects: [consume(2), { kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }] }]);
    let g = setup(['toll-creature'], 0);
    g.registry.register(card);
    expect(g.legalIntents(0).filter(i => i.kind === 'playCard')).toHaveLength(0);
    g = setup(['toll-creature'], 2);
    g.registry.register(card);
    expect(g.legalIntents(0).filter(i => i.kind === 'playCard')).toHaveLength(1);
  });
});

describe('enumeration agrees with validation (spec test 7)', () => {
  const playCard = (i: Intent): i is Extract<Intent, { kind: 'playCard' }> => i.kind === 'playCard';
  it('every enumerated playCard intent passes validatePlayCard; an unaffordable toll appears in neither path', () => {
    // 1 token: the consume(1) spell is affordable, the consume(2) battlecry is not.
    const cheap = toll('toll-cheap', [consume(1), { kind: 'dealDamage', value: 2, target: 'enemyCreature' }]);
    const dear = toll('toll-dear', [], [{ when: 'battlecry', effects: [consume(2), { kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }] }]);
    const g = setup(['toll-cheap', 'toll-dear'], 1);
    g.registry.register(cheap);
    g.registry.register(dear);
    const enemy = addCreature(g, 1, { id: 'enemy-scout', attack: 2, health: 2 });
    const plays = g.legalIntents(0).filter(playCard);
    // toll-cheap (consume 1 <= 1 token): exactly one intent, aimed at the enemy creature
    const cheapPlays = plays.filter(i => i.handIndex === 0);
    expect(cheapPlays).toHaveLength(1);
    expect(cheapPlays[0]!.target).toEqual({ type: 'creature', id: enemy.id });
    // toll-dear (consume 2 > 1 token): absent from enumeration
    expect(plays.filter(i => i.handIndex === 1)).toHaveLength(0);
    // agreement: every enumerated playCard intent passes validatePlayCard
    for (const i of plays) expect(validatePlayCard(g, i, 0)).toBeNull();
    // and the unaffordable card is rejected by validation, not silently legal
    expect(validatePlayCard(g, { kind: 'playCard', handIndex: 1, target: { type: 'creature', id: enemy.id } }, 0))
      .toBe('Need 2 friendly tokens to consume (have 1)');
  });
});

describe('determinism', () => {
  it('the gate mutates nothing: rejected and accepted toll plays replay byte-identically', () => {
    const card = toll('toll-det', [consume(1), { kind: 'dealDamage', value: 2, target: 'any' }]);
    const a = Game.create(makeTestSetup());
    const b = Game.create(makeTestSetup());
    for (const g of [a, b]) {
      g.state.phase = 'main';
      g.state.players[0].mana = 10;
      g.state.players[0].maxMana = 10;
      g.registry.register(card);
      g.state.players[0].hand = ['toll-det', 't-001'];
    }
    // rejected opportunity: 0 tokens -> the toll card is legal-intent-invisible
    expect(a.legalIntents(0).some(i => i.kind === 'playCard' && i.handIndex === 0)).toBe(false);
    // accepted opportunity: summon 1 token, then the toll is legal and played
    for (const g of [a, b]) {
      applyEffect(g, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 1 });
    }
    const play = a.legalIntents(0).find(i => i.kind === 'playCard' && i.handIndex === 0)!;
    expect(() => a.submit(play)).not.toThrow();
    b.submit(play);
    // identical seeds + identical accepted intents -> byte-identical state
    expect(a.serialize()).toBe(b.serialize());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run core/tests/consume-affordability.test.ts`

Expected: FAIL — `requiredConsumeTokens` / `immediateConsumeAffordability` cannot be imported from `../src/engine/intents.js` (they do not exist), and the affordability-message assertions do not match the current `'Spell requires a target'`/no-gate behavior.

- [ ] **Step 3: Write the minimal implementation**

Modify `core/src/engine/intents.ts`:

(3a) Add `GameState` to the type import:

```ts
import type { Card, EffectSpec, EffectTarget, GameState, Intent, PlayerIndex, TargetRef } from '../types.js';
```

(3b) Insert the two pure helpers and the result type immediately after the existing `battlecryEffects(card)` function (they depend on it):

```ts
/** Sum of every IMMEDIATE Consume clause's cost (value ?? 1): top-level
 *  card.effects plus battlecry trigger effects. A Consume inside a later
 *  trigger (deathrattle/start/endOfTurn/onDamage) is a PAYOFF, not a play
 *  cost, and never gates the card (identity pilot, a1). Pure — reads the
 *  card def only. */
export function requiredConsumeTokens(card: Card): number {
  const immediate = [...card.effects, ...battlecryEffects(card)];
  return immediate.reduce((n, s) => (s.kind === 'consume' ? n + (s.value ?? 1) : n), 0);
}

export interface ConsumeAffordability {
  required: number;
  available: number;
  payable: boolean;
}

/** Pre-play affordability for a card's immediate Consume clauses (identity
 *  pilot, a1). `available` is the controller's pre-play friendly token count
 *  (CreatureState.token === true); `payable` is available >= required. Reads
 *  state BEFORE the play intent resolves, so tokens the card itself summons
 *  never satisfy the cost. ONE shared predicate for validatePlayCard and
 *  legalIntents — the two branches must never disagree. */
export function immediateConsumeAffordability(
  state: GameState,
  player: PlayerIndex,
  card: Card,
): ConsumeAffordability {
  const required = requiredConsumeTokens(card);
  const available = state.players[player].board.filter(c => c.token).length;
  return { required, available, payable: available >= required };
}
```

(3c) Gate `validatePlayCard` — insert between the mana check and the board-cap check:

```ts
  if (p.mana < playEffectiveCost(game, card, me)) return 'Not enough mana';
  // Identity pilot (a1): immediate Consume clauses are a PRE-PLAY cost. The
  // card is illegal unless the whole token cost exists before the intent
  // resolves; tokens summoned by the same card never satisfy it. Shared
  // helper with legalIntents (playCard branch) so validation and
  // enumeration cannot disagree.
  const afford = immediateConsumeAffordability(game.state, me, card);
  if (!afford.payable) {
    return `Need ${afford.required} friendly tokens to consume (have ${afford.available})`;
  }
  // Board cap (audit 01 C2, Task 3): ...
```

(3d) Gate `legalIntents` — insert in the playable-cards loop, immediately after the mana `continue`:

```ts
    if (p.mana < playEffectiveCost(game, card, player)) continue;
    // Identity pilot (a1): an unaffordable immediate-Consume card is
    // unplayable — same predicate validatePlayCard uses, so a play that
    // enumeration offers can never be rejected at submit (mirror how
    // unaffordable cards are skipped above).
    if (!immediateConsumeAffordability(game.state, player, card).payable) continue;
```

(3e) Extend the module header comment's rulings list with one line:

```ts
 *  - immediate Consume (a1, identity pilot): card.effects + battlecry effects
 *    only; a card is illegal unless the whole token cost exists pre-play
 *    (Need {required} friendly tokens to consume (have {available})).
```

No other file changes. No `GameState` fields, no serialization, no dispatch, no RNG.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run core/tests/consume-affordability.test.ts
npm run build -w core
npm test -w core
npm test
```

Expected: the new file passes; `tsc --noEmit` on core is clean; the whole workspace suite (core + server + app) is green. `legal.test.ts` and every bot suite stay green because the gate only removes plays that were already unenumerable-worthy.

- [ ] **Step 5: Commit**

```bash
git add core/src/engine/intents.ts core/tests/consume-affordability.test.ts
git commit -m "feat(core): gate immediate Consume costs before play (identity a1)"
```

---

### Task 2: Ember Court — Ash Toll, no healing, cheap reach

**Files:**

- Modify: `core/src/data/builders.ts`
- Modify: `core/src/data/ember-court.ts`
- Test: `core/tests/house-identity.test.ts` (Create)
- Test: `core/tests/cardtext.test.ts`
- Test: `core/tests/decks-1-3.test.ts`

**Interfaces:**

- Consumes: the a1 gate from Task 1 (pattern established; Ember's `overload` needs no gate — it is charged unconditionally at resolution, `effects.ts`). Consumes the `overload` builder this task adds to `builders.ts`.
- Produces: the Ember identity package — four Ash-Toll cards (`ember-blast`, `ember-cauterize`, `ember-pyroblast`, `ember-conflagration`) across three rarities, zero healing/draw/lifesteal anywhere in the house, the Cinderling/Sparkmage/Igniter duplicate resolved, and the structural test file `core/tests/house-identity.test.ts` (pool invariants + five-element matrix + ember assertions) that Tasks 3 and 4 extend.

**Exact card data changes** (IDs, names, art seeds, rarity, cost, and deck membership all unchanged):

1. `ember-blast` (common spell, cost 3): `[dmg(4, 'any')]` → `[dmg(5, 'any'), overload(2)]` — the signature Lava-Burst-style Ash card.
2. `ember-cauterize` (common spell, cost 4): `[dmg(3, 'any'), heal(3)]` → `[dmg(6, 'any'), overload(1)]` — the healing violation removed; the mana lock is the new "seared wound".
3. `ember-pyroblast` (rare spell, cost 5): `[dmg(7, 'any')]` → `[dmg(8, 'any'), overload(2)]`.
4. `ember-conflagration` (epic spell, cost 7): `[dmg(2, 'allEnemies')]` → `[dmg(5, 'allEnemies'), overload(3)]` — was far below rate at 7; now the all-in board burst.
5. `ember-igniter` (common creature, cost 3, 2/3): battlecry `[dmg(1, 'any')]` → battlecry `[dmg(2, 'any')]` — resolves the Sparkmage/Igniter duplicate common: Sparkmage stays `(dealDamage, 1, any, battlecry)`, Igniter becomes `(dealDamage, 2, any, battlecry)`.
6. `ember-phoenixwhelp` (rare creature, cost 5, 5/4): keyword `lifesteal` → deathrattle `[dmg(2, 'randomEnemy')]`. Lifesteal is healing; the weakness is "no healing". The deathrattle keeps the phoenix "dies and still burns" flavor and stays reach.

Toll coverage: 4 cards (blast, cauterize = common; pyroblast = rare; conflagration = epic) across 3 rarities — exceeds the ≥4 / ≥2 requirement.

- [ ] **Step 1: Write the failing tests**

(1a) Create `core/tests/house-identity.test.ts` (this task writes the shared helpers, pool invariants, five-element matrix, and the Ember block; Tasks 3–4 append blocks):

```ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildPool, DECK_DEFS, expandDeck, EMBER_COURT_HERO } from '../src/data/index.js';
import type { ArchetypeId } from '../src/data/index.js';
import type { Card } from '../src/types.js';
import { validateCard, statBudget, KEYWORD_COST } from '../src/validate.js';

const pool = buildPool();
const byHouse = (house: ArchetypeId) => pool.filter(c => c.archetype === house);
const allSpecs = (c: Card) => [...c.effects, ...(c.triggers ?? []).flatMap(t => t.effects)];
const meanCost = (house: ArchetypeId) => {
  const cards = byHouse(house);
  return cards.reduce((s, c) => s + c.cost, 0) / cards.length;
};
const weightedSpend = (c: Card) =>
  (c.health ?? 0) + ((c.attack ?? 0) + (c.reflect ?? 0)) / 2
  + c.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
const sha256 = (items: string[]) => createHash('sha256').update([...items].sort().join('\n')).digest('hex');
const BASELINE_ID_HASH = '135705962902e62ca7443fb204c28544e0dfb8777715ea61b9605c69f7b29fa7';
const BASELINE_SIG_HASH = {
  ember: 'd1e92556ae82a9e69d23f84d6bc2defa5dd5206c8664d7e5c3e2ec2e60dbf65d',
  bone: '615096ea5c7a8ac057f56baca2c5443e4121267ee5943f54328ded348b495194',
  vermin: '21239b0547f8a347a992241687b1f8c4d408a57081b9724def4e15dbf954544e',
} as const;

describe('pool invariants (identity pilot)', () => {
  it('keeps the exact immutable non-token card-id set', () => {
    const ids = buildPool().filter(c => c.archetype !== 'token').map(c => c.id);
    expect(ids).toHaveLength(278);
    expect(sha256(ids)).toBe(BASELINE_ID_HASH);
  });
  it('every pool card still validates with no errors', () => {
    for (const c of buildPool()) {
      expect(validateCard(c).filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
  });
  it('keeps each 21-card house membership, exact signature counts, and 60-card expansion', () => {
    for (const house of ['ember', 'bone', 'vermin'] as const) {
      const ids = byHouse(house).map(c => c.id);
      expect(ids).toHaveLength(21);
      expect(new Set(DECK_DEFS[house].sig.map(([id]) => id))).toEqual(new Set(ids));
      const sigWithCounts = DECK_DEFS[house].sig.map(([id, n]) => `${id}:${n}`);
      expect(sha256(sigWithCounts)).toBe(BASELINE_SIG_HASH[house]);
      expect(expandDeck(DECK_DEFS[house])).toHaveLength(60);
    }
  });
});

/**
 * Duplicate (kind, value, target) commons within a house, trigger context
 * meaningful: the trigger `when` for trigger effects, 'spell' for top-level
 * spell effects (spec test 1 — a battlecry dmg and a spell dmg are different
 * contexts). The report fails until every duplicate is redesigned or
 * explicitly waived with a recorded strategic reason. The pilot resolves
 * every duplicate by redesign; WAIVERS exists for future houses.
 */
const duplicateCommons = (house: ArchetypeId): string[] => {
  const seen = new Map<string, string[]>();
  for (const c of byHouse(house)) {
    if (c.rarity !== 'common') continue;
    const items = [
      ...c.effects.map(s => ({ when: 'spell' as const, s })),
      ...(c.triggers ?? []).flatMap(t => t.effects.map(s => ({ when: t.when, s }))),
    ];
    for (const { when, s } of items) {
      const key = `${s.kind}|${s.value ?? ''}|${s.target ?? ''}|${when}`;
      const list = seen.get(key) ?? [];
      list.push(c.id);
      seen.set(key, list);
    }
  }
  const report: string[] = [];
  for (const [key, ids] of seen) {
    const unique = [...new Set(ids)];
    if (unique.length > 1) report.push(`${key}: ${unique.join(', ')}`);
  }
  return report;
};

/** Recorded duplicate waivers: card id -> strategic reason. Empty for the
 *  pilot — every duplicate was redesigned. */
const WAIVERS: Record<string, string> = {};

it('duplicate-common report is empty or fully waived (spec test 1)', () => {
  // Per-house staging (green-per-task ruling): this task changes Ember only,
  // so the enforcement loop is scoped to Ember here. Task 3's Step 1
  // broadens it to ['ember', 'bone', 'vermin'] so Bone's pre-existing
  // duplicate is RED exactly when Task 3 starts, then Task 3's data
  // implementation turns it green. The helper/report stays house-capable.
  for (const house of ['ember'] as const) {
    const report = duplicateCommons(house).filter(line => {
      const ids = line.split(': ')[1]!.split(', ');
      return ids.some(id => !(id in WAIVERS));
    });
    expect(report, `${house}: ${report.join('; ')}`).toEqual([]);
  }
});

/**
 * Approved five-element identity contract (spec 2026-08-10). The prose rows
 * are the reviewable contract; each house's describe below carries the
 * structural assertions that keep its row true.
 */
const MATRIX = [
  { house: 'ember', verbs: 'Direct damage, reach', resource: 'Ash Toll — overload', payoff: 'Burst the enemy hero', weakness: 'No healing or sustained draw; runs out of gas', curve: 'Cheap curve, aggressive power' },
  { house: 'bone', verbs: 'Deathrattle, rebuilding after deaths', resource: 'Death as an engine signal; no Toll', payoff: 'Recursion; the board rebuilds itself', weakness: 'No reach to the enemy hero; must win on board', curve: 'Midrange' },
  { house: 'vermin', verbs: 'Token generation, wide-board conversion', resource: 'Fodder Toll — immediate consume (a1)', payoff: 'Convert expendable tokens into swarm-wide pressure', weakness: 'Individual units are weak; vulnerable to sweepers', curve: 'Cheap curve' },
] as const;

it('the approved matrix maps to three distinct resource mechanics present in pool data', () => {
  const signal = (house: ArchetypeId) => {
    const cards = byHouse(house);
    if (cards.some(c => allSpecs(c).some(s => s.kind === 'overload'))) return 'Ash Toll — overload';
    if (cards.some(c => allSpecs(c).some(s => s.kind === 'consume'))) return 'Fodder Toll — consume';
    if (cards.some(c => (c.triggers ?? []).some(t => t.when === 'deathrattle'))) return 'Death as engine signal';
    return 'missing';
  };
  expect(MATRIX.map(r => [r.house, signal(r.house)])).toEqual([
    ['ember', 'Ash Toll — overload'],
    ['bone', 'Death as engine signal'],
    ['vermin', 'Fodder Toll — consume'],
  ]);
});

describe('ember court identity', () => {
  const house = byHouse('ember');
  it('charges Ash (overload) on at least 4 cards across at least 2 rarities (spec test 2, 4)', () => {
    const tolls = house.filter(c => allSpecs(c).some(s => s.kind === 'overload'));
    expect(tolls.length).toBeGreaterThanOrEqual(4);
    expect(new Set(tolls.map(c => c.rarity)).size).toBeGreaterThanOrEqual(2);
  });
  it('has no healing and no sustained draw anywhere in the house (weakness)', () => {
    const offenders: string[] = [];
    for (const c of house) {
      if (allSpecs(c).some(s => s.kind === 'heal' || s.kind === 'draw')) offenders.push(c.id);
      if (c.keywords.includes('lifesteal')) offenders.push(c.id);
    }
    expect(offenders, offenders.join(', ')).toEqual([]);
    expect(EMBER_COURT_HERO.power.effects.some(s => s.kind === 'heal' || s.kind === 'draw')).toBe(false);
  });
});
```

(1b) Update `core/tests/cardtext.test.ts` — replace the `ember-cauterize exact string` test (line ~170):

```ts
  it('ember-cauterize exact string', () => {
    const pool = new Map(buildPool().map((c) => [c.id, c]));
    expect(cardText(pool.get('ember-cauterize')!)).toBe('Deal 6 damage to any target. Overload: 1.');
  });
```

(1c) Update `core/tests/decks-1-3.test.ts` — replace the `ember-cauterize damages the chosen enemy creature AND heals own hero` regression test (line ~85). The mixed-card auto-resolve ruling is still covered by the untouched `choir-verdict` test in the same describe; Ember's cauterize is no longer a mixed card:

```ts
    it('ember-cauterize deals 6 to the chosen target and charges Ash (no heal)', () => {
      const game = newGame(EMBER_COURT_HERO, EMBER_COURT_DECK);
      toMain(game);
      const victim = addCreature(game, 1, { id: 'enemy-scout', attack: 2, health: 7 });
      game.state.players[0].hand.unshift('ember-cauterize');
      game.state.players[0].mana = 10;
      game.state.players[0].hero.hp = 20;
      game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: victim.id } });
      expect(game.state.players[1].board.find(c => c.id === victim.id)!.health).toBe(1);  // 6 damage to the target
      expect(game.state.players[0].hero.hp).toBe(20);                                     // NO heal lands
      expect(game.state.players[0].overload).toBe(1);                                     // Ash charged at resolution
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run core/tests/house-identity.test.ts core/tests/cardtext.test.ts core/tests/decks-1-3.test.ts
```

Expected: FAIL —

- house-identity: ember toll coverage is 0 ≥ 4 fails; `ember-cauterize` carries `heal` so the no-heal test fails; the duplicate report flags Ember's `dealDamage|1|any|battlecry: ember-sparkmage, ember-igniter`. (The enforcement loop is Ember-scoped in this task per the green-per-task ruling; Bone's pre-existing `summon|||deathrattle: bone-gravedigger, bone-cairn` duplicate is not checked yet — Task 3's Step 1 broadens the loop so it fails there.)
- cardtext: exact-string mismatch (`Deal 3 damage... Restore 3 health...` vs the new string).
- decks-1-3: the replaced cauterize test asserts the new behavior (overload 1, no heal) which does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

(3a) `core/src/data/builders.ts` — add the two toll builders after the existing `summon` export:

```ts
/** Ash Toll (ember identity): lock N mana at the start of the caster's next
 *  turn (overload). Charged unconditionally at resolution (effects.ts). */
export const overload = (value: number): EffectSpec => ({ kind: 'overload', value });
/** Fodder Toll (vermin identity): consume N friendly tokens (oldest first,
 *  effects.ts). Immediate Consume clauses are gated by (a1) before play;
 *  trigger-position Consume is a payoff, not a cost. Shared by the vermin
 *  data file, which used to declare its own private copy. */
export const consume = (value: number): EffectSpec => ({ kind: 'consume', value });
```

(3b) `core/src/data/ember-court.ts` — change the builders import (drop the now-unused `heal`, add `overload`):

```ts
import { archetypeCards, dmg, overload, summon } from './builders.js';
```

Then replace the six card lines exactly:

```ts
  spell('ember-blast', 'Blast', 3, 'common', [dmg(5, 'any'), overload(2)], 'A fist of fire hurled from the high galleries. There is no diplomacy in it.'),
```

```ts
  creature('ember-igniter', 'Igniter', 3, 2, 3, 'common', [], [{ when: 'battlecry', effects: [dmg(2, 'any')] }], 'Every siege begins with one small flame where no flame should be.'),
```

```ts
  spell('ember-cauterize', 'Cauterize', 4, 'common', [dmg(6, 'any'), overload(1)], 'The court\'s surgeons know a seared wound cannot bleed again — and they let the enemy pay for the flame.'),
```

```ts
  spell('ember-firestorm', 'Firestorm', 5, 'rare', [dmg(4, 'allEnemies')], 'When the court tires of words, it lets the sky speak.'),
  creature('ember-phoenixwhelp', 'Phoenix Whelp', 5, 5, 4, 'rare', [], [{ when: 'deathrattle', effects: [dmg(2, 'randomEnemy')] }], 'A fledgling of the Sovereign\'s brood, learning that every dying ember is a debt owed to fire.'),
  spell('ember-pyroblast', 'Pyroblast', 5, 'rare', [dmg(8, 'any'), overload(2)], 'The last word in the court\'s vocabulary of fire. There are no appeals.'),
```

```ts
  spell('ember-conflagration', 'Conflagration', 7, 'epic', [dmg(5, 'allEnemies'), overload(3)], 'The Ember Court does not wage war; it sets the world alight and calls the settling ash peace.'),
```

(Note: `ember-firestorm` is shown for context only — it does not change.) The deck sig and hero power stay exactly as-is.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run core/tests/house-identity.test.ts core/tests/cardtext.test.ts core/tests/decks-1-3.test.ts
npm run build -w core
npm test
```

Expected: all green. The pre-existing `pool-balance.test.ts` rules stay satisfied: no creature changes exceed the ceiling (`ember-igniter` 4 ≤ 12, `ember-phoenixwhelp` 9 ≤ 14); both redesigned creatures carry rules text so the below-budget-vanilla rule skips them; no strict domination introduced; no new summon clause violates TOKEN_CAP.

- [ ] **Step 5: Commit**

```bash
git add core/src/data/builders.ts core/src/data/ember-court.ts core/tests/house-identity.test.ts core/tests/cardtext.test.ts core/tests/decks-1-3.test.ts
git commit -m "feat(data): ember court identity — Ash Toll, no healing, cheap reach"
```

---

### Task 3: Bone Horde — deathrattle/rebuild, no reach, midrange

**Files:**

- Modify: `core/src/data/bone-horde.ts`
- Test: `core/tests/house-identity.test.ts`
- Test: `core/tests/decks-7-9.test.ts`

**Interfaces:**

- Consumes: the shared test helpers (`byHouse`, `allSpecs`, `duplicateCommons`, `MATRIX`) from Task 2; the `destroy` builder from `builders.ts` (already exported since Task 14, this task just imports it).
- Produces: the Bone identity package — no enemy-hero reach (all `allEnemies` retargeted to `allEnemyCreatures`), six deathrattle creatures, one destroy-friendly death-engine activation, zero Consume. The `destroy` target legality is the existing choice-target machinery: `friendlyCreature` requires a ref to the caster's own board; with no friendly creature the spell is unplayable (targetVariants returns null), exactly like the Breath toll.

**Exact card data changes** (IDs, names, art seeds, rarity, cost, and deck membership all unchanged):

1. `bone-rattle` (common spell, cost 4): `[dmg(2, 'allEnemies')]` → `[dmg(2, 'allEnemyCreatures')]` — reach removed.
2. `bone-cataclysm` (epic spell, cost 8): `[dmg(3, 'allEnemies')]` → `[dmg(3, 'allEnemyCreatures')]` — reach removed.
3. `bone-legion` (rare spell, cost 5): `[summon('token-skeleton', 3)]` → `[destroy('friendlyCreature'), summon('token-skeleton', 3)]` — **death-engine activation, deliberately NOT a Toll**: destroying a friendly creature is a choice (`friendlyCreature` choice target, gated by existing `validateEffectTargets`/`targetVariants`), and the destroyed creature's deathrattle fires first, so the spell converts any bone body into skeleton pressure. The name "Legion Call" and flavor ("Three names spoken into the cold earth") already read as an offering; the spell now mechanically is one.
4. `bone-raider` (common creature, cost 3, 3/3): no triggers → deathrattle `[summon('token-skeleton', 2)]`.
5. `bone-cairn` (common creature, cost 3, 0/4 taunt): deathrattle `[summon('token-skeleton')]` → deathrattle `[summon('token-skeleton', 3)]`.

Deathrattle house count after these edits: gravedigger, cairn, raider, warlord, overlord, king = 6. Duplicate-common keys are now distinct: gravedigger `(summon|∅|∅|deathrattle)`, raider `(summon|2|∅|deathrattle)`, cairn `(summon|3|∅|deathrattle)`.

- [ ] **Step 1: Write the failing tests**

(1a) Broaden the Task 2 `duplicate-common report` enforcement loop from `['ember']` to `['ember', 'bone', 'vermin']` in `core/tests/house-identity.test.ts`. Task 2 scoped the loop to Ember (green-per-task ruling: each task verifies the house it changes and ends green); this test-first substep restores the three-house enforcement so Bone's pre-existing `summon|||deathrattle: bone-gravedigger, bone-cairn` duplicate fails exactly during Task 3's RED run. Task 3's Step 3 data implementation (`bone-cairn` deathrattle → `summon('token-skeleton', 3)`) then turns it green.

(1b) Append to `core/tests/house-identity.test.ts` (after the `ember court identity` describe, before the final closing of the file's describe list — i.e. add a new top-level describe):

```ts
describe('bone horde identity', () => {
  const house = byHouse('bone');
  const REACH = new Set(['any', 'hero', 'allEnemies', 'randomEnemy']);
  it('has no reach to the enemy hero (board-only payoff)', () => {
    const offenders: string[] = [];
    for (const c of house) {
      for (const s of allSpecs(c)) {
        if (s.kind === 'dealDamage' && s.target && REACH.has(s.target)) offenders.push(c.id);
      }
    }
    expect(offenders, offenders.join(', ')).toEqual([]);
  });
  it('never uses Consume (mechanically separate from Vermin)', () => {
    expect(house.some(c => allSpecs(c).some(s => s.kind === 'consume'))).toBe(false);
  });
  it('rebuilds through deathrattle on at least 6 cards', () => {
    const dr = house.filter(c => (c.triggers ?? []).some(t => t.when === 'deathrattle'));
    expect(dr.length).toBeGreaterThanOrEqual(6);
  });
  it('bone-legion is a death-engine activation, not a Toll: destroy-friendly choice with a skeleton payoff', () => {
    const legion = house.find(c => c.id === 'bone-legion')!;
    expect(legion.effects).toEqual([
      { kind: 'destroy', target: 'friendlyCreature' },
      { kind: 'summon', cardId: 'token-skeleton', value: 3 },
    ]);
    // no Consume, no overload: Bone charges no toll
    expect(legion.effects.some(s => s.kind === 'consume' || s.kind === 'overload')).toBe(false);
  });
});
```

(1c) Append a real legality/resolution regression inside the existing top-level `describe('decks 7-9 ...')` in `core/tests/decks-7-9.test.ts`:

```ts
  describe('bone-legion death-engine activation', () => {
    it('is unplayable without a friendly creature to destroy', () => {
      const game = newGame(BONE_HORDE_HERO, BONE_HORDE_DECK);
      toMain(game);
      game.state.players[0].hand.unshift('bone-legion');
      game.state.players[0].mana = 10;
      expect(game.legalIntents(0).filter(i => i.kind === 'playCard' && i.handIndex === 0)).toEqual([]);
    });

    it('destroys the chosen creature, fires its deathrattle, then adds the three-card payoff', () => {
      const game = newGame(BONE_HORDE_HERO, BONE_HORDE_DECK);
      toMain(game);
      const offering = addCreature(game, 0, {
        id: 'bone-offering', attack: 2, health: 2,
        trigger: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-skeleton' }],
      });
      game.state.players[0].hand.unshift('bone-legion');
      game.state.players[0].mana = 10;
      game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: offering.id } });
      expect(game.state.players[0].board.some(c => c.id === offering.id)).toBe(false);
      expect(game.state.players[0].board.filter(c => c.token && c.cardId === 'token-skeleton')).toHaveLength(4);
    });
  });
```

The second test deliberately proves the full event ordering and payoff, not merely the static effect array: one skeleton comes from the chosen creature's deathrattle and three from Legion Call.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run core/tests/house-identity.test.ts`

Expected: FAIL —

- no-reach: `bone-rattle` and `bone-cataclysm` still target `allEnemies`.
- deathrattle count is 5 today (gravedigger, cairn, warlord, overlord, king) → ≥ 6 fails.
- the duplicate-common report flags `summon|||deathrattle: bone-gravedigger, bone-cairn` (the base `duplicate-common report` assertion fails for bone because Step 1's (1a) substep broadened the enforcement loop back to all three houses — this is the intended per-house RED, and Step 3's cairn redesign turns it green).
- bone-legion structural effects assertion fails (still pure summon); the decks-7-9 legality test incorrectly finds it playable without a friendly target; the runtime payoff test cannot produce four skeletons.

- [ ] **Step 3: Write the minimal implementation**

`core/src/data/bone-horde.ts` — change the builders import (add `destroy`):

```ts
import { archetypeCards, buff, destroy, dmg, summon } from './builders.js';
```

Then replace the five card lines exactly:

```ts
  creature('bone-cairn', 'Cairn', 3, 0, 4, 'common', ['taunt'], [{ when: 'deathrattle', effects: [summon('token-skeleton', 3)] }], 'A heap of the honored dead, piled high enough to block the living.'),
```

```ts
  creature('bone-raider', 'Raider', 3, 3, 3, 'common', [], [{ when: 'deathrattle', effects: [summon('token-skeleton', 2)] }], 'It plunders the living for what the dead no longer need.'),
```

```ts
  spell('bone-rattle', 'Rattle', 4, 'common', [dmg(2, 'allEnemyCreatures')], 'The horde rattles as one, and the sound cracks the bones of the living.'),
```

```ts
  spell('bone-legion', 'Legion Call', 5, 'rare', [destroy('friendlyCreature'), summon('token-skeleton', 3)], 'Three names spoken into the cold earth — three ranks answer.'),
```

```ts
  spell('bone-cataclysm', 'Cataclysm', 8, 'epic', [dmg(3, 'allEnemyCreatures')], "When the whole horde rattles at once, the world's bones tremble too."),
```

No other file changes. The hero power (Raise Skeleton) stays; the deck sig stays.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run core/tests/house-identity.test.ts core/tests/decks-7-9.test.ts core/tests/pool-balance.test.ts
npm run build -w core
npm test
```

Expected: all green. `decks-7-9` directly covers Bone's hero, scripted deck, Legion Call target gate, and deathrattle-plus-payoff resolution; `pool-balance` confirms no ceiling/domination/TOKEN_CAP violations (`bone-cairn` spend 5 ≤ 10, `bone-raider` 6 ≤ 10, `bone-legion` summons 3 ≤ 7).

- [ ] **Step 5: Commit**

```bash
git add core/src/data/bone-horde.ts core/tests/house-identity.test.ts core/tests/decks-7-9.test.ts
git commit -m "feat(data): bone horde identity — deathrattle rebuild, no reach, midrange"
```

---

### Task 4: Vermin Swarm — Fodder Toll, weak bodies, cheap curve

**Files:**

- Modify: `core/src/data/vermin-swarm.ts`
- Test: `core/tests/house-identity.test.ts`
- Test: `core/tests/consume-affordability.test.ts`

**Interfaces:**

- Consumes: the a1 gate from Task 1 (this is what makes Vermin's Toll playable-iff-funded), the shared `consume` builder from Task 2, the shared test helpers from Task 2.
- Produces: the Vermin identity package — four Fodder-Toll cards across two rarities, every immediate Consume preceding its payoff, hero power free of Consume, all bodies at or below vanilla budget. `vermin-swarmlord` keeps its existing `[consume(2), buff(1,1,'allFriendlyCreatures')]` battlecry — it becomes legal-iff-funded by Task 1, no data change.

**Exact card data changes** (IDs, names, art seeds, rarity, cost, and deck membership all unchanged):

1. `vermin-nibble` (common spell, cost 1): `[dmg(1, 'anyCreature')]` → `[consume(1), dmg(2, 'anyCreature')]` — Fodder Toll #1.
2. `vermin-frenzy` (common spell, cost 3): `[{ kind: 'buff', value: 2, value2: 0, target: 'allFriendlyCreatures' }]` → `[consume(2), { kind: 'buff', value: 2, value2: 0, target: 'allFriendlyCreatures' }]` — Fodder Toll #3 (consume-2 keeps the key distinct from nibble's consume-1).
3. `vermin-alpha` (rare creature, cost 4, 3/3): battlecry `[{ kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }]` → battlecry `[consume(1), { kind: 'buff', value: 1, value2: 2, target: 'allFriendlyCreatures' }]` — Fodder Toll #4, consume-1 distinguishes its key from swarmlord's battlecry consume-2, and `+1/+2` ("bolder and larger") differs from swarmlord's `+1/+1`.

Toll coverage: nibble (common, consume 1), swarmlord (common, consume 2), frenzy (common, consume 2), alpha (rare, consume 1) = 4 cards across 2 rarities. Duplicate-common keys are distinct per house-context: nibble `(consume|1||spell)`, frenzy `(consume|2||spell)`, swarmlord `(consume|2||battlecry)`, alpha `(consume|1||battlecry)`.

- [ ] **Step 1: Write the failing tests**

Append to `core/tests/house-identity.test.ts` (new top-level describe after `bone horde identity`). Add `VERMIN_SWARM_HERO` and `BONE_HORDE_HERO` to the existing data/index.js import at the top of the file, and add `requiredConsumeTokens` to a new import from `../src/engine/intents.js`:

```ts
import { buildPool, DECK_DEFS, expandDeck, EMBER_COURT_HERO, BONE_HORDE_HERO, VERMIN_SWARM_HERO } from '../src/data/index.js';
```

```ts
import { requiredConsumeTokens } from '../src/engine/intents.js';
```

```ts
describe('vermin swarm identity', () => {
  const house = byHouse('vermin');
  it('charges Fodder (consume) on at least 4 cards across at least 2 rarities (spec test 2)', () => {
    const tolls = house.filter(c => requiredConsumeTokens(c) > 0);
    expect(tolls.length).toBeGreaterThanOrEqual(4);
    expect(new Set(tolls.map(c => c.rarity)).size).toBeGreaterThanOrEqual(2);
  });
  it('places every immediate Consume before its payoff (spec test 8)', () => {
    for (const c of house) {
      if (requiredConsumeTokens(c) === 0) continue;   // trigger-only Consume is exempt
      const immediate = [...c.effects, ...(c.triggers ?? []).flatMap(t => (t.when === 'battlecry' ? t.effects : []))];
      let seenPayoff = false;
      for (const s of immediate) {
        if (s.kind !== 'consume') seenPayoff = true;
        else expect(seenPayoff, `${c.id}: Consume after payoff`).toBe(false);
      }
    }
  });
  it('keeps the hero power free of Consume (spec test 9)', () => {
    for (const hero of [EMBER_COURT_HERO, BONE_HORDE_HERO, VERMIN_SWARM_HERO]) {
      expect(hero.power.effects.some(s => s.kind === 'consume'), hero.name).toBe(false);
    }
  });
  it('keeps individual bodies weak: no creature exceeds its vanilla budget (weakness)', () => {
    const over: string[] = [];
    for (const c of house) {
      if (c.type !== 'creature') continue;
      if (weightedSpend(c) > statBudget(c.cost)) over.push(`${c.id} (${weightedSpend(c)} vs ${statBudget(c.cost)})`);
    }
    expect(over, over.join(', ')).toEqual([]);
  });
});

describe('cross-house separation', () => {
  it('keeps the curve ordering: cheap-aggressive < cheap < midrange', () => {
    const ember = meanCost('ember');
    const vermin = meanCost('vermin');
    const bone = meanCost('bone');
    expect(ember).toBeLessThanOrEqual(4.5);
    expect(vermin).toBeLessThanOrEqual(4.5);
    expect(bone).toBeGreaterThanOrEqual(4.5);
    expect(ember).toBeLessThan(vermin);
    expect(vermin).toBeLessThan(bone);
  });
});
```

(1b) In `core/tests/consume-affordability.test.ts`, add `buildPool` to the imports and append a curated-card deterministic continuation test:

```ts
import { buildPool } from '../src/data/index.js';
```

```ts
describe('curated Vermin Toll determinism', () => {
  it('rejects unfunded Nibble, then replays the same accepted intent byte-identically when funded', () => {
    const nibble = buildPool().find(c => c.id === 'vermin-nibble')!;

    const rejected = setup(['vermin-nibble'], 0);
    rejected.registry.register(nibble);
    addCreature(rejected, 1, { id: 'nibble-target', attack: 2, health: 2 });
    expect(rejected.legalIntents(0).some(i => i.kind === 'playCard' && i.handIndex === 0)).toBe(false);

    const a = setup(['vermin-nibble'], 1);
    a.registry.register(nibble);
    const victim = addCreature(a, 1, { id: 'nibble-target', attack: 2, health: 2 });
    const b = Game.deserialize(a.serialize(), a.registry);
    const intent = a.legalIntents(0).find(i =>
      i.kind === 'playCard' && i.handIndex === 0
      && i.target?.type === 'creature' && i.target.id === victim.id
    );
    expect(intent).toBeDefined();
    expect(b.legalIntents(0)).toContainEqual(intent);
    expect(a.submit(intent!)).toEqual(b.submit(intent!));
    expect(a.serialize()).toBe(b.serialize());
  });
});
```

This is the spec's accepted-intent-log replay check over the actual curated Toll card, not merely two direct helper calls. It is RED before Task 4 because base `vermin-nibble` has no Consume and therefore remains legal with zero tokens.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run core/tests/house-identity.test.ts`

Expected: FAIL —

- toll coverage: only `vermin-swarmlord` carries Consume today (1 card, 1 rarity) → ≥ 4 across ≥ 2 fails.
- the duplicate-common report flags `consume|1||battlecry` ... no — today only swarmlord has consume, so the report passes for vermin today; the failure is the coverage assertion. The curve-ordering, weak-body, and hero-power assertions pass today (invariants, asserted to stay true).

- [ ] **Step 3: Write the minimal implementation**

(3a) `core/src/data/vermin-swarm.ts` — change imports and delete the file-local `consume` helper (now shared from `builders.ts`, added in Task 2). `EffectSpec` becomes unused in this file; drop it from the type import:

```ts
import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, consume, dmg, summon } from './builders.js';
```

Delete the local helper block:

```ts
/** Token-eater (vermin identity): the oldest friendly tokens die (deathrattles
 *  fire) — the payoff on a consume card is board space plus whatever the
 *  companion effect grants. */
const consume = (value: number): EffectSpec => ({ kind: 'consume', value });
```

(3b) Replace the three card lines exactly:

```ts
  spell('vermin-nibble', 'Nibble', 1, 'common', [consume(1), dmg(2, 'anyCreature')], 'One nibble means nothing. That is precisely what the swarm is counting on.'),
```

```ts
  spell('vermin-frenzy', 'Frenzy', 3, 'common', [consume(2), { kind: 'buff', value: 2, value2: 0, target: 'allFriendlyCreatures' }], 'Hunger is the only war horn the swarm has ever needed.'),
```

```ts
  creature('vermin-alpha', 'Alpha Rat', 4, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [consume(1), { kind: 'buff', value: 1, value2: 2, target: 'allFriendlyCreatures' }] }], 'Where the alpha walks, the pack grows bolder — and larger.'),
```

The hero power (Rat Call) and deck sig stay exactly as-is. `vermin-swarmlord` is unchanged by data.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run core/tests/house-identity.test.ts core/tests/consume-affordability.test.ts core/tests/decks-1-3.test.ts core/tests/pool-balance.test.ts
npm run build -w core
npm test
```

Expected: all green. `decks-1-3` covers vermin; the greedy scripted game never throws because `legalIntents` now skips unfunded tolls; `pool-balance` confirms all vermin bodies stay at or below budget. `npm test` runs the full workspace including every bot suite (Recruit/Veteran/Grandmaster receive affordability through `legalIntents`) and the replay suites.

- [ ] **Step 5: Commit**

```bash
git add core/src/data/vermin-swarm.ts core/tests/house-identity.test.ts core/tests/consume-affordability.test.ts
git commit -m "feat(data): vermin swarm identity — Fodder Toll, weak bodies, cheap curve"
```

---

### Task 5: Play-test protocol and the pilot verdict gate

**Files:**

- Create: `docs/superpowers/playtests/2026-08-10-three-house-pilot.md`

**Interfaces:**

- Consumes: the completed Task 1 gate and Tasks 2–4 card packages.
- Produces: the executable play-test protocol and the pilot's only acceptance gate. This gate CANNOT be closed by automated tests — a separate user verdict per house is required, and the pilot is accepted only when all three houses are played and separately approved. STOP after the verdicts; the nine-house expansion is a separate design/approval, out of scope for this plan.

- [ ] **Step 1: Write the protocol document**

Create `docs/superpowers/playtests/2026-08-10-three-house-pilot.md`:

```markdown
# Three-House Identity Pilot — Play-test Protocol (final gate)

**Date:** 2026-08-10
**Status:** OPEN — cannot be closed by automated tests. Runs after Task 4 of
`docs/superpowers/plans/2026-08-10-three-house-identity-pilot.md`.

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
```

- [ ] **Step 2: Run the play-test protocol**

Execute the matrix above in the app. Every match must follow the setup and the recording template. Record the toll ledger and board evidence per slot, then answer the success/failure questions per house.

- [ ] **Step 3: Record the three separate user verdicts**

Fill the Verdict section of the protocol doc with one APPROVE/REJECT per house (Ember, Bone, Vermin), each with a one-line reason. The pilot is not accepted until all three approve; if any house rejects, revise the identity spec for that house and re-run its block before this plan is considered complete.

- [ ] **Step 4: Commit the protocol and verdicts**

```bash
git add docs/superpowers/playtests/2026-08-10-three-house-pilot.md
git commit -m "docs(playtest): record three-house identity pilot verdicts"
```

- [ ] **Step 5: Stop at the pilot verdict**

Do NOT expand the approved contract to the remaining nine houses in this plan. If the pilot is accepted, the parent plan's Identity Gate (step 5) records the stabilized roles for its Task 2 (final Reflect authoring) and a separate plan owns the nine-house expansion. If rejected, revise the identity spec and this pilot before any further house work.

---

## Self-Review

**1. Spec coverage.** Walked every section of `docs/superpowers/specs/2026-08-10-house-toll-identity-design.md` and the brief:

- (a1) gate with exact contract — Task 1, implemented verbatim (items 1–7 in Global Constraints): `requiredConsumeTokens` sums only `card.effects` + battlecry effects with `value ?? 1`; `immediateConsumeAffordability` reads pre-play `CreatureState.token` count; shared by `validatePlayCard` and `legalIntents`; exact message `Need {required} friendly tokens to consume (have {available})`; later triggers ungated; same-card summons never pay; hero powers excluded (Task 4 test).
- Ember identity (verbs/reach, Ash/overload, burst, no healing or sustained draw, cheap curve) — Task 2: four Ash-Toll cards across three rarities (≥4 across ≥2 required); Cauterize heal removed; Phoenix Whelp lifesteal removed (lifesteal is healing); Cinderling/Sparkmage/Igniter duplicate RESOLVED by redesign (no waiver).
- Bone identity (deathrattle/rebuild, board-only, no reach, midrange) — Task 3: both `allEnemies` reach cards retargeted to `allEnemyCreatures`; six deathrattle creatures; `bone-legion` is a destroy-friendly death-engine activation explicitly NOT a toll, with `friendlyCreature` choice-target legality specified (unplayable with no friendly body, gated by existing `validateEffectTargets`/`targetVariants`); zero Consume in Bone.
- Vermin identity (tokens + immediate Consume conversion, collective payoff, weak bodies/sweeper vulnerability, cheap curve) — Task 4: four Fodder-Toll cards across two rarities, every immediate Consume precedes its payoff; hero power free of Consume; all bodies at or below `statBudget(cost)`.
- Testing section — Task 1 covers the affordability matrix (0/1/2 tokens, multiple clauses sum, omitted value, later trigger, same-card summon, legal-enumeration/validation agreement, pure gate determinism); Task 4 adds accepted-intent replay over curated `vermin-nibble`; `house-identity.test.ts` covers the duplicate-common report with trigger context, toll coverage, overload nonzero, Consume ordering, hero-power exclusion, no-heal/draw for Ember, no-reach for Bone, weak-body/curve for Vermin, all-pool-validates, exact immutable ID/signature hashes, unchanged deck membership, and the approved five-element matrix.
- Play-test gate — Task 5: fixed protocol (curated decks, fixed matchup order, fixed bot level, fixed recording template; seed recorded when exposed), exact match matrix, per-house success/failure questions, required separate verdict per house, STOP after verdict.
- "Remaining nine houses untouched" — only `ember-court.ts`, `bone-horde.ts`, `vermin-swarm.ts`, `builders.ts`, `intents.ts`, and the shared test files are modified.
- "Balance effect packages explicitly; budget not proof" — every task states the exact final card (type/cost/Attack/Reflect/Health/keywords/triggers/effects) and the play-test gate is the balance authority; no task claims `validateCard` proves cost.

**2. Placeholder scan.** No "TBD"/"TODO"/"implement later"; no "write tests for above"; every card change names an immutable ID with exact resulting data; every test file is written out in full; every diff has exact before/after text.

**3. Type consistency.** `requiredConsumeTokens(card: Card): number` and `immediateConsumeAffordability(state: GameState, player: PlayerIndex, card: Card): { required; available; payable }` are defined in Task 1 and consumed identically in Tasks 1 (tests) and 4 (toll coverage). `overload`/`consume` builders are added in Task 2 and used in Tasks 2/4. `duplicateCommons`, `byHouse`, `allSpecs`, `meanCost`, `weightedSpend`, `MATRIX`, `WAIVERS` are defined once in Task 2's test file and reused in Tasks 3–4 with identical names. The `bone-legion` effects assertion in Task 3 matches the exact spec array produced in its Step 3. The `ember-cauterize` cardtext string in Task 2 matches `effectText` output for `[dmg(6,'any'), overload(1)]` ("Deal 6 damage to any target. Overload: 1.").

**Known balance risks (deliberate, play-test-owned):** `ember-blast` (3-mana deal 5 + overload 2) is the strongest common in the pool; `bone-cairn` (3-mana 0/4 taunt, deathrattle summon 3) and `bone-legion` (sacrifice + summon 3 + the victim's deathrattle) are strong midrange plays; `vermin-nibble` (1-mana deal 2 with fodder) is efficient removal. These are the intended identity signals, and Task 5 exists specifically to catch any that overperform.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-three-house-identity-pilot.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
