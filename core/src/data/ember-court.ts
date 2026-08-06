import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Ember Court (Task 14): Pyra Emberveil's burn-tempo deck. Signature cards use
 * the 'ember' art preset (Forge mapping, Task 26 owns the canonical palette;
 * this is a placeholder dark-fantasy 2-color palette). Art seed = FNV-1a hash
 * of the card id (same scheme as tokens.ts arcaneArt).
 */
const EMBER_PALETTE = ['#3b0d0d', '#ff6b35'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'ember', palette: EMBER_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'ember',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'ember',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'ember',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number): EffectSpec => ({ kind: 'heal', value, target: 'hero' });
const summon = (cardId: string): EffectSpec => ({ kind: 'summon', cardId });

export const HERO: HeroSpec = {
  name: 'Pyra Emberveil',
  power: { name: 'Ember Bolt', cost: 2, effects: [dmg(1, 'any')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('ember-cinderling', 'Cinderling', 1, 2, 1, 'common'),
  creature('ember-sparkmage', 'Sparkmage', 1, 1, 1, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }]),
  spell('ember-bolt', 'Ember Bolt', 1, 'common', [dmg(2, 'any')]),
  creature('ember-ashhunter', 'Ash Hunter', 2, 2, 2, 'common'),
  spell('ember-searing', 'Searing Wave', 2, 'common', [dmg(1, 'allEnemies')]),
  creature('ember-flamewhelp', 'Flamewhelp', 2, 2, 1, 'common', ['rush']),
  spell('ember-blast', 'Blast', 3, 'common', [dmg(4, 'any')]),
  creature('ember-firebrand', 'Firebrand', 3, 3, 3, 'common'),
  creature('ember-igniter', 'Igniter', 3, 2, 3, 'common', [], [{ when: 'battlecry', effects: [dmg(1, 'any')] }]),
  spell('ember-cauterize', 'Cauterize', 4, 'common', [dmg(3, 'any'), heal(3)]),
  creature('ember-hellhound', 'Hellhound', 4, 4, 3, 'common', ['charge']),
  // Rares (5)
  spell('ember-firestorm', 'Firestorm', 5, 'rare', [dmg(4, 'allEnemies')]),
  creature('ember-phoenixwhelp', 'Phoenix Whelp', 5, 4, 3, 'rare', ['lifesteal']),
  spell('ember-pyroblast', 'Pyroblast', 5, 'rare', [dmg(7, 'any')]),
  creature('ember-flamebringer', 'Flamebringer', 6, 5, 5, 'rare', [], [{ when: 'battlecry', effects: [dmg(2, 'any')] }]),
  artifact('ember-emberforged', 'Emberforged Blade', 4, 'rare', [{ when: 'startOfTurn', effects: [dmg(1, 'randomEnemy')] }]),
  // Epics (3)
  spell('ember-conflagration', 'Conflagration', 7, 'epic', [dmg(2, 'allEnemies')]),
  creature('ember-ashwing', 'Ashwing', 7, 6, 5, 'epic', ['charge']),
  creature('ember-magmasoul', 'Magmasoul', 8, 7, 7, 'epic', ['windfury']),
  // Legendaries (2)
  creature('ember-phoenix', 'The Phoenix Sovereign', 9, 8, 8, 'legendary', [], [
    { when: 'battlecry', effects: [dmg(3, 'allEnemies')] },
    { when: 'deathrattle', effects: [summon('token-phoenixash')] },
  ]),
  creature('ember-emberlord', 'Emberlord Vharn', 6, 5, 5, 'legendary', [], [{ when: 'battlecry', effects: [dmg(2, 'randomEnemy')] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['ember-cinderling', 3], ['ember-sparkmage', 3], ['ember-bolt', 3], ['ember-ashhunter', 3],
    ['ember-searing', 3], ['ember-flamewhelp', 3], ['ember-blast', 3], ['ember-firebrand', 3],
    ['ember-igniter', 3], ['ember-cauterize', 3], ['ember-hellhound', 3],
    ['ember-firestorm', 2], ['ember-phoenixwhelp', 2], ['ember-pyroblast', 2],
    ['ember-flamebringer', 2], ['ember-emberforged', 2],
    ['ember-conflagration', 1], ['ember-ashwing', 1], ['ember-magmasoul', 1],
    ['ember-phoenix', 1], ['ember-emberlord', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-boar', 'neutral-crack', 'neutral-scroll', 'neutral-bloom',
    'neutral-drums', 'neutral-ogre', 'neutral-swift', 'neutral-lance', 'neutral-banner',
    'neutral-squire', 'neutral-herb',
  ],
};
