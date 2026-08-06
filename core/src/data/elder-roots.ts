import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Elder Roots (Task 15): Oldroot's ramp deck — gainMana adds EMPTY crystals
 * (Task 6 contract: maxMana rises, current mana unchanged). Signature cards
 * use the 'nature' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const ROOTS_PALETTE = ['#0d2818', '#7fd66b'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'nature', palette: ROOTS_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'roots',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'roots',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'roots',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number): EffectSpec => ({ kind: 'heal', value, target: 'hero' });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const gainMana = (value: number): EffectSpec => ({ kind: 'gainMana', value });
const summon = (cardId: string, value?: number): EffectSpec => ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

export const HERO: HeroSpec = {
  name: 'Oldroot',
  power: { name: 'Roots of the World', cost: 2, effects: [gainMana(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('roots-sapling', 'Sapling', 1, 1, 2, 'common'),
  spell('roots-grow', 'Grow', 1, 'common', [gainMana(1)]),
  spell('roots-vine', 'Vine Snare', 2, 'common', [dmg(1, 'anyCreature')]),
  creature('roots-sprout', 'Sprout', 2, 2, 2, 'common'),
  spell('roots-bloom', 'Bloom', 3, 'common', [gainMana(2)]),
  creature('roots-barkhide', 'Barkhide', 3, 2, 4, 'common', ['taunt']),
  creature('roots-forager', 'Forager', 3, 3, 3, 'common'),
  spell('roots-thorn', 'Thorn Barrage', 4, 'common', [dmg(3, 'anyCreature')]),
  creature('roots-ancients', "Ancient's Wrath", 4, 4, 4, 'common'),
  artifact('roots-sylvan', 'Sylvan Grove', 5, 'common', [{ when: 'startOfTurn', effects: [gainMana(1)] }]),
  creature('roots-ironwood', 'Ironwood', 5, 4, 6, 'common', ['taunt']),
  // Rares (5)
  spell('roots-regen', 'Regrowth', 3, 'rare', [heal(4)]),
  creature('roots-worldtree', 'Worldtree Sapling', 6, 5, 5, 'rare', [], [{ when: 'battlecry', effects: [gainMana(2)] }]),
  spell('roots-verdant', 'Verdant Bloom', 6, 'rare', [gainMana(3)]),
  creature('roots-treant', 'Elder Treant', 7, 7, 7, 'rare'),
  spell('roots-bounty', "Nature's Bounty", 5, 'rare', [draw(2)]),
  // Epics (3)
  creature('roots-goliath', 'Goliath', 8, 8, 8, 'epic'),
  spell('roots-awaken', 'Awakening', 8, 'epic', [gainMana(4)]),
  creature('roots-titan', 'Titan of the Deep Roots', 10, 10, 10, 'epic', ['taunt']),
  // Legendaries (2)
  creature('roots-worldmother', 'Worldmother', 12, 12, 12, 'legendary'),
  artifact('roots-heart', 'Heart of the Forest', 7, 'legendary', [{ when: 'endOfTurn', effects: [summon('token-treant')] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['roots-sapling', 3], ['roots-grow', 3], ['roots-vine', 3], ['roots-sprout', 3],
    ['roots-bloom', 3], ['roots-barkhide', 3], ['roots-forager', 3], ['roots-thorn', 3],
    ['roots-ancients', 3], ['roots-sylvan', 3], ['roots-ironwood', 3],
    ['roots-regen', 2], ['roots-worldtree', 2], ['roots-verdant', 2],
    ['roots-treant', 2], ['roots-bounty', 2],
    ['roots-goliath', 1], ['roots-awaken', 1], ['roots-titan', 1],
    ['roots-worldmother', 1], ['roots-heart', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-light', 'neutral-sentinel', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-colossus', 'neutral-idol',
  ],
};
