import { MANA_SURGE } from '../types.js';
import type { Card, EffectSpec, EffectTarget, Intent, PlayerIndex, TargetRef } from '../types.js';
import { findCreature, isDragon, resolveTargets, SINGLE_TARGET_TARGETS } from './effects.js';
import { canAttack, effectiveKeywords, tauntPresent } from './keywords.js';
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
  // resolve internally and need no target). hero/self effects auto-resolve to
  // the caster's own hero — skipped unconditionally (Task 10 precedent,
  // Task 14 mixed-card ruling: a choice ref may ride along).
  return validateEffectTargets(game, me, card.effects, intent.target);
}

/**
 * Validate an intent.target against every single-target effect in `effects`
 * (shared by playCard validation and hero power resolution so both paths
 * agree). hero/self AUTO-RESOLVE to the caster's own hero — they are skipped
 * unconditionally (a supplied ref is ignored for them; the mixed-card ruling
 * in Task 14 makes `dmg3(any)+heal3(h)` legal with a creature ref). Other
 * single-target kinds require a legal ref per validateTarget. AoE/random/
 * no-target effects are skipped (they resolve internally).
 */
export function validateEffectTargets(game: Game, me: PlayerIndex, effects: readonly EffectSpec[], target: TargetRef | undefined): string | null {
  for (const spec of effects) {
    if (spec.target === undefined || !SINGLE_TARGET_TARGETS.has(spec.target) || spec.target === 'hero' || spec.target === 'self') continue;
    const err = validateTarget(game, me, spec.target, target);
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

/**
 * Full legal-intent enumeration for `player` (Task 10), used by the Phase 3
 * bot and Phase 5 UI highlighting. Main phase only, for the current player:
 * every playable card with one intent per legal target ref, every attack
 * (taunt forces taunt defenders), the hero power with its target variants,
 * and endTurn. Mulligan → [] (bots use a fixed policy; the UI its own
 * keep-selection).
 *
 * Discount consistency: affordability uses the same playEffectiveCost that
 * validatePlayCard and the playCard payment use, so validation/enumeration/
 * payment never disagree. (Discounts are turn-scoped: beginTurn zeroes
 * discountCheapest/discountNextSpell at every turn start.)
 */
export function legalIntents(game: Game, player: PlayerIndex): Intent[] {
  if (game.state.phase !== 'main' || game.currentPlayer() !== player) return [];
  const p = game.state.players[player];
  const enemy = (1 - player) as PlayerIndex;
  const out: Intent[] = [];

  // 1. playable cards: effective cost, then one intent per legal target ref
  for (let i = 0; i < p.hand.length; i++) {
    const card = safeCard(game, p.hand[i]!);
    if (!card) continue;
    // Mana Surge is unplayable once surged (validatePlayCard's gate) — never
    // enumerate an intent submit would reject.
    if (card.id === MANA_SURGE && p.surged) continue;
    if (p.mana < playEffectiveCost(game, card, player)) continue;
    const variants = targetVariants(game, player, card.effects);
    if (!variants) continue;   // single-target effect with no legal ref → unplayable
    for (const t of variants) out.push({ kind: 'playCard', handIndex: i, target: t });
  }

  // 2. attacks: while the enemy has a taunt, ONLY taunt defenders are legal
  //    targets (hero excluded); otherwise every enemy creature + the hero.
  const enemyBoard = game.state.players[enemy].board;
  const taunt = tauntPresent(enemyBoard);
  for (const c of p.board) {
    if (!canAttack(c, game)) continue;
    if (taunt) {
      for (const d of enemyBoard) {
        if (effectiveKeywords(d).has('taunt')) {
          out.push({ kind: 'attack', attackerId: c.id, target: { type: 'creature', id: d.id } });
        }
      }
    } else {
      for (const d of enemyBoard) out.push({ kind: 'attack', attackerId: c.id, target: { type: 'creature', id: d.id } });
      out.push({ kind: 'attack', attackerId: c.id, target: { type: 'hero', player: enemy } });
    }
  }

  // 3. hero power: affordable + unused, with target variants per its effects
  if (!p.hero.usedPower && p.mana >= p.hero.power.cost) {
    const variants = targetVariants(game, player, p.hero.power.effects);
    if (variants) for (const t of variants) out.push({ kind: 'heroPower', target: t });
  }

  // 4. endTurn is always legal in main phase (even with unused mana)
  out.push({ kind: 'endTurn' });
  return out;
}

/**
 * Target variants for one set of effects. Single-target "choice" kinds
 * (any/anyCreature/enemyCreature/friendlyCreature/friendlyDragon) enumerate
 * one intent per legal ref via resolveTargets; hero/self auto-resolve to the
 * caster's own hero and are never enumerated as choices. Effects with no
 * single-target choice (AoE/random/no-target, or only hero/self) yield a
 * single no-target variant. Returns null when a choice kind has no legal refs
 * (the card/power is unplayable).
 */
function targetVariants(game: Game, me: PlayerIndex, effects: readonly EffectSpec[]): (TargetRef | undefined)[] | null {
  let choice: EffectTarget | undefined;
  for (const spec of effects) {
    if (spec.target === undefined || !SINGLE_TARGET_TARGETS.has(spec.target)) continue;
    if (spec.target === 'hero' || spec.target === 'self') continue;
    choice = spec.target;
    break;
  }
  if (!choice) return [undefined];
  const refs = resolveTargets(game, me, choice);
  return refs.length > 0 ? refs : null;
}
