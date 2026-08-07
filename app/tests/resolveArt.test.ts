import { describe, expect, it } from 'vitest';
import { makeResolver } from '../src/art/resolveArt.js';

// Shaped exactly like an import.meta.glob(..., { eager: true, as: 'url' }) map:
// absolute-ish source paths as keys, emitted URLs as values.
const MAP = {
  '/src/assets/art/cards/choir-seraph.jpg': '/assets/choir-seraph-a1b2c3.jpg',
  '/src/assets/art/cards/ember-imp.jpg': '/assets/ember-imp-d4e5f6.jpg',
};

const resolve = makeResolver(MAP, '/src/assets/art/cards');

describe('makeResolver', () => {
  it('returns the hashed URL for a card that has art', () => {
    expect(resolve('choir-seraph')).toBe('/assets/choir-seraph-a1b2c3.jpg');
  });

  it('returns null for a card with no art, so the caller can fall back', () => {
    expect(resolve('vigil-smite')).toBeNull();
  });

  it('does not match on a partial id', () => {
    // 'seraph' must not accidentally resolve 'choir-seraph'.
    expect(resolve('seraph')).toBeNull();
  });

  it('is empty-safe — a pool with no generated art yet resolves nothing', () => {
    const none = makeResolver({}, '/src/assets/art/cards');
    expect(none('choir-seraph')).toBeNull();
  });
});

import { heroSlug } from '../src/art/resolveArt.js';

describe('heroSlug agrees with the generator', () => {
  it('matches scripts/art/paths.ts for all 12 hero names', () => {
    const expected: Record<string, string> = {
      'Pyra Emberveil': 'pyra-emberveil',
      'Vespera Dawnlight': 'vespera-dawnlight',
      'Rat King Moulder': 'rat-king-moulder',
      'Seraphina Skywing': 'seraphina-skywing',
      'Oldroot': 'oldroot',
      'Nyx Nightshade': 'nyx-nightshade',
      'Baron Von Bone': 'baron-von-bone',
      'Morticia Gravefall': 'morticia-gravefall',
      'Morwenna Hex': 'morwenna-hex',
      'Archon Stellara': 'archon-stellara',
      'Ser Aldric the Vigilant': 'ser-aldric-the-vigilant',
      'Zephyra Stormveil': 'zephyra-stormveil',
    };
    for (const [name, slug] of Object.entries(expected)) {
      expect(heroSlug(name)).toBe(slug);
    }
  });
});
