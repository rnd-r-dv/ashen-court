import { describe, expect, it } from 'vitest';
import { DECK_DEFS, HEROES } from '@ashen/core';
import { houseOfHeroName } from '../src/game/house.js';

// Hand-derived fixture: hero name -> archetype key, in the exact order the
// positional contract pins (HEROES zipped with Object.keys(DECK_DEFS),
// core/src/data/index.ts). Written as literals so a shuffled HEROES array or
// a reordered DECK_DEFS object fails loudly instead of silently re-zipping.
const HOUSES = [
  ['ember', 'Pyra Emberveil'],
  ['choir', 'Vespera Dawnlight'],
  ['vermin', 'Rat King Moulder'],
  ['dragon', 'Seraphina Skywing'],
  ['roots', 'Oldroot'],
  ['dance', 'Nyx Nightshade'],
  ['bone', 'Baron Von Bone'],
  ['pact', 'Morticia Gravefall'],
  ['coven', 'Morwenna Hex'],
  ['star', 'Archon Stellara'],
  ['vigil', 'Ser Aldric the Vigilant'],
  ['storm', 'Zephyra Stormveil'],
] as const;

describe('houseOfHeroName', () => {
  it('maps all twelve hero names to their house archetype', () => {
    for (const [archetype, name] of HOUSES) {
      expect(houseOfHeroName(name)).toEqual({ archetype, heroName: name });
    }
  });

  it('stays in step with the underlying positional contract', () => {
    // The contract itself: HEROES and DECK_DEFS must zip 1:1 in order. If
    // this fails, every houseOfHeroName result is suspect, not just unknown
    // names.
    expect(Object.keys(DECK_DEFS)).toHaveLength(HEROES.length);
  });

  it('falls back to the first house for an unknown name', () => {
    expect(houseOfHeroName('Nobody Important')).toEqual({ archetype: 'ember', heroName: 'Pyra Emberveil' });
  });
});
