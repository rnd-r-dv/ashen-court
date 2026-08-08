import { describe, it, expect } from 'vitest';
import { CardRegistry } from '../../src/cards.js';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../../src/data/index.js';
import type { ArchetypeId } from '../../src/data/index.js';
import { Game } from '../../src/engine/game.js';
import { createBot } from '../../src/bot/index.js';
import type { BotLevel } from '../../src/bot/index.js';
import { mulliganPolicy, Grandmaster } from '../../src/bot/policies.js';
import { MAX_TURNS } from '../../src/types.js';
import type { PlayerIndex } from '../../src/types.js';
import { makeTestSetup, addCreature } from '../helpers.js';

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

  it('grandmaster holds parity with veteran under simultaneous combat', () => {
    // 240 seeded matches, same deck both sides; the grandmaster seat
    // alternates so first-player advantage cancels.
    //
    // SIMULTANEOUS COMBAT (Task 2) removed the old edge. Retaliation used to
    // be gated on defender survival, so a first attacker could kill a defender
    // and keep its own creature ("free" trades); GM's depth-2 search exploited
    // that sequencing better than greedy Veteran. Combat is now symmetric —
    // every attack trades both values — so the exploitable edge is gone.
    // Re-measured under the new rules on seeds 0-239: 119/240 = 49.6% GM wins
    // (40-game blocks range 42.5%-57.5%); seeds 0-479: 244/480 = 50.8%. The
    // same 0-239 window on the pre-simultaneous engine measured 143/240 =
    // 59.6%, so the drop is the rule change, not the sample. BAR: > 45% — the
    // canary is that GM does not fall well below parity; revisit when the
    // rebalance tasks (12+) re-tune the pool.
    const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
    let gmWins = 0;
    const games = 240;
    for (let i = 0; i < games; i++) {
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
    expect(gmWins / games).toBeGreaterThan(0.45);
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

  it('grandmaster resolves a pending discover inside the depth-2 enemy-turn simulation', () => {
    // Deterministic depth-2 scenario (Task 1 Step 7). Player 0 holds a
    // 1-cost star-spark and a 0/1 vanilla that cannot attack; their only
    // artifact fires a Discover at the START of player 0's turn. The enemy
    // has a stealthed 1/1 Charge that hits player 0's hero for 1 on its
    // greedy turn (stealth keeps it off the anyCreature target lists). The
    // hero power is rewritten to dmg(1, anyCreature) so its only variant is
    // hitting our own creature — never the enemy hero (which would outscore
    // everything).
    //
    // Hand-derived scores (evaluate weights: board atk*2+hp, foe *1.3, hp*2,
    // hand*1.2, maxMana*0.3, board-length*0.5):
    //   - playCard star-spark on our own 0/1: 0 - 3.9 - 0.5 + 0.6 = -3.8
    //   - endTurn, sim exits WITHOUT resolving the choice (the old loop
    //     stopped as soon as the current player was no longer the enemy):
    //     board 1 - 3.9 - 2(hero hit) + 1.2(spark held) + 0.9 = -2.8
    //   - hero power on our own 0/1 (spark stays in hand): -2.6
    //   - endTurn, sim resolves the pending choice (hand +1.2):
    //     1 - 3.9 - 2 + 1.2 + 1.2 + 0.9 = -1.6
    // So WITHOUT the sim's pending-resolution branch Grandmaster picks the
    // hero power (-2.6 > -2.8); WITH it, endTurn wins (-1.6 > -2.6).
    const ids = expandDeck(DECK_DEFS.ember!);
    const game = Game.create({ seed: 42, decks: [ids, ids], heroes: [HEROES[0]!, HEROES[6]!] }, pool);
    game.state.phase = 'main';
    game.state.players[0].hand = ['star-spark'];
    game.state.players[0].mana = 2;
    game.state.players[0].maxMana = 2;
    game.state.players[0].deck = [];
    game.state.players[0].hero.power = { name: 'Star Rite', cost: 2, effects: [{ kind: 'dealDamage', value: 1, target: 'anyCreature' }] };
    game.state.players[1].hand = [];
    game.state.players[1].deck = [];
    game.state.players[1].mana = 0;
    game.state.players[1].maxMana = 0;
    pool.register({
      id: 'disc-art', name: 'Discover Relic', type: 'artifact', cost: 0,
      keywords: [], effects: [], triggers: [{ when: 'startOfTurn', effects: [{ kind: 'discover' }] }],
      rarity: 'common', archetype: 'neutral',
      art: { preset: 'arcane', palette: ['#141430', '#ffe9a8'], seed: 1 },
      author: 'curated', version: 1,
    });
    game.state.players[0].artifacts.push({ id: 'a1', cardId: 'disc-art', owner: 0 });
    addCreature(game, 0, { id: 'disc-c', attack: 0, health: 1 });           // exhausted: cannot attack
    addCreature(game, 1, { id: 'disc-d', attack: 1, health: 1, keywords: ['charge', 'stealth'] });

    expect(Grandmaster.chooseIntent(game, 0)).toMatchObject({ kind: 'endTurn' });
  });
});
