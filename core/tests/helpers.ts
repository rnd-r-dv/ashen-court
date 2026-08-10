import type { Game } from '../src/engine/game.js';
import type { Card, CreatureState, EffectSpec, HeroSpec, Keyword, PlayerIndex, Trigger } from '../src/types.js';

export const hero = (name: string): HeroSpec => ({ name, power: { name: 'Test Power', cost: 2, effects: [{ kind: 'dealDamage', value: 1, target: 'any' }] } });

export function makeTestSetup(): ConstructorParameters<typeof Game>[0] {
  // Build a 60-card pool of plain creatures + mana-surge, seeded deterministically
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) ids.push(`t-${String(i).padStart(3, '0')}`);
  return { decks: [ids, [...ids].reverse()], heroes: [hero('A'), hero('B')], seed: 1 };
}

export interface AddCreatureInput {
  /** cardId used by the synthetic card def AND the creature's cardId. */
  id: string;
  attack: number;
  health: number;
  /** Independent counter-damage stat (Task 1). Defaults to attack for
   *  fixture parity with the transitional curated builders. */
  reflect?: number;
  cost?: number;
  keywords?: Keyword[];
  /** When present, the registered card def gets triggers: [{ when, effects }] (Task 8 lookups). */
  trigger?: Trigger;
  effects?: EffectSpec[];
  /** Tests set exhausted: false when the creature must attack immediately. */
  exhausted?: boolean;
}

/** Module-level counter keeps synthetic creature ids unique across games/tests. */
let creatureCounter = 0;

/**
 * Push a synthetic creature onto `player`'s board and register/update its card
 * def in `game.registry` (base vanilla card merged with the partial's
 * keywords / trigger+effects pair), so trigger lookups (Task 8) and summon
 * paths resolve synthetic creatures. Defaults mirror effects.ts makeCreature:
 * exhausted true (rush/charge still attack via canAttack), attacksLeft
 * windfury?2:1, shields shield?1:0, warded ward?1:0, frozen false.
 */
export function addCreature(game: Game, player: PlayerIndex, partial: AddCreatureInput): CreatureState {
  const id = `syn-${++creatureCounter}`;
  const keywords: Keyword[] = partial.keywords ?? [];
  const creature: CreatureState = {
    id,
    cardId: partial.id,
    owner: player,
    attack: partial.attack,
    health: partial.health,
    maxHealth: partial.health,
    reflect: partial.reflect ?? partial.attack,
    keywords,
    exhausted: partial.exhausted ?? true,
    attacksLeft: keywords.includes('windfury') ? 2 : 1,
    shields: keywords.includes('shield') ? 1 : 0,
    warded: keywords.includes('ward'),
    frozen: false,
    silenced: false,  // fixtures are never silenced at creation
    token: false,  // synthetic fixtures are hand-placed creatures, never tokens
    spellPower: 0,
  };
  game.state.players[player].board.push(creature);
  const base: Card = {
    id: partial.id,
    name: `Test ${partial.id}`,
    type: 'creature',
    cost: partial.cost ?? 1,
    attack: partial.attack,
    health: partial.health,
    reflect: partial.reflect ?? partial.attack,
    keywords,
    effects: [],
    rarity: 'common',
    archetype: 'neutral',
    art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
    author: 'curated',
    version: 1,
  };
  game.registry.register(partial.trigger
    ? { ...base, triggers: [{ when: partial.trigger, effects: partial.effects ?? [] }] }
    : base);
  return creature;
}
