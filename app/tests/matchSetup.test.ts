// Match entry builder tests (Task 31). Pins the deck pick → MatchSetup
// mapping: curated vs custom decks (with the curated-precedence edge case),
// hero resolution, bot vs hotseat config, Game-constructor validity, and the
// rematch fresh-seed helper.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPool, CardRegistry, HEROES } from '@ashen/core';
import { deleteDeck, saveDeck } from '../src/storage.js';
import {
  buildMatchEntry,
  deckCardIds,
  heroFor,
  rematchSetup,
} from '../src/game/matchSetup.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deckCardIds', () => {
  it('expands a curated archetype deck to its full 60-card definition', () => {
    const ids = deckCardIds('ember');
    expect(ids.length).toBe(60);
    const reg = new CardRegistry(buildPool());
    for (const id of ids) expect(reg.has(id)).toBe(true);
  });

  it('uses a saved custom-deck overlay for non-curated slugs', () => {
    saveDeck('my-deck', ['custom-a', 'custom-b']);
    expect(deckCardIds('my-deck')).toEqual(['custom-a', 'custom-b']);
    deleteDeck('my-deck');
  });

  it('prefers the curated definition when a custom overlay shares a curated slug', () => {
    // Documented edge case: a saved overlay named 'ember' cannot override the
    // curated deck in v1 (DeckPickResult carries no custom flag).
    saveDeck('ember', ['overlay-only']);
    const ids = deckCardIds('ember');
    expect(ids).toHaveLength(60);
    expect(ids.includes('overlay-only')).toBe(false);
    deleteDeck('ember');
  });
});

describe('heroFor', () => {
  it('maps curated slugs to their archetype hero', () => {
    expect(heroFor('ember')).toBe(HEROES[0]);
    expect(heroFor('dragon')).toBe(HEROES[3]);
    expect(heroFor('storm')).toBe(HEROES[11]);
  });

  it('falls back to the first curated hero for custom slugs', () => {
    expect(heroFor('my-custom-deck')).toBe(HEROES[0]);
  });
});

describe('buildMatchEntry', () => {
  it('bot mode: human deck as player 0, random bot deck, bot config attached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic: bot picks the first archetype
    const entry = buildMatchEntry({
      mode: 'bot',
      difficulty: 'veteran',
      decks: [{ slug: 'dragon', name: 'Dragonflight' }],
    });
    const g = entry.setup.driver.game();
    expect(entry.setup.myPlayer).toBe(0);
    expect(entry.setup.bot).toEqual({ level: 'veteran' });
    expect(entry.core.decks[0]).toEqual(deckCardIds('dragon'));
    expect(entry.core.decks[1]).toEqual(deckCardIds('ember')); // Math.random 0 → first archetype
    expect(entry.core.decks[0]).toHaveLength(60);
    expect(entry.core.decks[1]).toHaveLength(60);
    expect(g.state.players[0].hero.name).toBe(heroFor('dragon').name);
    expect(g.state.players[1].hero.name).toBe(heroFor('ember').name);
    expect(entry.core.seed).toBeTypeOf('number');
  });

  it('defaults the bot difficulty to recruit', () => {
    const entry = buildMatchEntry({ mode: 'bot', decks: [{ slug: 'ember', name: 'Ember' }] });
    expect(entry.setup.bot).toEqual({ level: 'recruit' });
  });

  it('hotseat: both picks become players, no bot config', () => {
    const entry = buildMatchEntry({
      mode: 'hotseat',
      decks: [
        { slug: 'ember', name: 'Ember Court' },
        { slug: 'bone', name: 'Bone Horde' },
      ],
    });
    expect(entry.setup.bot).toBeUndefined();
    expect(entry.setup.myPlayer).toBe(0);
    const g = entry.setup.driver.game();
    expect(g.state.players[0].hero.name).toBe(heroFor('ember').name);
    expect(g.state.players[1].hero.name).toBe(heroFor('bone').name);
  });

  it('throws when a deck is invalid (App catches and sends the player back)', () => {
    // Unknown slug → no curated def, no saved overlay → empty deck → invalid.
    expect(() =>
      buildMatchEntry({ mode: 'bot', decks: [{ slug: 'no-such-deck', name: '?' }] }),
    ).toThrow(/invalid/i);
  });
});

describe('rematchSetup', () => {
  it('keeps decks and heroes with a fresh seed', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5);
    const entry = buildMatchEntry({ mode: 'bot', decks: [{ slug: 'ember', name: 'Ember' }] });
    const rematch = rematchSetup(entry);
    expect(rematch.decks).toEqual(entry.core.decks);
    expect(rematch.heroes).toEqual(entry.core.heroes);
    expect(rematch.seed).not.toBe(entry.core.seed);
  });
});
