import { describe, it, expect } from 'vitest';
import { CardRegistry } from '../../src/cards.js';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../../src/data/index.js';
import type { ArchetypeId } from '../../src/data/index.js';
import { Game } from '../../src/engine/game.js';
import { Grandmaster, Veteran, mulliganPolicy } from '../../src/bot/policies.js';
import { makeTestSetup, addCreature } from '../helpers.js';

/**
 * Depth-2 lookahead (Task 22). The Grandmaster policy simulates, for each of
 * its legal intents, the opponent's greedy best reply (a budget-capped
 * Veteran-style argmax) before scoring — so an intent that hands the turn to
 * the enemy is judged AFTER the enemy's best response, while Veteran judges
 * it immediately. A blunder position is one where those two rankings disagree:
 * ending the turn looks fine immediately but the enemy's reply makes it worse
 * than trading.
 */
describe('Grandmaster', () => {
  it('avoids the greedy blunder: depth-2 pick differs from Veteran', () => {
    // My hero at 2 hp. Enemy has a single 3/2 taunt. My only creature is a
    // 1/1 charge; no mana, no hand, no deck (nothing else to do).
    //   - Veteran (depth-1): ending the turn scores -64.5 immediately (my 1/1
    //     still on board) vs -66.7 for suiciding the 1/1 into the taunt, so
    //     Veteran ends the turn.
    //   - Grandmaster (depth-2): after endTurn the enemy's best reply kills my
    //     1/1 with the taunt (their argmax, 66.8 vs 66.4 for hero-lethal vs
    //     62.4 for ending), leaving -68.0 — worse than the -66.7 trade. It
    //     therefore attacks the taunt instead.
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.players[0].hero.hp = 2;
    game.state.players[0].mana = 0;
    game.state.players[0].maxMana = 0;
    game.state.players[0].hand = [];
    game.state.players[0].deck = [];
    game.state.players[1].mana = 0;
    game.state.players[1].maxMana = 0;
    game.state.players[1].hand = [];
    game.state.players[1].deck = [];
    addCreature(game, 0, { id: 'gm-001', attack: 1, health: 1, keywords: ['charge'] });
    addCreature(game, 1, { id: 'gm-002', attack: 3, health: 2, keywords: ['taunt'] });

    const veteranPick = Veteran.chooseIntent(game, 0);
    const gmPick = Grandmaster.chooseIntent(game, 0);

    // the blunder: Veteran ends the turn (the greedy move);
    expect(veteranPick).toMatchObject({ kind: 'endTurn' });
    // Grandmaster sees the enemy reply and picks something different.
    expect(gmPick.kind).not.toBe('endTurn');
    expect(gmPick).toMatchObject({ kind: 'attack', target: { type: 'creature' } });
    // and Grandmaster's pick survives: submitting it keeps the game running.
    game.submit(gmPick);
    expect(game.state.phase).toBe('main');
    expect(game.state.players[0].hero.hp).toBeGreaterThan(0);
  });

  it('never produces illegal intents across 100 seeded random states', () => {
    const pool = new CardRegistry(buildPool());
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    for (let i = 0; i < 100; i++) {
      const ids = expandDeck(DECK_DEFS[deckKeys[i % 12]!]);
      const game = Game.create(
        { seed: i, decks: [ids, ids], heroes: [HEROES[i % 12]!, HEROES[(i + 7) % 12]!] },
        pool,
      );
      // both players mulligan through the policy, then play ~8 grandmaster turns
      game.submit(mulliganPolicy(game, 0));
      game.submit(mulliganPolicy(game, 1));
      for (let step = 0; step < 8; step++) {
        expect(() => game.submit(Grandmaster.chooseIntent(game, game.currentPlayer()))).not.toThrow();
        if (game.state.phase === 'gameOver') break;
      }
    }
  });
});
