import { describe, it, expect } from 'vitest';
import { CardRegistry } from '../../src/cards.js';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../../src/data/index.js';
import type { ArchetypeId } from '../../src/data/index.js';
import { Game } from '../../src/engine/game.js';
import { createBot } from '../../src/bot/index.js';
import type { BotLevel } from '../../src/bot/index.js';
import { mulliganPolicy } from '../../src/bot/policies.js';
import { MAX_TURNS } from '../../src/types.js';
import type { PlayerIndex } from '../../src/types.js';
import { makeTestSetup } from '../helpers.js';

const pool = new CardRegistry(buildPool());

/**
 * Play one full bot match to completion. Mulligans both players through the
 * fixed mulligan policy, then alternates the two bot levels by seat and loops
 * chooseIntent → submit until the engine reaches gameOver. The turn guard
 * (belt-and-suspenders around the engine's MAX_TURNS draw) bounds the loop,
 * so a stall can never hang the suite.
 */
function runMatch(
  seed: number,
  deckIds: string[],
  p0Level: BotLevel,
  p1Level: BotLevel,
): { winner: PlayerIndex | 'draw'; turns: number } {
  const game = Game.create({ seed, decks: [deckIds, deckIds], heroes: [HEROES[0]!, HEROES[6]!] }, pool);
  game.submit(mulliganPolicy(game, 0));
  game.submit(mulliganPolicy(game, 1));
  while (game.state.phase !== 'gameOver' && game.state.turn < MAX_TURNS) {
    const me = game.currentPlayer();
    const level = me === 0 ? p0Level : p1Level;
    game.submit(createBot(level).chooseIntent(game, me));
  }
  const over = game.state.log.find(e => e.type === 'gameOver');
  return { winner: over && over.type === 'gameOver' ? over.winner : 'draw', turns: game.state.turn };
}

describe('bot integration', () => {
  it('veteran beats recruit in seeded mirror matches', () => {
    // 20 seeded mirrors, same deck both sides, cycled across all 12
    // archetypes; the veteran seat alternates so first-player advantage
    // cancels. Assert the veteran player wins most games (> 60%).
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    let veteranWins = 0;
    for (let i = 0; i < 20; i++) {
      const ids = expandDeck(DECK_DEFS[deckKeys[i % 12]!]);
      const veteranIsP0 = i % 2 === 0;
      const res = runMatch(
        i,
        ids,
        veteranIsP0 ? 'veteran' : 'recruit',
        veteranIsP0 ? 'recruit' : 'veteran',
      );
      if (res.winner === (veteranIsP0 ? 0 : 1)) veteranWins++;
    }
    expect(veteranWins / 20).toBeGreaterThan(0.6);
  });

  it('grandmaster beats veteran in seeded matches', () => {
    // 20 seeded matches, same deck both sides; grandmaster seat alternates.
    // GM uses the full-enemy-turn reply model (audit 03 C1): endTurn intents
    // are scored after simulating the enemy's ENTIRE greedy turn, so passing
    // into a punishing enemy turn is seen and avoided.
    //
    // Measured rates (slice B, audit 03 C1): fixed seeds 0-19 here = 12/20
    // (60%); ad-hoc soaks with the same deck cycle — seeds 20-59 = 21/40
    // (52.5%), 60-99 = 24/40 (60%), 100-139 = 25/40 (62.5%) → true edge over
    // Veteran ≈ 58% (82/140). Fork analysis of the 260 positions where GM
    // deviated from Veteran across seeds 0-59: GM's pick won 14 games that
    // Veteran's pick lost, lost 6 the reverse way — the deepen is net-positive
    // but small, and the fixed 20-seed window is draw-luck dominated (one win
    // of margin; Approved-with-caveat per the slice brief, assertion
    // untouched).
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    let gmWins = 0;
    for (let i = 0; i < 20; i++) {
      const ids = expandDeck(DECK_DEFS[deckKeys[i % 12]!]);
      const gmIsP0 = i % 2 === 0;
      const res = runMatch(
        i,
        ids,
        gmIsP0 ? 'grandmaster' : 'veteran',
        gmIsP0 ? 'veteran' : 'grandmaster',
      );
      if (res.winner === (gmIsP0 ? 0 : 1)) gmWins++;
    }
    expect(gmWins / 20).toBeGreaterThan(0.55);
  });

  it('every full bot game completes within the turn limit', () => {
    // all 12 archetypes, recruit mirror: the engine's MAX_TURNS draw makes
    // every match reach gameOver by turn 200 — no stall, no infinite loop.
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    for (const key of deckKeys) {
      const ids = expandDeck(DECK_DEFS[key]!);
      const res = runMatch(1, ids, 'recruit', 'recruit');
      expect(res.turns, `${key} turns`).toBeLessThanOrEqual(MAX_TURNS);
      expect([0, 1, 'draw'], `${key} winner`).toContain(res.winner);
    }
  });

  it('bot games are deterministic under the same seed', () => {
    // two identical setups → identical gameOver winner + turn count, for
    // veteran AND grandmaster (the budgeted search must stay deterministic).
    const ids = expandDeck(DECK_DEFS.ember!);
    const a = runMatch(7, ids, 'veteran', 'veteran');
    const b = runMatch(7, ids, 'veteran', 'veteran');
    expect(a).toEqual(b);
    const c = runMatch(7, ids, 'grandmaster', 'grandmaster');
    const d = runMatch(7, ids, 'grandmaster', 'grandmaster');
    expect(c).toEqual(d);
  });

  it('MAX_TURNS: turn limit ends the game with a draw', () => {
    // force the turn counter to the limit; the next endTurn resolution must
    // emit a deterministic gameOver draw ('turn limit') in the log.
    const game = Game.create(makeTestSetup());
    game.state.phase = 'main';
    game.state.turn = MAX_TURNS;
    game.state.players[0].deck = [];
    game.state.players[1].deck = [];
    game.submit({ kind: 'endTurn' });
    expect(game.state.phase).toBe('gameOver');
    const over = game.state.log.find(e => e.type === 'gameOver');
    expect(over).toMatchObject({ winner: 'draw', reason: 'turn limit' });
  });
});
