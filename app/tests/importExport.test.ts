import { describe, it, expect, beforeEach } from 'vitest';
import type { Card } from '@ashen/core';
import {
  buildPool,
  DECK_DEFS,
  expandDeck,
  validateCard,
  validateDeck,
} from '@ashen/core';
import {
  exportCardsJson,
  importCardsJson,
  saveCustomCard,
  loadCustomCards,
} from '../src/storage.js';

/** A valid 1-cost 1/1 creature fixture (validated by @ashen/core). */
const validCard = (over: Partial<Card> = {}): Card => ({
  id: 'custom-import-001',
  name: 'Import Test',
  type: 'creature',
  cost: 1,
  attack: 1,
  health: 1,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'ember', palette: ['#2a1a3e', '#ff6b35'], seed: 7 },
  author: 'custom',
  version: 1,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('JSON import/export round-trip', () => {
  it('fixtures pass core validation', () => {
    const cards = [
      validCard(),
      validCard({ id: 'custom-import-002', name: 'Second', cost: 2, attack: 2, health: 2 }),
    ];
    for (const c of cards) {
      expect(validateCard(c).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('round-trips a Card[] through exportCardsJson → importCardsJson', () => {
    const cards = [
      validCard(),
      validCard({
        id: 'custom-import-002',
        name: 'Ash Hound',
        cost: 3,
        attack: 2,
        health: 4,
        keywords: ['taunt'],
        rarity: 'rare',
        flavor: 'Burns bright at dawn.',
        art: { preset: 'bone', palette: ['#2b2118', '#e8d5b0'], glyph: '✦', seed: 11 },
        version: 2,
      }),
    ];
    const json = exportCardsJson(cards);
    expect(importCardsJson(json)).toEqual(cards);
  });

  it('import rejects invalid JSON', () => {
    expect(() => importCardsJson('not json at all')).toThrow('Invalid JSON');
  });

  it('import rejects a non-array payload (e.g. a deck blob)', () => {
    expect(() => importCardsJson(JSON.stringify({ deck: ['a', 'b', 'c'] }))).toThrow(
      'expected an array',
    );
  });

  it('import rejects the first invalid card with its id in the message', () => {
    const bad = JSON.stringify([
      validCard(),
      { id: 'BAD ID!', name: 'Bad', type: 'creature', cost: 1 },
    ]);
    expect(() => importCardsJson(bad)).toThrow('BAD ID!');
  });
});

describe('deck import', () => {
  it('a 60-card curated deck validates clean against pool ∪ custom cards', () => {
    const ids = expandDeck(DECK_DEFS.ember);
    expect(ids).toHaveLength(60);
    const pool = new Map<string, Card>();
    for (const c of [...buildPool(), ...loadCustomCards()]) pool.set(c.id, c);
    expect(validateDeck(ids, pool).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('a 3-card deck reports the exactly-60 error', () => {
    const pool = new Map<string, Card>();
    for (const c of buildPool()) pool.set(c.id, c);
    const issues = validateDeck(['ember-cinderling', 'ember-cinderling', 'ember-cinderling'], pool);
    expect(issues.some((i) => i.message.includes('exactly 60'))).toBe(true);
  });
});

describe('bulk import persistence', () => {
  it('saving each imported card via saveCustomCard persists them all', () => {
    const cards = [validCard(), validCard({ id: 'custom-import-002', name: 'Second' })];
    const imported = importCardsJson(exportCardsJson(cards));
    for (const c of imported) saveCustomCard(c);
    expect(loadCustomCards()).toEqual(cards);
  });
});
