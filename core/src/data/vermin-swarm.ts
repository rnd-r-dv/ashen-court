import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, dmg, summon } from './builders.js';

/**
 * Vermin Swarm (Task 14): Rat King Moulder's token flood deck. Signature
 * cards use the 'nature' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const VERMIN_PALETTE = ['#14201a', '#8fd14f'];

const { creature, spell } = archetypeCards('nature', VERMIN_PALETTE, 'vermin');

export const HERO: HeroSpec = {
  name: 'Rat King Moulder',
  power: { name: 'Rat Call', cost: 2, effects: [summon('token-rat')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('vermin-squeaker', 'Squeaker', 1, 1, 1, 'common', [], [], 'The first rat through the wall is always the smallest. It is also the only one you ever see.'),
  spell('vermin-nibble', 'Nibble', 1, 'common', [dmg(1, 'anyCreature')], 'One nibble means nothing. That is precisely what the swarm is counting on.'),
  creature('vermin-scavenger', 'Scavenger', 1, 2, 1, 'common', [], [], 'The battlefield belongs to the dead — and the dead belong to the scavengers.'),
  spell('vermin-packcall', 'Pack Call', 2, 'common', [summon('token-rat', 2)], 'One cry in the dark, and the shadows answer two at a time.'),
  creature('vermin-brute', 'Mangy Brute', 2, 3, 2, 'common', [], [], 'Rats the size of hounds, with the patience of graves and the appetite of famine.'),
  creature('vermin-swarmlord', 'Swarmlord', 3, 2, 4, 'common', [], [], 'It does not lead from the front. It leads by being everywhere at once.'),
  spell('vermin-frenzy', 'Frenzy', 3, 'common', [{ kind: 'buff', value: 2, value2: 0, target: 'allFriendlyCreatures' }], 'Hunger is the only war horn the swarm has ever needed.'),
  creature('vermin-gnawer', 'Gnawer', 3, 3, 3, 'common', [], [], 'Bone, timber, iron, faith — given time, the gnawers wear through all of it.'),
  spell('vermin-army', 'Vermin Army', 4, 'common', [summon('token-rat', 3)], 'They do not march in columns. They march in everything.'),
  creature('vermin-warband', 'Warband', 4, 4, 3, 'common', [], [], 'A hundred throats share one hunger, and the hunger decides where they go.'),
  spell('vermin-pestilence', 'Pestilence', 5, 'common', [dmg(2, 'allEnemyCreatures')], 'The plague does not announce itself. It arrives, and the city begins counting its dead.'),
  // Rares (5)
  creature('vermin-alpha', 'Alpha Rat', 4, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [{ kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }] }], 'Where the alpha walks, the pack grows bolder — and larger.'),
  creature('vermin-breeder', 'Breeder', 5, 3, 4, 'rare', [], [{ when: 'endOfTurn', effects: [summon('token-rat')] }], 'Moulder does not raise an army. He keeps one mother, and she does the rest.'),
  creature('vermin-plaguemaster', 'Plaguemaster', 5, 3, 5, 'rare', [], [{ when: 'deathrattle', effects: [summon('token-rat', 2)] }], 'Even in death the master of plagues pays his debts to the swarm — in kind.'),
  spell('vermin-tide', 'The Tide of Teeth', 6, 'rare', [summon('token-rat', 4)], 'First the tide rises. Then the screaming begins.'),
  creature('vermin-queen', 'Queen Moulder', 6, 4, 6, 'rare', [], [{ when: 'startOfTurn', effects: [summon('token-rat')] }], 'Every morning the queen drops a litter, and every night the city loses a street.'),
  // Epics (3)
  spell('vermin-carrion', 'Carrion Call', 4, 'epic', [summon('token-rat', 2)], 'The dead have one voice that the living cannot hear. The rats hear it perfectly.'),
  spell('vermin-horde', 'The Horde', 7, 'epic', [summon('token-rat', 6)], 'There is no army here. There is only the horde — and the horde is never finished.'),
  creature('vermin-rattus', 'Rattus the God', 8, 8, 8, 'epic', ['taunt'], [], 'Rats worship nothing but hunger. When hunger learned to walk, they called it Rattus.'),
  // Legendaries (2)
  creature('vermin-plagueking', 'Plague King', 7, 6, 6, 'legendary', [], [{ when: 'startOfTurn', effects: [summon('token-rat', 2)] }], 'The king does not fight. He sheds plague like a cloak and lets his children do the rest.'),
  spell('vermin-endless', 'The Endless Swarm', 9, 'legendary', [summon('token-rat', 9)], 'Count them, if you like. The swarm has already finished counting you.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['vermin-squeaker', 3], ['vermin-nibble', 3], ['vermin-scavenger', 3], ['vermin-packcall', 3],
    ['vermin-brute', 3], ['vermin-swarmlord', 3], ['vermin-frenzy', 3], ['vermin-gnawer', 3],
    ['vermin-army', 3], ['vermin-warband', 3], ['vermin-pestilence', 3],
    ['vermin-alpha', 2], ['vermin-breeder', 2], ['vermin-plaguemaster', 2],
    ['vermin-tide', 2], ['vermin-queen', 2],
    ['vermin-carrion', 1], ['vermin-horde', 1], ['vermin-rattus', 1],
    ['vermin-plagueking', 1], ['vermin-endless', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-boar', 'neutral-hound', 'neutral-squire', 'neutral-drums',
    'neutral-scroll', 'neutral-bloom', 'neutral-swift', 'neutral-banner', 'neutral-frostbind',
    'neutral-ogre', 'neutral-lance',
  ],
};
