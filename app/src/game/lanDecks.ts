// Shared LAN deck sources (Task 45). Pure module (no React) holding the deck
// pick grid's data model + builders, extracted from LanHost so LanJoin's new
// deck-pick stage reuses the exact same curated + custom sources (same
// positional zip of DECK_DEFS/HEROES DeckPick uses).
import { DECK_DEFS, HEROES, expandDeck } from '@ashen/core';
import type { ArchetypeId } from '@ashen/core';
import { loadDecks } from '../storage.js';

export interface DeckCard {
  slug: string;
  name: string;
  hero?: string;
  tag: string;
  cards: number;
  custom: boolean;
}

/** Display names + archetype tags for the 12 curated decks (spec table). */
export const CURATED_INFO: Record<ArchetypeId, { name: string; tag: string }> = {
  ember: { name: 'The Ember Court', tag: 'Burn / Aggro' },
  choir: { name: 'The Hollow Choir', tag: 'Control' },
  vermin: { name: 'The Vermin Swarm', tag: 'Zoo' },
  dragon: { name: 'The Dragonflight', tag: 'Midrange tribal' },
  roots: { name: 'The Elder Roots', tag: 'Ramp' },
  dance: { name: 'The Shadow Dancers', tag: 'Combo' },
  bone: { name: 'The Bone Horde', tag: 'Token swarm' },
  pact: { name: 'The Grave Pact', tag: 'Self-damage / life-swap' },
  coven: { name: 'The Night Coven', tag: 'Debuff control' },
  star: { name: 'The Starforged', tag: 'Big-mana cheat' },
  vigil: { name: 'The Eternal Vigil', tag: 'Sustain grind' },
  storm: { name: 'The Stormwrought', tag: 'Tempo spells' },
};

export function buildCurated(): DeckCard[] {
  // DECK_DEFS and HEROES share archetype order, so the zip is positional.
  return (Object.keys(DECK_DEFS) as ArchetypeId[]).map((slug, i) => {
    const hero = HEROES[i];
    return {
      slug,
      name: CURATED_INFO[slug].name,
      hero: hero ? hero.name : 'Unknown hero',
      tag: CURATED_INFO[slug].tag,
      cards: expandDeck(DECK_DEFS[slug]).length,
      custom: false,
    };
  });
}

export function buildCustom(): DeckCard[] {
  const overlays = loadDecks(); // slug → card ids (deck builder overlays)
  return Object.entries(overlays).map(([slug, cardIds]) => ({
    slug,
    name: slug in CURATED_INFO ? CURATED_INFO[slug as ArchetypeId].name : slug,
    tag: 'Custom deck',
    cards: cardIds.length,
    custom: true,
  }));
}
