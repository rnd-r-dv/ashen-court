import { DECK_DEFS, HEROES } from '@ashen/core';
import type { ArchetypeId } from '@ashen/core';

export interface House {
  /** DECK_DEFS key — the house this hero belongs to (the archetype id). */
  archetype: ArchetypeId;
  /** The hero's name, which titles the house banner. */
  heroName: string;
}

/**
 * House identity for a hero name, derived from the positional contract in
 * core/src/data/index.ts: HEROES is zipped with Object.keys(DECK_DEFS), and
 * app/server both rely on that ordering. Unknown names fall back to the first
 * entry — the same HEROES[0] fallback used everywhere else (lanDriver,
 * matchSetup, rooms). The archetype key drives the --house-* tincture and the
 * banner charge on the board's margins.
 */
export function houseOfHeroName(name: string): House {
  const archetypes = Object.keys(DECK_DEFS) as ArchetypeId[];
  const idx = HEROES.findIndex((h) => h.name === name);
  const i = idx >= 0 ? idx : 0;
  return { archetype: archetypes[i]!, heroName: HEROES[i]!.name };
}
