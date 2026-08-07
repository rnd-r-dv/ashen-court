// app/src/art/resolveArt.ts

/**
 * Generated-art lookup, with a build-time answer.
 *
 * Vite's import.meta.glob enumerates the asset directory at build time and
 * hands back content-hashed URLs, so "does this card have art" is settled
 * before the app runs. The alternative — constructing a URL and letting the
 * <img> 404 — would flash a broken image for every card without art, which
 * during incremental generation is most of them.
 *
 * A miss returns null and the caller falls back to the procedural SVG in
 * CardArt, which is what keeps Forge custom cards working and lets the pool be
 * generated a slice at a time.
 */

/** Pure lookup core, extracted so it is testable without Vite. */
export function makeResolver(
  map: Record<string, string>,
  dir: string,
  ext = '.jpg',
): (key: string) => string | null {
  return (key: string) => map[`${dir}/${key}${ext}`] ?? null;
}

const CARD_DIR = '/src/assets/art/cards';
const HERO_DIR = '/src/assets/art/heroes';

const cardMap = import.meta.glob('../assets/art/cards/*.jpg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

const heroMap = import.meta.glob('../assets/art/heroes/*.jpg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

/** Glob keys are relative to this module; normalise them to absolute-ish
 *  project paths so the resolver's key format is stable and testable. */
function normalise(map: Record<string, string>, dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(map)) {
    const file = path.split('/').pop();
    if (file) out[`${dir}/${file}`] = url;
  }
  return out;
}

const cards = normalise(cardMap, CARD_DIR);
const heroes = normalise(heroMap, HERO_DIR);

export const resolveCardArt = makeResolver(cards, CARD_DIR);

/** Mirrors scripts/art/paths.ts heroSlug — the two must agree exactly, or
 *  every hero portrait silently misses. */
export function heroSlug(heroName: string): string {
  return heroName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const heroResolver = makeResolver(heroes, HERO_DIR);
export function resolveHeroArt(heroName: string): string | null {
  return heroResolver(heroSlug(heroName));
}
