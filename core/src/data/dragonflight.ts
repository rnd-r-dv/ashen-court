import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Dragonflight (Task 15): Seraphina Skywing's dragon-tempo deck. Signature
 * cards use the 'dragon' art preset (Forge mapping, Task 26 owns the canonical
 * palette; this is a placeholder dark-fantasy 2-color palette). Art seed =
 * FNV-1a hash of the card id (same scheme as tokens.ts arcaneArt).
 */
const DRAGON_PALETTE = ['#1a1f3a', '#c9a227'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'dragon', palette: DRAGON_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [],
  flavor?: string,
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'dragon',
  art: art(id), flavor, author: 'curated', version: 1,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[], flavor?: string): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'dragon',
  art: art(id), flavor, author: 'curated', version: 1,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[], flavor?: string): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'dragon',
  art: art(id), flavor, author: 'curated', version: 1,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const buff = (value: number, value2: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'buff', value, value2, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const summon = (cardId: string, value?: number): EffectSpec => ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

export const HERO: HeroSpec = {
  name: 'Seraphina Skywing',
  power: { name: "Dragon's Boon", cost: 2, effects: [buff(1, 1, 'friendlyDragon')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  creature('dragon-whelp', 'Dragon Whelp', 1, 1, 2, 'common', [], [], 'Every dragonflight begins with a single hatchling too proud to stay on the ground.'),
  creature('dragon-scaleglider', 'Scaleglider', 2, 2, 3, 'common', [], [], 'It rides the mountain drafts for hours, turning on air that would throw lesser wings from the sky.'),
  spell('dragon-wingmen', 'Wingmen', 2, 'common', [buff(2, 2, 'friendlyDragon')], "No dragon flies alone; the flight's wings move as one, and the sky grows crowded."),
  spell('dragon-snout', 'Wyrm Snout', 2, 'common', [dmg(2, 'anyCreature')], "A wyrm's snout is a gate of teeth, and what closes within it does not open again."),
  creature('dragon-hunter', 'Sky Hunter', 3, 3, 3, 'common', ['rush'], [], 'It folds its wings and falls, and only the dead know it was ever there.'),
  creature('dragon-roost', 'Roost Guardian', 3, 2, 4, 'common', ['taunt'], [], "The roost's eggs are the flight's future, and nothing crosses the Guardian's shadow."),
  spell('dragon-claw', 'Claw Sweep', 3, 'common', [dmg(3, 'allEnemyCreatures')], 'One rake of the claw clears the field like a storm clearing the sky.'),
  creature('dragon-hatchling', 'Hatchling', 3, 3, 2, 'common', [], [], 'Fresh from the shell, it tests its fire on anything that moves — and most things wisely move.'),
  creature('dragon-elderscale', 'Elderscale', 4, 3, 5, 'common', ['taunt'], [], 'Its scales carry scars older than most kingdoms, and each one taught it to endure.'),
  spell('dragon-swoop', 'Swoop', 4, 'common', [dmg(4, 'enemyCreature')], 'The shadow grows, and grows, until it is too late to look up.'),
  creature('dragon-drakeling', 'Drakeling', 5, 4, 4, 'common', [], [], "Too young to join the flight's hunt, too proud to admit it."),
  // Rares (5)
  creature('dragon-matriarch', 'Matriarch', 5, 4, 5, 'rare', [], [{ when: 'battlecry', effects: [buff(1, 1, 'allFriendlyCreatures')] }], 'When the Matriarch roars, every dragon in the flight feels its blood run hotter.'),
  creature('dragon-seer', 'Seer', 4, 2, 5, 'rare', [], [{ when: 'endOfTurn', effects: [draw(1)] }], "Her eyes are fixed on a tomorrow that has not happened yet."),
  spell('dragon-flight', 'Flight of Dragons', 6, 'rare', [summon('token-dragon-whelp', 2)], 'The sky darkens as the flight answers — not with one dragon, but with all of them.'),
  creature('dragon-warden', 'Warden of Skies', 6, 5, 5, 'rare', ['taunt'], [], 'The Warden patrols the cloud-road day and night, and the storm itself steps aside.'),
  creature('dragon-prince', 'Prince of Scales', 7, 5, 6, 'rare', [], [], 'Heir to the hoard and to the mountain that guards it, he has never known doubt.'),
  // Epics (3)
  artifact('dragon-council', 'Sky Council', 7, 'epic', [{ when: 'startOfTurn', effects: [buff(1, 1, 'friendlyDragon')] }], 'At dawn the elders confer, and their wisdom settles on the flight like a blessing.'),
  spell('dragon-storm', 'Dragonstorm', 8, 'epic', [summon('token-dragon-whelp', 3)], 'When the storm breaks, it does not rain water — it rains whelps and fury.'),
  creature('dragon-tyrant', 'Wyrm Tyrant', 8, 8, 6, 'epic', [], [], "Its hoard is a mountain range, and its temper is the earthquake that shapes it."),
  // Legendaries (2)
  creature('dragon-worldeater', 'Worldeater', 10, 10, 10, 'legendary', ['taunt'], [], 'The oldest of the old. Mountains are its footprints; kingdoms, its meals.'),
  creature('dragon-celestial', 'Celestial Skywing', 6, 4, 4, 'legendary', ['windfury'], [{ when: 'battlecry', effects: [buff(1, 1, 'allFriendlyCreatures')] }], 'A dragon born of the heavens strikes twice where lesser wings strike once, and the flight it leads burns brighter for it.'),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['dragon-whelp', 3], ['dragon-scaleglider', 3], ['dragon-wingmen', 3], ['dragon-snout', 3],
    ['dragon-hunter', 3], ['dragon-roost', 3], ['dragon-claw', 3], ['dragon-hatchling', 3],
    ['dragon-elderscale', 3], ['dragon-swoop', 3], ['dragon-drakeling', 3],
    ['dragon-matriarch', 2], ['dragon-seer', 2], ['dragon-flight', 2],
    ['dragon-warden', 2], ['dragon-prince', 2],
    ['dragon-council', 1], ['dragon-storm', 1], ['dragon-tyrant', 1],
    ['dragon-worldeater', 1], ['dragon-celestial', 1],
  ],
  neutrals: [
    'neutral-golem', 'neutral-sentinel', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-bear', 'neutral-knight', 'neutral-banner', 'neutral-frostbind', 'neutral-ogre',
    'neutral-colossus', 'neutral-titan',
  ],
};
