import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Hollow Choir (Task 14): Vespera Dawnlight's attrition/heal deck. Signature
 * cards use the 'frost' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const CHOIR_PALETTE = ['#0e1f3a', '#7fd4ff'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'frost', palette: CHOIR_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'choir',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'choir',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'choir',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number): EffectSpec => ({ kind: 'heal', value, target: 'hero' });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const destroy = (): EffectSpec => ({ kind: 'destroy', target: 'enemyCreature' });
const summon = (cardId: string): EffectSpec => ({ kind: 'summon', cardId });

export const HERO: HeroSpec = {
  name: 'Vespera Dawnlight',
  power: { name: 'Lullaby', cost: 2, effects: [heal(2)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('choir-acolyte', 'Acolyte', 1, 1, 2, 'common'),
  spell('choir-mend', 'Mend', 1, 'common', [{ kind: 'heal', value: 3, target: 'any' }]),
  creature('choir-sergeant', 'Sergeant of the Pale', 2, 2, 3, 'common'),
  spell('choir-candle', 'Candlelight', 2, 'common', [draw(1), heal(2)]),
  spell('choir-smite', 'Smite', 2, 'common', [dmg(2, 'enemyCreature')]),
  creature('choir-warden', 'Warden', 3, 2, 4, 'common', ['taunt']),
  spell('choir-chant', 'Chant of Rest', 3, 'common', [heal(5)]),
  creature('choir-praetor', 'Praetor', 4, 3, 5, 'common'),
  spell('choir-banish', 'Banish', 4, 'common', [destroy()]),
  spell('choir-clear', 'Cleansing Light', 4, 'common', [dmg(2, 'allEnemyCreatures')]),
  creature('choir-luminarch', 'Luminarch', 5, 4, 5, 'common'),
  // Rares (5)
  spell('choir-revelation', 'Revelation', 4, 'rare', [draw(3)]),
  creature('choir-seraph', 'Seraph of Lament', 6, 4, 6, 'rare', ['lifesteal']),
  spell('choir-verdict', 'Final Verdict', 8, 'rare', [destroy(), heal(5)]),
  creature('choir-martyr', 'Martyr', 5, 3, 5, 'rare', [], [{ when: 'deathrattle', effects: [heal(5)] }]),
  artifact('choir-sanctum', 'Sanctum of Echoes', 5, 'rare', [{ when: 'startOfTurn', effects: [draw(1)] }]),
  // Epics (3)
  creature('choir-exorcist', 'Exorcist', 6, 4, 7, 'epic', [], [{ when: 'battlecry', effects: [destroy()] }]),
  spell('choir-truth', 'Truth Unveiled', 8, 'epic', [draw(4)]),
  creature('choir-lightbringer', 'Lightbringer', 7, 5, 7, 'epic', ['taunt']),
  // Legendaries (2)
  creature('choir-lady', 'Lady of the Pale Choir', 9, 6, 8, 'legendary', ['taunt'], [{ when: 'startOfTurn', effects: [heal(4)] }]),
  artifact('choir-mirror', 'Mirror of Souls', 6, 'legendary', [{ when: 'endOfTurn', effects: [summon('token-wisp')] }]),
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
