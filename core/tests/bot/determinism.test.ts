import { describe, it, expect, afterEach } from 'vitest';
import { CardRegistry } from '../../src/cards.js';
import { buildPool, DECK_DEFS, expandDeck, HEROES } from '../../src/data/index.js';
import type { ArchetypeId } from '../../src/data/index.js';
import { Game } from '../../src/engine/game.js';
import { Grandmaster, Veteran, mulliganPolicy } from '../../src/bot/policies.js';
import { MAX_TURNS } from '../../src/types.js';
import type { Intent, PlayerIndex } from '../../src/types.js';

/**
 * Issue 11: bot decisions must be a pure function of game state.
 *
 * The engine's headline invariant is "same seed + same intent sequence ⇒
 * byte-identical state". A bot that consults performance.now() to decide how
 * many intents to evaluate breaks it from the outside: under load the same
 * seed yields different picks, so a bot match is not reproducible and seeded
 * regression tests flake. Running the same match twice back-to-back on an idle
 * machine does NOT catch this — the budget simply never binds. These tests
 * force the issue by driving the clock, which is the only way to observe the
 * hazard deterministically.
 */

const pool = new CardRegistry(buildPool());
const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];

/** Play a seeded match forward `plies` bot intents to reach a real mid-game
 *  position (full decks, real cards, contested board). */
function positionAfter(seed: number, plies: number): { game: Game; me: PlayerIndex } {
  const ids = expandDeck(DECK_DEFS[deckKeys[seed % 12]!]);
  const game = Game.create({ seed, decks: [ids, ids], heroes: [HEROES[0]!, HEROES[6]!] }, pool);
  game.submit(mulliganPolicy(game, 0));
  game.submit(mulliganPolicy(game, 1));
  for (let i = 0; i < plies && game.state.phase !== 'gameOver' && game.state.turn < MAX_TURNS; i++) {
    game.submit(Veteran.chooseIntent(game, game.currentPlayer()));
  }
  return { game, me: game.currentPlayer() };
}

const realNow = performance.now.bind(performance);
afterEach(() => { performance.now = realNow; });

/**
 * Run `fn` under a hostile clock: every reading leaps `stepMs` further ahead,
 * so ANY elapsed-time budget is already blown the first time it is checked.
 * This is what an overloaded machine looks like to a wall-clock budget — the
 * decision path must not notice.
 */
function underLeapingClock<T>(stepMs: number, fn: () => T): T {
  let t = 0;
  performance.now = () => (t += stepMs);
  try {
    return fn();
  } finally {
    performance.now = realNow;
  }
}

describe('bot decisions are wall-clock independent (I11)', () => {
  it('Grandmaster picks the same intent under a clock that blows every budget', () => {
    // 12 real mid-game positions across all archetypes. A wall-clock-bounded
    // search truncates its candidate loop the moment the clock leaps, so it
    // falls back to legal[0] instead of the argmax.
    const mismatches: { seed: number; normal: Intent; leaping: Intent }[] = [];
    for (let seed = 0; seed < 12; seed++) {
      const a = positionAfter(seed, 18);
      const b = positionAfter(seed, 18);
      const normal = Grandmaster.chooseIntent(a.game, a.me);
      const leaping = underLeapingClock(10_000, () => Grandmaster.chooseIntent(b.game, b.me));
      if (JSON.stringify(normal) !== JSON.stringify(leaping)) mismatches.push({ seed, normal, leaping });
    }
    expect(mismatches).toEqual([]);
  });

  it('Grandmaster plays an identical full match under a hostile clock', () => {
    // End-to-end: the whole game must be byte-identical, not just one pick.
    const run = (wrap: <T>(fn: () => T) => T) => {
      const ids = expandDeck(DECK_DEFS.ember!);
      const game = Game.create({ seed: 7, decks: [ids, ids], heroes: [HEROES[0]!, HEROES[6]!] }, pool);
      game.submit(mulliganPolicy(game, 0));
      game.submit(mulliganPolicy(game, 1));
      const picks: Intent[] = [];
      while (game.state.phase !== 'gameOver' && game.state.turn < MAX_TURNS) {
        const me = game.currentPlayer();
        const intent = wrap(() => Grandmaster.chooseIntent(game, me));
        picks.push(intent);
        game.submit(intent);
      }
      return { picks, turn: game.state.turn, log: game.state.log.length };
    };
    const plain = run((fn) => fn());
    const hostile = run((fn) => underLeapingClock(10_000, fn));
    expect(hostile).toEqual(plain);
  });

  it('Veteran picks the same intent under a hostile clock', () => {
    // Veteran has no budget today; this pins that it stays that way.
    for (let seed = 0; seed < 6; seed++) {
      const a = positionAfter(seed, 18);
      const b = positionAfter(seed, 18);
      const normal = Veteran.chooseIntent(a.game, a.me);
      const leaping = underLeapingClock(10_000, () => Veteran.chooseIntent(b.game, b.me));
      expect(leaping, `seed ${seed}`).toEqual(normal);
    }
  });
});
