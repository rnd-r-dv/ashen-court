import { describe, it, expect, beforeEach } from 'vitest';
import type { Card } from '@ashen/core';
import {
  saveCustomCard,
  loadCustomCards,
  deleteCustomCard,
  saveDeck,
  loadDecks,
  deleteDeck,
  exportCardsJson,
  importCardsJson,
} from '../src/storage.js';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'custom-001', name: 'Test', type: 'creature', cost: 3, attack: 3, health: 3,
  keywords: [], effects: [], rarity: 'common', archetype: 'neutral',
  art: { preset: 'shadow', palette: ['#111', '#333'], seed: 1 },
  author: 'custom', version: 1, ...over,
});

beforeEach(() => localStorage.clear());

describe('custom cards', () => {
  it('saves and loads a custom card', () => {
    saveCustomCard(card());
    expect(loadCustomCards()).toEqual([card()]);
  });
  it('upserts by id', () => {
    saveCustomCard(card());
    saveCustomCard(card({ name: 'Renamed', version: 2 }));
    const cards = loadCustomCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual(card({ name: 'Renamed', version: 2 }));
  });
  it('deletes by id', () => {
    saveCustomCard(card());
    saveCustomCard(card({ id: 'custom-002', name: 'Other' }));
    deleteCustomCard('custom-001');
    expect(loadCustomCards()).toEqual([card({ id: 'custom-002', name: 'Other' })]);
  });
});

describe('deck overlay', () => {
  it('deck overlay round-trips', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `t-${String(i).padStart(3, '0')}`);
    saveDeck('bone', ids);
    expect(loadDecks()).toEqual({ bone: ids });
    deleteDeck('bone');
    expect(loadDecks()).toEqual({});
  });
});

describe('JSON import/export', () => {
  it('export then import round-trips', () => {
    const json = exportCardsJson([card()]);
    expect(importCardsJson(json)).toEqual([card()]);
  });
  it('import rejects invalid JSON and invalid cards', () => {
    expect(() => importCardsJson('not json')).toThrow();
    expect(() => importCardsJson(JSON.stringify([{ id: 'bad id!' }]))).toThrow();
  });
});
