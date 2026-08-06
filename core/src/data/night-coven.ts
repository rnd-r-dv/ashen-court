import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Night Coven (Task 16): Morwenna Hex's debuff/curse deck. Signature cards
 * use the 'curse' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const COVEN_PALETTE = ['#1a1609', '#d9c94f'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'curse', palette: COVEN_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'coven',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'coven',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'coven',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number): EffectSpec => ({ kind: 'heal', value, target: 'hero' });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const freeze = (target: EffectSpec['target']): EffectSpec => ({ kind: 'freeze', target });
const destroy = (target: EffectSpec['target']): EffectSpec => ({ kind: 'destroy', target });

export const HERO: HeroSpec = {
  name: 'Morwenna Hex',
  power: { name: 'Hex', cost: 2, effects: [buff(-1, -1, 'enemyCreature')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('coven-whisper', 'Whisper', 1, 'common', [dmg(1, 'anyCreature')]),
  spell('coven-hex', 'Hex', 2, 'common', [buff(-1, -1, 'enemyCreature')]),
  spell('coven-curse', 'Curse', 2, 'common', [buff(-1, -1, 'enemyCreature'), dmg(1, 'enemyCreature')]),
  creature('coven-familiar', 'Familiar', 2, 2, 2, 'common'),
  spell('coven-wither', 'Wither', 3, 'common', [buff(-2, -2, 'enemyCreature')]),
  creature('coven-bog', 'Bog Hag', 3, 2, 4, 'common'),
  spell('coven-doom', 'Doom', 3, 'common', [dmg(3, 'enemyCreature')]),
  spell('coven-nightmare', 'Nightmare', 4, 'common', [buff(-3, -3, 'enemyCreature')]),
  creature('coven-raven', 'Raven', 4, 3, 4, 'common'),
  creature('coven-scare', 'Scarecrow', 4, 0, 6, 'common', ['taunt']),
  spell('coven-drain', 'Drain', 5, 'common', [dmg(2, 'enemyCreature'), heal(2)]),
  // Rares (5)
  spell('coven-decay', 'Decay', 5, 'rare', [buff(-2, -2, 'allEnemyCreatures')]),
  creature('coven-eldritch', 'Eldritch Horror', 6, 6, 6, 'rare'),
  spell('coven-transfix', 'Transfix', 3, 'rare', [freeze('enemyCreature'), buff(-1, -1, 'enemyCreature')]),
  spell('coven-mirrorhex', 'Mirror Hex', 5, 'rare', [buff(-4, -4, 'enemyCreature')]),
  spell('coven-veil', 'Veil of Night', 6, 'rare', [draw(3), dmg(1, 'self')]),
  // Epics (3)
  spell('coven-apathy', 'Apathy', 7, 'epic', [buff(-3, -3, 'allEnemyCreatures')]),
  spell('coven-glare', "Morwenna's Glare", 8, 'epic', [destroy('enemyCreature'), buff(-1, -1, 'allEnemyCreatures')]),
  creature('coven-abyss', 'Abyssal Gaze', 9, 8, 8, 'epic'),
  // Legendaries (2)
  creature('coven-queen', 'The Hex Queen', 10, 7, 10, 'legendary', [], [{ when: 'battlecry', effects: [buff(-2, -2, 'allEnemyCreatures')] }]),
  artifact('coven-eternal', 'Eternal Night', 7, 'legendary', [{ when: 'startOfTurn', effects: [buff(-1, -1, 'allEnemyCreatures')] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['coven-whisper', 3], ['coven-hex', 3], ['coven-curse', 3], ['coven-familiar', 3],
    ['coven-wither', 3], ['coven-bog', 3], ['coven-doom', 3], ['coven-nightmare', 3],
    ['coven-raven', 3], ['coven-scare', 3], ['coven-drain', 3],
    ['coven-decay', 2], ['coven-eldritch', 2], ['coven-transfix', 2],
    ['coven-mirrorhex', 2], ['coven-veil', 2],
    ['coven-apathy', 1], ['coven-glare', 1], ['coven-abyss', 1],
    ['coven-queen', 1], ['coven-eternal', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll',
    'neutral-rite', 'neutral-light', 'neutral-bear', 'neutral-knight', 'neutral-execute',
    'neutral-colossus', 'neutral-frostbind',
  ],
};
