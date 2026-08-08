import { MANA_SURGE } from '../types.js';
import type { Card, EffectSpec, EffectTarget, Intent, PlayerIndex, TargetRef } from '../types.js';
import { findCreature, isChoiceTarget, isDragon, resolveTargets, BOARD_CAP } from './effects.js';
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
 *    discountMostExpensive (only for the most expensive creature in hand, via
 *    registry cost lookup); discounts are consumed on use even at effective 0.
 *  - single-target effects require a valid target ref: creature refs carry only
 *    { type: 'creature', id } — the owner is inferred from the board. Side
 *    checks: enemyCreature → enemy board, friendlyCreature/friendlyDragon →
 *    own board, anyCreature/any → anywhere, hero/self → own hero ref.
 *  - Mana Surge / the Coin (refillMana 1): the `surged` flag gates it to ONE
 *    use per match — validation rejects once surged is true. `surged` starts
 *    false and is set when the card is played (audit 02: setup used to pre-set
 *    it, which made the card permanently unplayable).
 */

/** Cost the player would actually pay to play `card`, with discounts applied. */
export function playEffectiveCost(game: Game, card: Card, me: PlayerIndex): number {
  const p = game.state.players[me];
  let eff = card.cost;
  if (card.type === 'spell') {
    eff -= p.hero.discountNextSpell;
  } else if (card.type === 'creature' && isMostExpensiveCreatureInHand(game, me, card)) {
    eff -= p.hero.discountMostExpensive;
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
  // Board cap (audit 01 C2, Task 3): a board of BOARD_CAP non-token creatures
  // cannot play more creatures — hand-played creatures are never tokens, so only
  // the non-token count matters. Effect summons cap too, so the invariant holds.
  if (card.type === 'creature' && p.board.filter(c => !c.token).length >= BOARD_CAP) return 'Board is full';
  // Single-target effects require a valid target ref; every single-target
  // effect must accept the supplied ref (multi-target / no-target effects
  // resolve internally and need no target). hero/self effects auto-resolve to
  // the caster's own hero — skipped unconditionally (Task 10 precedent,
  // Task 14 mixed-card ruling: a choice ref may ride along). For creatures the
  // target feeds the battlecry (Task 15 ruling: cardPlayed.target passes
  // through to fireTriggers).
  return validateEffectTargets(game, me, [...card.effects, ...battlecryEffects(card)], intent.target);
}

/** Effect specs of a creature card's battlecry trigger group(s), if any. */
function battlecryEffects(card: Card): EffectSpec[] {
  return (card.triggers ?? []).filter(g => g.when === 'battlecry').flatMap(g => g.effects);
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
    if (!isChoiceTarget(spec.target)) continue;
    const err = validateTarget(game, me, spec.target!, target);
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
 * discountMostExpensive/discountNextSpell at every turn start.)
 */
export function legalIntents(game: Game, player: PlayerIndex): Intent[] {
  // Discover suspends legality (Task 1): while a choice is pending, ONLY the
  // pending owner may act, and its only legal intents are the three choices.
  // Every other player has no legal intents at all — the whole normal
  // enumeration below is suspended, not filtered.
  const pending = game.state.pendingChoice;
  if (pending !== null) {
    return pending.player === player
      ? pending.cardIds.map((_, choice) => ({ kind: 'discover' as const, choice }))
      : [];
  }
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
    // Board cap (audit 01 C2, Task 3): creatures at a full board are unplayable —
    // count only non-tokens (tokens live in their own row; a hand-played creature
    // is never a token) — mirror how unaffordable cards are skipped (validatePlayCard rejects).
    if (card.type === 'creature' && p.board.filter(c => !c.token).length >= BOARD_CAP) continue;
    if (p.mana < playEffectiveCost(game, card, player)) continue;
    // Same effect list validatePlayCard validates against — spell effects AND
    // battlecry effects — so enumeration and validation cannot disagree. (No
    // curated creature carries `effects`, but a Forge one may, and it would
    // otherwise be enumerated without the target validation demands.)
    const variants = targetVariants(game, player, [...card.effects, ...battlecryEffects(card)]);
    if (!variants) continue;   // single-target effect with no legal ref → unplayable
    for (const t of variants) out.push({ kind: 'playCard', handIndex: i, target: t });
  }

  // 2. attacks: while the enemy has a taunt, ONLY taunt defenders are legal
  //    targets (hero excluded); otherwise every enemy creature + the hero.
  // Stealthed defenders are invisible to the attacker: skip them in BOTH the
  // taunt and non-taunt branches (a stealthed taunt is also skipped here, and
  // tauntPresent ignores it too — it cannot be attacked, so it gates nothing).
  const enemyBoard = game.state.players[enemy].board.filter(c => !c.keywords.includes('stealth'));
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
 * single no-target variant. Returns null when no ref is legal (the card/power
 * is unplayable).
 *
 * An intent carries ONE target ref, and validateEffectTargets checks that ref
 * against EVERY choice spec — so enumeration must do the same and yield the
 * INTERSECTION. Enumerating only the first choice spec's refs (audit 02) let
 * legalIntents emit intents validatePlayCard rejects whenever a card mixed two
 * different choice targets (e.g. dmg(enemyCreature) + buff(friendlyCreature),
 * whose intersection is always empty). Filtering the candidate refs through
 * validateTarget — the very function validation uses — is what keeps the two
 * from drifting apart again.
 */
function targetVariants(game: Game, me: PlayerIndex, effects: readonly EffectSpec[]): (TargetRef | undefined)[] | null {
  const choices: EffectTarget[] = [];
  for (const spec of effects) if (isChoiceTarget(spec.target)) choices.push(spec.target!);
  if (choices.length === 0) return [undefined];
  const refs = resolveTargets(game, me, choices[0]!)
    .filter(ref => choices.every(kind => validateTarget(game, me, kind, ref) === null));
  return refs.length > 0 ? refs : null;
}
