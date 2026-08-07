// scripts/tests/paths.test.ts
import { describe, expect, it } from 'vitest';
import { cardArtPath, heroArtPath, heroSlug } from '../art/paths.js';

describe('paths', () => {
  it('slugs a hero name', () => {
    expect(heroSlug('Vespera Dawnlight')).toBe('vespera-dawnlight');
    expect(heroSlug('Ser Aldric the Vigilant')).toBe('ser-aldric-the-vigilant');
    expect(heroSlug('Baron Von Bone')).toBe('baron-von-bone');
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(heroSlug("Morwenna  Hex!")).toBe('morwenna-hex');
    expect(heroSlug('  Oldroot  ')).toBe('oldroot');
  });

  it('puts card art under app/src so Vite can glob it', () => {
    // Under public/ Vite would not enumerate or content-hash these.
    expect(cardArtPath('choir-seraph')).toBe('app/src/assets/art/cards/choir-seraph.jpg');
  });

  it('puts hero art under its own directory, keyed by slug', () => {
    expect(heroArtPath('Rat King Moulder')).toBe('app/src/assets/art/heroes/rat-king-moulder.jpg');
  });

  it('produces a distinct slug for all 12 heroes', () => {
    const names = [
      'Pyra Emberveil', 'Vespera Dawnlight', 'Rat King Moulder', 'Seraphina Skywing',
      'Oldroot', 'Nyx Nightshade', 'Baron Von Bone', 'Morticia Gravefall',
      'Morwenna Hex', 'Archon Stellara', 'Ser Aldric the Vigilant', 'Zephyra Stormveil',
    ];
    expect(new Set(names.map(heroSlug)).size).toBe(12);
  });
});
