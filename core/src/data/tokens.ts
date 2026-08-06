import type { ArtRecipe, Card } from '../types.js';

/**
 * Default art preset for Phase 2 curated cards. The archetype->preset mapping
 * is defined by the Forge (Task 26); neutrals and tokens both default to
 * 'arcane' with this shared palette.
 */
export const ARCANE_PALETTE = ['#241b4f', '#7b5cff'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** ArtRecipe for a curated card: 'arcane' preset, shared palette, id-derived seed. */
export function arcaneArt(id: string): ArtRecipe {
  return { preset: 'arcane', palette: ARCANE_PALETTE, seed: hashId(id) };
}

const base = (id: string, name: string, type: Card['type'], cost: number, rarity: Card['rarity']): Card => ({
  id, name, type, cost,
  keywords: [], effects: [], rarity, archetype: 'token',
  art: arcaneArt(id), author: 'curated', version: 1,
});

/**
 * Token cards (summoned by effects/hero powers, never drafted into decks).
 * Only tokens referenced by curated cards / hero powers live here — dead data
 * would trip validateDeck edge cases and confuse the Forge's token picker.
 */
export const TOKEN_CARDS: Card[] = [
  { ...base('token-rat', 'Giant Rat', 'creature', 0, 'common'), attack: 1, health: 1 },
  { ...base('token-skeleton', 'Skeleton', 'creature', 0, 'common'), attack: 1, health: 1 },
  { ...base('token-wisp', 'Choir Spirit', 'creature', 0, 'common'), attack: 1, health: 1 },
  { ...base('token-dragon-whelp', 'Dragon Whelp', 'creature', 0, 'common'), attack: 1, health: 1 },
  { ...base('token-treant', 'Root Treant', 'creature', 0, 'common'), attack: 1, health: 1, keywords: ['taunt'] },
  { ...base('token-phoenixash', 'Phoenix Ash', 'creature', 0, 'common'), attack: 2, health: 2 },
];

/** Player 2's setup head-start spell (surge already granted; see Game constructor). */
export const MANA_SURGE_CARD: Card = {
  ...base('mana-surge', 'Mana Surge', 'spell', 0, 'common'),
  effects: [{ kind: 'refillMana', value: 1 }],
};
