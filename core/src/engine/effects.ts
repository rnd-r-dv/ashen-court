/**
 * Effect-resolution engine (stub).
 *
 * Later tasks implement EffectKind resolution here (dealDamage, draw, heal,
 * buff, summon, freeze, destroy, ...) against the Resolver, invoked after
 * events are applied. This module is kept importable so dispatch can wire it
 * in without churn; nothing is resolved yet.
 */
export function resolveEffects(): void {
  // placeholder — effect resolution arrives in a later task
}
