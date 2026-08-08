import type { Card, EffectSpec, EffectTarget, HeroSpec } from '../types.js';
import type { DeckDef } from './index.js';
import { archetypeCards, destroy, dmg, draw, heal, summon } from './builders.js';

/** Judgment removal (choir identity): strip keywords/triggers from a chosen
 *  enemy creature. Requires a target — the Praetor is unplayable while the
 *  enemy board is empty, matching targeted-battlecry rulings. */
const silence = (target: EffectTarget): EffectSpec => ({ kind: 'silence', target });

/**
 * Hollow Choir (Task 14): Vespera Dawnlight's attrition/heal deck. Signature
 * cards use the 'frost' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const CHOIR_PALETTE = ['#0e1f3a', '#7fd4ff'];

const { artifact, creature, spell } = archetypeCards('frost', CHOIR_PALETTE, 'choir');

export const HERO: HeroSpec = {
  name: 'Vespera Dawnlight',
  power: { name: 'Lullaby', cost: 2, effects: [heal(2)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('choir-acolyte', 'Acolyte', 1, 1, 2, 'common', [], [{ when: 'battlecry', effects: [heal(2)] }], 'She lights every candle in the chapel before dawn, whispering the names the choir has forgotten.'),
  spell('choir-mend', 'Mend', 1, 'common', [heal(3, 'any')], 'Where the lament is sung, torn flesh knits and spent breath returns.'),
  creature('choir-sergeant', 'Sergeant of the Pale', 2, 2, 3, 'common', ['ward'], [], 'He has stood guard since the bells first tolled, and he will stand guard after the last echo dies.'),
  spell('choir-candle', 'Candlelight', 2, 'common', [{ kind: 'discover' }, heal(2)], 'One flame for the living, one for the dead, and one to find the way home.'),
  spell('choir-smite', 'Smite', 2, 'common', [dmg(2, 'enemyCreature')], 'The choir does not argue with the condemned; it strikes, and the pale light remembers why.'),
  creature('choir-warden', 'Warden', 3, 2, 4, 'common', ['taunt'], [], 'The gate of the pale cathedral has no lock. It has him.'),
  spell('choir-chant', 'Chant of Rest', 3, 'common', [heal(5)], 'Sleep is the choir\u2019s oldest hymn, and the dead sing it best.'),
  creature('choir-praetor', 'Praetor', 4, 3, 5, 'common', [], [{ when: 'battlecry', effects: [silence('enemyCreature')] }], 'He keeps the choir\u2019s ledger in cold iron, and every debt is paid in kind.'),
  spell('choir-banish', 'Banish', 4, 'common', [destroy('enemyCreature')], 'The pale doors open once more, and the condemned walk through of their own accord.'),
  spell('choir-clear', 'Cleansing Light', 4, 'common', [dmg(2, 'allEnemyCreatures')], 'The light does not forgive. It removes, and what it removes is not remembered.'),
  creature('choir-luminarch', 'Luminarch', 5, 4, 6, 'common', [], [{ when: 'battlecry', effects: [draw(1)] }], 'The tallest candle burns coldest, and its shadow is the whole cathedral.'),
  // Rares (5)
  spell('choir-revelation', 'Revelation', 4, 'rare', [draw(3)], 'What the choir knows, it knows slowly \u2014 all at once, and without mercy.'),
  creature('choir-seraph', 'Seraph of Lament', 6, 5, 6, 'rare', ['lifesteal'], [], 'She weeps for the wounded, and every wound she deals she carries home like a hymn.'),
  spell('choir-verdict', 'Final Verdict', 8, 'rare', [destroy('enemyCreature'), heal(5)], 'When the last hymn ends, judgment does not wait for appeals.'),
  creature('choir-martyr', 'Martyr', 5, 3, 5, 'rare', [], [{ when: 'deathrattle', effects: [heal(5)] }], 'She spends herself so that others may sing another verse.'),
  artifact('choir-sanctum', 'Sanctum of Echoes', 5, 'rare', [{ when: 'startOfTurn', effects: [draw(1)] }], 'Every prayer ever spoken still hangs in this hall, waiting to be heard again.'),
  // Epics (3)
  creature('choir-exorcist', 'Exorcist', 6, 4, 7, 'epic', [], [{ when: 'battlecry', effects: [destroy('enemyCreature')] }], 'He has cast out worse than you, and he remembers them all by name.'),
  spell('choir-truth', 'Truth Unveiled', 6, 'epic', [draw(4), heal(4)], 'The veil was never meant to hold. It was only ever meant to delay.'),
  creature('choir-lightbringer', 'Lightbringer', 7, 6, 8, 'epic', ['taunt'], [], 'He bears the light not because it is his, but because it is needed.'),
  // Legendaries (2)
  creature('choir-lady', 'Lady of the Pale Choir', 9, 6, 8, 'legendary', ['taunt'], [{ when: 'startOfTurn', effects: [heal(4)] }], 'The choir began as her lament, and it will end the same way \u2014 softly, and only when she wills it.'),
  artifact('choir-mirror', 'Mirror of Souls', 6, 'legendary', [{ when: 'endOfTurn', effects: [summon('token-wisp')] }], 'Every soul the mirror keeps is a note the choir has not yet sung.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['choir-acolyte', 3], ['choir-mend', 3], ['choir-sergeant', 3], ['choir-candle', 3],
    ['choir-smite', 3], ['choir-warden', 3], ['choir-chant', 3], ['choir-praetor', 3],
    ['choir-banish', 3], ['choir-clear', 3], ['choir-luminarch', 3],
    ['choir-revelation', 2], ['choir-seraph', 2], ['choir-verdict', 2],
    ['choir-martyr', 2], ['choir-sanctum', 2],
    ['choir-exorcist', 1], ['choir-truth', 1], ['choir-lightbringer', 1],
    ['choir-lady', 1], ['choir-mirror', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-light', 'neutral-sentinel', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-titan', 'neutral-relic',
  ],
};
