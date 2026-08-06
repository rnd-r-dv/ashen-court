import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Grave Pact (Task 16): Morticia Gravefall's self-damage / draw-engine deck.
 * Signature cards use the 'void' art preset (Forge mapping, Task 26 owns the
 * canonical palette; this is a placeholder dark-fantasy 2-color palette).
 * Art seed = FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const PACT_PALETTE = ['#150e1e', '#a06bff'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'void', palette: PACT_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'pact',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'pact',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'pact',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number): EffectSpec => ({ kind: 'heal', value, target: 'hero' });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const destroy = (target: EffectSpec['target']): EffectSpec => ({ kind: 'destroy', target });

export const HERO: HeroSpec = {
  name: 'Morticia Gravefall',
  power: { name: 'Blood Toll', cost: 2, effects: [dmg(1, 'self'), draw(1)] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('pact-bloodrite', 'Bloodrite', 1, 'common', [dmg(1, 'self'), draw(1)]),
  spell('pact-thirst', 'Blood Thirst', 1, 'common', [dmg(2, 'anyCreature')]),
  spell('pact-sacrifice', 'Sacrifice', 2, 'common', [destroy('friendlyCreature'), draw(2)]),
  creature('pact-imp', 'Blood Imp', 2, 3, 2, 'common'),
  creature('pact-leech', 'Leech', 2, 2, 2, 'common', ['lifesteal']),
  spell('pact-bond', 'Blood Bond', 3, 'common', [buff(3, 3, 'friendlyCreature'), dmg(2, 'self')]),
  creature('pact-masochist', 'Masochist', 3, 3, 4, 'common', [], [{ when: 'onDamage', effects: [draw(1)] }]),
  creature('pact-ravager', 'Ravager', 4, 5, 3, 'common'),
  spell('pact-lifeleech', 'Life Leech', 4, 'common', [dmg(3, 'enemyCreature'), heal(3)]),
  creature('pact-cultist', 'Cultist', 4, 4, 4, 'common'),
  spell('pact-hemorrhage', 'Hemorrhage', 5, 'common', [dmg(5, 'any')]),
  // Rares (5)
  spell('pact-darkpact', 'Dark Pact', 3, 'rare', [destroy('friendlyCreature'), draw(2)]),
  spell('pact-torment', 'Torment', 5, 'rare', [dmg(3, 'allEnemies'), dmg(2, 'self')]),
  creature('pact-fiend', 'Fiend', 5, 6, 4, 'rare'),
  spell('pact-bargain', 'Bargain', 6, 'rare', [dmg(4, 'self'), { kind: 'refillMana', value: 4 }]),
  creature('pact-dread', 'Dreadknight', 6, 5, 6, 'rare'),
  // Epics (3)
  spell('pact-mirror', 'Mirror of Blood', 7, 'epic', [dmg(7, 'randomEnemy'), dmg(3, 'self')]),
  spell('pact-ascend', 'Ascension', 8, 'epic', [{ kind: 'gainMana', value: 3 }, draw(3), dmg(5, 'self')]),
  creature('pact-lord', 'Lord of the Pact', 8, 8, 8, 'epic'),
  // Legendaries (2)
  creature('pact-morticia', 'Morticia Gravefall', 9, 7, 9, 'legendary', [], [{ when: 'battlecry', effects: [dmg(3, 'self'), dmg(3, 'allEnemies')] }]),
  artifact('pact-immortal', 'Immortal Bargain', 6, 'legendary', [{ when: 'startOfTurn', effects: [dmg(1, 'self'), draw(1)] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['pact-bloodrite', 3], ['pact-thirst', 3], ['pact-sacrifice', 3], ['pact-imp', 3],
    ['pact-leech', 3], ['pact-bond', 3], ['pact-masochist', 3], ['pact-ravager', 3],
    ['pact-lifeleech', 3], ['pact-cultist', 3], ['pact-hemorrhage', 3],
    ['pact-darkpact', 2], ['pact-torment', 2], ['pact-fiend', 2],
    ['pact-bargain', 2], ['pact-dread', 2],
    ['pact-mirror', 1], ['pact-ascend', 1], ['pact-lord', 1],
    ['pact-morticia', 1], ['pact-immortal', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-scroll', 'neutral-rite', 'neutral-crack',
    'neutral-frostbind', 'neutral-lance', 'neutral-banner', 'neutral-execute', 'neutral-soulmirror',
    'neutral-ogre', 'neutral-idol',
  ],
};
