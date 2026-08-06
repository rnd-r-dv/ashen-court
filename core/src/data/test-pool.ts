import type { ArtRecipe, Card, Keyword } from '../types.js';
import { KEYWORD_COST, statBudget } from '../validate.js';

// Small deterministic pool used when tests omit an explicit registry
// (Game.create falls back to `new CardRegistry(createTestPool())`).
// Every card must pass validateCard so deck validation in Game.create succeeds.
// The real curated pool arrives in Phase 2.

const art = (seed: number): ArtRecipe => ({
  preset: 'shadow',
  palette: ['#1a1a2e', '#3a3a5e'],
  seed,
});

/** Named vanilla fixtures: t-001 is 3-cost 3/3, t-007 is 7-cost 7/7. */
const vanilla = (id: string, cost: number, attack: number, health: number, seed: number): Card => ({
  id, name: `Test ${id}`, type: 'creature', cost, attack, health,
  keywords: [], effects: [], rarity: 'common', archetype: 'neutral',
  art: art(seed), author: 'curated', version: 1,
});

// Rotating keyword for the procedural creatures (taunt/rush/lifesteal/windfury/none).
const KW_ROTATION = ['taunt', 'rush', 'lifesteal', 'windfury', 'none'] as const;
const KW_COST: Record<(typeof KW_ROTATION)[number], number> = {
  taunt: KEYWORD_COST.taunt,
  rush: KEYWORD_COST.rush,
  lifesteal: KEYWORD_COST.lifesteal,
  windfury: KEYWORD_COST.windfury,
  none: 0,
};

/**
 * Procedural creatures t-000..t-059. Cost = (i % 14) + 1; attack/health are
 * derived from `i` but always within the Task 3 budget formula
 * (attack + health + keyword costs <= statBudget(cost) + 4) so validateCard
 * reports no errors. t-001 and t-007 are pinned to their named specs
 * (3-cost 3/3 vanilla, 7-cost 7/7 vanilla).
 */
function proceduralCreature(i: number): Card {
  const id = `t-${String(i).padStart(3, '0')}`;
  if (i === 1) return vanilla(id, 3, 3, 3, i);
  if (i === 7) return vanilla(id, 7, 7, 7, i);
  const cost = (i % 14) + 1;
  const kwName = KW_ROTATION[i % KW_ROTATION.length]!;
  const keywords: Keyword[] = kwName === 'none' ? [] : [kwName];
  const stats = statBudget(cost) + 4 - KW_COST[kwName];
  const attack = 1 + ((i * 5) % (stats - 1));
  const health = stats - attack;
  return {
    id, name: `Test ${id}`, type: 'creature', cost, attack, health,
    keywords, effects: [], rarity: 'common', archetype: 'neutral',
    art: art(i), author: 'curated', version: 1,
  };
}

export function createTestPool(): Card[] {
  const named: Card[] = [
    {
      id: 'mana-surge', name: 'Mana Surge', type: 'spell', cost: 0,
      keywords: [], effects: [{ kind: 'refillMana', value: 1 }],
      rarity: 'common', archetype: 'token', art: art(900), author: 'curated', version: 1,
    },
    {
      id: 'test-spell', name: 'Test Spell', type: 'spell', cost: 1,
      keywords: [], effects: [{ kind: 'dealDamage', value: 1, target: 'anyCreature' }],
      rarity: 'common', archetype: 'neutral', art: art(901), author: 'curated', version: 1,
    },
    {
      id: 'test-spell-ec', name: 'Test Spell (Enemy Creature)', type: 'spell', cost: 1,
      keywords: [], effects: [{ kind: 'dealDamage', value: 1, target: 'enemyCreature' }],
      rarity: 'common', archetype: 'neutral', art: art(902), author: 'curated', version: 1,
    },
    {
      id: 'bc-2dmg', name: 'Battlecry 2 Damage', type: 'creature', cost: 2, attack: 2, health: 2,
      keywords: [], effects: [], triggers: [{ when: 'battlecry', effects: [{ kind: 'dealDamage', value: 2, target: 'allEnemies' }] }],
      rarity: 'common', archetype: 'neutral', art: art(903), author: 'curated', version: 1,
    },
    {
      id: 'art-heal', name: 'Healing Artifact', type: 'artifact', cost: 3,
      keywords: [], effects: [], triggers: [{ when: 'startOfTurn', effects: [{ kind: 'heal', value: 2, target: 'hero' }] }],
      rarity: 'common', archetype: 'neutral', art: art(904), author: 'curated', version: 1,
    },
    {
      id: 't-rush', name: 'Test Rusher', type: 'creature', cost: 2, attack: 2, health: 1,
      keywords: ['rush'], effects: [], rarity: 'common', archetype: 'neutral', art: art(905), author: 'curated', version: 1,
    },
  ];
  const procedural: Card[] = [];
  for (let i = 0; i < 60; i++) procedural.push(proceduralCreature(i));
  return [...named, ...procedural];
}
