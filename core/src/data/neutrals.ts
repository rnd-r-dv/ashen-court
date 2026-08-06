import type { Card, Keyword, Rarity } from '../types.js';
import { arcaneArt } from './tokens.js';

/**
 * Neutral staple pool (Task 13). Archetype decks (Tasks 14-17) reference these
 * by id; all 26 must pass validateCard with zero error issues.
 */

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, effects: [], rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: Card['effects']): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: Card['triggers']): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1,
});

export const NEUTRAL_CARDS: Card[] = [
  // Common creatures
  creature('neutral-militia', 'Village Militia', 1, 1, 2, 'common'),
  creature('neutral-boar', 'Wild Boar', 1, 2, 1, 'common'),
  creature('neutral-hound', 'Feral Hound', 2, 2, 2, 'common'),
  creature('neutral-golem', 'Stone Golem', 3, 3, 3, 'common'),
  creature('neutral-squire', 'Vanguard Squire', 2, 2, 1, 'common', ['taunt']),
  creature('neutral-sentinel', 'Wall Sentinel', 3, 1, 4, 'common', ['taunt']),
  creature('neutral-ogre', 'War Ogre', 5, 5, 5, 'common', ['ward']),
  // Common spells
  spell('neutral-crack', 'Crack of Thunder', 3, 'common', [{ kind: 'dealDamage', value: 3, target: 'enemyCreature' }]),
  spell('neutral-scroll', 'Scroll of Lore', 2, 'common', [{ kind: 'draw', value: 1 }]),
  spell('neutral-bloom', 'Mana Bloom', 2, 'common', [{ kind: 'gainMana', value: 1 }]),
  spell('neutral-herb', 'Herbal Remedy', 1, 'common', [{ kind: 'heal', value: 3, target: 'hero' }]),
  spell('neutral-drums', 'War Drums', 2, 'common', [{ kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }]),
  // Rare creatures
  creature('neutral-bear', 'Ironclad Bear', 4, 4, 4, 'rare', ['taunt']),
  creature('neutral-swift', 'Swiftblade', 2, 2, 1, 'rare', ['rush']),
  creature('neutral-knight', 'Bulwark Knight', 5, 4, 5, 'rare', ['taunt']),
  // Rare spells
  spell('neutral-lance', 'Shadow Lance', 4, 'rare', [{ kind: 'dealDamage', value: 4, target: 'enemyCreature' }]),
  spell('neutral-rite', 'Rite of Remembering', 3, 'rare', [{ kind: 'draw', value: 2 }]),
  spell('neutral-light', 'Sanctuary Light', 3, 'rare', [{ kind: 'heal', value: 5, target: 'hero' }]),
  // Rare artifacts
  artifact('neutral-relic', 'Relic of Restoration', 3, 'rare', [{ when: 'startOfTurn', effects: [{ kind: 'heal', value: 2, target: 'hero' }] }]),
  artifact('neutral-idol', 'Idol of Growth', 3, 'rare', [{ when: 'startOfTurn', effects: [{ kind: 'gainMana', value: 1 }] }]),
  // Epic
  creature('neutral-colossus', 'Colossus', 7, 7, 7, 'epic', ['taunt']),
  spell('neutral-execute', 'Execute', 5, 'epic', [{ kind: 'destroy', target: 'enemyCreature' }]),
  spell('neutral-banner', 'Banner of Courage', 4, 'epic', [{ kind: 'buff', value: 2, value2: 2, target: 'friendlyCreature' }]),
  spell('neutral-frostbind', 'Frostbind', 2, 'epic', [
    { kind: 'dealDamage', value: 2, target: 'anyCreature' },
    { kind: 'freeze', target: 'anyCreature' },
  ]),
  // Legendary
  creature('neutral-titan', 'Titan of Ash', 9, 9, 9, 'legendary', ['taunt']),
  // Soul Mirror copies a random enemy creature each EOT (undefined-safe: no
  // enemy creature -> nothing happens; copyCard resolves the cardId at runtime).
  artifact('neutral-soulmirror', 'Soul Mirror', 6, 'legendary', [{ when: 'endOfTurn', effects: [{ kind: 'copyCard' }] }]),
];
