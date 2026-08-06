import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Bone Horde (Task 16): Baron Von Bone's skeleton token swarm. Signature
 * cards use the 'bone' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const BONE_PALETTE = ['#221a12', '#e6c98f'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'bone', palette: BONE_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'bone',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'bone',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const summon = (cardId: string, value?: number): EffectSpec => ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

export const HERO: HeroSpec = {
  name: 'Baron Von Bone',
  power: { name: 'Raise Skeleton', cost: 2, effects: [summon('token-skeleton')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('bone-clatter', 'Clatter', 1, 'common', [summon('token-skeleton')]),
  creature('bone-scrapper', 'Scrapper', 1, 1, 2, 'common'),
  spell('bone-gnaw', 'Gnaw', 2, 'common', [dmg(2, 'anyCreature')]),
  creature('bone-marauder', 'Marauder', 2, 3, 1, 'common'),
  creature('bone-gravedigger', 'Gravedigger', 2, 2, 2, 'common', [], [{ when: 'deathrattle', effects: [summon('token-skeleton')] }]),
  creature('bone-cairn', 'Cairn', 3, 0, 4, 'common', ['taunt'], [{ when: 'deathrattle', effects: [summon('token-skeleton')] }]),
  spell('bone-frenzy', 'Bone Frenzy', 3, 'common', [buff(1, 1, 'allFriendlyCreatures')]),
  creature('bone-raider', 'Raider', 3, 3, 3, 'common'),
  spell('bone-rattle', 'Rattle', 4, 'common', [dmg(2, 'allEnemies')]),
  creature('bone-skull', 'Skull Wall', 4, 2, 5, 'common', ['taunt']),
  spell('bone-howl', 'Howl', 4, 'common', [summon('token-skeleton', 2)]),
  // Rares (5)
  creature('bone-necromancer', 'Necromancer', 5, 3, 4, 'rare', [], [{ when: 'startOfTurn', effects: [summon('token-skeleton')] }]),
  spell('bone-legion', 'Legion Call', 5, 'rare', [summon('token-skeleton', 3)]),
  spell('bone-horde', 'Bone Horde', 6, 'rare', [summon('token-skeleton', 4)]),
  creature('bone-warlord', 'Warlord', 6, 5, 5, 'rare'),
  creature('bone-behemoth', 'Behemoth', 7, 7, 7, 'rare', ['taunt']),
  // Epics (3)
  creature('bone-whisper', 'Whisperer', 5, 3, 6, 'epic', [], [{ when: 'endOfTurn', effects: [summon('token-skeleton')] }]),
  spell('bone-cataclysm', 'Cataclysm', 8, 'epic', [dmg(3, 'allEnemies')]),
  creature('bone-overlord', 'Overlord', 9, 8, 8, 'epic'),
  // Legendaries (2)
  creature('bone-king', 'The Bone King', 10, 8, 10, 'legendary', ['taunt'], [{ when: 'deathrattle', effects: [summon('token-skeleton', 3)] }]),
  spell('bone-army', 'Risen Army', 7, 'legendary', [summon('token-skeleton', 6)]),
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
