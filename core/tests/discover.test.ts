import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup } from './helpers.js';
import type { Card, GameEvent, PendingChoice, PlayerIndex } from '../src/types.js';

/**
 * Discover (Task 1): the engine's first interrupting intent state. Candidates
 * are drawn through the seeded RNG (game.pickRandom), the active choice lives
 * in state.pendingChoice, and overlapping offers queue FIFO in
 * state.pendingChoiceQueue. Events remain the ONLY mutation path: the discover
 * effect pushes discoverOffered, resolution emits discoverResolved, and both
 * dispatch handlers mutate state. Tests drive the real engine through the
 * public submit/applyEvent surface and derive expectations independently.
 */

/** Synthetic 1-cost Discover spell, registered into the test-pool registry so
 *  the real playCard → applyEffect path offers the choice. */
const DISCOVER_SPELL: Card = {
  id: 'disc-test', name: 'Discover Test', type: 'spell', cost: 1,
  keywords: [], effects: [{ kind: 'discover' }],
  rarity: 'common', archetype: 'neutral',
  art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
  author: 'curated', version: 1,
};

const choice = (player: PlayerIndex, cardIds: string[]): PendingChoice => ({ kind: 'discover', player, cardIds });

/** A main-phase game where player 0 holds a playable Discover spell. */
function makeDiscoverGame(seed = 1): Game {
  const game = Game.create(makeTestSetup());
  game.registry.register(DISCOVER_SPELL);
  game.state.phase = 'main';
  game.state.players[0].hand = ['disc-test'];
  game.state.players[0].mana = 1;
  game.state.players[0].maxMana = 1;
  return game;
}

/** Play the Discover spell and return the discoverOffered event it produces. */
function offerFromPlay(game: Game): Extract<GameEvent, { type: 'discoverOffered' }> {
  const evts = game.submit({ kind: 'playCard', handIndex: 0 });
  const offered = evts.find((e): e is Extract<GameEvent, { type: 'discoverOffered' }> => e.type === 'discoverOffered');
  expect(offered).toBeDefined();
  return offered!;
}

describe('Discover candidate generation', () => {
  it('produces three distinct candidates through the seeded RNG', () => {
    const game = makeDiscoverGame();
    const offered = offerFromPlay(game);
    const ids = offered.choice.cardIds;
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);            // distinct, not repeats
    expect(game.state.pendingChoice).toEqual(offered.choice);
  });

  it('is deterministic: the same seed offers the same candidates', () => {
    const a = offerFromPlay(makeDiscoverGame(1));
    const b = offerFromPlay(makeDiscoverGame(1));
    expect(a.choice.cardIds).toEqual(b.choice.cardIds);
  });

  it('excludes tokens and mana-surge from the candidates', () => {
    const game = makeDiscoverGame();
    const offered = offerFromPlay(game);
    expect(offered.choice.cardIds).toHaveLength(3);
    for (const id of offered.choice.cardIds) {
      const card = game.registry.get(id);
      expect(card.archetype, id).not.toBe('token');
      expect(id, id).not.toBe('mana-surge');
    }
  });
});

describe('Discover legality', () => {
  it('only the pending owner receives three legal Discover intents; every other player none', () => {
    const game = makeDiscoverGame();
    const owner = offerFromPlay(game).choice.player;
    const enemy = (1 - owner) as PlayerIndex;
    const intents = game.legalIntents(owner);
    expect(intents).toHaveLength(3);
    expect(intents.every(i => i.kind === 'discover')).toBe(true);
    // the three choices map 1:1 onto the offered candidates
    expect(intents.map(i => (i.kind === 'discover' ? i.choice : -1))).toEqual([0, 1, 2]);
    expect(game.legalIntents(enemy)).toEqual([]);
  });
});

describe('Discover resolution', () => {
  it('the pending owner can resolve while they are NOT currentPlayer()', () => {
    const game = makeDiscoverGame();
    // A choice offered to player 1 while player 0 is still the current player
    // (how a start/end-of-turn trigger creates an out-of-turn choice).
    game.applyEvent({ type: 'discoverOffered', choice: choice(1, ['t-001', 't-002', 't-003']) });
    expect(game.currentPlayer()).toBe(0);
    expect(game.state.pendingChoice?.player).toBe(1);
    const evts = game.submit({ kind: 'discover', choice: 2 });
    const p1 = game.state.players[1];
    expect(p1.hand[p1.hand.length - 1]).toBe('t-003');
    expect(evts.some(e => e.type === 'discoverResolved' && e.player === 1 && e.cardId === 't-003')).toBe(true);
    expect(game.state.pendingChoice).toBeNull();
  });

  it('rejects every non-Discover intent and every out-of-range choice without mutation', () => {
    const game = makeDiscoverGame();
    game.applyEvent({ type: 'discoverOffered', choice: choice(1, ['t-001', 't-002', 't-003']) });
    const before = game.serialize();
    expect(() => game.submit({ kind: 'endTurn' })).toThrow('Resolve Discover first');
    expect(() => game.submit({ kind: 'playCard', handIndex: 0 })).toThrow('Resolve Discover first');
    expect(() => game.submit({ kind: 'mulligan', keep: [] })).toThrow('Resolve Discover first');
    expect(() => game.submit({ kind: 'discover', choice: -1 })).toThrow();
    expect(() => game.submit({ kind: 'discover', choice: 3 })).toThrow();
    expect(() => game.submit({ kind: 'discover', choice: 1.5 })).toThrow();   // non-integer
    expect(game.serialize()).toBe(before);                                     // zero mutation
    expect(game.state.pendingChoice).toEqual(choice(1, ['t-001', 't-002', 't-003']));
  });

  it('rejects a Discover intent when no choice is pending', () => {
    const game = makeDiscoverGame();
    expect(() => game.submit({ kind: 'discover', choice: 0 })).toThrow('No Discover choice pending');
  });

  it('adds the selected card to the pending owner hand through discoverResolved', () => {
    const game = makeDiscoverGame();
    const offered = offerFromPlay(game);
    const picked = offered.choice.cardIds[1]!;
    const evts = game.submit({ kind: 'discover', choice: 1 });
    const p0 = game.state.players[0];
    expect(p0.hand[p0.hand.length - 1]).toBe(picked);
    expect(evts.some(e => e.type === 'discoverResolved' && e.player === 0 && e.cardId === picked)).toBe(true);
    expect(game.state.pendingChoice).toBeNull();
  });
});

describe('Discover queueing', () => {
  it('two offers queue FIFO; resolving the first exposes the second, then clears both fields', () => {
    const game = makeDiscoverGame();
    const first = choice(0, ['t-001', 't-002', 't-003']);
    const second = choice(1, ['t-004', 't-005', 't-006']);
    game.applyEvent({ type: 'discoverOffered', choice: first });
    game.applyEvent({ type: 'discoverOffered', choice: second });
    expect(game.state.pendingChoice).toEqual(first);
    expect(game.state.pendingChoiceQueue).toEqual([second]);
    game.submit({ kind: 'discover', choice: 0 });
    const p0 = game.state.players[0];
    expect(p0.hand[p0.hand.length - 1]).toBe('t-001');
    expect(game.state.pendingChoice).toEqual(second);       // FIFO: next offer exposed
    expect(game.state.pendingChoiceQueue).toEqual([]);
    game.submit({ kind: 'discover', choice: 2 });
    const p1 = game.state.players[1];
    expect(p1.hand[p1.hand.length - 1]).toBe('t-006');
    expect(game.state.pendingChoice).toBeNull();
    expect(game.state.pendingChoiceQueue).toEqual([]);
  });

  it('gameOver clears active and queued choices', () => {
    const game = makeDiscoverGame();
    game.applyEvent({ type: 'discoverOffered', choice: choice(0, ['t-001', 't-002', 't-003']) });
    game.applyEvent({ type: 'discoverOffered', choice: choice(0, ['t-004', 't-005', 't-006']) });
    expect(game.state.pendingChoiceQueue).toHaveLength(1);
    // the deferred win check fires at the end of the discover resolution session
    game.state.players[1].hero.hp = 0;
    game.submit({ kind: 'discover', choice: 0 });
    expect(game.state.phase).toBe('gameOver');
    expect(game.state.pendingChoice).toBeNull();
    expect(game.state.pendingChoiceQueue).toEqual([]);
  });
});

describe('Discover serialization', () => {
  it('a real round trip preserves candidates, owner, queue, RNG position, and byte-identical continuation', () => {
    const game = makeDiscoverGame();
    offerFromPlay(game);                                                     // pending for player 0
    game.applyEvent({ type: 'discoverOffered', choice: choice(1, ['t-004', 't-005', 't-006']) });
    expect(game.state.pendingChoiceQueue).toHaveLength(1);

    const restored = Game.deserialize(game.serialize(), game.registry);
    expect(restored.state.pendingChoice).toEqual(game.state.pendingChoice);
    expect(restored.state.pendingChoiceQueue).toEqual(game.state.pendingChoiceQueue);

    game.submit({ kind: 'discover', choice: 1 });
    restored.submit({ kind: 'discover', choice: 1 });
    // same intent sequence → byte-identical state: RNG position continued from
    // the same saved rngState.calls, queue rotated identically
    expect(restored.serialize()).toBe(game.serialize());
  });

  it('clone() preserves active/queued choices while keeping the empty-log search contract', () => {
    const game = makeDiscoverGame();
    const offered = offerFromPlay(game);
    game.applyEvent({ type: 'discoverOffered', choice: choice(1, ['t-004', 't-005', 't-006']) });
    const clone = game.clone();
    expect(clone.state.pendingChoice).toEqual(game.state.pendingChoice);
    expect(clone.state.pendingChoiceQueue).toEqual(game.state.pendingChoiceQueue);
    expect(clone.state.log).toEqual([]);          // search clones carry no event log
    // the clone is fully functional: it can resolve the carried choice
    const picked = offered.choice.cardIds[0]!;
    clone.submit({ kind: 'discover', choice: 0 });
    const p0 = clone.state.players[0];
    expect(p0.hand[p0.hand.length - 1]).toBe(picked);
    expect(clone.state.pendingChoice?.player).toBe(1);   // queue rotated onto the clone too
  });
});
