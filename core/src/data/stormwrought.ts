import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Stormwrought (Task 17): Zephyra Stormveil's storm-tempo deck. Signature
 * cards use the 'storm' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts
 * arcaneArt).
 */
const STORM_PALETTE = ['#1c2b3a', '#7fb2e5'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'storm', palette: STORM_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'storm',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'storm',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'storm',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const discSpell = (value: number): EffectSpec => ({ kind: 'discountNextSpell', value });

export const HERO: HeroSpec = {
  name: 'Zephyra Stormveil',
  power: { name: 'Static', cost: 2, effects: [discSpell(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('storm-arc', 'Arc', 1, 'common', [dmg(2, 'anyCreature')]),
  spell('storm-bolt', 'Bolt', 2, 'common', [dmg(3, 'any')]),
  creature('storm-adept', 'Adept', 2, 2, 2, 'common'),
  spell('storm-charge', 'Storm Charge', 2, 'common', [buff(2, 2, 'friendlyCreature')]),
  creature('storm-emberwitch', 'Emberwitch', 3, 3, 2, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }]),
  spell('storm-squall', 'Squall', 3, 'common', [dmg(2, 'allEnemies')]),
  creature('storm-rider', 'Storm Rider', 4, 4, 3, 'common', ['rush']),
  spell('storm-gust', 'Gust', 4, 'common', [dmg(4, 'enemyCreature')]),
  creature('storm-sorcerer', 'Sorcerer', 4, 3, 4, 'common'),
  spell('storm-downpour', 'Downpour', 5, 'common', [dmg(3, 'allEnemies')]),
  spell('storm-cyclone', 'Cyclone', 6, 'common', [dmg(6, 'any')]),
  // Rares (5)
  creature('storm-mistweaver', 'Mistweaver', 4, 3, 3, 'rare', [], [{ when: 'battlecry', effects: [discSpell(1)] }]),
  spell('storm-echoes', 'Echoes', 5, 'rare', [draw(2), dmg(1, 'allEnemies')]),
  creature('storm-stormcaller', 'Stormcaller', 6, 5, 5, 'rare'),
  creature('storm-leviathan', 'Leviathan', 7, 7, 7, 'rare'),
  spell('storm-eye', 'Eye of the Storm', 7, 'rare', [dmg(4, 'allEnemies'), draw(1)]),
  // Epics (3)
  spell('storm-tempest', 'Tempest', 8, 'epic', [dmg(5, 'allEnemies')]),
  creature('storm-siren', 'Siren', 5, 4, 4, 'epic', [], [{ when: 'battlecry', effects: [discSpell(1)] }]),
  creature('storm-thunderhead', 'Thunderhead', 9, 9, 9, 'epic'),
  // Legendaries (2)
  creature('storm-zephyra', 'Zephyra', 10, 8, 8, 'legendary', ['windfury']),
  artifact('storm-boreas', 'Boreas, Eye of the Storm', 8, 'legendary', [{ when: 'startOfTurn', effects: [dmg(2, 'randomEnemy'), draw(1)] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['storm-arc', 3], ['storm-bolt', 3], ['storm-adept', 3], ['storm-charge', 3],
    ['storm-emberwitch', 3], ['storm-squall', 3], ['storm-rider', 3], ['storm-gust', 3],
    ['storm-sorcerer', 3], ['storm-downpour', 3], ['storm-cyclone', 3],
    ['storm-mistweaver', 2], ['storm-echoes', 2], ['storm-stormcaller', 2],
    ['storm-leviathan', 2], ['storm-eye', 2],
    ['storm-tempest', 1], ['storm-siren', 1], ['storm-thunderhead', 1],
    ['storm-zephyra', 1], ['storm-boreas', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-swift', 'neutral-scroll', 'neutral-rite',
    'neutral-crack', 'neutral-frostbind', 'neutral-lance', 'neutral-banner', 'neutral-execute',
    'neutral-ogre', 'neutral-soulmirror',
  ],
};
