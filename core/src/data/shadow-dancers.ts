import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Shadow Dancers (Task 15): Nyx Nightshade's draw/damage deck. Signature
 * cards use the 'shadow' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const DANCE_PALETTE = ['#1a1a2e', '#c084fc'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'shadow', palette: DANCE_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'dance',
  art: art(id), author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[]): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'dance',
  art: art(id), author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[]): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'dance',
  art: art(id), author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });

export const HERO: HeroSpec = {
  name: 'Nyx Nightshade',
  power: { name: 'Gamble', cost: 2, effects: [draw(1), dmg(1, 'self')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('dance-dagger', 'Dagger Throw', 1, 'common', [dmg(2, 'anyCreature')]),
  spell('dance-step', 'Shadow Step', 1, 'common', [draw(1)]),
  spell('dance-twirl', 'Twirl', 1, 'common', [dmg(1, 'any')]),
  creature('dance-acrobat', 'Acrobat', 2, 2, 2, 'common'),
  spell('dance-slash', 'Slash', 2, 'common', [dmg(3, 'enemyCreature')]),
  creature('dance-dervish', 'Dervish', 2, 3, 1, 'common', ['rush']),
  spell('dance-vanish', 'Vanish', 3, 'common', [dmg(3, 'anyCreature')]),
  spell('dance-echo', 'Echo', 3, 'common', [draw(2)]),
  spell('dance-spin', 'Spinning Blade', 3, 'common', [dmg(2, 'allEnemies')]),
  creature('dance-bladeweaver', 'Bladeweaver', 4, 3, 4, 'common'),
  spell('dance-veil', 'Veil Dance', 4, 'common', [draw(2)]),
  // Rares (5)
  spell('dance-flurry', 'Flurry', 4, 'rare', [dmg(4, 'randomEnemyCreature')]),
  creature('dance-trickster', 'Trickster', 5, 4, 4, 'rare', [], [{ when: 'battlecry', effects: [draw(1)] }]),
  spell('dance-finale', 'Grand Finale', 7, 'rare', [dmg(6, 'randomEnemy')]),
  spell('dance-mirage', 'Mirage', 5, 'rare', [draw(3)]),
  creature('dance-illusionist', 'Illusionist', 6, 5, 5, 'rare'),
  // Epics (3)
  creature('dance-puppet', 'Puppet Master', 7, 6, 6, 'epic', [], [{ when: 'battlecry', effects: [draw(2)] }]),
  spell('dance-trick', 'The Ultimate Trick', 8, 'epic', [dmg(8, 'any')]),
  creature('dance-shadow', 'Shadow Dancer', 7, 5, 5, 'epic', [], [{ when: 'deathrattle', effects: [draw(2)] }]),
  // Legendaries (2)
  creature('dance-nyx', 'Nyx, the Last Dance', 9, 7, 7, 'legendary', ['windfury']),
  artifact('dance-infinite', 'Infinite Shadows', 6, 'legendary', [{ when: 'endOfTurn', effects: [draw(1)] }]),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['dance-dagger', 3], ['dance-step', 3], ['dance-twirl', 3], ['dance-acrobat', 3],
    ['dance-slash', 3], ['dance-dervish', 3], ['dance-vanish', 3], ['dance-echo', 3],
    ['dance-spin', 3], ['dance-bladeweaver', 3], ['dance-veil', 3],
    ['dance-flurry', 2], ['dance-trickster', 2], ['dance-finale', 2],
    ['dance-mirage', 2], ['dance-illusionist', 2],
    ['dance-puppet', 1], ['dance-trick', 1], ['dance-shadow', 1],
    ['dance-nyx', 1], ['dance-infinite', 1],
  ],
  neutrals: [
    'neutral-boar', 'neutral-hound', 'neutral-swift', 'neutral-scroll', 'neutral-rite',
    'neutral-crack', 'neutral-drums', 'neutral-lance', 'neutral-banner', 'neutral-frostbind',
    'neutral-ogre', 'neutral-soulmirror',
  ],
};
