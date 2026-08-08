import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, dmg, draw } from './builders.js';

/**
 * Shadow Dancers (Task 15): Nyx Nightshade's draw/damage deck. Signature
 * cards use the 'shadow' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const DANCE_PALETTE = ['#1a1a2e', '#c084fc'];

const { artifact, creature, spell } = archetypeCards('shadow', DANCE_PALETTE, 'dance');

export const HERO: HeroSpec = {
  name: 'Nyx Nightshade',
  power: { name: 'Gamble', cost: 2, effects: [draw(1), dmg(1, 'self')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('dance-dagger', 'Dagger Throw', 1, 'common', [dmg(2, 'anyCreature')], 'The dagger leaves her hand before the eye can follow; the shadow of its flight arrives a heartbeat late.'),
  spell('dance-step', 'Shadow Step', 1, 'common', [draw(1)], 'Step into shadow, step out of reach — and let the dark carry away what was never yours.'),
  spell('dance-twirl', 'Twirl', 1, 'common', [dmg(1, 'any')], 'She twirls, and the crowd applauds. Only the wounded notice the blade that was there a moment ago.'),
  creature('dance-acrobat', 'Acrobat', 2, 2, 2, 'common', ['stealth'], [], 'Gravity is a suggestion the Acrobat politely declines.'),
  spell('dance-slash', 'Slash', 2, 'common', [dmg(3, 'enemyCreature')], 'Quick, clean, and done before the scream finds its voice.'),
  creature('dance-dervish', 'Dervish', 2, 3, 1, 'common', ['rush'], [], 'A whirlwind of blade and shadow — everywhere at once, and gone the moment the eye blinks.'),
  spell('dance-vanish', 'Vanish', 3, 'common', [dmg(3, 'anyCreature')], 'Those who see the vanish are already bleeding; those who do not are still counting their coin.'),
  spell('dance-echo', 'Echo', 3, 'common', [draw(2)], 'Every performance echoes twice — once in the hall, and once in the shadows that remember it.'),
  spell('dance-spin', 'Spinning Blade', 3, 'common', [dmg(2, 'allEnemies')], 'A single blade spun into a ring of steel. Step inside the circle, and pray the music ends first.'),
  creature('dance-bladeweaver', 'Bladeweaver', 4, 4, 4, 'common', ['stealth'], [], 'Threads of shadow, needles of steel — the battlefield is the loom, and blades are the thread.'),
  spell('dance-veil', 'Veil Dance', 4, 'common', [draw(2)], 'The veils rise and fall; what they conceal is never what the crowd believes it saw.'),
  // Rares (5)
  spell('dance-flurry', 'Flurry', 4, 'rare', [dmg(4, 'randomEnemyCreature')], 'Every dagger bets on a different mark. The flurry cares only that one of them lands.'),
  creature('dance-trickster', 'Trickster', 5, 4, 4, 'rare', [], [{ when: 'battlecry', effects: [draw(1)] }], 'Watch the hands, not the eyes. Even the watchful leave poorer, unsure of what they lost.'),
  spell('dance-finale', 'Grand Finale', 7, 'rare', [dmg(6, 'randomEnemy')], 'The last bow, the last blade, the last secret — the audience will never forget a single step.'),
  spell('dance-mirage', 'Mirage', 5, 'rare', [draw(3)], 'The mirage shows you what you most desire, and charges you dearly for the glimpse.'),
  creature('dance-illusionist', 'Illusionist', 6, 5, 5, 'rare', [], [{ when: 'battlecry', effects: [{ kind: 'returnToHand', target: 'enemyCreature' }] }], 'No light bends that the Illusionist cannot command, and no shadow that will not answer her call.'),
  // Epics (3)
  creature('dance-puppet', 'Puppet Master', 7, 6, 6, 'epic', [], [{ when: 'battlecry', effects: [draw(2)] }], 'Strings unseen, audience unknowing — everyone dances to a tune only one can hear.'),
  spell('dance-trick', 'The Ultimate Trick', 8, 'epic', [dmg(8, 'any')], 'For the final trick, the stage itself disappears — and takes one poor soul with it.'),
  creature('dance-shadow', 'Shadow Dancer', 7, 5, 5, 'epic', [], [{ when: 'deathrattle', effects: [draw(2)] }], 'The dance does not end when the dancer falls; the shadows finish the steps.'),
  // Legendaries (2)
  creature('dance-nyx', 'Nyx, the Last Dance', 9, 8, 8, 'legendary', ['windfury'], [], 'When Nyx Nightshade takes the floor, even fate holds its breath until she bows.'),
  artifact('dance-infinite', 'Infinite Shadows', 6, 'legendary', [{ when: 'endOfTurn', effects: [draw(1)] }], 'The shadows multiply with every passing hour — patient, endless, and always watching.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['dance-dagger', 3], ['dance-step', 3], ['dance-twirl', 3], ['dance-acrobat', 3],
    ['dance-slash', 3], ['dance-dervish', 3], ['dance-vanish', 3], ['dance-echo', 3],
    ['dance-spin', 3], ['dance-bladeweaver', 3], ['dance-veil', 3],
    ['dance-flurry', 2], ['dance-trickster', 2], ['dance-finale', 2],
    ['dance-mirage', 2], ['dance-illusionist', 2],
    ['dance-puppet', 1], ['dance-trick', 1], ['dance-shadow', 1],
    ['dance-nyx', 1], ['dance-infinite', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-swift', 'neutral-scroll', 'neutral-rite',
    'neutral-crack', 'neutral-drums', 'neutral-lance', 'neutral-banner', 'neutral-frostbind',
    'neutral-ogre', 'neutral-soulmirror',
  ],
};
