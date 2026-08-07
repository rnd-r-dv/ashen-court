import { evaluate } from './heuristic.js';
import type { Game } from '../engine/game.js';
import type { Intent, PlayerIndex } from '../types.js';

/** A bot's decision function: choose one legal intent for `me` in `game`. */
export interface BotPolicy {
  chooseIntent(game: Game, me: PlayerIndex): Intent;
}

/** Grandmaster turn budget (depth-2 search): total wall-clock cap per chooseIntent.
 *  Approximate, per-iteration-granular: checked BETWEEN iterations, so one heavy
 *  iteration (submit + full enemy-turn sim) may overrun it by one iteration's
 *  cost. The deterministic hard cap below (MAX_EVAL) keeps the evaluated set a
 *  pure function of state when this budget does not bind (audit 03 I1/I3). */
const GRANDMASTER_BUDGET_MS = 1000;
/** Grandmaster enemy-turn budget: cap for the full-enemy-turn simulation that
 *  follows an endTurn intent (audit 03 C1). Same 200ms sub-budget as the
 *  retired single-reply search. */
const ENEMY_TURN_BUDGET_MS = 200;
/**
 * Grandmaster deterministic fallback cap: at most this many own intents are
 * evaluated, in stable enumeration order (hand/board order), so the evaluated
 * set is a pure function of state — never of wall time (audit 03 I1/I3). */
const MAX_EVAL = 64;

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
 * With budgetMs set (Grandmaster's enemy-turn simulation) the loop stops once
 * the wall-clock cap is exceeded; without a budget the loop always exhausts
 * every intent, so Veteran's behavior is unchanged by the extraction.
 */
function greedyBest(game: Game, me: PlayerIndex, budgetMs?: number): Intent | null {
  if (game.state.phase === 'mulligan') return mulliganPolicy(game, me);
  const legal = game.legalIntents(me);
  if (legal.length === 0) return null;
  const start = performance.now();
  let best = legal[0]!;
  let bestScore = -Infinity;
  for (let i = 0; i < legal.length; i++) {
    if (budgetMs !== undefined && performance.now() - start > budgetMs) break;
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
 * game ends. The whole simulation is bounded by ENEMY_TURN_BUDGET_MS: checked
 * at loop top, and the remaining time is passed into each greedyBest so no
 * single reply search can overrun the cap by more than one iteration. The final
 * state — my next turn after the enemy's endTurn (ready board, fresh mana,
 * drawn card), or the terminal state — is scored from my perspective. A
 * budgeted mid-turn cut leaves the partial enemy turn scored: approximate, and
 * only reachable when the 200ms cap binds (never observed in practice).
 */
function scoreAfterEnemyTurn(g: Game, me: PlayerIndex): number {
  const enemy = (1 - me) as PlayerIndex;
  const start = performance.now();
  while (g.state.phase !== 'gameOver' && g.currentPlayer() === enemy) {
    if (performance.now() - start > ENEMY_TURN_BUDGET_MS) break;
    const remaining = Math.max(0, ENEMY_TURN_BUDGET_MS - (performance.now() - start));
    const reply = greedyBest(g, enemy, remaining);
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
 * deterministic enumeration. Bounds (audit 03 I1/I3): a 1000ms wall-clock
 * budget, checked between iterations and therefore approximate / per-
 * iteration-granular, PLUS a deterministic hard cap of MAX_EVAL own intents
 * evaluated in enumeration order — the evaluated set is a pure function of
 * state whenever the wall-clock budget does not bind (today it never does).
 * Intents that throw on submit are skipped; an empty legal set degrades to
 * endTurn. Mulligan is delegated to mulliganPolicy.
 */
export const Grandmaster: BotPolicy = {
  chooseIntent(game, me) {
    if (game.state.phase === 'mulligan') return mulliganPolicy(game, me);
    const legal = game.legalIntents(me);
    if (legal.length === 0) return { kind: 'endTurn' };
    const start = performance.now();
    let best = legal[0]!;
    let bestScore = -Infinity;
    for (let i = 0; i < legal.length; i++) {
      // Budget check BEFORE the iteration (audit 03 I1/I3): the previous
      // iteration's full cost (submit + enemy-turn sim) counts against the
      // 1000ms cap, and MAX_EVAL caps the evaluated set deterministically.
      if (performance.now() - start > GRANDMASTER_BUDGET_MS) break;
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
