import type { Card, EffectSpec, EffectTarget, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, dmg, draw, gainMana } from './builders.js';

/**
 * Starforged (Task 17): Archon Stellara's star-tempo deck. Signature cards
 * use the 'star' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const STAR_PALETTE = ['#141430', '#ffe9a8'];

const { creature, spell } = archetypeCards('star', STAR_PALETTE, 'star');

/** Starforged is the only archetype that discounts creatures, so this stays local. */
const discCheap = (value: number): EffectSpec => ({ kind: 'discountMostExpensive', value });
/** Starforged is also the only archetype that hands out spell power, so this stays local. */
const spellPow = (value: number, target: EffectTarget): EffectSpec => ({ kind: 'spellPower', value, target });

export const HERO: HeroSpec = {
  name: 'Archon Stellara',
  power: { name: 'Star Rite', cost: 2, effects: [discCheap(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('star-spark', 'Spark', 1, 'common', [dmg(2, 'anyCreature')], 'A cinder torn from the Archon\'s forge falls where she wills it.'),
  spell('star-meteor', 'Meteor Shard', 2, 'common', [dmg(3, 'enemyCreature')], 'What the heavens discard, Stellara wields as a blade.'),
  creature('star-acolyte', 'Star Acolyte', 2, 2, 2, 3, 'common', ['taunt'], [], 'Newest to the Archon\'s choir, they read destinies in the ash of dying stars.'),
  spell('star-meditate', 'Meditate', 2, 'common', [{ kind: 'discover' }, gainMana(1)], 'Silence, and the firmament answers: one whispered truth, one spark of power.'),
  spell('star-focus', 'Star Focus', 3, 'common', [gainMana(2)], 'Scattered starfire gathered into a lens — and the sky bends to her purpose.'),
  creature('star-guardian', 'Guardian', 3, 2, 3, 4, 'common', ['taunt'], [], 'Wrought from a constellation\'s core, it stands where lesser lights would fall.'),
  creature('star-sentinel', 'Sentinel', 4, 3, 4, 5, 'common', ['taunt'], [], 'It has watched the void since before the first spark was struck — and it watches still.'),
  spell('star-comet', 'Comet', 4, 'common', [dmg(4, 'enemyCreature')], 'The comet\'s path was fixed the moment the Archon raised her hand.'),
  spell('star-gravitate', 'Gravitate', 5, 'common', [dmg(3, 'allEnemies')], 'Every shard and stray ember obeys the pull of a greater mass.'),
  creature('star-mage', 'Starmage', 5, 4, 5, 6, 'common', [], [{ when: 'battlecry', effects: [spellPow(1, 'friendlyCreature')] }], 'Mages of the starforged court weave the sky\'s light into armor and blade alike.'),
  spell('star-fall', 'Starfall', 6, 'common', [dmg(6, 'any')], 'When Stellara calls, the firmament answers — a whole sky falling at once.'),
  // Rares (5)
  creature('star-prophet', 'Prophet', 4, 3, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [discCheap(1)] }], 'What the Prophet has foreseen, the Archon need not pay full price for.'),
  creature('star-oracle', 'Oracle', 5, 3, 4, 4, 'rare', [], [{ when: 'battlecry', effects: [discCheap(1)] }], 'Her visions are never wrong, and the price of what follows is already known.'),
  spell('star-chorus', 'Celestial Chorus', 6, 'rare', [draw(2), gainMana(1)], 'A thousand star-voices in unison: each note a memory, each harmony a new power.'),
  creature('star-giant', 'Star Giant', 7, 7, 7, 7, 'rare', ['taunt'], [], 'A titan born of coalesced starlight; the sky dims where it walks.'),
  spell('star-eclipse', 'Eclipse', 7, 'rare', [dmg(7, 'any')], 'Stellara draws a veil across the sun, and the world reels in the sudden dark.'),
  // Epics (3)
  creature('star-wanderer', 'Wanderer', 8, 8, 6, 8, 'epic', ['charge'], [], 'No constellation claims it; it crosses the heavens unbound, answering to no sky.'),
  spell('star-void', 'Chorus of the Void', 9, 'epic', [dmg(9, 'any')], 'The void is not silent — it sings with the voices of the stars it has swallowed.'),
  creature('star-megastar', 'Megastar', 10, 10, 8, 10, 'epic', ['windfury'], [], 'A star grown beyond its sky, forged to burn where gods once trod.'),
  // Legendaries (2)
  creature('star-archon', 'Archon Stellara', 12, 12, 12, 12, 'legendary', ['taunt'], [], 'The Archon\'s will is the sky\'s own law; every star in her court burns to her design.'),
  creature('star-constellation', 'Living Constellation', 8, 7, 6, 7, 'legendary', [], [{ when: 'battlecry', effects: [discCheap(2)] }], 'It redraws the firmament as it moves, and the next summon is already written in its light.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['star-spark', 3], ['star-meteor', 3], ['star-acolyte', 3], ['star-meditate', 3],
    ['star-focus', 3], ['star-guardian', 3], ['star-sentinel', 3], ['star-comet', 3],
    ['star-gravitate', 3], ['star-mage', 3], ['star-fall', 3],
    ['star-prophet', 2], ['star-oracle', 2], ['star-chorus', 2],
    ['star-giant', 2], ['star-eclipse', 2],
    ['star-wanderer', 1], ['star-void', 1], ['star-megastar', 1],
    ['star-archon', 1], ['star-constellation', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll',
    'neutral-rite', 'neutral-light', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-idol', 'neutral-colossus',
  ],
};
