import type { Card, HeroSpec } from '../types.js';
import { NEUTRAL_CARDS } from './neutrals.js';
import { TOKEN_CARDS, MANA_SURGE_CARD } from './tokens.js';
import { HERO as EMBER_COURT_HERO, CARDS as EMBER_COURT_CARDS, DECK as EMBER_COURT_DECK } from './ember-court.js';
import { HERO as HOLLOW_CHOIR_HERO, CARDS as HOLLOW_CHOIR_CARDS, DECK as HOLLOW_CHOIR_DECK } from './hollow-choir.js';
import { HERO as VERMIN_SWARM_HERO, CARDS as VERMIN_SWARM_CARDS, DECK as VERMIN_SWARM_DECK } from './vermin-swarm.js';
import { HERO as STARFORGED_HERO, CARDS as STARFORGED_CARDS, DECK as STARFORGED_DECK } from './starforged.js';
import { HERO as ETERNAL_VIGIL_HERO, CARDS as ETERNAL_VIGIL_CARDS, DECK as ETERNAL_VIGIL_DECK } from './eternal-vigil.js';
import { HERO as STORMWROUGHT_HERO, CARDS as STORMWROUGHT_CARDS, DECK as STORMWROUGHT_DECK } from './stormwrought.js';

export type ArchetypeId = 'ember' | 'choir' | 'vermin' | 'dragon' | 'roots' | 'dance' | 'bone' | 'pact' | 'coven' | 'star' | 'vigil' | 'storm';

export interface DeckDef { sig: [string, number][]; neutrals: string[]; }

export { TOKEN_CARDS, MANA_SURGE_CARD };
export { HERO as EMBER_COURT_HERO, CARDS as EMBER_COURT_CARDS, DECK as EMBER_COURT_DECK } from './ember-court.js';
export { HERO as HOLLOW_CHOIR_HERO, CARDS as HOLLOW_CHOIR_CARDS, DECK as HOLLOW_CHOIR_DECK } from './hollow-choir.js';
export { HERO as VERMIN_SWARM_HERO, CARDS as VERMIN_SWARM_CARDS, DECK as VERMIN_SWARM_DECK } from './vermin-swarm.js';
export { HERO as STARFORGED_HERO, CARDS as STARFORGED_CARDS, DECK as STARFORGED_DECK } from './starforged.js';
export { HERO as ETERNAL_VIGIL_HERO, CARDS as ETERNAL_VIGIL_CARDS, DECK as ETERNAL_VIGIL_DECK } from './eternal-vigil.js';
export { HERO as STORMWROUGHT_HERO, CARDS as STORMWROUGHT_CARDS, DECK as STORMWROUGHT_DECK } from './stormwrought.js';

/** All curated heroes, in archetype order (Forge hero picker). */
export const HEROES: HeroSpec[] = [
  EMBER_COURT_HERO, HOLLOW_CHOIR_HERO, VERMIN_SWARM_HERO,
  STARFORGED_HERO, ETERNAL_VIGIL_HERO, STORMWROUGHT_HERO,
];

/**
 * Production card pool: neutrals + curated archetype cards (Tasks 14-17 fill
 * the rest as they land) + tokens + mana-surge. Kept as a function so the
 * Forge always builds a fresh, deduped collection.
 */
export function buildPool(): Card[] {
  return [
    ...NEUTRAL_CARDS,
    ...EMBER_COURT_CARDS, ...HOLLOW_CHOIR_CARDS, ...VERMIN_SWARM_CARDS,
    ...STARFORGED_CARDS, ...ETERNAL_VIGIL_CARDS, ...STORMWROUGHT_CARDS,
    ...TOKEN_CARDS, MANA_SURGE_CARD,
  ];
}

/**
 * Deck definitions per archetype. Ember/choir/vermin landed in Task 14; the
 * remaining 9 keys fill in Tasks 15-17. The Record<ArchetypeId, DeckDef> type
 * requires all 12 keys, so the partial object compiles via the cast.
 */
export const DECK_DEFS = {
  ember: EMBER_COURT_DECK,
  choir: HOLLOW_CHOIR_DECK,
  vermin: VERMIN_SWARM_DECK,
  star: STARFORGED_DECK,
  vigil: ETERNAL_VIGIL_DECK,
  storm: STORMWROUGHT_DECK,
} as Record<ArchetypeId, DeckDef>;

/** Expand a DeckDef into a flat ordered card list: sig copies then neutrals. */
export function expandDeck(def: DeckDef): string[] {
  const ids: string[] = [];
  for (const [cardId, copies] of def.sig) {
    for (let i = 0; i < copies; i++) ids.push(cardId);
  }
  return [...ids, ...def.neutrals];
}
