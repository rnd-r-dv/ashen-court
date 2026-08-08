# Engine Fixes, Mechanics, and Rebalance — Worker Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two confirmed engine bugs, make combat simultaneous, add a token row and seven new mechanics, then rebalance all 278 curated cards — every change verified by `npm test`.

**Architecture:** Everything here lives in `core/`. The engine is deterministic and synchronous; `submit(intent)` validates, then all state change flows through `emit()` → `runQueue()` → `dispatch(evt)`. Adding a `GameEvent` requires a `dispatch` case — the `default` branch throws on purpose. Adding an `EffectKind` requires handling it in `core/src/engine/effects.ts` **and** `core/src/cardtext.ts` **and** `app/src/forge/formState.ts`, because Forge cards run the identical path as curated ones.

**Tech Stack:** TypeScript (ESM, `strict` + `noUncheckedIndexedAccess`), Vitest, npm workspaces.

## Global Constraints

- ESM throughout: relative imports carry the `.js` extension even in `.ts` source.
- `strict` + `noUncheckedIndexedAccess` are on. The `!` assertions on indexed access are intentional, not sloppiness. Match the surrounding style.
- **All 278 card ids are immutable.** Never rename, split, or delete a card id. Card art is seeded from `hashId(card.id)`; renaming repaints the card and breaks saved decks.
- Rules text is **generated**, never hand-written. Never add a `text` field to a card.
- `core/tests/` is never type-checked by `tsc`. Tests still must be correct.
- Run `npm test` before every commit. 391 tests currently pass; that number only goes up.
- Comments in this codebase carry rules rationale. When you change engine behavior, update the explanatory comment — those comments are the spec for edge cases.
- Never use `any` in `core/src/`. Tests may use `as any` for intent literals.
- Commit after every task. Never batch two tasks into one commit.

---

### Task 1: Fix the start-of-turn mana clobber

`beginTurn` computes `maxMana`, emits `turnStart` (whose dispatch fires startOfTurn triggers, so a ramp artifact's `gainMana` lands), and *then* emits a `manaChanged` built from the **pre-trigger** value — overwriting the ramp. Sylvan Grove and Idol of Growth currently do nothing.

**Files:**
- Modify: `core/src/engine/game.ts:542-571`
- Test: `core/tests/mana-ramp.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: correct `beginTurn` event ordering — Task 10 (`overload`) depends on `manaChanged` being emitted *before* `turnStart`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/mana-ramp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';

describe('start-of-turn mana', () => {
  it('a startOfTurn gainMana artifact stacks on top of the turn crystal', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // Register an artifact whose startOfTurn trigger grants an empty crystal.
    game.registry.add({
      id: 'ramp-relic', name: 'Ramp Relic', type: 'artifact', cost: 3,
      keywords: [], effects: [],
      triggers: [{ when: 'startOfTurn', effects: [{ kind: 'gainMana', value: 1 }] }],
      rarity: 'rare', archetype: 'neutral',
      art: { preset: 'arcane', palette: ['#000', '#fff'], seed: 1 },
      author: 'curated', version: 1,
    });
    game.state.players[0].artifacts.push({ id: 'art-1', cardId: 'ramp-relic', owner: 0 });

    const before = game.state.players[0].maxMana;
    game.submit({ kind: 'endTurn' });   // player 0 -> 1
    game.submit({ kind: 'endTurn' });   // player 1 -> 0, beginTurn(0) runs
    const after = game.state.players[0].maxMana;

    // +1 for the turn, +1 for the artifact.
    expect(after).toBe(before + 2);
  });
});
```

If `game.registry.add` does not exist, use whatever registration helper `core/src/cards.ts` exposes (read it first); do not change `CardRegistry`'s public surface for a test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/mana-ramp.test.ts`
Expected: FAIL — `expected 2 to be 3`. The artifact's crystal is overwritten.

- [ ] **Step 3: Reorder the events in beginTurn**

In `core/src/engine/game.ts`, inside `beginTurn`, the current order is:

```ts
    this.emit({ type: 'turnStart', player: me, mana: maxMana });
    this.emit({ type: 'manaChanged', player: me, mana: maxMana, maxMana });
```

Replace with:

```ts
    // ORDER IS LOAD-BEARING: manaChanged sets the turn's baseline FIRST, then
    // turnStart's dispatch fires startOfTurn triggers on top of it. Emitting
    // turnStart first meant a ramp artifact's gainMana landed during that
    // dispatch and was then overwritten by this manaChanged, which carries the
    // value computed BEFORE the trigger ran — so Sylvan Grove and Idol of
    // Growth granted nothing at all. Any future effect that adjusts mana from
    // a startOfTurn trigger (overload included) depends on this ordering.
    this.emit({ type: 'manaChanged', player: me, mana: maxMana, maxMana });
    this.emit({ type: 'turnStart', player: me, mana: maxMana });
```



- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/mana-ramp.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass. If a test asserted the old event order, update that test's expectation and note why in its comment — the new order is correct.

- [ ] **Step 6: Commit**

```bash
git add core/src/engine/game.ts core/tests/mana-ramp.test.ts
git commit -m "fix(engine): stop beginTurn clobbering startOfTurn mana ramp"
```

---

### Task 2: Simultaneous combat

Retaliation is gated on `defender.health > 0`, so a defender killed outright deals nothing back. No major TCG works this way. Make damage simultaneous.

**Files:**
- Modify: `core/src/engine/game.ts:193-200`
- Test: `core/tests/combat-simultaneous.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: simultaneous combat. Task 7 (`venom`) and the whole of Task 12+ (rebalance) assume it.

- [ ] **Step 1: Write the failing test**

Create `core/tests/combat-simultaneous.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';

describe('simultaneous combat', () => {
  it('a defender killed outright still deals its attack back', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 5, health: 2, exhausted: false });
    const defender = addCreature(game, 1, { id: 't-b', attack: 4, health: 4 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    // 5 >= 4 kills the defender; 4 >= 2 must still kill the attacker.
    expect(game.state.players[1].board).toHaveLength(0);
    expect(game.state.players[0].board).toHaveLength(0);
  });

  it('a zero-attack wall still deals nothing back', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 3, exhausted: false });
    const wall = addCreature(game, 1, { id: 't-b', attack: 0, health: 6 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: wall.id } });

    expect(wall.health).toBe(3);
    expect(attacker.health).toBe(3);
  });

  it('a surviving defender still retaliates', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const attacker = addCreature(game, 0, { id: 't-a', attack: 3, health: 3, exhausted: false });
    const defender = addCreature(game, 1, { id: 't-b', attack: 2, health: 5 });

    game.submit({ kind: 'attack', attackerId: attacker.id, target: { type: 'creature', id: defender.id } });

    expect(defender.health).toBe(2);
    expect(attacker.health).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/combat-simultaneous.test.ts`
Expected: the first test FAILS (attacker survives, `players[0].board` has length 1). The other two pass already.

- [ ] **Step 3: Make damage simultaneous**

In `core/src/engine/game.ts`, replace:

```ts
      if (target.type === 'creature') {
        const defender = enemyBoard.find(c => c.id === target.id);
        if (!defender) throw new Error('Defender not found');
        this.dealDamage(attacker, defender, attacker.attack);       // uses effects internals
        if (defender.health > 0) this.dealDamage(defender, attacker, defender.attack);  // retaliation (source = defender)
      } else {
```

with:

```ts
      if (target.type === 'creature') {
        const defender = enemyBoard.find(c => c.id === target.id);
        if (!defender) throw new Error('Defender not found');
        // Damage is SIMULTANEOUS: both values are captured BEFORE either lands,
        // then applied unconditionally. Retaliation used to be gated on
        // `defender.health > 0`, which made a clean kill free and diverged from
        // every mainstream TCG. Capturing first also makes the second call safe:
        // the defender may already be off the board (dispatch(creatureDied)
        // removes it during the first drain), so re-reading defender.attack
        // afterwards would read a removed creature.
        const attackerPower = attacker.attack;
        const defenderPower = defender.attack;
        this.dealDamage(attacker, defender, attackerPower);
        // Source stays the DEFENDER so retaliation lifesteal heals the
        // defender's controller (EffectCtx.player = source.owner).
        this.dealDamage(defender, attacker, defenderPower);
      } else {
```

Now read `core/src/engine/game.ts`'s `dealDamage` (around line 578). It builds an `EffectCtx` from the source creature. Confirm it does not early-return on a source whose health has already dropped to 0 — if it does, that guard must go, with a comment explaining that a dead defender still swings.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/combat-simultaneous.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and fix fallout**

Run: `npm test`

Expected: **several existing tests will fail.** This is a deliberate rule change. For each failure, confirm the new behavior is correct under simultaneous damage, then update the expectation and add a one-line comment saying the value changed because combat became simultaneous. Do **not** weaken an assertion to make it pass — recompute what the right number now is.

Bot tests (`core/tests/bot/*.test.ts`) may also shift, because the heuristic evaluates trades. Update expected values; do not change bot policy in this task.

- [ ] **Step 6: Commit**

```bash
git add core/src/engine/game.ts core/tests/
git commit -m "feat(engine)!: make combat damage simultaneous"
```

---

### Task 3: Token row — `token` flag and `TOKEN_CAP`

`summonTokens` clamps to `BOARD_CAP - board.length`, so Endless Swarm (9) on an empty board silently yields 7. Give tokens their own cap so summon counts stop lying.

**Files:**
- Modify: `core/src/types.ts` (CreatureState)
- Modify: `core/src/engine/effects.ts:29` (caps), `:376-386` (summonTokens), `:391+` (makeCreature)
- Modify: `core/src/engine/intents.ts:161` (playCard board-full guard)
- Modify: `core/src/index.ts` (export `TOKEN_CAP`)
- Test: `core/tests/token-row.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `CreatureState.token: boolean`; `TOKEN_CAP` exported from `@ashen/core`. The app's Board rendering (main-thread plan) reads `creature.token` to pick a row.

- [ ] **Step 1: Write the failing test**

Create `core/tests/token-row.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('token row', () => {
  it('tokens do not consume creature slots', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    // Fill all 7 creature slots.
    for (let i = 0; i < 7; i++) {
      addCreature(game, 0, { id: `t-fill-${i}`, attack: 1, health: 1 });
    }
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 5 });

    const board = game.state.players[0].board;
    expect(board.filter(c => !c.token)).toHaveLength(7);
    expect(board.filter(c => c.token)).toHaveLength(5);
  });

  it('token summons clamp at TOKEN_CAP, not BOARD_CAP', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 99 });
    expect(game.state.players[0].board.filter(c => c.token)).toHaveLength(7);
  });
});
```

The test needs `token-rat` in the registry. `makeTestSetup` uses the synthetic test pool; read `core/src/data/test-pool.ts` and register a token card there named `token-rat` (1/1, cost 0, archetype `token`) if one is absent. Keep it in the test pool, not the production pool.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/token-row.test.ts`
Expected: FAIL — `token` is not a property of `CreatureState`.

- [ ] **Step 3: Add the field and the cap**

In `core/src/types.ts`, extend `CreatureState`:

```ts
export interface CreatureState {
  id: string; cardId: string; owner: PlayerIndex;
  attack: number; health: number; maxHealth: number;
  keywords: Keyword[]; exhausted: boolean; attacksLeft: number;
  shields: number; warded: boolean; frozen: boolean;
  /** True for creatures summoned by an effect from a `token` archetype card.
   *  Tokens occupy a SEPARATE row with its own cap (TOKEN_CAP) so a big
   *  swarm card is not silently truncated by the creature cap. Serialization
   *  is a plain JSON round-trip, so a state saved before this field existed
   *  deserializes with `token` undefined, which is correctly falsy. */
  token: boolean;
}
```

In `core/src/engine/effects.ts`, beside `BOARD_CAP`:

```ts
export const BOARD_CAP = 7;
/** Tokens fill their own row. Same size as the creature cap so a full board
 *  of both reads symmetrically on screen. */
export const TOKEN_CAP = 7;
```

In `makeCreature`, set the flag from the card's archetype:

```ts
    token: card.archetype === 'token',
```

In `summonTokens`, clamp against the right cap:

```ts
  const card = registryOf(game).get(spec.cardId);
  const p = game.state.players[ctx.player];
  const isToken = card.archetype === 'token';
  const cap = isToken ? TOKEN_CAP : BOARD_CAP;
  const used = p.board.filter(c => c.token === isToken).length;
  const count = Math.min(spec.value ?? 1, cap - used);
```

In `core/src/engine/intents.ts:161`, the playCard guard must count only non-tokens (a hand-played creature is never a token):

```ts
    if (card.type === 'creature' && p.board.filter(c => !c.token).length >= BOARD_CAP) continue;
```

Find the matching guard in `validatePlayCard` (same file) and apply the identical change, so enumeration and validation cannot disagree.

Export the cap from `core/src/index.ts` next to `BOARD_CAP`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/token-row.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass. `addCreature` in `core/tests/helpers.ts` must set `token: false` — add it there if TypeScript or a test complains.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests
git commit -m "feat(engine): give tokens their own row and cap"
```

---

### Task 4: Disambiguate Ward and Shield

Ward currently fizzles targeted spells only (`game.ts:237-240`); Shield absorbs one damage instance. Neither is stated on any card, and the two read as the same thing. Give both generated text.

**Files:**
- Modify: `core/src/cardtext.ts`
- Test: `core/tests/cardtext.test.ts` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: `KEYWORD_TEXT` exported from `core/src/cardtext.ts`, consumed by the app's card inspect panel (main-thread plan).

- [ ] **Step 1: Write the failing test**

Add to `core/tests/cardtext.test.ts`:

```ts
import { KEYWORD_TEXT } from '../src/cardtext.js';

describe('keyword text', () => {
  it('distinguishes ward from shield', () => {
    expect(KEYWORD_TEXT.ward).toBe('Absorbs the next enemy spell or effect that targets this creature.');
    expect(KEYWORD_TEXT.shield).toBe('Absorbs the next instance of damage from any source.');
  });

  it('covers every keyword', () => {
    const keywords = ['taunt', 'rush', 'charge', 'windfury', 'lifesteal', 'ward', 'shield'] as const;
    for (const k of keywords) {
      expect(KEYWORD_TEXT[k].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/cardtext.test.ts`
Expected: FAIL — `KEYWORD_TEXT` is not exported.

- [ ] **Step 3: Add KEYWORD_TEXT**

In `core/src/cardtext.ts`, after `TRIGGER_LABEL`:

```ts
/**
 * Player-facing rules text for every keyword. Ward and Shield were previously
 * indistinguishable in play: both read as "absorbs something", and neither
 * appeared on a card. They are genuinely different — Ward answers TARGETED
 * SPELLS AND EFFECTS (game.ts fizzles the spell outright), Shield answers
 * DAMAGE from any source, attacks included. Stated here so the UI can show it.
 */
export const KEYWORD_TEXT: Record<Keyword, string> = {
  taunt: 'Enemies must attack this creature before your hero or your other creatures.',
  rush: 'Can attack enemy creatures the turn it is summoned.',
  charge: 'Can attack anything, including the enemy hero, the turn it is summoned.',
  windfury: 'Can attack twice each turn.',
  lifesteal: 'Damage this creature deals also restores that much health to your hero.',
  ward: 'Absorbs the next enemy spell or effect that targets this creature.',
  shield: 'Absorbs the next instance of damage from any source.',
};
```

Add `Keyword` to the existing `import type { ... } from './types.js'` line at the top of the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/cardtext.test.ts`
Expected: PASS

- [ ] **Step 5: Export it and run the full suite**

Add `KEYWORD_TEXT` to the `export { cardText, heroPowerText, effectText }` line in `core/src/index.ts`.

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests
git commit -m "feat(core): generate keyword rules text, splitting ward from shield"
```

---

### Task 5: `silence` effect kind

Strips a creature's keywords and triggers. The pool has seven `destroy` effects and no other answer to a trigger-based threat.

**Files:**
- Modify: `core/src/types.ts` (`EffectKind`), `core/src/engine/effects.ts`, `core/src/cardtext.ts`, `app/src/forge/formState.ts`
- Test: `core/tests/effects-silence.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `EffectKind` member `'silence'`. `CreatureState.silenced: boolean`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/effects-silence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('silence', () => {
  it('strips keywords from the target', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-a', attack: 4, health: 4, keywords: ['taunt', 'windfury'] });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(c.keywords).toHaveLength(0);
    expect(c.silenced).toBe(true);
  });

  it('suppresses the deathrattle of a silenced creature', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, {
      id: 't-rattler', attack: 1, health: 1,
      trigger: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-rat', value: 2 }],
    });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'silence', target: 'enemyCreature' }, { type: 'creature', id: c.id });
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'destroy', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(game.state.players[1].board).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/effects-silence.test.ts`
Expected: FAIL — `'silence'` is not assignable to `EffectKind`.

- [ ] **Step 3: Implement it**

`core/src/types.ts` — add `'silence'` to the `EffectKind` union, and add to `CreatureState`:

```ts
  /** Set by the `silence` effect. Keywords are emptied on application; this
   *  flag additionally suppresses the card def's triggers, which live on the
   *  CARD not the creature and so cannot be removed by clearing an array. */
  silenced: boolean;
```

`core/src/engine/effects.ts` — in `makeCreature`, add `silenced: false`. Add the case to `applyEffectInner`:

```ts
    case 'silence': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        // Keywords live on the creature (an array we can empty); triggers live
        // on the CARD DEF, shared by every copy, so they must never be mutated
        // — the flag is what Game.fireTriggers checks instead.
        c.keywords.length = 0;
        c.silenced = true;
      }
      break;
    }
```

`core/src/engine/game.ts` — in `fireTriggers`, return early for a silenced creature. Read the method first; it resolves the creature by id. Add, right after the creature lookup:

```ts
    // A silenced creature has no triggers (Task 5).
    if (creature && creature.silenced) return;
```

`core/src/cardtext.ts` — add to `effectText`:

```ts
    case 'silence':
      return `Silence ${target(effect.target)}.`;
```

`app/src/forge/formState.ts` — add to `EFFECT_PRESETS`:

```ts
  { label: 'Silence a creature', spec: { kind: 'silence', target: 'anyCreature' } },
```

`core/src/validate.ts` — add `'silence'` to the `TARGET_KINDS` array so validation requires a target.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/effects-silence.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass. `addCreature` in `core/tests/helpers.ts` needs `silenced: false`.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests app/src/forge/formState.ts
git commit -m "feat(core): add the silence effect kind"
```

---

### Task 6: `returnToHand` effect kind

Bounce a creature to its owner's hand. Tempo removal that is not a seventh `destroy`.

**Files:**
- Modify: `core/src/types.ts`, `core/src/engine/effects.ts`, `core/src/cardtext.ts`, `app/src/forge/formState.ts`, `core/src/validate.ts`
- Test: `core/tests/effects-bounce.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `EffectKind` member `'returnToHand'`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/effects-bounce.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('returnToHand', () => {
  it('moves the creature off the board and into its owner hand', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, { id: 't-a', attack: 4, health: 4 });
    const handBefore = game.state.players[1].hand.length;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'returnToHand', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    expect(game.state.players[1].board).toHaveLength(0);
    expect(game.state.players[1].hand).toHaveLength(handBefore + 1);
    expect(game.state.players[1].hand.at(-1)).toBe('t-a');
  });

  it('does not fire the deathrattle', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const c = addCreature(game, 1, {
      id: 't-rattler', attack: 1, health: 1,
      trigger: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-rat', value: 2 }],
    });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'returnToHand', target: 'enemyCreature' }, { type: 'creature', id: c.id });

    // Bounced, not killed: no rats.
    expect(game.state.players[1].board).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/effects-bounce.test.ts`
Expected: FAIL — `'returnToHand'` is not assignable to `EffectKind`.

- [ ] **Step 3: Implement it**

Add `'returnToHand'` to `EffectKind` in `core/src/types.ts`.

Add a `creatureReturned` event to the `GameEvent` union in `core/src/types.ts`:

```ts
  | { type: 'creatureReturned'; player: PlayerIndex; creatureId: string; cardId: string }
```

In `core/src/engine/effects.ts`:

```ts
    case 'returnToHand': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        // NOT a death: no creatureDied, so no deathrattle. Bounce is removal
        // that deliberately leaves the card playable again.
        push(game, { type: 'creatureReturned', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
      break;
    }
```

In `core/src/engine/game.ts` `dispatch`, add the handler (the `default` branch throws, so this is required):

```ts
      case 'creatureReturned': {
        const p = this.state.players[evt.player];
        const idx = p.board.findIndex(c => c.id === evt.creatureId);
        if (idx === -1) break;
        p.board.splice(idx, 1);
        // A full hand simply loses the card, matching how draw handles overflow.
        p.hand.push(evt.cardId);
        break;
      }
```

In `core/src/cardtext.ts`:

```ts
    case 'returnToHand':
      return `Return ${target(effect.target)} to its owner's hand.`;
```

Add to `EFFECT_PRESETS` in `app/src/forge/formState.ts`:

```ts
  { label: "Return a creature to its owner's hand", spec: { kind: 'returnToHand', target: 'anyCreature' } },
```

Add `'returnToHand'` to `TARGET_KINDS` in `core/src/validate.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/effects-bounce.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests app/src/forge/formState.ts
git commit -m "feat(core): add the returnToHand effect kind"
```

---

### Task 7: `venom` keyword

Any creature this damages is destroyed. Deliberately strong under simultaneous combat — it is the pressure release for the inverted stat curve.

**Files:**
- Modify: `core/src/types.ts` (`Keyword`), `core/src/engine/effects.ts` (`damageTarget`), `core/src/validate.ts` (`KEYWORD_COST`), `core/src/cardtext.ts` (`KEYWORD_TEXT`)
- Test: `core/tests/keyword-venom.test.ts` (create)

**Interfaces:**
- Consumes: `KEYWORD_TEXT` from Task 4.
- Produces: `Keyword` member `'venom'`, `KEYWORD_COST.venom = 2`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/keyword-venom.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';

describe('venom', () => {
  it('destroys any creature it damages, however large', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const snake = addCreature(game, 0, { id: 't-snake', attack: 1, health: 1, keywords: ['venom'], exhausted: false });
    const titan = addCreature(game, 1, { id: 't-titan', attack: 2, health: 12 });

    game.submit({ kind: 'attack', attackerId: snake.id, target: { type: 'creature', id: titan.id } });

    expect(game.state.players[1].board).toHaveLength(0);
  });

  it('does not trigger on zero damage', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const snake = addCreature(game, 0, { id: 't-snake', attack: 0, health: 3, keywords: ['venom'], exhausted: false });
    const titan = addCreature(game, 1, { id: 't-titan', attack: 1, health: 9 });

    game.submit({ kind: 'attack', attackerId: snake.id, target: { type: 'creature', id: titan.id } });

    expect(game.state.players[1].board).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/keyword-venom.test.ts`
Expected: FAIL — `'venom'` is not assignable to `Keyword`.

- [ ] **Step 3: Implement it**

Add `'venom'` to the `Keyword` union in `core/src/types.ts`.

In `core/src/engine/effects.ts`, inside `damageTarget`'s creature branch, after the health subtraction and the `damageDealt` push:

```ts
    if (c.health <= 0) {
      push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
    } else if (dmg > 0 && ctx.creatureId) {
      // venom: a source creature that dealt real damage destroys what it hit,
      // regardless of size. Gated on dmg > 0 so a shield absorb (which emits a
      // 0-amount damageDealt) never kills, matching the onDamage trigger rule.
      const source = findCreature(game, ctx.creatureId);
      if (source && source.keywords.includes('venom')) {
        push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
    }
```

In `core/src/validate.ts`, add to `KEYWORD_COST`: `venom: 2,` and add `'venom'` to `CREATURE_ONLY_KEYWORDS`.

In `core/src/cardtext.ts`, add to `KEYWORD_TEXT`:

```ts
  venom: 'Any creature damaged by this creature is destroyed.',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/keyword-venom.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests
git commit -m "feat(core): add the venom keyword"
```

---

### Task 8: `stealth` keyword

Untargetable by the enemy until this creature attacks.

**Files:**
- Modify: `core/src/types.ts`, `core/src/engine/effects.ts` (`resolveTargets`), `core/src/engine/game.ts` (clear on attack), `core/src/validate.ts`, `core/src/cardtext.ts`
- Test: `core/tests/keyword-stealth.test.ts` (create)

**Interfaces:**
- Consumes: `KEYWORD_TEXT` from Task 4.
- Produces: `Keyword` member `'stealth'`, `KEYWORD_COST.stealth = 1`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/keyword-stealth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { legalIntents } from '../src/engine/intents.js';

describe('stealth', () => {
  it('is not a legal attack target for the enemy', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    addCreature(game, 0, { id: 't-att', attack: 3, health: 3, exhausted: false });
    const hidden = addCreature(game, 1, { id: 't-hidden', attack: 2, health: 2, keywords: ['stealth'] });

    const legal = legalIntents(game, 0);
    const hits = legal.filter(i => i.kind === 'attack' && i.target.type === 'creature' && i.target.id === hidden.id);
    expect(hits).toHaveLength(0);
  });

  it('loses stealth once it attacks', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const hidden = addCreature(game, 0, { id: 't-hidden', attack: 2, health: 4, keywords: ['stealth'], exhausted: false });
    addCreature(game, 1, { id: 't-victim', attack: 0, health: 6 });

    game.submit({ kind: 'attack', attackerId: hidden.id, target: { type: 'hero', player: 1 } });

    expect(hidden.keywords).not.toContain('stealth');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/keyword-stealth.test.ts`
Expected: FAIL — `'stealth'` is not assignable to `Keyword`.

- [ ] **Step 3: Implement it**

Add `'stealth'` to `Keyword` in `core/src/types.ts`.

In `core/src/engine/effects.ts`, in `resolveTargets`, the enemy-creature cases (`enemyCreature`, `allEnemyCreatures`, `randomEnemyCreature`, and the creature part of `any`/`allEnemies`) must filter out stealthed creatures. Add a helper next to `isDragon`:

```ts
/** Enemy-facing target filter: a stealthed creature is not selectable by the
 *  opponent. It stays fully selectable by its OWN controller (friendly buffs
 *  and heals still reach it), so the filter is applied only where the refs
 *  belong to the enemy. */
function visibleToEnemy(c: CreatureState): boolean {
  return !c.keywords.includes('stealth');
}
```

Apply `.filter(visibleToEnemy)` to the enemy board in each of those cases. Read the surrounding code and keep the existing `map`/`push` shape.

In `core/src/engine/intents.ts`, the attack enumeration loop (`for (const d of enemyBoard)`) must skip stealthed defenders in both the taunt and non-taunt branches. Also: `tauntPresent` must ignore stealthed taunts, or a stealthed taunt would make every attack illegal. Change `core/src/engine/keywords.ts`:

```ts
export function tauntPresent(board: CreatureState[]): boolean {
  // A stealthed taunt cannot be attacked, so it must not gate attacks either —
  // otherwise it would make every enemy attack illegal.
  return board.some(c => c.keywords.includes('taunt') && !c.keywords.includes('stealth'));
}
```

Apply the same guard in `validateAttack`'s taunt check inside `core/src/engine/game.ts:177-187`.

In `core/src/engine/game.ts`, after `attacker.attacksLeft -= 1;`:

```ts
      // Attacking reveals a stealthed creature (Task 8).
      const stealthIdx = attacker.keywords.indexOf('stealth');
      if (stealthIdx !== -1) attacker.keywords.splice(stealthIdx, 1);
```

`core/src/validate.ts`: `stealth: 1,` in `KEYWORD_COST`, plus `'stealth'` in `CREATURE_ONLY_KEYWORDS`.

`core/src/cardtext.ts` `KEYWORD_TEXT`:

```ts
  stealth: 'Cannot be targeted by the enemy until it attacks.',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/keyword-stealth.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests
git commit -m "feat(core): add the stealth keyword"
```

---

### Task 9: `spellPower`

A creature that adds to your spells' damage. Build-around for Ember, Storm, and Star.

**Files:**
- Modify: `core/src/types.ts`, `core/src/engine/effects.ts`, `core/src/cardtext.ts`, `core/src/validate.ts`, `app/src/forge/formState.ts`
- Test: `core/tests/spell-power.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `EffectKind` member `'spellPower'`; `CreatureState.spellPower: number`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/spell-power.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('spellPower', () => {
  it('adds to spell damage but not to attack damage', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const mage = addCreature(game, 0, { id: 't-mage', attack: 1, health: 4 });
    mage.spellPower = 2;
    const victim = addCreature(game, 1, { id: 't-victim', attack: 0, health: 10 });

    // A SPELL (no source creature) deals 3 + 2 = 5.
    applyEffect(game, { player: 0, cardId: 'a-spell' }, { kind: 'dealDamage', value: 3, target: 'enemyCreature' }, { type: 'creature', id: victim.id });
    expect(victim.health).toBe(5);
  });

  it('does not boost a creature battlecry', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    const mage = addCreature(game, 0, { id: 't-mage', attack: 1, health: 4 });
    mage.spellPower = 2;
    const victim = addCreature(game, 1, { id: 't-victim', attack: 0, health: 10 });

    applyEffect(
      game,
      { player: 0, cardId: 'a-creature', creatureId: mage.id },
      { kind: 'dealDamage', value: 3, target: 'enemyCreature' },
      { type: 'creature', id: victim.id },
    );
    expect(victim.health).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/spell-power.test.ts`
Expected: FAIL — `spellPower` is not a property of `CreatureState`.

- [ ] **Step 3: Implement it**

`core/src/types.ts` — add to `CreatureState`:

```ts
  /** Added to the controller's SPELL damage while this creature is on board. */
  spellPower: number;
```

and add `'spellPower'` to `EffectKind`.

`core/src/engine/effects.ts` — `makeCreature` sets `spellPower: 0`. Add a helper:

```ts
/** Total spell power on a player's board. Applied only when the damage source
 *  is a SPELL — an EffectCtx with no creatureId. A creature's own battlecry
 *  carries creatureId, so a board full of mages never inflates battlecries. */
function spellPowerOf(game: Resolver, player: PlayerIndex): number {
  return game.state.players[player].board.reduce((s, c) => s + c.spellPower, 0);
}
```

In `applyEffectInner`'s `dealDamage` case, replace `const amount = spec.value ?? 0;` with:

```ts
      const bonus = ctx.creatureId ? 0 : spellPowerOf(game, ctx.player);
      const amount = (spec.value ?? 0) + bonus;
```

Add the effect case so a battlecry can grant it:

```ts
    case 'spellPower': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (c) c.spellPower += spec.value ?? 0;
      }
      break;
    }
```

`core/src/cardtext.ts`:

```ts
    case 'spellPower':
      return `Give ${target(effect.target)} Spell Power +${v}.`;
```

Add `'spellPower'` to `TARGET_KINDS` in `core/src/validate.ts`, and add a preset in `app/src/forge/formState.ts`:

```ts
  { label: 'Give a friendly creature Spell Power +1', spec: { kind: 'spellPower', value: 1, target: 'friendlyCreature' } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/spell-power.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass. `addCreature` needs `spellPower: 0`.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests app/src/forge/formState.ts
git commit -m "feat(core): add spell power"
```

---

### Task 10: `overload`

A card is cheap now and locks mana next turn.

**Files:**
- Modify: `core/src/types.ts`, `core/src/engine/effects.ts`, `core/src/engine/game.ts` (`beginTurn`), `core/src/cardtext.ts`, `app/src/forge/formState.ts`
- Test: `core/tests/overload.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's event ordering (`manaChanged` before `turnStart`).
- Produces: `EffectKind` member `'overload'`; `PlayerState.overload: number`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/overload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('overload', () => {
  it('locks mana on the controller next turn only', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].maxMana = 5;
    game.state.players[0].mana = 5;

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'overload', value: 2 });
    expect(game.state.players[0].mana).toBe(5);   // this turn is unaffected

    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // back to player 0

    // maxMana rises to 6; 2 are locked, so 4 are available.
    expect(game.state.players[0].maxMana).toBe(6);
    expect(game.state.players[0].mana).toBe(4);

    game.submit({ kind: 'endTurn' });
    game.submit({ kind: 'endTurn' });             // the lock has expired

    expect(game.state.players[0].mana).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/overload.test.ts`
Expected: FAIL — `'overload'` is not assignable to `EffectKind`.

- [ ] **Step 3: Implement it**

`core/src/types.ts` — add `'overload'` to `EffectKind`, and to `PlayerState`:

```ts
  /** Mana locked at the start of this player's NEXT turn, then cleared. */
  overload: number;
```

`core/src/engine/game.ts` — `makePlayer` sets `overload: 0`. In `beginTurn`, after computing `maxMana` and before the emits:

```ts
    // overload: the lock applies to THIS turn's pool and is then spent. It
    // subtracts from the emitted mana rather than from maxMana, so the crystal
    // count on screen stays truthful and the lock lasts exactly one turn.
    const locked = Math.min(p.overload, maxMana);
    p.overload = 0;
```

then change the `manaChanged` emit to:

```ts
    this.emit({ type: 'manaChanged', player: me, mana: maxMana - locked, maxMana });
```

`core/src/engine/effects.ts`:

```ts
    case 'overload':
      game.state.players[ctx.player].overload += spec.value ?? 0;
      break;
```

`core/src/cardtext.ts`:

```ts
    case 'overload':
      return `Overload: ${v}.`;
```

`app/src/forge/formState.ts`:

```ts
  { label: 'Overload 1', spec: { kind: 'overload', value: 1 } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/overload.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests app/src/forge/formState.ts
git commit -m "feat(core): add overload"
```

---

### Task 11: `consume`

Destroy a friendly token for a payoff. Gives Vermin, Bone, and Pact a way to convert bodies into value.

**Files:**
- Modify: `core/src/types.ts`, `core/src/engine/effects.ts`, `core/src/cardtext.ts`, `app/src/forge/formState.ts`
- Test: `core/tests/effects-consume.test.ts` (create)

**Interfaces:**
- Consumes: `CreatureState.token` from Task 3.
- Produces: `EffectKind` member `'consume'`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/effects-consume.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import { applyEffect } from '../src/engine/effects.js';

describe('consume', () => {
  it('destroys the given number of friendly tokens', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 3 });
    const real = addCreature(game, 0, { id: 't-real', attack: 2, health: 2 });

    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'consume', value: 2 });

    const board = game.state.players[0].board;
    expect(board.filter(c => c.token)).toHaveLength(1);
    // Non-token creatures are never eaten.
    expect(board.some(c => c.id === real.id)).toBe(true);
  });

  it('consumes what it can when short of tokens', () => {
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'summon', cardId: 'token-rat', value: 1 });
    applyEffect(game, { player: 0, cardId: 'test' }, { kind: 'consume', value: 3 });
    expect(game.state.players[0].board.filter(c => c.token)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run core/tests/effects-consume.test.ts`
Expected: FAIL — `'consume'` is not assignable to `EffectKind`.

- [ ] **Step 3: Implement it**

Add `'consume'` to `EffectKind` in `core/src/types.ts`. In `core/src/engine/effects.ts`:

```ts
    case 'consume': {
      const p = game.state.players[ctx.player];
      // Oldest tokens first, so a player's most recent summons survive — the
      // board reads left-to-right and eating the newest looks like a bug.
      const eligible = p.board.filter(c => c.token).slice(0, spec.value ?? 1);
      for (const c of eligible) {
        // A real death: deathrattles on tokens still fire.
        push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
      break;
    }
```

`core/src/cardtext.ts`:

```ts
    case 'consume': {
      const n = effect.value ?? 1;
      return `Consume ${n} friendly ${plural(n, 'token')}.`;
    }
```

`app/src/forge/formState.ts`:

```ts
  { label: 'Consume 1 friendly token', spec: { kind: 'consume', value: 1 } },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run core/tests/effects-consume.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add core/src core/tests app/src/forge/formState.ts
git commit -m "feat(core): add the consume effect kind"
```

---

### Task 12: Rebalance guardrail test

Before touching card data, write the test that defines "balanced". Every later rebalance task runs against it.

**Files:**
- Test: `core/tests/pool-balance.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the guardrail every rebalance task (13-16) must satisfy.

- [ ] **Step 1: Write the test**

Create `core/tests/pool-balance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPool } from '../src/data/index.js';
import { cardText } from '../src/cardtext.js';
import { statBudget, KEYWORD_COST, validateCard, STAT_BUDGET_SLACK } from '../src/validate.js';
import { TOKEN_CAP } from '../src/engine/effects.js';

const pool = buildPool().filter(c => c.archetype !== 'token');

describe('pool balance', () => {
  it('every card passes validateCard with no errors', () => {
    for (const card of pool) {
      const errors = validateCard(card).filter(i => i.severity === 'error');
      expect(errors, `${card.id}: ${errors.map(e => e.message).join('; ')}`).toHaveLength(0);
    }
  });

  it('no creature sits far BELOW its stat budget', () => {
    const under: string[] = [];
    for (const card of pool) {
      if (card.type !== 'creature') continue;
      if (cardText(card).length > 0) continue;   // text pays for stats
      const spent = (card.attack ?? 0) + (card.health ?? 0)
        + card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
      // A vanilla body must land within 2 of its budget in either direction.
      if (spent < statBudget(card.cost) - 2) under.push(`${card.id} (${spent} vs ${statBudget(card.cost)})`);
    }
    expect(under, `underpowered vanillas: ${under.join(', ')}`).toHaveLength(0);
  });

  it('no creature exceeds the ceiling', () => {
    for (const card of pool) {
      if (card.type !== 'creature') continue;
      const spent = (card.attack ?? 0) + (card.health ?? 0)
        + card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
      expect(spent, card.id).toBeLessThanOrEqual(statBudget(card.cost) + STAT_BUDGET_SLACK);
    }
  });

  it('no summon effect promises more tokens than the row can hold', () => {
    for (const card of pool) {
      const specs = [...card.effects, ...(card.triggers ?? []).flatMap(t => t.effects)];
      for (const s of specs) {
        if (s.kind !== 'summon') continue;
        expect(s.value ?? 1, `${card.id} summons ${s.value}`).toBeLessThanOrEqual(TOKEN_CAP);
      }
    }
  });

  it('at most 45 cards carry no rules text and no keyword', () => {
    const blank = pool.filter(c => cardText(c).length === 0 && c.keywords.length === 0);
    expect(blank.length, `blank cards: ${blank.map(c => c.id).join(', ')}`).toBeLessThanOrEqual(45);
  });
});
```

- [ ] **Step 2: Run it to see the current baseline**

Run: `npx vitest run core/tests/pool-balance.test.ts`
Expected: FAIL on the under-budget, summon-count, and blank-card assertions. Record the failure output — it is the exact worklist for Tasks 13-16.

- [ ] **Step 3: Commit the guardrail**

```bash
git add core/tests/pool-balance.test.ts
git commit -m "test(core): add the pool balance guardrail"
```

Commit it **failing**. Tasks 13-16 turn it green.

---

### Tasks 13-16: Rebalance the card data

Four tasks, three archetypes each, all with identical structure. Work only inside the named data files.

- **Task 13:** `ember-court.ts`, `hollow-choir.ts`, `vermin-swarm.ts`
- **Task 14:** `dragonflight.ts`, `elder-roots.ts`, `shadow-dancers.ts`
- **Task 15:** `bone-horde.ts`, `grave-pact.ts`, `night-coven.ts`
- **Task 16:** `starforged.ts`, `eternal-vigil.ts`, `stormwrought.ts`, `neutrals.ts`

**Files (per task):** the three or four named files in `core/src/data/`.

**Interfaces:**
- Consumes: every effect kind and keyword from Tasks 5-11, and `TOKEN_CAP` from Task 3.
- Produces: a pool that satisfies `core/tests/pool-balance.test.ts`.

For **each** task, run these steps:

- [ ] **Step 1: Read the current cards**

```bash
npx tsx -e "import('./core/src/data/index.js').then(async m => { const {cardText} = await import('./core/src/cardtext.js'); for (const c of m.buildPool()) if (['ember','choir','vermin'].includes(c.archetype)) console.log(c.cost, c.name, c.attack ?? '-', c.health ?? '-', c.keywords.join(','), '::', cardText(c) || '(vanilla)'); })"
```

Substitute the archetype keys for your task. Compare against `graphify-out/CARDS.md`, which holds the pre-rebalance inventory.

- [ ] **Step 2: Raise under-budget creatures**

For every creature the guardrail lists as under-budget, raise `attack` and/or `health` until `attack + health + keywordCost` lands within 2 of `statBudget(cost) = 2 + 2 * cost`. Prefer adding health on taunt bodies and attack on aggressive ones. **Never change `cost`** — cost changes ripple into deck curves and the `DECK` copy counts.

- [ ] **Step 3: Give blank mid- and high-cost cards text**

Every vanilla creature costing 4 or more gets either a keyword or a trigger, using the archetype's identity:

| Archetype | Payoff loop | Reach for |
|---|---|---|
| ember | spell damage burn | `spellPower`, `dealDamage`, `overload` |
| choir | heal into value | `heal`, `draw`, `silence` |
| vermin | token flood | `summon`, `consume`, `venom` |
| dragon | tribal buff | `buff` on `friendlyDragon`, `summon` |
| roots | ramp to oversized threats | `gainMana`, big bodies, `taunt` |
| dance | cheap-spell chains | `draw`, `stealth`, `returnToHand` |
| bone | deathrattle recursion | `summon` on `deathrattle`, `consume` |
| pact | pay health for power | self `dealDamage` + `draw`/`refillMana` |
| coven | shrink and control | negative `buff`, `silence`, `venom`, `freeze` |
| star | cost reduction into a huge turn | `discountMostExpensive`, `spellPower` |
| vigil | defensive lifesteal | `lifesteal`, `shield`, `heal` |
| storm | spell cost reduction | `discountNextSpell`, `overload`, `returnToHand` |

Leave low-cost vanillas (cost 1-3) alone — the guardrail allows up to 45 blank cards precisely so a plain 2/3 stays legal.

- [ ] **Step 4: Cap summon counts**

Any `summon` spec with `value` above `TOKEN_CAP` (7) drops to at most 7. Where that makes a card weak for its cost, compensate with stats or a second effect — never by raising the count back.

- [ ] **Step 5: Run the guardrail and the suite**

Run: `npx vitest run core/tests/pool-balance.test.ts`
Then: `npm test`

Expected: your archetypes no longer appear in any failure list. Tests for other archetypes may still fail until their task runs — that is expected, and you must not edit files outside your task to silence them.

- [ ] **Step 6: Commit**

```bash
git add core/src/data
git commit -m "balance(data): retune and de-vanilla <archetypes>"
```

---

### Task 17: Regenerate the card inventory

**Files:**
- Modify: `graphify-out/CARDS.md`

- [ ] **Step 1: Verify the whole pool is green**

Run: `npm test`
Expected: all pass, `core/tests/pool-balance.test.ts` included.

- [ ] **Step 2: Regenerate the inventory**

The generator script is described in `graphify-out/CARDS.md`'s header: it walks `buildPool()` and renders each card through `cardText()`. Rebuild it the same way, grouped by archetype, with the mechanics preamble updated to include the keywords and effect kinds added in Tasks 5-11.

- [ ] **Step 3: Commit**

```bash
git add graphify-out/CARDS.md
git commit -m "docs: regenerate the card inventory after the rebalance"
```

---

## Self-Review

**Spec coverage.** §4.1 → Task 1. §4.2 → Task 2. §4.3 → Task 3. §4.4 → Task 4. §5.1 `silence`/`returnToHand`/`consume` → Tasks 5, 6, 11. §5.2 → Tasks 7, 8. §5.3 → Tasks 9, 10. §6 → Tasks 12-17. §5.4 (Discover) is **deliberately absent** — it crosses `core`, `server`, and `app` and belongs to the main-thread plan. §7 (the Armorial) is likewise out of scope here.

**Type consistency.** `CreatureState` gains `token` (Task 3), `silenced` (Task 5), and `spellPower` (Task 9); every task that adds a field also updates `makeCreature` and `core/tests/helpers.ts`. `PlayerState` gains `overload` (Task 10), set in `makePlayer`. `TOKEN_CAP` is defined in Task 3 and consumed by Tasks 11, 12, and 13-16. `KEYWORD_TEXT` is defined in Task 4 and extended by Tasks 7 and 8.

**Ordering.** Task 10 depends on Task 1's event ordering; Task 11 depends on Task 3's `token` flag; Tasks 13-16 depend on Tasks 3 and 5-11. Tasks 13-16 are independent of each other and may run in parallel.
