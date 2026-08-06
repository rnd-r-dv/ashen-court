import type { Card } from '../types.js';
import { NEUTRAL_CARDS } from './neutrals.js';
import { TOKEN_CARDS, MANA_SURGE_CARD } from './tokens.js';

export type ArchetypeId = 'ember' | 'choir' | 'vermin' | 'dragon' | 'roots' | 'dance' | 'bone' | 'pact' | 'coven' | 'star' | 'vigil' | 'storm';

export interface DeckDef { sig: [string, number][]; neutrals: string[]; }

export { TOKEN_CARDS, MANA_SURGE_CARD };

/**
 * Production card pool: neutrals + tokens + mana-surge now; the 12 archetype
 * card sets (Tasks 14-17) get appended here as they land. Kept as a function
 * so the Forge always builds a fresh, deduped collection.
 */
export function buildPool(): Card[] {
  return [...NEUTRAL_CARDS, ...TOKEN_CARDS, MANA_SURGE_CARD];
}

/**
 * Deck definitions per archetype. Placeholder until Tasks 14-17 fill the
 * entries; the Record<ArchetypeId, DeckDef> type requires all 12 keys, so an
 * empty object only compiles via the cast.
 */
export const DECK_DEFS = {} as Record<ArchetypeId, DeckDef>;

/** Expand a DeckDef into a flat ordered card list: sig copies then neutrals. */
export function expandDeck(def: DeckDef): string[] {
  const ids: string[] = [];
  for (const [cardId, copies] of def.sig) {
    for (let i = 0; i < copies; i++) ids.push(cardId);
  }
  return [...ids, ...def.neutrals];
}
