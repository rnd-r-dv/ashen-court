// Shared LAN deck-source tests (audit 07 bug 18). loadDecks() is keyed by the
// NAMESPACED overlay key ('custom:<slug>', audit 05 I4); the LAN deck grid must
// SHOW the clean slug while keeping the namespaced key as DeckCard.slug —
// LanHost.roomParamsFor and LanJoin.pickDeck both resolve decks with
// loadDecks()[deck.slug].
import { beforeEach, describe, expect, it } from 'vitest';
import { DECK_DEFS } from '@ashen/core';
import { saveDeck } from '../src/storage.js';
import { buildCurated, buildCustom } from '../src/game/lanDecks.js';

beforeEach(() => localStorage.clear());

describe('lanDecks.buildCustom', () => {
  it('displays the clean slug, not the namespaced overlay key', () => {
    saveDeck('my-deck', ['a', 'b', 'c']);
    const cards = buildCustom();
    expect(cards).toHaveLength(1);
    expect(cards[0]!.name).toBe('my-deck');
    expect(cards[0]!.cards).toBe(3);
    expect(cards[0]!.custom).toBe(true);
  });

  it('keeps the NAMESPACED key as slug so loadDecks()[slug] still resolves', () => {
    saveDeck('my-deck', ['a', 'b', 'c']);
    const cards = buildCustom();
    expect(cards[0]!.slug).toBe('custom:my-deck');
  });

  it('a custom deck named after a curated archetype shows its own slug', () => {
    // The old `slug in CURATED_INFO` branch was dead code (a namespaced key can
    // never equal a curated archetype id) AND would have mislabelled this deck
    // "The Ember Court" if it had ever fired.
    saveDeck('ember', ['x']);
    const cards = buildCustom();
    expect(cards[0]!.name).toBe('ember');
    expect(cards[0]!.slug).toBe('custom:ember');
  });
});

describe('lanDecks.buildCurated', () => {
  it('lists all 12 curated archetypes with heroes and 60-card counts', () => {
    const cards = buildCurated();
    expect(cards).toHaveLength(Object.keys(DECK_DEFS).length);
    for (const c of cards) {
      expect(c.custom).toBe(false);
      expect(c.cards).toBe(60);
      expect(c.hero).toBeTruthy();
    }
  });
});
