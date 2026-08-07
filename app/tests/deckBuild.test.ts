import { describe, it, expect } from 'vitest';
import { RARITY_COPY_LIMIT, type Card } from '@ashen/core';
import { addCard, removeCard, deckStatus, deckExportError, filterPool, wouldOverwrite, type PoolQuery } from '../src/deckBuild.js';
import { deckKey, loadDecks, saveDeck } from '../src/storage.js';

/** Minimal card fixture; defaults are common 2-cost creatures. */
function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id,
    name: id,
    type: 'creature',
    cost: 2,
    keywords: [],
    effects: [],
    rarity: 'common',
    archetype: 'neutral',
    art: { preset: 'arcane', palette: ['#241b4f', '#7b5cff'], seed: 1 },
    author: 'curated',
    version: 1,
    ...over,
  };
}

function poolOf(...cards: Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [c.id, c]));
}

const POOL: Card[] = [
  card('ember-spark', { name: 'Ember Spark', type: 'spell', cost: 1, archetype: 'ember' }),
  card('ember-warden', { name: 'Ember Warden', type: 'creature', cost: 4, archetype: 'ember', rarity: 'rare', attack: 3, health: 5 }),
  card('bone-baron', { name: 'Bone Baron', type: 'creature', cost: 5, archetype: 'bone', rarity: 'epic', attack: 4, health: 6 }),
  card('frost-ritual', { name: 'Frost Ritual', type: 'spell', cost: 2, archetype: 'vigil' }),
  card('ashen-blade', { name: 'Ashen Blade', type: 'artifact', cost: 3, archetype: 'ember', rarity: 'rare' }),
];

describe('addCard', () => {
  it('rejects a 4th common copy with an error and an unchanged list', () => {
    const pool = poolOf(card('t-000'));
    const list = ['t-000', 't-000', 't-000'];
    const result = addCard(list, 't-000', pool);
    expect(result.error).toBe(`Only ${RARITY_COPY_LIMIT.common} copies of t-000 (common).`);
    expect(result.list).toEqual(list);
  });

  it('allows copies up to the rarity limit and rejects one beyond it', () => {
    const pool = poolOf(
      card('common-card'),
      card('rare-card', { rarity: 'rare' }),
      card('legendary-card', { rarity: 'legendary' }),
    );
    // common: 2 existing → 3rd OK, 4th blocked (limit 3)
    expect(addCard(['common-card', 'common-card'], 'common-card', pool).error).toBeUndefined();
    expect(addCard(['common-card', 'common-card', 'common-card'], 'common-card', pool).error).toContain('Only 3 copies');
    // rare: 1 existing → 2nd OK, 3rd blocked (limit 2)
    expect(addCard(['rare-card'], 'rare-card', pool).error).toBeUndefined();
    expect(addCard(['rare-card', 'rare-card'], 'rare-card', pool).error).toContain('Only 2 copies');
    // legendary: 0 existing → 1st OK, 2nd blocked (limit 1)
    expect(addCard([], 'legendary-card', pool).error).toBeUndefined();
    expect(addCard(['legendary-card'], 'legendary-card', pool).error).toContain('Only 1 copies');
  });

  it('appends to the list when the copy limit is not reached', () => {
    const pool = poolOf(card('ember-spark'));
    const result = addCard(['other-card'], 'ember-spark', pool);
    expect(result.error).toBeUndefined();
    expect(result.list).toEqual(['other-card', 'ember-spark']);
  });
});

describe('removeCard', () => {
  it('removes only the first occurrence of the id', () => {
    expect(removeCard(['a', 'b', 'a', 'c'], 'a')).toEqual(['b', 'a', 'c']);
  });

  it('returns the list unchanged when the id is absent', () => {
    expect(removeCard(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});

describe('deckStatus', () => {
  it('reports the list length as count', () => {
    const pool = poolOf(...POOL);
    const list = ['ember-spark', 'ember-warden', 'ashen-blade'];
    expect(deckStatus(list, pool).count).toBe(3);
  });

  it('flags a short list with the exactly-60 error', () => {
    const pool = poolOf(...POOL);
    const issues = deckStatus(['ember-spark', 'ember-warden', 'ashen-blade'], pool).issues;
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('exactly 60'))).toBe(true);
  });

  it('flags an oversized list with the exactly-60 error', () => {
    const pool = poolOf(...POOL);
    const many = Array.from({ length: 61 }, (_, i) => `card-${i}`);
    const issues = deckStatus(many, pool).issues;
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('exactly 60'))).toBe(true);
  });

  it('flags copy-limit and token violations surfaced from validateDeck', () => {
    const token = card('token-rat', { name: 'Giant Rat', archetype: 'token' });
    const pool = poolOf(card('common-card'), token);
    const issues = deckStatus(['common-card', 'common-card', 'common-card', 'common-card', 'token-rat'], pool).issues;
    expect(issues.some((i) => i.message.includes('More than 3 copies'))).toBe(true);
    expect(issues.some((i) => i.message.includes('Token cards cannot be in decks'))).toBe(true);
  });
});

describe('wouldOverwrite (I3)', () => {
  it('is false for a fresh slug or an empty existing overlay', () => {
    expect(wouldOverwrite(undefined, ['a'])).toBe(false);
    expect(wouldOverwrite([], ['a'])).toBe(false);
  });

  it('is true when the incoming deck differs from the saved overlay', () => {
    expect(wouldOverwrite(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
    expect(wouldOverwrite(['a', 'b'], ['a', 'x'])).toBe(true);
  });

  it('is false when re-saving identical content (no clobber, no confirm needed)', () => {
    expect(wouldOverwrite(['a', 'b'], ['a', 'b'])).toBe(false);
  });
});

describe('saved-overlay repair flow (I3: load-then-edit)', () => {
  it('loads a broken overlay, flags the vanished card, repairs and re-saves it', () => {
    const good = Array.from({ length: 59 }, (_, i) => `t-${String(i).padStart(3, '0')}`);
    saveDeck('broken', [...good, 'vanished-card']);
    const pool = poolOf(...POOL);
    const loaded = loadDecks()[deckKey('broken')]!;
    expect(deckStatus(loaded, pool).issues.some((i) => i.message.includes('vanished-card'))).toBe(true);
    // edit: drop the broken card (mirrors the deck-builder Remove button)
    const repaired = removeCard(loaded, 'vanished-card');
    const issues = deckStatus(repaired, pool).issues;
    expect(issues.some((i) => i.message.includes('vanished-card'))).toBe(false);
    // overwrite-confirm gate: the edited deck differs from the saved overlay
    expect(wouldOverwrite(loaded, repaired)).toBe(true);
    saveDeck('broken', repaired);
    expect(loadDecks()[deckKey('broken')]).toEqual(repaired);
  });
});

describe('deckExportError (M4)', () => {
  it('blocks export when the deck is not exactly 60 cards', () => {
    const pool = poolOf(...POOL);
    expect(deckExportError([], pool)).toMatch(/exactly 60/);
    expect(deckExportError(['ember-spark'], pool)).toMatch(/exactly 60/);
  });

  it('blocks export when the deck has validation errors (copy limit)', () => {
    const poolCards = Array.from({ length: 20 }, (_, i) => card(`t-${String(i).padStart(3, '0')}`));
    const pool = poolOf(...poolCards);
    // 60 cards total, but t-000 appears 4 times (common limit is 3).
    const ids = [
      't-000', 't-000', 't-000', 't-000',
      ...poolCards.slice(1, 19).flatMap((c) => [c.id, c.id, c.id]),
      't-019', 't-019',
    ];
    expect(ids).toHaveLength(60);
    expect(deckExportError(ids, pool)).toMatch(/More than 3 copies/);
  });

  it('allows export for a clean 60-card deck (round-trip through its own import)', () => {
    const poolCards = Array.from({ length: 20 }, (_, i) => card(`t-${String(i).padStart(3, '0')}`));
    const pool = poolOf(...poolCards);
    const ids = poolCards.flatMap((c) => [c.id, c.id, c.id]);
    expect(ids).toHaveLength(60);
    expect(deckExportError(ids, pool)).toBeUndefined();
  });
});

describe('filterPool', () => {
  const all: PoolQuery = { search: '', archetype: '', type: '', cost: [0, 15] };

  it('returns everything when no filters are set', () => {
    expect(filterPool(POOL, { ...all })).toHaveLength(POOL.length);
  });

  it('matches name search case-insensitively as a substring', () => {
    expect(filterPool(POOL, { ...all, search: 'ember' }).map((c) => c.id)).toEqual(['ember-spark', 'ember-warden']);
    expect(filterPool(POOL, { ...all, search: 'EMBER' }).map((c) => c.id)).toEqual(['ember-spark', 'ember-warden']);
    expect(filterPool(POOL, { ...all, search: 'blade' }).map((c) => c.id)).toEqual(['ashen-blade']);
  });

  it('matches type exactly', () => {
    expect(filterPool(POOL, { ...all, type: 'spell' }).map((c) => c.id)).toEqual(['ember-spark', 'frost-ritual']);
    expect(filterPool(POOL, { ...all, type: 'artifact' }).map((c) => c.id)).toEqual(['ashen-blade']);
    expect(filterPool(POOL, { ...all, type: 'creature' }).map((c) => c.id)).toEqual(['ember-warden', 'bone-baron']);
  });

  it('matches cost inclusively within [min, max]', () => {
    expect(filterPool(POOL, { ...all, cost: [2, 4] }).map((c) => c.id)).toEqual(['ember-warden', 'frost-ritual', 'ashen-blade']);
    expect(filterPool(POOL, { ...all, cost: [4, 4] }).map((c) => c.id)).toEqual(['ember-warden']);
  });

  it('matches archetype exactly', () => {
    expect(filterPool(POOL, { ...all, archetype: 'ember' }).map((c) => c.id)).toEqual(['ember-spark', 'ember-warden', 'ashen-blade']);
    expect(filterPool(POOL, { ...all, archetype: 'bone' }).map((c) => c.id)).toEqual(['bone-baron']);
    expect(filterPool(POOL, { ...all, archetype: 'nope' })).toHaveLength(0);
  });

  it('combines search, type and cost filters', () => {
    expect(filterPool(POOL, { ...all, search: 'ember', type: 'creature', cost: [4, 4] }).map((c) => c.id)).toEqual(['ember-warden']);
  });
});
