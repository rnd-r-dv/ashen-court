// scripts/art/paths.ts

/**
 * Output lives under app/src, NOT app/public. Vite only enumerates and
 * content-hashes assets it can see through the module graph, and
 * import.meta.glob is what gives the app a build-time answer to "does this
 * card have art" instead of probing for 404s at runtime.
 */
export const CARD_ART_DIR = 'app/src/assets/art/cards';
export const HERO_ART_DIR = 'app/src/assets/art/heroes';

/** Lowercase; runs of non-alphanumerics collapse to '-'; dashes trimmed at
 *  both ends. Mirrors the slugify already used by the deck builder. */
export function heroSlug(heroName: string): string {
  return heroName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Card ids are already slug-safe by construction (e.g. 'choir-seraph'). */
export function cardArtPath(cardId: string): string {
  return `${CARD_ART_DIR}/${cardId}.jpg`;
}

export function heroArtPath(heroName: string): string {
  return `${HERO_ART_DIR}/${heroSlug(heroName)}.jpg`;
}
