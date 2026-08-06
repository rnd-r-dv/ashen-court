import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Dragonflight (Task 15): Seraphina Skywing's dragon-tempo deck. Signature
 * cards use the 'dragon' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const DRAGON_PALETTE = ['#1a1f3a', '#c9a227'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'dragon', palette: DRAGON_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'dragon',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'dragon',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'dragon',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const summon = (cardId: string, value?: number): EffectSpec => ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

export const HERO: HeroSpec = {
  name: 'Seraphina Skywing',
  power: { name: "Dragon's Boon", cost: 2, effects: [buff(1, 1, 'friendlyDragon')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('dragon-whelp', 'Dragon Whelp', 1, 1, 2, 'common'),
  creature('dragon-scaleglider', 'Scaleglider', 2, 2, 3, 'common'),
  spell('dragon-wingmen', 'Wingmen', 2, 'common', [buff(2, 2, 'friendlyDragon')]),
  spell('dragon-snout', 'Wyrm Snout', 2, 'common', [dmg(2, 'anyCreature')]),
  creature('dragon-hunter', 'Sky Hunter', 3, 3, 3, 'common', ['rush']),
  creature('dragon-roost', 'Roost Guardian', 3, 2, 4, 'common', ['taunt']),
  spell('dragon-claw', 'Claw Sweep', 3, 'common', [dmg(3, 'allEnemyCreatures')]),
  creature('dragon-hatchling', 'Hatchling', 3, 3, 2, 'common'),
  creature('dragon-elderscale', 'Elderscale', 4, 3, 5, 'common', ['taunt']),
  spell('dragon-swoop', 'Swoop', 4, 'common', [dmg(4, 'enemyCreature')]),
  creature('dragon-drakeling', 'Drakeling', 5, 4, 4, 'common'),
  // Rares (5)
  creature('dragon-matriarch', 'Matriarch', 5, 4, 5, 'rare', [], [{ when: 'battlecry', effects: [buff(1, 1, 'allFriendlyCreatures')] }]),
  creature('dragon-seer', 'Seer', 4, 2, 5, 'rare', [], [{ when: 'endOfTurn', effects: [draw(1)] }]),
  spell('dragon-flight', 'Flight of Dragons', 6, 'rare', [summon('token-dragon-whelp', 2)]),
  creature('dragon-warden', 'Warden of Skies', 6, 5, 5, 'rare', ['taunt']),
  creature('dragon-prince', 'Prince of Scales', 7, 5, 6, 'rare'),
  // Epics (3)
  artifact('dragon-council', 'Sky Council', 7, 'epic', [{ when: 'startOfTurn', effects: [buff(1, 1, 'friendlyDragon')] }]),
  spell('dragon-storm', 'Dragonstorm', 8, 'epic', [summon('token-dragon-whelp', 3)]),
  creature('dragon-tyrant', 'Wyrm Tyrant', 8, 8, 6, 'epic'),
  // Legendaries (2)
  creature('dragon-worldeater', 'Worldeater', 10, 10, 10, 'legendary', ['taunt']),
  creature('dragon-celestial', 'Celestial Skywing', 6, 4, 4, 'legendary', ['windfury'], [{ when: 'battlecry', effects: [buff(1, 1, 'allFriendlyCreatures')] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['dragon-whelp', 3], ['dragon-scaleglider', 3], ['dragon-wingmen', 3], ['dragon-snout', 3],
    ['dragon-hunter', 3], ['dragon-roost', 3], ['dragon-claw', 3], ['dragon-hatchling', 3],
    ['dragon-elderscale', 3], ['dragon-swoop', 3], ['dragon-drakeling', 3],
    ['dragon-matriarch', 2], ['dragon-seer', 2], ['dragon-flight', 2],
    ['dragon-warden', 2], ['dragon-prince', 2],
    ['dragon-council', 1], ['dragon-storm', 1], ['dragon-tyrant', 1],
    ['dragon-worldeater', 1], ['dragon-celestial', 1],
  ],
  neutrals: [
    'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-bear', 'neutral-knight', 'neutral-banner', 'neutral-frostbind', 'neutral-ogre',
    'neutral-colossus', 'neutral-titan',
  ],
};
