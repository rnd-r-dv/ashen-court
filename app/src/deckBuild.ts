import { RARITY_COPY_LIMIT, validateDeck, type Card, type ValidationIssue } from '@ashen/core';

/**
 * Deck builder helpers (Task 27). Pure functions over card-id lists and a
 * card pool; the DeckBuilder screen composes them with storage.ts.
 */

export interface PoolQuery {
  search: string;
  archetype: string;
  type: string;
  cost: [number, number];
}

/** Filter a card pool by search text (case-insensitive name substring), exact
 *  archetype/type ('' = all), and inclusive cost range [min, max]. */
export function filterPool(pool: Card[], q: PoolQuery): Card[] {
  const search = q.search.trim().toLowerCase();
  const [min, max] = q.cost;
  return pool.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search)) return false;
    if (q.archetype && c.archetype !== q.archetype) return false;
    if (q.type && c.type !== q.type) return false;
    if (c.cost < min || c.cost > max) return false;
    return true;
  });
}

/** Append a card id to the deck list if the rarity copy limit allows it.
 *  Returns the original list untouched (plus an error) when blocked. */
export function addCard(
  list: string[],
  id: string,
  pool: Map<string, Card>,
): { list: string[]; error?: string } {
  const card = pool.get(id);
  if (!card) return { list, error: `Unknown card id: ${id}` };
  const count = list.filter((x) => x === id).length;
  const limit = RARITY_COPY_LIMIT[card.rarity];
  if (count >= limit) {
    return { list, error: `Only ${limit} copies of ${card.name} (${card.rarity}).` };
  }
  return { list: [...list, id] };
}

/** Remove the FIRST occurrence of the id (a deck may hold multiple copies). */
export function removeCard(list: string[], id: string): string[] {
  const idx = list.indexOf(id);
  if (idx === -1) return list;
  const next = [...list];
  next.splice(idx, 1);
  return next;
}

/** Deck size + validation issues (core validateDeck: unknown ids, token
 *  exclusion, copy limits, exactly-60). */
export function deckStatus(
  list: string[],
  pool: Map<string, Card>,
): { count: number; issues: ValidationIssue[] } {
  return { count: list.length, issues: validateDeck(list, pool) };
}
