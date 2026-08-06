import { evaluate } from './heuristic.js';
import type { Game } from '../engine/game.js';
import type { Intent, PlayerIndex } from '../types.js';

/** A bot's decision function: choose one legal intent for `me` in `game`. */
export interface BotPolicy {
  chooseIntent(game: Game, me: PlayerIndex): Intent;
}

/** Grandmaster turn budget (depth-2 search): total wall-clock cap per chooseIntent. */
const GRANDMASTER_BUDGET_MS = 1000;
/** Grandmaster opponent-reply budget: cap for the greedy bestReply search. */
const REPLY_BUDGET_MS = 200;

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

/** Recruit difficulty: uniformly random legal intent (seeded stream). */
export const Recruit: BotPolicy = {
  chooseIntent(game, me) {
    return game.pickRandom(game.legalIntents(me));
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
 * With budgetMs set (Grandmaster's reply search) the loop stops once the
 * wall-clock cap is exceeded; without a budget the loop always exhausts every
 * intent, so Veteran's behavior is unchanged by the extraction.
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
 * Grandmaster difficulty: bounded depth-2 search. For each legal intent,
 * clone the game and apply it; score the immediate position with evaluate()
 * and, when the intent hands the turn over (endTurn), deepen one ply: the
 * opponent's greedy best reply (greedyBest with the 200ms reply budget)
 * decides the resulting position, which is then scored from our perspective.
 * Non-endTurn intents keep the immediate score (the enemy cannot act while
 * it is still our turn, so there is no reply to simulate — identical to
 * Veteran for those intents). Strict > argmax over the deterministic
 * enumeration; a 1000ms wall-clock cap bounds the whole search. Intents that
 * throw on submit are skipped; an empty legal set degrades to endTurn.
 * Mulligan is delegated to mulliganPolicy.
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
      const intent = legal[i]!;
      let score: number;
      let g: Game;
      try {
        g = game.clone();
        g.submit(intent);
        score = evaluate(g, me);
      } catch {
        continue; // intent that submit rejects: skip, never crash the bot
      }
      if (performance.now() - start > GRANDMASTER_BUDGET_MS) break;
      // Depth-2: the opponent's best reply. legalIntents enumerates only for
      // the current player, so a reply exists only after an endTurn intent
      // (the one intent that hands the turn over).
      const reply = greedyBest(g, (1 - me) as PlayerIndex, REPLY_BUDGET_MS);
      if (reply !== null) {
        try {
          const g2 = g.clone();
          g2.submit(reply);
          score = evaluate(g2, me);
        } catch {
          // defensive: a reply that submit rejects keeps the immediate score
        }
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
