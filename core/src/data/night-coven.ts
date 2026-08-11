import type { Card, EffectSpec, EffectTarget, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, destroy, dmg, draw, heal } from './builders.js';

/**
 * Night Coven (Task 16): Morwenna Hex's debuff/curse deck. Signature cards
 * use the 'curse' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const COVEN_PALETTE = ['#1a1609', '#d9c94f'];

const { artifact, creature, spell } = archetypeCards('curse', COVEN_PALETTE, 'coven');

/** Coven is the only archetype that freezes, so this stays local. */
const freeze = (target: EffectTarget): EffectSpec => ({ kind: 'freeze', target });

export const HERO: HeroSpec = {
  name: 'Morwenna Hex',
  power: { name: 'Hex', cost: 2, effects: [buff(-1, -1, 'enemyCreature', -1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('coven-whisper', 'Whisper', 1, 'common', [dmg(1, 'anyCreature')], "A voice too soft to be heard, yet too sharp to ignore. What is whispered in the dark cannot be unheard."),
  spell('coven-hex', 'Hex', 2, 'common', [buff(-1, -1, 'enemyCreature', -1)], 'The old words curdle blood and dull bone. Once the hex is spoken, its victim carries a weight they cannot name.'),
  spell('coven-curse', 'Curse', 2, 'common', [buff(-1, -1, 'enemyCreature', -1), dmg(1, 'enemyCreature')], 'A curse is a promise with teeth. It takes strength first, and blood after.'),
  creature('coven-familiar', 'Familiar', 2, 2, 2, 2, 'common', [], [], 'Every witch keeps a shadow with claws. This one has learned to fetch more than trinkets.'),
  spell('coven-wither', 'Wither', 3, 'common', [buff(-2, -2, 'enemyCreature', -1)], 'Where the withering passes, green turns grey and marrow turns dust. The coven does not burn what it hates; it lets it dry on the vine.'),
  creature('coven-bog', 'Bog Hag', 3, 2, 3, 4, 'common', [], [], 'She rose from the marsh with reeds braided in her hair and debts older than the moon. The bog keeps what it takes, and so does she.'),
  spell('coven-doom', 'Doom', 3, 'common', [dmg(3, 'enemyCreature')], 'Some futures are fixed before the first step is taken. Morwenna merely reads them aloud.'),
  spell('coven-nightmare', 'Nightmare', 4, 'common', [buff(-3, -3, 'enemyCreature', -2)], 'Sleep offers no refuge from the coven. Their dreams ride in on your own.'),
  creature('coven-raven', 'Raven', 4, 4, 4, 4, 'common', [], [{ when: 'battlecry', effects: [buff(-1, -1, 'enemyCreature', -1)] }], "The raven knows the way home, and the way to the enemy's window. It counts the coven's debts in caws and graves."),
  creature('coven-scare', 'Scarecrow', 4, 1, 4, 7, 'common', ['taunt'], [], "The coven's fields are planted with worse than grain. What stands among them does not frighten crows — it feeds them."),
  spell('coven-drain', 'Drain', 5, 'common', [dmg(2, 'enemyCreature'), heal(2)], 'Life is a loan the coven collects with interest. The wound closes on one side of the circle; on the other, a harvest is taken.'),
  // Rares (5)
  spell('coven-decay', 'Decay', 5, 'rare', [buff(-2, -2, 'allEnemyCreatures', -1)], "Rot is patient, and it preaches to everything that stands too proud. The rite of decay is the coven's oldest sermon."),
  creature('coven-eldritch', 'Eldritch Horror', 6, 6, 5, 6, 'rare', ['venom'], [], 'It was not summoned so much as noticed. Something this old resents being seen.'),
  spell('coven-transfix', 'Transfix', 3, 'rare', [freeze('enemyCreature'), buff(-1, -1, 'enemyCreature', -1)], 'The winter hex slows blood and stills breath, leaving motion a fading memory. The cold takes what it touches and keeps it.'),
  spell('coven-mirrorhex', 'Mirror Hex', 5, 'rare', [buff(-4, -4, 'enemyCreature', -2)], 'See yourself as the coven sees you — small, fading, already forgotten. The looking glass makes the curse fourfold.'),
  spell('coven-veil', 'Veil of Night', 6, 'rare', [draw(3), dmg(1, 'self')], 'Beneath the veil, secrets surface like drowned things. The price of sight is a sliver of self.'),
  // Epics (3)
  spell('coven-apathy', 'Apathy', 7, 'epic', [buff(-3, -3, 'allEnemyCreatures', -2)], 'The cruellest hex is not hatred but indifference. Fists uncurl, shields lower, and the battle simply ends.'),
  spell('coven-glare', "Morwenna's Glare", 8, 'epic', [destroy('enemyCreature'), buff(-1, -1, 'allEnemyCreatures', -1)], "Some curses are spoken; others are merely looked at. Morwenna's glare is a death sentence with no appeal."),
  creature('coven-abyss', 'Abyssal Gaze', 9, 8, 7, 9, 'epic', [], [{ when: 'battlecry', effects: [buff(-2, -2, 'enemyCreature', -1)] }], 'Staring into it is not the danger. The danger is that it stares back and remembers your face.'),
  // Legendaries (2)
  creature('coven-queen', 'The Hex Queen', 10, 7, 9, 10, 'legendary', [], [{ when: 'battlecry', effects: [buff(-2, -2, 'allEnemyCreatures', -1)] }], 'Morwenna Hex, sovereign of the night coven, whose throne is a circle of fading candles. When she is crowned, the whole world begins to wither.'),
  artifact('coven-eternal', 'Eternal Night', 7, 'legendary', [{ when: 'startOfTurn', effects: [buff(-1, -1, 'allEnemyCreatures', -1)] }], 'An hourglass of black glass that never empties. While it turns, the sun remains only a rumor.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['coven-whisper', 3], ['coven-hex', 3], ['coven-curse', 3], ['coven-familiar', 3],
    ['coven-wither', 3], ['coven-bog', 3], ['coven-doom', 3], ['coven-nightmare', 3],
    ['coven-raven', 3], ['coven-scare', 3], ['coven-drain', 3],
    ['coven-decay', 2], ['coven-eldritch', 2], ['coven-transfix', 2],
    ['coven-mirrorhex', 2], ['coven-veil', 2],
    ['coven-apathy', 1], ['coven-glare', 1], ['coven-abyss', 1],
    ['coven-queen', 1], ['coven-eternal', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll',
    'neutral-rite', 'neutral-light', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-colossus', 'neutral-frostbind',
  ],
};
