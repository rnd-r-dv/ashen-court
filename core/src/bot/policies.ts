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
