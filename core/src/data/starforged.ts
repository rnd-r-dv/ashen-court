import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Starforged (Task 17): Archon Stellara's star-tempo deck. Signature cards
 * use the 'star' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const STAR_PALETTE = ['#141430', '#ffe9a8'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'star', palette: STAR_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'star',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'star',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const gainMana = (value: number): EffectSpec => ({ kind: 'gainMana', value });
const discCheap = (value: number): EffectSpec => ({ kind: 'discountCheapest', value });

export const HERO: HeroSpec = {
  name: 'Archon Stellara',
  power: { name: 'Star Rite', cost: 2, effects: [discCheap(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('star-spark', 'Spark', 1, 'common', [dmg(2, 'anyCreature')]),
  spell('star-meteor', 'Meteor Shard', 2, 'common', [dmg(3, 'enemyCreature')]),
  creature('star-acolyte', 'Star Acolyte', 2, 2, 3, 'common'),
  spell('star-meditate', 'Meditate', 2, 'common', [draw(1), gainMana(1)]),
  spell('star-focus', 'Star Focus', 3, 'common', [gainMana(2)]),
  creature('star-guardian', 'Guardian', 3, 2, 4, 'common', ['taunt']),
  creature('star-sentinel', 'Sentinel', 4, 3, 5, 'common'),
  spell('star-comet', 'Comet', 4, 'common', [dmg(4, 'enemyCreature')]),
  spell('star-gravitate', 'Gravitate', 5, 'common', [dmg(3, 'allEnemies')]),
  creature('star-mage', 'Starmage', 5, 4, 5, 'common'),
  spell('star-fall', 'Starfall', 6, 'common', [dmg(6, 'any')]),
  // Rares (5)
  creature('star-prophet', 'Prophet', 4, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [discCheap(1)] }]),
  creature('star-oracle', 'Oracle', 5, 3, 4, 'rare', [], [{ when: 'battlecry', effects: [discCheap(1)] }]),
  spell('star-chorus', 'Celestial Chorus', 6, 'rare', [draw(2), gainMana(1)]),
  creature('star-giant', 'Star Giant', 7, 7, 7, 'rare'),
  spell('star-eclipse', 'Eclipse', 7, 'rare', [dmg(7, 'any')]),
  // Epics (3)
  creature('star-wanderer', 'Wanderer', 8, 8, 8, 'epic'),
  spell('star-void', 'Chorus of the Void', 9, 'epic', [dmg(9, 'any')]),
  creature('star-megastar', 'Megastar', 10, 10, 10, 'epic'),
  // Legendaries (2)
  creature('star-archon', 'Archon Stellara', 12, 12, 12, 'legendary'),
  creature('star-constellation', 'Living Constellation', 8, 7, 7, 'legendary', [], [{ when: 'battlecry', effects: [discCheap(2)] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['star-spark', 3], ['star-meteor', 3], ['star-acolyte', 3], ['star-meditate', 3],
    ['star-focus', 3], ['star-guardian', 3], ['star-sentinel', 3], ['star-comet', 3],
    ['star-gravitate', 3], ['star-mage', 3], ['star-fall', 3],
    ['star-prophet', 2], ['star-oracle', 2], ['star-chorus', 2],
    ['star-giant', 2], ['star-eclipse', 2],
    ['star-wanderer', 1], ['star-void', 1], ['star-megastar', 1],
    ['star-archon', 1], ['star-constellation', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll',
    'neutral-rite', 'neutral-light', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-idol', 'neutral-colossus',
  ],
};
