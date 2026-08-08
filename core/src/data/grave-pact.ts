import type { Card, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, buff, destroy, dmg, draw, heal } from './builders.js';

/**
 * Grave Pact (Task 16): Morticia Gravefall's self-damage / draw-engine deck.
 * Signature cards use the 'void' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const PACT_PALETTE = ['#150e1e', '#a06bff'];

const { artifact, creature, spell } = archetypeCards('void', PACT_PALETTE, 'pact');

export const HERO: HeroSpec = {
  name: 'Morticia Gravefall',
  power: { name: 'Blood Toll', cost: 2, effects: [dmg(1, 'self'), draw(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('pact-bloodrite', 'Bloodrite', 1, 'common', [dmg(1, 'self'), draw(1)], 'A single drop of blood buys a glimpse of what is to come. The pact always answers.'),
  spell('pact-thirst', 'Blood Thirst', 1, 'common', [dmg(2, 'anyCreature')], 'An old thirst, older than the pact itself, that answers to the smell of open flesh.'),
  spell('pact-sacrifice', 'Sacrifice', 2, 'common', [destroy('friendlyCreature'), draw(2)], 'The ledger demands its due. A creature pays early so its master may see two cards deeper.'),
  creature('pact-imp', 'Blood Imp', 2, 3, 2, 'common', [], [], 'Small, sharp, and eager to be repaid in pain.'),
  creature('pact-leech', 'Leech', 2, 2, 2, 'common', ['lifesteal'], [], 'It drinks deeply, and the wound closes on the other side of the bargain.'),
  spell('pact-bond', 'Blood Bond', 3, 'common', [buff(3, 3, 'friendlyCreature'), dmg(2, 'self')], 'Two hearts beat as one; the second pays for the first’s strength.'),
  creature('pact-masochist', 'Masochist', 3, 3, 4, 'common', [], [{ when: 'onDamage', effects: [draw(1)] }], 'Pain is a language, and the Masochist is fluent. Every wound is a whispered word of power.'),
  creature('pact-ravager', 'Ravager', 4, 5, 3, 'common', [], [{ when: 'battlecry', effects: [dmg(2, 'self'), draw(1)] }], 'It spends its own flesh as recklessly as it spends the enemy’s.'),
  spell('pact-lifeleech', 'Life Leech', 4, 'common', [dmg(3, 'enemyCreature'), heal(3)], 'What it drinks from the enemy, it pours back into its master.'),
  creature('pact-cultist', 'Cultist', 4, 4, 4, 'common', [], [{ when: 'deathrattle', effects: [draw(1)] }], 'Every scar is a promise kept. The pact remembers each one.'),
  spell('pact-hemorrhage', 'Hemorrhage', 5, 'common', [dmg(5, 'any')], 'Blood reaches the floor faster than mercy ever will.'),
  // Rares (5)
  spell('pact-darkpact', 'Dark Pact', 3, 'rare', [destroy('friendlyCreature'), draw(2)], 'Some contracts are sealed with a creature’s final breath.'),
  spell('pact-torment', 'Torment', 5, 'rare', [dmg(3, 'allEnemies'), dmg(2, 'self')], 'Torment does not spare its bearer; it only shares the pain around.'),
  creature('pact-fiend', 'Fiend', 5, 6, 4, 'rare', [], [{ when: 'battlecry', effects: [dmg(2, 'self'), draw(2)] }], 'Bound by blood and kept by suffering, it bites the hand that feeds it — then asks for more.'),
  spell('pact-bargain', 'Bargain', 6, 'rare', [dmg(4, 'self'), { kind: 'refillMana', value: 4 }], 'Life is the only coin the pact accepts. Four drops buy four favors.'),
  creature('pact-dread', 'Dreadknight', 6, 6, 6, 'rare', [], [{ when: 'battlecry', effects: [dmg(2, 'self'), { kind: 'refillMana', value: 2 }] }], 'It rides at the head of the procession every pact eventually joins.'),
  // Epics (3)
  spell('pact-mirror', 'Mirror of Blood', 7, 'epic', [dmg(7, 'randomEnemy'), dmg(3, 'self')], 'The mirror shows your enemy’s face — and charges you for the looking.'),
  spell('pact-ascend', 'Ascension', 8, 'epic', [{ kind: 'gainMana', value: 3 }, draw(3), dmg(5, 'self')], 'Every step upward is bought with a piece of what you were.'),
  creature('pact-lord', 'Lord of the Pact', 8, 8, 8, 'epic', [], [{ when: 'startOfTurn', effects: [dmg(1, 'self'), draw(1)] }], 'The Lord wrote the first clause in his own blood, and has been paying for it ever since.'),
  // Legendaries (2)
  creature('pact-morticia', 'Morticia Gravefall', 9, 7, 9, 'legendary', [], [{ when: 'battlecry', effects: [dmg(3, 'self'), dmg(3, 'allEnemies')] }], 'Morticia Gravefall pays the blood toll herself — and the field answers in kind.'),
  artifact('pact-immortal', 'Immortal Bargain', 6, 'legendary', [{ when: 'startOfTurn', effects: [dmg(1, 'self'), draw(1)] }], 'The bargain is simple: a little of you, every day, forever.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['pact-bloodrite', 3], ['pact-thirst', 3], ['pact-sacrifice', 3], ['pact-imp', 3],
    ['pact-leech', 3], ['pact-bond', 3], ['pact-masochist', 3], ['pact-ravager', 3],
    ['pact-lifeleech', 3], ['pact-cultist', 3], ['pact-hemorrhage', 3],
    ['pact-darkpact', 2], ['pact-torment', 2], ['pact-fiend', 2],
    ['pact-bargain', 2], ['pact-dread', 2],
    ['pact-mirror', 1], ['pact-ascend', 1], ['pact-lord', 1],
    ['pact-morticia', 1], ['pact-immortal', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-scroll', 'neutral-rite', 'neutral-crack',
    'neutral-frostbind', 'neutral-lance', 'neutral-banner', 'neutral-execute', 'neutral-soulmirror',
    'neutral-ogre', 'neutral-idol',
  ],
};
