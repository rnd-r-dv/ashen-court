import { MANA_SURGE } from '../types.js';
import type { Card, EffectTarget, Intent, PlayerIndex, TargetRef } from '../types.js';
import { findCreature, isDragon, SINGLE_TARGET_TARGETS } from './effects.js';
import type { Game } from './game.js';

/**
 * playCard intent validation (Task 9).
 *
 * validatePlayCard returns an error string or null. The same effective-cost
 * logic (playEffectiveCost) drives both the "cost payable" check here and the
 * mana payment in submit, so validation and resolution can never disagree.
 *
 * Rulings encoded here (task brief 17d659a):
 *  - effective cost = registry cost minus discountNextSpell (spells) or minus
 *    discountCheapest (only for the most expensive creature in hand, via
 *    registry cost lookup); discounts are consumed on use even at effective 0.
 *  - single-target effects require a valid target ref: creature refs carry only
 *    { type: 'creature', id } — the owner is inferred from the board. Side
 *    checks: enemyCreature → enemy board, friendlyCreature/friendlyDragon →
 *    own board, anyCreature/any → anywhere, hero/self → own hero ref.
 *  - Mana Surge (refillMana 1): the `surged` flag gates it — validation
 *    rejects when surged is true (the head start was already granted).
 */

/** Cost the player would actually pay to play `card`, with discounts applied. */
export function playEffectiveCost(game: Game, card: Card, me: PlayerIndex): number {
  const p = game.state.players[me];
  let eff = card.cost;
  if (card.type === 'spell') {
    eff -= p.hero.discountNextSpell;
  } else if (card.type === 'creature' && isMostExpensiveCreatureInHand(game, me, card)) {
    eff -= p.hero.discountCheapest;
  }
  return Math.max(0, eff);
}

/** True when no OTHER creature in hand costs more than `card` (ties are most-expensive). */
export function isMostExpensiveCreatureInHand(game: Game, me: PlayerIndex, card: Card): boolean {
  for (const id of game.state.players[me].hand) {
    const other = safeCard(game, id);
    if (other && other.type === 'creature' && other.cost > card.cost) return false;
  }
  return true;
}

export function validatePlayCard(
  game: Game,
  intent: Extract<Intent, { kind: 'playCard' }>,
  me: PlayerIndex,
): string | null {
  if (game.state.phase !== 'main') return 'Not in main phase';
  const p = game.state.players[me];
  const { handIndex } = intent;
  if (handIndex < 0 || handIndex >= p.hand.length) return 'Bad hand index';
  const cardId = p.hand[handIndex]!;
  const card = safeCard(game, cardId);
  if (!card) return `Unknown card id: ${cardId}`;
  if (cardId === MANA_SURGE && p.surged) return 'Mana Surge already surged';
  if (p.mana < playEffectiveCost(game, card, me)) return 'Not enough mana';
  // Single-target effects require a valid target ref; every single-target
  // effect must accept the supplied ref (multi-target / no-target effects
  // resolve internally and need no target).
  for (const spec of card.effects) {
    if (spec.target === undefined || !SINGLE_TARGET_TARGETS.has(spec.target)) continue;
    const err = validateTarget(game, me, spec.target, intent.target);
    if (err) return err;
  }
  return null;
}

function validateTarget(game: Game, me: PlayerIndex, kind: EffectTarget, target: TargetRef | undefined): string | null {
  if (!target) return 'Spell requires a target';
  // hero/self resolve to the caster's OWN hero (Task 6 ruling)
  if (kind === 'hero' || kind === 'self') {
    if (target.type !== 'hero') return 'Illegal target: must be your own hero';
    if (target.player !== me) return 'Illegal target: must be your own hero';
    return null;
  }
  if (target.type === 'hero') {
    // 'any' accepts any hero; creature-targeting kinds reject hero refs
    return kind === 'any' ? null : `Illegal target: hero is not a valid ${kind} target`;
  }
  const c = findCreature(game, target.id);
  if (!c) return 'Target creature not found';
  switch (kind) {
    case 'any':
    case 'anyCreature':
      return null;
    case 'enemyCreature':
      return c.owner === (1 - me) as PlayerIndex ? null : 'Illegal target: must be an enemy creature';
    case 'friendlyCreature':
      return c.owner === me ? null : 'Illegal target: must be a friendly creature';
    case 'friendlyDragon':
      return c.owner === me && isDragon(game, c) ? null : 'Illegal target: must be a friendly dragon';
    default:
      return `Illegal target for ${kind}`;
  }
}

/** Registry lookup that tolerates unknown ids (returns undefined instead of throwing). */
function safeCard(game: Game, id: string): Card | undefined {
  try { return game.registry.get(id); } catch { return undefined; }
}
