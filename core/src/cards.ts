import type { Card } from './types.js';

/** Pool access for the card collection. */
export class CardRegistry {
  private readonly poolMap: Map<string, Card>;

  constructor(cards: Card[]) {
    this.poolMap = new Map(cards.map(c => [c.id, c]));
  }

  /** Throws on unknown ids so engine/Forge get loud feedback instead of undefined. */
  get(id: string): Card {
    const card = this.poolMap.get(id);
    if (!card) throw new Error(`Unknown card id: ${id}`);
    return card;
  }

  has(id: string): boolean {
    return this.poolMap.has(id);
  }

  pool(): Map<string, Card> {
    return this.poolMap;
  }

  /** Cards flagged as tokens (summoned by effects, not in a player's collection). */
  tokens(): Card[] {
    return [...this.poolMap.values()].filter(c => c.archetype === 'token');
  }
}
