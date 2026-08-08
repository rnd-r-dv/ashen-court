import type { Card, EffectSpec, EffectTarget, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, dmg, heal, summon } from './builders.js';

/** Spell-damage aura (ember identity): grant Spell Power to a chosen friendly
 *  creature. Spell Power applies only to SPELL damage (effects.ts), so the
 *  payoff loop is: play Firebrand, then burn. */
const spellPower = (value: number, target: EffectTarget): EffectSpec => ({ kind: 'spellPower', value, target });

/**
 * Ember Court (Task 14): Pyra Emberveil's burn-tempo deck. Signature cards use
 * the 'ember' art preset (Forge mapping, Task 26 owns the canonical palette;
 * this is a placeholder dark-fantasy 2-color palette). Art seed = FNV-1a hash
 * of the card id (same scheme as tokens.ts arcaneArt).
 */
const EMBER_PALETTE = ['#3b0d0d', '#ff6b35'];

const { artifact, creature, spell } = archetypeCards('ember', EMBER_PALETTE, 'ember');

export const HERO: HeroSpec = {
  name: 'Pyra Emberveil',
  power: { name: 'Ember Bolt', cost: 2, effects: [dmg(1, 'any')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('ember-cinderling', 'Cinderling', 1, 2, 1, 'common', [], [{ when: 'deathrattle', effects: [dmg(1, 'randomEnemy')] }], 'A coal given breath and malice. The court breeds its smallest cruelties first.'),
  creature('ember-sparkmage', 'Sparkmage', 1, 1, 1, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }], 'Every sparkmage learns the court\'s first lesson: one flame, well-placed, ends a kingdom.'),
  spell('ember-bolt', 'Ember Bolt', 1, 'common', [dmg(2, 'any')], 'Pyra\'s answer to doubt — short, hot, and final.'),
  creature('ember-ashhunter', 'Ash Hunter', 2, 2, 2, 'common', ['stealth'], [], 'It stalks the cooled fields where the fires have passed, harvesting whatever survived the burning.'),
  spell('ember-searing', 'Searing Wave', 2, 'common', [dmg(1, 'allEnemies')], 'The court\'s opening argument: heat enough to crack shields and curl banners before the first blade is drawn.'),
  creature('ember-flamewhelp', 'Flamewhelp', 2, 2, 1, 'common', ['rush'], [], 'Born hungry and taught to charge, the whelps throw themselves at whatever stands — the court calls it eagerness.'),
  spell('ember-blast', 'Blast', 3, 'common', [dmg(4, 'any')], 'A fist of fire hurled from the high galleries. There is no diplomacy in it.'),
  creature('ember-firebrand', 'Firebrand', 3, 3, 3, 'common', [], [{ when: 'battlecry', effects: [spellPower(1, 'allFriendlyCreatures')] }], 'Snatched burning from a dying pyre and given a sword, the firebrand carries the court\'s anger into the line.'),
  creature('ember-igniter', 'Igniter', 3, 2, 3, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }], 'Every siege begins with one small flame where no flame should be.'),
  spell('ember-cauterize', 'Cauterize', 4, 'common', [dmg(3, 'any'), heal(3)], 'The court\'s surgeons know a seared wound cannot bleed again — and they let the enemy pay for the flame.'),
  creature('ember-hellhound', 'Hellhound', 4, 4, 3, 'common', ['charge'], [], 'Bred in the kennels beneath the Throne of Ash, the hounds answer only to the scent of fear.'),
  // Rares (5)
  spell('ember-firestorm', 'Firestorm', 5, 'rare', [dmg(4, 'allEnemies')], 'When the court tires of words, it lets the sky speak.'),
  creature('ember-phoenixwhelp', 'Phoenix Whelp', 5, 5, 4, 'rare', ['lifesteal'], [], 'A fledgling of the Sovereign\'s brood, learning that every dying ember is a debt owed to fire.'),
  spell('ember-pyroblast', 'Pyroblast', 5, 'rare', [dmg(7, 'any')], 'The last word in the court\'s vocabulary of fire. There are no appeals.'),
  creature('ember-flamebringer', 'Flamebringer', 6, 5, 5, 'rare', [], [{ when: 'battlecry', effects: [dmg(2, 'any')] }], 'He does not announce the burning. He is the announcement.'),
  artifact('ember-emberforged', 'Emberforged Blade', 4, 'rare', [{ when: 'startOfTurn', effects: [dmg(1, 'randomEnemy')] }], 'Forged in the heart of the Sovereign\'s pyre, the blade remembers every fire it has known — and hungers for the next.'),
  // Epics (3)
  spell('ember-conflagration', 'Conflagration', 7, 'epic', [dmg(2, 'allEnemies')], 'The Ember Court does not wage war; it sets the world alight and calls the settling ash peace.'),
  creature('ember-ashwing', 'Ashwing', 7, 7, 6, 'epic', ['charge'], [], 'It does not descend to fight. It arrives, and the field remembers it should already be ash.'),
  creature('ember-magmasoul', 'Magmasoul', 8, 7, 7, 'epic', ['windfury'], [], 'A heart of molten stone, struck twice with the same fury — the first blow is the warning, the second is the verdict.'),
  // Legendaries (2)
  creature('ember-phoenix', 'The Phoenix Sovereign', 9, 8, 8, 'legendary', [], [
    { when: 'battlecry', effects: [dmg(3, 'allEnemies')] },
    { when: 'deathrattle', effects: [summon('token-phoenixash')] },
  ], 'The first and final fire of the Ember Court. When the Sovereign falls, the burning is only beginning.'),
  creature('ember-emberlord', 'Emberlord Vharn', 6, 5, 5, 'legendary', [], [{ when: 'battlecry', effects: [dmg(2, 'randomEnemy')] }], 'First to kneel at the Sovereign\'s pyre, last to stop smoldering — Vharn is the court\'s burning right hand.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['ember-cinderling', 3], ['ember-sparkmage', 3], ['ember-bolt', 3], ['ember-ashhunter', 3],
    ['ember-searing', 3], ['ember-flamewhelp', 3], ['ember-blast', 3], ['ember-firebrand', 3],
    ['ember-igniter', 3], ['ember-cauterize', 3], ['ember-hellhound', 3],
    ['ember-firestorm', 2], ['ember-phoenixwhelp', 2], ['ember-pyroblast', 2],
    ['ember-flamebringer', 2], ['ember-emberforged', 2],
    ['ember-conflagration', 1], ['ember-ashwing', 1], ['ember-magmasoul', 1],
    ['ember-phoenix', 1], ['ember-emberlord', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-boar', 'neutral-crack', 'neutral-scroll', 'neutral-bloom',
    'neutral-drums', 'neutral-ogre', 'neutral-swift', 'neutral-lance', 'neutral-banner',
    'neutral-squire', 'neutral-herb',
  ],
};
