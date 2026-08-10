import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, destroy, dmg, summon } from './builders.js';

/**
 * Bone Horde (Task 16): Baron Von Bone's skeleton token swarm. Signature
 * cards use the 'bone' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const BONE_PALETTE = ['#221a12', '#e6c98f'];

const { creature, spell } = archetypeCards('bone', BONE_PALETTE, 'bone');

export const HERO: HeroSpec = {
  name: 'Baron Von Bone',
  power: { name: 'Raise Skeleton', cost: 2, effects: [summon('token-skeleton')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('bone-clatter', 'Clatter', 1, 'common', [summon('token-skeleton')], 'Every graveyard knows the sound: one rattle, and a hundred more answer it.'),
  creature('bone-scrapper', 'Scrapper', 1, 1, 2, 'common', [], [], 'Too small for the ranks, it still crawls from the grave — claws first.'),
  spell('bone-gnaw', 'Gnaw', 2, 'common', [dmg(2, 'anyCreature')], 'Teeth worn to nubs on gravestone and gristle; the hunger never dulls.'),
  creature('bone-marauder', 'Marauder', 2, 3, 1, 'common', [], [], 'Fresh from the barrow, it remembers only the raid.'),
  creature('bone-gravedigger', 'Gravedigger', 2, 2, 2, 'common', [], [{ when: 'deathrattle', effects: [summon('token-skeleton')] }], 'Every grave it opens answers with a shambling guest.'),
  creature('bone-cairn', 'Cairn', 3, 0, 4, 'common', ['taunt'], [{ when: 'deathrattle', effects: [summon('token-skeleton', 3)] }], 'A heap of the honored dead, piled high enough to block the living.'),
  spell('bone-frenzy', 'Bone Frenzy', 3, 'common', [buff(1, 1, 'allFriendlyCreatures')], 'The horde forgets fear. It remembers only the charge.'),
  creature('bone-raider', 'Raider', 3, 3, 3, 'common', [], [{ when: 'deathrattle', effects: [summon('token-skeleton', 2)] }], 'It plunders the living for what the dead no longer need.'),
  spell('bone-rattle', 'Rattle', 4, 'common', [dmg(2, 'allEnemyCreatures')], 'The horde rattles as one, and the sound cracks the bones of the living.'),
  creature('bone-skull', 'Skull Wall', 4, 2, 5, 'common', ['taunt'], [], 'A thousand jawless grins, stacked in patient silence.'),
  spell('bone-howl', 'Howl', 4, 'common', [summon('token-skeleton', 2)], 'One long cry from the barrow, and the earth gives up its tenants.'),
  // Rares (5)
  creature('bone-necromancer', 'Necromancer', 5, 3, 4, 'rare', [], [{ when: 'startOfTurn', effects: [summon('token-skeleton')] }], 'Each dawn it counts its army. Each dusk it adds one more.'),
  spell('bone-legion', 'Legion Call', 5, 'rare', [destroy('friendlyCreature'), summon('token-skeleton', 3)], 'Three names spoken into the cold earth — three ranks answer.'),
  spell('bone-horde', 'Bone Horde', 6, 'rare', [summon('token-skeleton', 4)], 'They do not march in step. They march as one tide.'),
  creature('bone-warlord', 'Warlord', 6, 6, 6, 'rare', [], [{ when: 'deathrattle', effects: [summon('token-skeleton', 2)] }], 'It commands a host that never tires, never falters, never negotiates.'),
  creature('bone-behemoth', 'Behemoth', 7, 7, 7, 'rare', ['taunt'], [], "The barrow's mountain, risen to keep its brothers safe."),
  // Epics (3)
  creature('bone-whisper', 'Whisperer', 5, 3, 6, 'epic', [], [{ when: 'endOfTurn', effects: [summon('token-skeleton')] }], 'It speaks to the sleeping dead in a voice only they can hear.'),
  spell('bone-cataclysm', 'Cataclysm', 8, 'epic', [dmg(3, 'allEnemyCreatures')], "When the whole horde rattles at once, the world's bones tremble too."),
  creature('bone-overlord', 'Overlord', 9, 8, 10, 'epic', [], [{ when: 'deathrattle', effects: [summon('token-skeleton', 2)] }], 'Beneath the crowns of a hundred dead kings, one will still rules.'),
  // Legendaries (2)
  creature('bone-king', 'The Bone King', 10, 8, 10, 'legendary', ['taunt'], [{ when: 'deathrattle', effects: [summon('token-skeleton', 3)] }], 'Death has a throne, and it is built from what it conquered. When the King falls, his court rises in his place.'),
  spell('bone-army', 'Risen Army', 7, 'legendary', [summon('token-skeleton', 6)], 'From every unmarked grave and forgotten war, they answer the call.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['bone-clatter', 3], ['bone-scrapper', 3], ['bone-gnaw', 3], ['bone-marauder', 3],
    ['bone-gravedigger', 3], ['bone-cairn', 3], ['bone-frenzy', 3], ['bone-raider', 3],
    ['bone-rattle', 3], ['bone-skull', 3], ['bone-howl', 3],
    ['bone-necromancer', 2], ['bone-legion', 2], ['bone-horde', 2],
    ['bone-warlord', 2], ['bone-behemoth', 2],
    ['bone-whisper', 1], ['bone-cataclysm', 1], ['bone-overlord', 1],
    ['bone-king', 1], ['bone-army', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-boar', 'neutral-hound', 'neutral-squire', 'neutral-drums',
    'neutral-scroll', 'neutral-bloom', 'neutral-swift', 'neutral-banner', 'neutral-ogre',
    'neutral-lance', 'neutral-relic',
  ],
};
