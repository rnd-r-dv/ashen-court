import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, dmg, draw, gainMana, heal, summon } from './builders.js';

/**
 * Elder Roots (Task 15): Oldroot's ramp deck — gainMana adds EMPTY crystals
 * (Task 6 contract: maxMana rises, current mana unchanged). Signature cards
 * use the 'nature' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const ROOTS_PALETTE = ['#0d2818', '#7fd66b'];

const { artifact, creature, spell } = archetypeCards('nature', ROOTS_PALETTE, 'roots');

export const HERO: HeroSpec = {
  name: 'Oldroot',
  power: { name: 'Roots of the World', cost: 2, effects: [gainMana(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('roots-sapling', 'Sapling', 1, 1, 2, 'common', ['taunt'], [], 'Every forest begins as a single stubborn root.'),
  spell('roots-grow', 'Grow', 1, 'common', [gainMana(1)], 'The old woods do not rush; they simply grow.'),
  spell('roots-vine', 'Vine Snare', 2, 'common', [dmg(1, 'anyCreature')], 'Vines do not chase. They wait, and the forest always collects its toll.'),
  creature('roots-sprout', 'Sprout', 2, 2, 2, 'common', ['taunt'], [], 'Beneath the loam, something green and patient stirs.'),
  spell('roots-bloom', 'Bloom', 3, 'common', [gainMana(2)], 'When the old grove blooms, mana spills like sap from the bark.'),
  creature('roots-barkhide', 'Barkhide', 3, 2, 4, 'common', ['taunt'], [], 'Its bark remembers every blade that ever struck it — and forgives none.'),
  creature('roots-forager', 'Forager', 3, 3, 3, 'common', [], [{ when: 'battlecry', effects: [gainMana(1)] }], 'It walks the roots of the world, gathering what the forest sheds.'),
  spell('roots-thorn', 'Thorn Barrage', 4, 'common', [dmg(3, 'anyCreature')], 'The forest does not warn twice.'),
  creature('roots-ancients', "Ancient's Wrath", 4, 4, 4, 'common', ['taunt'], [], 'Roused from a thousand-year sleep, the ancients remember what was taken from them.'),
  artifact('roots-sylvan', 'Sylvan Grove', 5, 'common', [{ when: 'startOfTurn', effects: [gainMana(1)] }], 'In the heart of the grove, the trees whisper the slow arithmetic of growth.'),
  creature('roots-ironwood', 'Ironwood', 5, 4, 6, 'common', ['taunt'], [], 'No axe has dulled it. No fire has scarred it.'),
  // Rares (5)
  spell('roots-regen', 'Regrowth', 3, 'rare', [heal(4)], 'What the deep roots touch does not die.'),
  creature('roots-worldtree', 'Worldtree Sapling', 6, 5, 5, 'rare', [], [{ when: 'battlecry', effects: [gainMana(2)] }], 'Planted from a seed of the first world, it will one day hold up the sky.'),
  spell('roots-verdant', 'Verdant Bloom', 6, 'rare', [gainMana(3)], "Spring's first breath, distilled into a single blossom."),
  creature('roots-treant', 'Elder Treant', 7, 7, 7, 'rare', ['taunt'], [], 'It has stood so long that the mountain grew around its feet.'),
  spell('roots-bounty', "Nature's Bounty", 5, 'rare', [draw(2)], 'The forest gives freely to those who remember how to ask.'),
  // Epics (3)
  creature('roots-goliath', 'Goliath', 8, 8, 8, 'epic', [], [{ when: 'battlecry', effects: [gainMana(2)] }], "Older than the kingdom's oldest stone, and twice as patient."),
  spell('roots-awaken', 'Awakening', 8, 'epic', [gainMana(4)], 'When the deep roots awaken, the whole world leans in to listen.'),
  creature('roots-titan', 'Titan of the Deep Roots', 10, 10, 10, 'epic', ['taunt'], [], 'Its roots bind the very bones of the world. Nothing passes.'),
  // Legendaries (2)
  creature('roots-worldmother', 'Worldmother', 12, 12, 12, 'legendary', [], [{ when: 'battlecry', effects: [buff(2, 2, 'allFriendlyCreatures')] }], 'She is the first tree, the root of all roots, the mother of every grove.'),
  artifact('roots-heart', 'Heart of the Forest', 7, 'legendary', [{ when: 'endOfTurn', effects: [summon('token-treant')] }], "The forest's heart beats slowly — once a turn, it births a guardian."),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['roots-sapling', 3], ['roots-grow', 3], ['roots-vine', 3], ['roots-sprout', 3],
    ['roots-bloom', 3], ['roots-barkhide', 3], ['roots-forager', 3], ['roots-thorn', 3],
    ['roots-ancients', 3], ['roots-sylvan', 3], ['roots-ironwood', 3],
    ['roots-regen', 2], ['roots-worldtree', 2], ['roots-verdant', 2],
    ['roots-treant', 2], ['roots-bounty', 2],
    ['roots-goliath', 1], ['roots-awaken', 1], ['roots-titan', 1],
    ['roots-worldmother', 1], ['roots-heart', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-light', 'neutral-sentinel', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-colossus', 'neutral-idol',
  ],
};
