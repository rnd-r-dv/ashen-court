import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Vermin Swarm (Task 14): Rat King Moulder's token flood deck. Signature
 * cards use the 'nature' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const VERMIN_PALETTE = ['#14201a', '#8fd14f'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'nature', palette: VERMIN_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'vermin',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'vermin',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const summon = (cardId: string, value?: number): EffectSpec => ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

export const HERO: HeroSpec = {
  name: 'Rat King Moulder',
  power: { name: 'Rat Call', cost: 2, effects: [summon('token-rat')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('vermin-squeaker', 'Squeaker', 1, 1, 1, 'common'),
  spell('vermin-nibble', 'Nibble', 1, 'common', [dmg(1, 'anyCreature')]),
  creature('vermin-scavenger', 'Scavenger', 1, 2, 1, 'common'),
  spell('vermin-packcall', 'Pack Call', 2, 'common', [summon('token-rat', 2)]),
  creature('vermin-brute', 'Mangy Brute', 2, 3, 2, 'common'),
  creature('vermin-swarmlord', 'Swarmlord', 3, 2, 4, 'common'),
  spell('vermin-frenzy', 'Frenzy', 3, 'common', [{ kind: 'buff', value: 2, value2: 0, target: 'allFriendlyCreatures' }]),
  creature('vermin-gnawer', 'Gnawer', 3, 3, 3, 'common'),
  spell('vermin-army', 'Vermin Army', 4, 'common', [summon('token-rat', 3)]),
  creature('vermin-warband', 'Warband', 4, 4, 3, 'common'),
  spell('vermin-pestilence', 'Pestilence', 5, 'common', [dmg(2, 'allEnemyCreatures')]),
  // Rares (5)
  creature('vermin-alpha', 'Alpha Rat', 4, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [{ kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }] }]),
  creature('vermin-breeder', 'Breeder', 5, 3, 4, 'rare', [], [{ when: 'endOfTurn', effects: [summon('token-rat')] }]),
  creature('vermin-plaguemaster', 'Plaguemaster', 5, 3, 5, 'rare', [], [{ when: 'deathrattle', effects: [summon('token-rat', 2)] }]),
  spell('vermin-tide', 'The Tide of Teeth', 6, 'rare', [summon('token-rat', 4)]),
  creature('vermin-queen', 'Queen Moulder', 6, 4, 6, 'rare', [], [{ when: 'startOfTurn', effects: [summon('token-rat')] }]),
  // Epics (3)
  spell('vermin-carrion', 'Carrion Call', 4, 'epic', [summon('token-rat', 2)]),
  spell('vermin-horde', 'The Horde', 7, 'epic', [summon('token-rat', 6)]),
  creature('vermin-rattus', 'Rattus the God', 8, 8, 8, 'epic', ['taunt']),
  // Legendaries (2)
  creature('vermin-plagueking', 'Plague King', 7, 6, 6, 'legendary', [], [{ when: 'startOfTurn', effects: [summon('token-rat', 2)] }]),
  spell('vermin-endless', 'The Endless Swarm', 9, 'legendary', [summon('token-rat', 9)]),
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
