import { describe, it, expect } from 'vitest';
import { buildPool } from '../src/data/index.js';
import { cardText } from '../src/cardtext.js';
import { statBudget, KEYWORD_COST, validateCard, STAT_BUDGET_SLACK } from '../src/validate.js';
import { TOKEN_CAP } from '../src/engine/effects.js';

const pool = buildPool().filter(c => c.archetype !== 'token');

describe('pool balance', () => {
  it('every card passes validateCard with no errors', () => {
    for (const card of pool) {
      const errors = validateCard(card).filter(i => i.severity === 'error');
      expect(errors, `${card.id}: ${errors.map(e => e.message).join('; ')}`).toHaveLength(0);
    }
  });

  it('no creature sits far BELOW its stat budget', () => {
    const under: string[] = [];
    for (const card of pool) {
      if (card.type !== 'creature') continue;
      if (cardText(card).length > 0) continue;   // text pays for stats
      const spent = (card.attack ?? 0) + (card.health ?? 0)
        + card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
      // A vanilla body must land within 2 of its budget in either direction.
      if (spent < statBudget(card.cost) - 2) under.push(`${card.id} (${spent} vs ${statBudget(card.cost)})`);
    }
    expect(under, `underpowered vanillas: ${under.join(', ')}`).toHaveLength(0);
  });

  it('no creature exceeds the ceiling', () => {
    for (const card of pool) {
      if (card.type !== 'creature') continue;
      const spent = (card.attack ?? 0) + (card.health ?? 0)
        + card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
      expect(spent, card.id).toBeLessThanOrEqual(statBudget(card.cost) + STAT_BUDGET_SLACK);
    }
  });

  it('no summon effect promises more tokens than the row can hold', () => {
    for (const card of pool) {
      const specs = [...card.effects, ...(card.triggers ?? []).flatMap(t => t.effects)];
      for (const s of specs) {
        if (s.kind !== 'summon') continue;
        expect(s.value ?? 1, `${card.id} summons ${s.value}`).toBeLessThanOrEqual(TOKEN_CAP);
      }
    }
  });

  it('at most 45 cards carry no rules text and no keyword', () => {
    const blank = pool.filter(c => cardText(c).length === 0 && c.keywords.length === 0);
    expect(blank.length, `blank cards: ${blank.map(c => c.id).join(', ')}`).toBeLessThanOrEqual(45);
  });
});
