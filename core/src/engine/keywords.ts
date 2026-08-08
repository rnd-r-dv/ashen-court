import type { CreatureState, Keyword } from '../types.js';
import type { Game } from './game.js';

/**
 * Static keyword helpers (Task 7).
 *
 * Keyword application model: `giveKeyword` (effects.ts) pushes into
 * `creature.keywords` directly, so the creature's own array is the single
 * source of truth — effectiveKeywords is a Set view over it.
 */

/** All keywords currently on a creature (own keywords; granted keywords are pushed into the same array). */
export function effectiveKeywords(creature: CreatureState): Set<Keyword> {
  return new Set(creature.keywords);
}

/** True when any creature on the board has taunt (hero + non-taunt targets are then illegal). */
export function tauntPresent(board: CreatureState[]): boolean {
  // A stealthed taunt cannot be attacked, so it must not gate attacks either —
  // otherwise it would make every enemy attack illegal.
  return board.some(c => c.keywords.includes('taunt') && !c.keywords.includes('stealth'));
}

/**
 * Can the creature attack right now? Frozen creatures can't attack; the
 * creature needs at least one attack left; and an exhausted (just-summoned)
 * creature can still attack when it has rush/charge.
 */
export function canAttack(creature: CreatureState, game: Game): boolean {
  if (creature.frozen) return false;
  if (creature.attacksLeft <= 0) return false;
  if (creature.exhausted && !creature.keywords.includes('rush') && !creature.keywords.includes('charge')) {
    return false;
  }
  return true;
}
