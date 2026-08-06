import { describe, it, expect } from 'vitest';
import { CardRegistry } from '../../src/cards.js';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../../src/data/index.js';
import type { ArchetypeId } from '../../src/data/index.js';
import { Game } from '../../src/engine/game.js';
import type { Card } from '../../src/types.js';
import { Recruit, mulliganPolicy } from '../../src/bot/policies.js';
import { makeTestSetup } from '../helpers.js';

/** Synthetic registry card for mulligan tests (no stat-budget validation at register). */
const syntheticCard = (id: string, cost: number): Card => ({
  id,
  name: `Test ${id}`,
  type: 'creature',
  cost,
  attack: 1,
  health: 1,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
  author: 'curated',
  version: 1,
});

describe('mulliganPolicy', () => {
  it('keeps exactly the expensive cards (cost >= 4)', () => {
    const game = Game.create(makeTestSetup());
    game.registry.register(syntheticCard('cheap', 1));
    game.registry.register(syntheticCard('exp', 5));
    game.state.players[0].hand = ['cheap', 'exp', 'cheap'];
    expect(mulliganPolicy(game, 0)).toEqual({ kind: 'mulligan', keep: [1] });
  });

  it('keeps the single most expensive card when nothing costs >= 4', () => {
    const game = Game.create(makeTestSetup());
    game.registry.register(syntheticCard('cheap', 1));
    game.registry.register(syntheticCard('mid', 2));
    game.state.players[0].hand = ['cheap', 'mid', 'cheap'];
    expect(mulliganPolicy(game, 0)).toEqual({ kind: 'mulligan', keep: [1] });
  });

  it('treats unknown card ids as unkeepable and does not throw', () => {
    const game = Game.create(makeTestSetup());
    game.state.players[0].hand = ['no-such-card', 'no-such-card-2', 'no-such-card-3'];
    expect(mulliganPolicy(game, 0)).toEqual({ kind: 'mulligan', keep: [] });
  });
});

describe('Recruit', () => {
  it('chooses only legal intents across 100 seeded random states', () => {
    const pool = new CardRegistry(buildPool());
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    for (let i = 0; i < 100; i++) {
      const ids = expandDeck(DECK_DEFS[deckKeys[i % 12]!]);
      const game = Game.create(
        { seed: i, decks: [ids, ids], heroes: [HEROES[i % 12]!, HEROES[(i + 7) % 12]!] },
        pool,
      );
      // both players mulligan through the policy, then play ~8 recruit turns
      game.submit(mulliganPolicy(game, 0));
      game.submit(mulliganPolicy(game, 1));
      for (let step = 0; step < 8; step++) {
        expect(() => game.submit(Recruit.chooseIntent(game, game.currentPlayer()))).not.toThrow();
        if (game.state.phase === 'gameOver') break;
      }
    }
  });
});
