import { evaluate } from './heuristic.js';
import type { Game } from '../engine/game.js';
import type { Intent, PlayerIndex } from '../types.js';

/** A bot's decision function: choose one legal intent for `me` in `game`. */
export interface BotPolicy {
  chooseIntent(game: Game, me: PlayerIndex): Intent;
}

/**
 * Grandmaster search bounds — ALL DETERMINISTIC (issue 11).
 *
 * These were wall-clock budgets (a 1000ms cap per chooseIntent and a 200ms cap
 * on the enemy-turn simulation). That made bot decisions a function of machine
 * load, which is the one hole in the engine's "same seed + same intent sequence
 * ⇒ byte-identical state" invariant: under load the same seed played a
 * different match, so seeded regression tests could flake. The budgets are now
 * replaced by pure state-derived caps, so the evaluated set depends only on the
 * position. See core/tests/bot/determinism.test.ts, which drives a hostile
 * clock to pin this down.
 *
 * Sizing, measured over 12 full Grandmaster matches on the curated pool with
 * both caps instrumented: they bound the worst case, they do not shape normal
 * decisions. Widest own enumeration 44, widest enemy-reply enumeration 56 (cap
 * 64); longest simulated enemy turn 9 intents (cap 32). Both caps bound ZERO
 * times across ~864 decisions, so play strength is unchanged by this fix.
 *
 * Cost after the change: mean 2.5ms, p50 1.7ms, p95 7.9ms, p99 15ms, max 26ms
 * per decision (before: mean 2.7ms, p99 16ms, max 40ms) — the wall-clock budget
 * was dead weight, never once binding, and the search sits ~40x under the
 * 1000ms cap it used to enforce.
 */

/** At most this many own intents are evaluated, in stable enumeration order
 *  (hand/board order). Widest position observed: 62. */
const MAX_EVAL = 64;
/**
 * Cap on intents simulated inside ONE enemy-turn simulation. Bounds the depth-2
 * reply model: the sim stops after this many enemy intents even if the enemy
 * has not ended its turn, and the partial turn is scored as-is (approximate,
 * exactly as the old 200ms cut was — but reproducibly so). Longest real greedy
 * turn observed: 11.
 */
const MAX_ENEMY_TURN_INTENTS = 32;

/**
 * One-time mulligan policy: keep every card that costs >= 4, redraw the rest.
 * When no card is expensive enough, keep the single most expensive card.
 * Unknown card ids (registry.get throws) count as unkeepable.
 * Returns indices of cards to KEEP (the engine splices the rest and redraws);
 * keep=[] is legal and redraws everything.
 */
export function mulliganPolicy(game: Game, me: PlayerIndex): Intent {
  const hand = game.state.players[me].hand;
  const keep: number[] = [];
  let mostExpensive: { index: number; cost: number } | null = null;
  for (let i = 0; i < hand.length; i++) {
    let cost: number;
    try {
      cost = game.registry.get(hand[i]!).cost;
    } catch {
      continue; // unknown id: unkeepable
    }
    if (cost >= 4) keep.push(i);
    if (mostExpensive === null || cost > mostExpensive.cost) mostExpensive = { index: i, cost };
  }
  if (keep.length === 0 && mostExpensive !== null) keep.push(mostExpensive.index);
  return { kind: 'mulligan', keep };
}

/** Recruit difficulty: uniformly random legal intent (seeded stream); an
 *  empty legal set (mulligan phase, non-current player, gameOver) degrades
 *  to endTurn — parity with Veteran/Grandmaster (audit 03 I2). */
export const Recruit: BotPolicy = {
  chooseIntent(game, me) {
    const legal = game.legalIntents(me);
    return legal.length === 0 ? { kind: 'endTurn' } : game.pickRandom(legal);
  },
};

/**
 * Greedy argmax over legal intents (the Veteran loop, shared with
 * Grandmaster's bestReply). For each legal intent, clone the game, apply the
 * intent, and score the resulting position with evaluate(); the argmax wins.
 * A tiny deterministic index tiebreak (score + i * 1e-9) keeps picks stable
 * under the same seed. Intents that throw on submit are skipped defensively
 * (log-free); an empty legal set returns null (Veteran falls back to endTurn,
 * Grandmaster treats it as 'no reply'). Mulligan delegates to mulliganPolicy.
 * With maxEval set (Grandmaster's enemy-turn simulation) the loop stops after
 * that many candidates in stable enumeration order; without it the loop always
 * exhausts every intent, so Veteran's behavior is unchanged by the extraction.
 * maxEval replaced a wall-clock sub-budget (issue 11) — a count is a pure
 * function of the position, elapsed time is not.
 */
function greedyBest(game: Game, me: PlayerIndex, maxEval?: number): Intent | null {
  if (game.state.phase === 'mulligan') return mulliganPolicy(game, me);
  const legal = game.legalIntents(me);
  if (legal.length === 0) return null;
  let best = legal[0]!;
  let bestScore = -Infinity;
  for (let i = 0; i < legal.length; i++) {
    if (maxEval !== undefined && i >= maxEval) break;
    const intent = legal[i]!;
    let score: number;
    try {
      const g = game.clone();
      g.submit(intent);
      score = evaluate(g, me) + i * 1e-9;
    } catch {
      continue; // intent that submit rejects: skip, never crash the bot
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return best;
}

/**
 * Veteran difficulty: greedy heuristic. For each legal intent, clone the
 * game, apply the intent, and score the resulting position with evaluate();
 * the argmax wins (a tiny deterministic index-based tiebreak keeps picks
 * stable under the same seed). Intents that throw on submit are skipped
 * defensively (log-free); an empty legal-intent set degrades to endTurn.
 * Mulligan is delegated to mulliganPolicy (legalIntents returns [] there).
 */
export const Veteran: BotPolicy = {
  chooseIntent(game, me) {
    return greedyBest(game, me) ?? { kind: 'endTurn' };
  },
};

/**
 * Score a position from `me`'s perspective AFTER the enemy's ENTIRE turn — the
 * Grandmaster depth-2 reply model (audit 03 C1). `g` is a working clone whose
 * current player is the enemy (my just-submitted intent was endTurn, the only
 * intent that hands the turn over). Loop: enumerate the enemy's legal intents,
 * pick its Veteran-style greedy argmax (greedyBest — same evaluate + i*1e-9
 * tiebreak convention, shared code), submit the pick to the working clone, and
 * repeat until the enemy ends its turn (current player returns to me) or the
 * game ends. The simulation is bounded deterministically (issue 11): at most
 * MAX_ENEMY_TURN_INTENTS iterations, and each reply search is itself capped at
 * MAX_EVAL candidates. The final state — my next turn after the enemy's endTurn
 * (ready board, fresh mana, drawn card), or the terminal state — is scored from
 * my perspective. A capped mid-turn cut leaves the partial enemy turn scored:
 * approximate, and unreachable in real play (longest greedy turn observed: 11
 * of the 32 allowed).
 */
function scoreAfterEnemyTurn(g: Game, me: PlayerIndex): number {
  const enemy = (1 - me) as PlayerIndex;
  let steps = 0;
  while (g.state.phase !== 'gameOver' && g.currentPlayer() === enemy) {
    if (steps++ >= MAX_ENEMY_TURN_INTENTS) break;
    const reply = greedyBest(g, enemy, MAX_EVAL);
    if (reply === null) break; // defensive: no legal intents (endTurn is always legal in main)
    try {
      g.submit(reply);
    } catch {
      break; // defensive: a rejected reply stops the sim, never crashes the bot
    }
  }
  return evaluate(g, me);
}

/**
 * Grandmaster difficulty: bounded depth-2 search with a full-enemy-turn reply
 * model (audit 03 C1). For each legal intent (stable hand/board enumeration
 * order), clone the game and apply it. Non-endTurn intents score the immediate
 * position with evaluate() — the enemy cannot act mid-turn, so those are
 * identical to Veteran. endTurn intents are scored AFTER a full simulation of
 * the enemy's entire greedy turn (scoreAfterEnemyTurn), so passing into a
 * punishing enemy turn is seen and avoided. Strict > argmax over the
 * deterministic enumeration. Bounds (issue 11): MAX_EVAL own intents evaluated
 * in enumeration order, and each endTurn's enemy simulation bounded by
 * MAX_ENEMY_TURN_INTENTS — no wall clock anywhere on the decision path, so the
 * evaluated set is a pure function of state and a seeded match replays
 * identically no matter how loaded the machine is. Intents that throw on submit
 * are skipped; an empty legal set degrades to endTurn. Mulligan is delegated to
 * mulliganPolicy.
 */
export const Grandmaster: BotPolicy = {
  chooseIntent(game, me) {
    if (game.state.phase === 'mulligan') return mulliganPolicy(game, me);
    const legal = game.legalIntents(me);
    if (legal.length === 0) return { kind: 'endTurn' };
    let best = legal[0]!;
    let bestScore = -Infinity;
    for (let i = 0; i < legal.length; i++) {
      // Deterministic cap only (issue 11): the wall-clock budget that used to
      // sit here made the evaluated set depend on machine load.
      if (i >= MAX_EVAL) break;
      const intent = legal[i]!;
      let score: number;
      let g: Game;
      try {
        g = game.clone();
        g.submit(intent);
      } catch {
        continue; // intent that submit rejects: skip, never crash the bot
      }
      if (intent.kind === 'endTurn') {
        // Depth-2, full-enemy-turn reply model: the one intent that hands the
        // turn over is judged after the enemy's ENTIRE greedy turn (not a
        // single reply), scored from my perspective on my next turn.
        score = scoreAfterEnemyTurn(g, me);
      } else {
        // The enemy cannot act while it is still my turn: immediate score,
        // identical to Veteran for these intents.
        score = evaluate(g, me);
      }
      // Deterministic index tiebreak (Task 21 pattern, shared with Veteran):
      // exact ties resolve toward the later-enumerated intent, so picks are
      // stable under the same seed and agree with Veteran on every non-endTurn
      // intent (identical scoring).
      score += i * 1e-9;
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }
    return best;
  },
};
