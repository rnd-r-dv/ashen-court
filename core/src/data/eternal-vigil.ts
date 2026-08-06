import type { Card, EffectSpec, HeroSpec, Keyword, Rarity, TriggerSpec } from '../types.js';
import type { DeckDef } from './index.js';

/**
 * Eternal Vigil (Task 17): Ser Aldric the Vigilant's healing wall deck.
 * Signature cards use the 'vigil' art preset (Forge mapping, Task 26 owns
 * the canonical palette; this is a placeholder dark-fantasy 2-color
 * palette). Art seed = FNV-1a hash of the card id (same scheme as
 * tokens.ts arcaneArt).
 */
const VIGIL_PALETTE = ['#2b2525', '#f2e6c9'];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const art = (id: string): Card['art'] => ({ preset: 'vigil', palette: VIGIL_PALETTE, seed: hashId(id) });

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], triggers: TriggerSpec[] = [], flavor?: string,
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  keywords, triggers, effects: [], rarity, archetype: 'vigil',
  art: art(id), author: 'curated', version: 1, flavor,
});

const spell = (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[], flavor?: string): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'vigil',
  art: art(id), author: 'curated', version: 1, flavor,
});

const artifact = (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[], flavor?: string): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'vigil',
  art: art(id), author: 'curated', version: 1, flavor,
});

const dmg = (value: number, target: EffectSpec['target']): EffectSpec => ({ kind: 'dealDamage', value, target });
const heal = (value: number, target: EffectSpec['target'] = 'hero'): EffectSpec => ({ kind: 'heal', value, target });
const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
const giveK = (keyword: Keyword, target: EffectSpec['target']): EffectSpec => ({ kind: 'giveKeyword', keyword, target });

export const HERO: HeroSpec = {
  name: 'Ser Aldric the Vigilant',
  power: { name: 'Renewal', cost: 2, effects: [heal(1, 'allFriendlyCreatures')] },
};

export const CARDS: Card[] = [
  // Commons (11)
  spell('vigil-bless', 'Bless', 1, 'common', [heal(2, 'any')], "A whispered benediction mends flesh and steadies trembling hands."),
  creature('vigil-guard', 'Guard', 1, 1, 3, 'common', [], [], "The first shield raised where the shadows begin to stir."),
  spell('vigil-pray', 'Prayer', 2, 'common', [heal(4)], "Each murmured word is a wall raised against the dark."),
  creature('vigil-squire', 'Squire', 2, 2, 2, 'common', [], [], "Trained in the cloisters, tempered on the dawn watch."),
  spell('vigil-lights', 'Lights', 2, 'common', [dmg(1, 'allEnemies')], "The Order's lanterns hunt every corner where shadow dares to gather."),
  creature('vigil-paladin', 'Paladin', 3, 2, 4, 'common', ['taunt'], [], "No blade passes where a paladin has sworn his vigil."),
  spell('vigil-smite', 'Smite', 3, 'common', [dmg(3, 'enemyCreature')], "Righteous fury, measured and swift."),
  creature('vigil-monk', 'Monk', 3, 3, 3, 'common', [], [], "Discipline is the monk's blade; stillness is his armor."),
  creature('vigil-shieldbearer', 'Shieldbearer', 4, 1, 6, 'common', ['taunt', 'shield'], [], "Their shields have outlasted a hundred sieges of the dark."),
  spell('vigil-hymn', 'Hymn', 4, 'common', [heal(6)], "A chorus that mends what war has broken."),
  creature('vigil-crusader', 'Crusader', 5, 4, 5, 'common', [], [], "He marches where the light burns thinnest."),
  // Rares (5)
  spell('vigil-divine', 'Divine Shield', 2, 'rare', [giveK('shield', 'friendlyCreature')], "Faith made visible: armor woven from conviction alone."),
  spell('vigil-layhands', 'Lay on Hands', 5, 'rare', [heal(8)], "Aldric's touch closes wounds no surgeon dare approach."),
  creature('vigil-avenger', 'Avenger', 5, 5, 4, 'rare', ['rush'], [], "Vengeance rides ahead of the host; mercy follows behind."),
  creature('vigil-warden', 'Warden of Dawn', 6, 4, 6, 'rare', ['lifesteal'], [], "Every wound he takes, the dawn repays tenfold."),
  spell('vigil-sanctify', 'Sanctify', 6, 'rare', [heal(10)], "The ground remembers the light long after the rites are done."),
  // Epics (3)
  creature('vigil-archon', 'Archon of Dawn', 7, 6, 7, 'epic', ['taunt', 'lifesteal'], [], "An immovable pillar of first light."),
  spell('vigil-radiance', 'Radiance', 7, 'epic', [heal(5), draw(2)], "In its glow the faithful find both solace and clarity."),
  creature('vigil-saint', 'Saint', 8, 5, 9, 'epic', ['lifesteal'], [], "Suffering passes through her and returns as mercy."),
  // Legendaries (2)
  creature('vigil-aldric', 'Ser Aldric', 9, 8, 8, 'legendary', ['taunt', 'lifesteal'], [], "He has stood guard so long that dawn itself waits on his word."),
  artifact('vigil-eternal', 'The Eternal Vigil', 6, 'legendary', [{ when: 'startOfTurn', effects: [heal(3)] }], "The flame that never gutters, watched by those who never sleep."),
];

// sig: 3x each common (11), 2x each rare (5), 1x each epic (3), 1x each legendary (2)
export const DECK: DeckDef = {
  sig: [
    ['vigil-bless', 3], ['vigil-guard', 3], ['vigil-pray', 3], ['vigil-squire', 3],
    ['vigil-lights', 3], ['vigil-paladin', 3], ['vigil-smite', 3], ['vigil-monk', 3],
    ['vigil-shieldbearer', 3], ['vigil-hymn', 3], ['vigil-crusader', 3],
    ['vigil-divine', 2], ['vigil-layhands', 2], ['vigil-avenger', 2],
    ['vigil-warden', 2], ['vigil-sanctify', 2],
    ['vigil-archon', 1], ['vigil-radiance', 1], ['vigil-saint', 1],
    ['vigil-aldric', 1], ['vigil-eternal', 1],
  ],
  neutrals: [
    'neutral-militia', 'neutral-golem', 'neutral-crack', 'neutral-scroll', 'neutral-rite',
    'neutral-light', 'neutral-sentinel', 'neutral-bear', 'neutral-knight', 'neutral-relic',
    'neutral-titan', 'neutral-execute',
  ],
};
