import { evaluate } from './heuristic.js';
import type { Game } from '../engine/game.js';
import type { Intent, PlayerIndex } from '../types.js';

/** A bot's decision function: choose one legal intent for `me` in `game`. */
export interface BotPolicy {
  chooseIntent(game: Game, me: PlayerIndex): Intent;
}

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
 * Veteran difficulty: greedy heuristic. For each legal intent, clone the
 * game, apply the intent, and score the resulting position with evaluate();
 * the argmax wins (a tiny deterministic index-based tiebreak keeps picks
 * stable under the same seed). Intents that throw on submit are skipped
 * defensively (log-free); an empty legal-intent set degrades to endTurn.
 * Mulligan is delegated to mulliganPolicy (legalIntents returns [] there).
 */
export const Veteran: BotPolicy = {
  chooseIntent(game, me) {
    if (game.state.phase === 'mulligan') return mulliganPolicy(game, me);
    const legal = game.legalIntents(me);
    if (legal.length === 0) return { kind: 'endTurn' };
    let best = legal[0]!;
    let bestScore = -Infinity;
    for (let i = 0; i < legal.length; i++) {
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
  },
};
