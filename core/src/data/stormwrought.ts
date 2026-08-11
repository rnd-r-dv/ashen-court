import type { Card, EffectSpec, EffectTarget, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, dmg, draw } from './builders.js';

/**
 * Stormwrought (Task 17): Zephyra Stormveil's storm-tempo deck. Signature
 * cards use the 'storm' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts
 * arcaneArt).
 */
const STORM_PALETTE = ['#1c2b3a', '#7fb2e5'];

const { artifact, creature, spell } = archetypeCards('storm', STORM_PALETTE, 'storm');

/** Stormwrought is the only archetype that discounts spells, so this stays local. */
const discSpell = (value: number): EffectSpec => ({ kind: 'discountNextSpell', value });
/** And the only one that bounces creatures, so this stays local too. */
const bounce = (target: EffectTarget): EffectSpec => ({ kind: 'returnToHand', target });

export const HERO: HeroSpec = {
  name: 'Zephyra Stormveil',
  power: { name: 'Static', cost: 2, effects: [discSpell(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('storm-arc', 'Arc', 1, 'common', [dmg(2, 'anyCreature')], 'A thread of lightning torn from a passing squall, eager to be spent.'),
  spell('storm-bolt', 'Bolt', 2, 'common', [dmg(3, 'any')], 'Skyfire given shape and a grudge; it strikes where Zephyra points.'),
  creature('storm-adept', 'Adept', 2, 2, 1, 2, 'common', ['rush'], [], 'Acolytes learn to read the sky long before they learn to break it.'),
  spell('storm-charge', 'Storm Charge', 2, 'common', [buff(2, 2, 'friendlyCreature', 1)], 'The storm lends its fury; the vessel decides where to spend it.'),
  creature('storm-emberwitch', 'Emberwitch', 3, 3, 2, 2, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }], 'Every ember she flings rides a gust straight to its mark.'),
  spell('storm-squall', 'Squall', 3, 'common', [dmg(2, 'allEnemies')], 'The sky tears open without warning, and everything caught in the open pays.'),
  creature('storm-rider', 'Storm Rider', 4, 4, 4, 3, 'common', ['rush'], [], 'Storm Riders arrive with the first crack of thunder and leave before the last.'),
  spell('storm-gust', 'Gust', 4, 'common', [dmg(4, 'enemyCreature')], 'A single breath of the storm, aimed with intent.'),
  creature('storm-sorcerer', 'Sorcerer', 4, 3, 3, 4, 'common', [], [{ when: 'battlecry', effects: [bounce('enemyCreature')] }], 'Every storm is a lesson, and the sorcerers take notes in lightning.'),
  spell('storm-downpour', 'Downpour', 5, 'common', [dmg(3, 'allEnemies')], 'The sky forgets mercy when it remembers how to drown.'),
  spell('storm-cyclone', 'Cyclone', 6, 'common', [dmg(6, 'any')], 'A whole storm folded into a single turning blade.'),
  // Rares (5)
  creature('storm-mistweaver', 'Mistweaver', 4, 3, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [discSpell(1)] }], 'Mistweavers gather the storm\'s loose threads and hand them to the next caster.'),
  spell('storm-echoes', 'Echoes', 5, 'rare', [draw(2), dmg(1, 'allEnemies')], 'Thunder rolls twice, and the second roll remembers what the first forgot.'),
  creature('storm-stormcaller', 'Stormcaller', 6, 5, 4, 5, 'rare', [], [{ when: 'battlecry', effects: [discSpell(2)] }], 'The clouds know their master\'s voice and come when called.'),
  creature('storm-leviathan', 'Leviathan', 7, 7, 7, 7, 'rare', ['taunt'], [], 'Something vast moves beneath the storm-torn sea, and it is not the storm.'),
  spell('storm-eye', 'Eye of the Storm', 7, 'rare', [dmg(4, 'allEnemies'), draw(1)], 'In the calm at the center, the storm takes stock of everything it will destroy.'),
  // Epics (3)
  spell('storm-tempest', 'Tempest', 8, 'epic', [dmg(5, 'allEnemies')], 'The tempest is not anger; it is weather with a purpose.'),
  creature('storm-siren', 'Siren', 5, 4, 4, 4, 'epic', [], [{ when: 'battlecry', effects: [discSpell(1)] }], 'Her song gathers the storm\'s scattered magic and lays it at your feet.'),
  creature('storm-thunderhead', 'Thunderhead', 9, 9, 8, 9, 'epic', ['taunt'], [], 'A mountain of black cloud with a heartbeat of lightning.'),
  // Legendaries (2)
  creature('storm-zephyra', 'Zephyra', 10, 9, 9, 9, 'legendary', ['windfury'], [], 'Where Zephyra walks, thunder follows at her heel, and the sky learns to strike twice.'),
  artifact('storm-boreas', 'Boreas, Eye of the Storm', 8, 'legendary', [{ when: 'startOfTurn', effects: [dmg(2, 'randomEnemy'), draw(1)] }], 'The last storm of the old world, set in iron and made to serve; it wakes at dawn with an old grudge.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['storm-arc', 3], ['storm-bolt', 3], ['storm-adept', 3], ['storm-charge', 3],
    ['storm-emberwitch', 3], ['storm-squall', 3], ['storm-rider', 3], ['storm-gust', 3],
    ['storm-sorcerer', 3], ['storm-downpour', 3], ['storm-cyclone', 3],
    ['storm-mistweaver', 2], ['storm-echoes', 2], ['storm-stormcaller', 2],
    ['storm-leviathan', 2], ['storm-eye', 2],
    ['storm-tempest', 1], ['storm-siren', 1], ['storm-thunderhead', 1],
    ['storm-zephyra', 1], ['storm-boreas', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-swift', 'neutral-scroll', 'neutral-rite',
    'neutral-crack', 'neutral-frostbind', 'neutral-lance', 'neutral-banner', 'neutral-execute',
    'neutral-ogre', 'neutral-soulmirror',
  ],
};
