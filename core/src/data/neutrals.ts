import type { Card, Keyword, Rarity } from '../types.js';
import { arcaneArt } from './tokens.js';

/**
 * Neutral staple pool (Task 13). Archetype decks (Tasks 14-17) reference these
 * by id; all 26 must pass validateCard with zero error issues.
 */

const creature = (
  id: string, name: string, cost: number, attack: number, health: number,
  rarity: Rarity, keywords: Keyword[] = [], flavor?: string,
): Card => ({
  id, name, type: 'creature', cost, attack, health,
  // Task 1 transitional: Reflect mirrors Attack (see archetypeCards).
  reflect: attack,
  keywords, effects: [], rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
});

const spell = (
  id: string, name: string, cost: number, rarity: Rarity,
  effects: Card['effects'], flavor?: string,
): Card => ({
  id, name, type: 'spell', cost,
  keywords: [], effects, rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
});

const artifact = (
  id: string, name: string, cost: number, rarity: Rarity,
  triggers: Card['triggers'], flavor?: string,
): Card => ({
  id, name, type: 'artifact', cost,
  keywords: [], effects: [], triggers, rarity, archetype: 'neutral',
  art: arcaneArt(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
});

export const NEUTRAL_CARDS: Card[] = [
  // Common creatures
  creature('neutral-militia', 'Village Militia', 1, 1, 2, 'common', ['taunt'],
    'Militia spears rise as the horn sounds across the hollows. The Court takes what it needs — and what it needs is bodies.'),
  creature('neutral-boar', 'Wild Boar', 1, 2, 1, 'common', ['rush'],
    'The boar does not ask who rules the Court. It knows only the scent of blood and the weight of its tusks.'),
  creature('neutral-hound', 'Feral Hound', 2, 2, 2, 'common', ['rush'],
    'Bred from the stray packs that gnaw the bones of the dead, the hound answers to hunger alone.'),
  creature('neutral-golem', 'Stone Golem', 3, 3, 3, 'common', ['taunt'],
    'Carved from the granite of the Ashlands and woken by a word older than the Court, it neither tires nor questions.'),
  creature('neutral-squire', 'Vanguard Squire', 2, 2, 1, 'common', ['taunt'],
    'The vanguard marches first so that others might live. A squire learns that lesson one scar at a time.'),
  creature('neutral-sentinel', 'Wall Sentinel', 3, 1, 4, 'common', ['taunt'],
    'Sentries do not sleep. They become the wall, and the wall remembers every siege it has outlasted.'),
  creature('neutral-ogre', 'War Ogre', 5, 5, 5, 'common', ['ward'],
    'Hired from the mountain clans for a purse of ash-crowns, the ogre’s loyalty lasts exactly as long as the war.'),
  // Common spells
  spell('neutral-crack', 'Crack of Thunder', 3, 'common', [{ kind: 'dealDamage', value: 3, target: 'enemyCreature' }],
    'The sky splits, and those who hear the thunder know the storm has already chosen its victims.'),
  spell('neutral-scroll', 'Scroll of Lore', 1, 'common', [{ kind: 'discover' }],
    'Every doctrine of the Ashen Court begins the same way: knowledge is a weapon, and weapons remember their bearers.'),
  spell('neutral-bloom', 'Mana Bloom', 2, 'common', [{ kind: 'gainMana', value: 1 }],
    'Where the Court’s will touches the earth, pale blooms drink the ambient mana and swell with stolen light.'),
  spell('neutral-herb', 'Herbal Remedy', 1, 'common', [{ kind: 'heal', value: 3, target: 'hero' }],
    'The field medics grind bitter roots into a paste that closes wounds and silences screams.'),
  spell('neutral-drums', 'War Drums', 2, 'common', [{ kind: 'buff', value: 1, value2: 1, target: 'allFriendlyCreatures' }],
    'One drum for the march, two for the charge, three for the fury that follows the banner.'),
  // Rare creatures
  creature('neutral-bear', 'Ironclad Bear', 4, 4, 4, 'rare', ['taunt'],
    'The Court’s smiths plate the great bears of the high hills in iron, turning beasts into bulwarks.'),
  creature('neutral-swift', 'Swiftblade', 2, 2, 1, 'rare', ['rush'],
    'A blade that moves before the eye, paid in silver and remembered in songs it never hears.'),
  creature('neutral-knight', 'Bulwark Knight', 5, 4, 5, 'rare', ['taunt'],
    'A knight of the old order who swore to hold the line until the ash settles. The ash never settles.'),
  // Rare spells
  spell('neutral-lance', 'Shadow Lance', 4, 'rare', [{ kind: 'dealDamage', value: 4, target: 'enemyCreature' }],
    'Forged in the dark beneath the Court, the lance strikes not the flesh but the shadow the flesh casts.'),
  spell('neutral-rite', 'Rite of Remembering', 3, 'rare', [{ kind: 'draw', value: 2 }],
    'The dead of the Ashen Court are not buried. They are remembered — and remembrance is a summons.'),
  spell('neutral-light', 'Sanctuary Light', 3, 'rare', [{ kind: 'heal', value: 5, target: 'hero' }],
    'Even in the ash-choked dusk, the pale light of the sanctuaries finds the faithful.'),
  // Rare artifacts
  artifact('neutral-relic', 'Relic of Restoration', 3, 'rare', [{ when: 'startOfTurn', effects: [{ kind: 'heal', value: 2, target: 'hero' }] }],
    'A fragment of a shrine that burned when the Court rose. It still remembers how to mend.'),
  artifact('neutral-idol', 'Idol of Growth', 3, 'rare', [{ when: 'startOfTurn', effects: [{ kind: 'gainMana', value: 1 }] }],
    'The idol’s roots drink deep of the earth’s mana and, each dawn, offer a single drop back.'),
  // Epic
  creature('neutral-colossus', 'Colossus', 7, 7, 7, 'epic', ['taunt'],
    'A war-construct of the old kings, woken to guard a Court that has forgotten its makers.'),
  spell('neutral-execute', 'Execute', 5, 'epic', [{ kind: 'destroy', target: 'enemyCreature' }],
    'No trial, no plea, no reprieve. The axe falls, and the Court’s ledger is balanced.'),
  spell('neutral-banner', 'Banner of Courage', 4, 'epic', [{ kind: 'buff', value: 2, value2: 2, target: 'friendlyCreature' }],
    'Follow the banner into the ash. It has never fallen, and neither will those who carry it.'),
  spell('neutral-frostbind', 'Frostbind', 2, 'epic', [
    { kind: 'dealDamage', value: 2, target: 'anyCreature' },
    { kind: 'freeze', target: 'anyCreature' },
  ],
    'Winter answers the Court’s call, cracking armor and stilling hearts in a single breath.'),
  // Legendary
  creature('neutral-titan', 'Titan of Ash', 9, 9, 9, 'legendary', ['taunt'],
    'The Court’s first servant, raised from the burning wastes. Where it walks, the ash itself kneels.'),
  // Soul Mirror copies a random enemy creature each EOT (undefined-safe: no
  // enemy creature -> nothing happens; copyCard resolves the cardId at runtime).
  artifact('neutral-soulmirror', 'Soul Mirror', 6, 'legendary', [{ when: 'endOfTurn', effects: [{ kind: 'copyCard' }] }],
    'Stare into the mirror and it learns your face. Turn away, and it keeps it.'),
];
