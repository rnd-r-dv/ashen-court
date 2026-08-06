import { Game } from '../src/engine/game.js';
import type { HeroSpec } from '../src/types.js';

export const hero = (name: string): HeroSpec => ({ name, power: { name: 'Test Power', cost: 2, effects: [{ kind: 'dealDamage', value: 1, target: 'any' }] } });

export function makeTestSetup(): ConstructorParameters<typeof Game>[0] {
  // Build a 60-card pool of plain creatures + mana-surge, seeded deterministically
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) ids.push(`t-${String(i).padStart(3, '0')}`);
  return { decks: [ids, [...ids].reverse()], heroes: [hero('A'), hero('B')], seed: 1 };
}
