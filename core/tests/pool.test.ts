import { describe, it, expect } from 'vitest';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../src/data/index.js';
import { validateCard, validateDeck } from '../src/validate.js';
import { CardRegistry } from '../src/cards.js';
import { Game } from '../src/engine/game.js';

describe('full pool', () => {
  it('all 12 decks are 60 valid cards', () => {
    const pool = new CardRegistry(buildPool()).pool();
    for (const [id, def] of Object.entries(DECK_DEFS)) {
      const ids = expandDeck(def);
      expect(ids.length, id).toBe(60);
      expect(validateDeck(ids, pool), id).toEqual([]);
    }
  });

  it('all curated cards validate', () => {
    for (const c of buildPool()) {
      expect(validateCard(c).filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
  });

  it('pool size is in the 250-350 range', () => {
    const n = buildPool().length;
    expect(n).toBeGreaterThanOrEqual(250);
    expect(n).toBeLessThanOrEqual(350);
  });

  it('every archetype has distinct hero powers', () => {
    const sigs = Object.values(HEROES).map(h => JSON.stringify(h.power.effects));
    expect(new Set(sigs).size).toBe(12);
  });

  it('random mirror match (deck vs itself) plays 20 turns without throwing', () => {
    // HEROES is in archetype order (ember, choir, vermin, dragon, roots, dance,
    // bone, pact, coven, star, vigil, storm), the same order as DECK_DEFS, so
    // the archetype's own hero faces a second archetype's hero per mirror.
    const archetypes = Object.values(DECK_DEFS);
    for (const [i, def] of archetypes.entries()) {
      const ids = expandDeck(def);
      const game = Game.create(
        { seed: 1, decks: [ids, ids], heroes: [HEROES[i]!, HEROES[(i + 6) % 12]!] },
        new CardRegistry(buildPool()),
      );
      // mulligan: legalIntents returns [] during mulligan, so submit
      // keep-everything explicitly for both players. Mulligan order is player
      // 0 then player 1 (mulligansDone drives the turn); player 1's hand holds
      // 4 cards (the Mana Surge head-start), so the keep list is computed per
      // mulligan player from that player's hand length.
      while (game.state.phase === 'mulligan') {
        const mp = game.state.mulligansDone[0] ? 1 : 0;
        const n = game.state.players[mp].hand.length;
        game.submit({ kind: 'mulligan', keep: Array.from({ length: n }, (_, i) => i) });
      }
      // main phase: always pick the first legal intent (legalIntents always
      // ends with endTurn, so it is non-empty). Intent targets are revalidated
      // synchronously at submit, so a throw here is a real engine bug.
      let actions = 0;
      while (game.state.phase !== 'gameOver' && actions < 40) {
        game.submit(game.legalIntents(game.currentPlayer())[0]!);
        actions++;
      }
      // either the game ended or we exhausted 40 actions — never a throw
    }
  });
});
