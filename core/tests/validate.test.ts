import { describe, it, expect } from 'vitest';
import { validateCard, validateDeck, RARITY_COPY_LIMIT, statBudget, STAT_BUDGET_SLACK } from '../src/validate.js';
import type { Card } from '../src/types.js';

const base = (over: Partial<Card> = {}): Card => ({
  id: 'test-001', name: 'Test', type: 'creature', cost: 3, attack: 3, health: 3,
  keywords: [], rarity: 'common', archetype: 'neutral', author: 'curated', version: 1,
  art: { preset: 'shadow', palette: ['#111', '#333'], seed: 1 }, effects: [], ...over,
});

describe('validateCard', () => {
  it('accepts a valid vanilla creature', () => expect(validateCard(base())).toEqual([]));
  it('rejects empty name and bad id', () => {
    expect(validateCard(base({ name: '' })).some(i => i.severity === 'error')).toBe(true);
    expect(validateCard(base({ id: 'no dashes' })).some(i => i.severity === 'error')).toBe(true);
  });
  it('rejects cost outside 0..15', () => {
    expect(validateCard(base({ cost: 16 })).some(i => i.severity === 'error')).toBe(true);
  });
  it('rejects creature without stats and spell with stats', () => {
    expect(validateCard(base({ attack: undefined, health: undefined })).some(i => i.severity === 'error')).toBe(true);
    expect(validateCard(base({ type: 'spell', attack: 3, health: 3 })).some(i => i.severity === 'error')).toBe(true);
  });
  it('rejects stats exceeding the cost budget', () => {
    expect(validateCard(base({ cost: 1, attack: 10, health: 10 })).some(i => i.severity === 'error')).toBe(true);
  });
  it('allows the design slack above the vanilla baseline (I10)', () => {
    // statBudget(3) = 8; the enforced ceiling is 8 + STAT_BUDGET_SLACK = 12.
    expect(STAT_BUDGET_SLACK).toBe(4);
    const atCeiling = base({ cost: 3, attack: 6, health: 6 });           // spent 12 == ceiling
    expect(validateCard(atCeiling).filter(i => i.field === 'stats')).toEqual([]);
    const underCeiling = base({ cost: 3, attack: 6, health: 5 });        // spent 11, over baseline
    expect(validateCard(underCeiling).filter(i => i.field === 'stats')).toEqual([]);
  });
  it('reports the overage against the enforced ceiling, not the baseline (I10)', () => {
    // spent 13, budget 8, ceiling 12 → real overage is 1, not 5.
    const issue = validateCard(base({ cost: 3, attack: 7, health: 6 })).find(i => i.field === 'stats');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('13');   // what the card spends
    expect(issue!.message).toContain('12');   // the ceiling actually enforced
    expect(issue!.message).not.toMatch(/exceed\w*\s+by\s+5\b/);
  });
  it('counts keyword cost toward the ceiling (I10)', () => {
    // cost 3 → baseline 8, ceiling 12. 5/5 + charge(2) = 12 → legal; +taunt(1) = 13 → error.
    expect(validateCard(base({ cost: 3, attack: 5, health: 5, keywords: ['charge'] })).filter(i => i.field === 'stats')).toEqual([]);
    expect(validateCard(base({ cost: 3, attack: 5, health: 5, keywords: ['charge', 'taunt'] })).some(i => i.field === 'stats')).toBe(true);
  });
  it('rejects single-target effects without a target', () => {
    expect(validateCard(base({ type: 'spell', effects: [{ kind: 'dealDamage', value: 1 }] })).some(i => i.severity === 'error')).toBe(true);
  });
  it('rejects illegal keyword combos (taunt on spell, ward+taunt)', () => {
    expect(validateCard(base({ type: 'spell', keywords: ['taunt'] })).some(i => i.severity === 'error')).toBe(true);
    expect(validateCard(base({ keywords: ['ward', 'taunt'] })).some(i => i.severity === 'error')).toBe(true);
  });
  it('rejects battlecry on non-creature and missing effect for trigger', () => {
    expect(validateCard(base({ type: 'spell', triggers: [{ when: 'battlecry', effects: [{ kind: 'dealDamage', value: 1 }] }] })).some(i => i.severity === 'error')).toBe(true);
    expect(validateCard(base({ triggers: [{ when: 'deathrattle', effects: [] }] })).some(i => i.severity === 'error')).toBe(true);
    expect(validateCard(base({ type: 'spell', effects: [] })).some(i => i.severity === 'error')).toBe(true);
  });
});

describe('validateDeck', () => {
  it('enforces rarity copy limits', () => {
    expect(RARITY_COPY_LIMIT).toEqual({ common: 3, rare: 2, epic: 1, legendary: 1 });
  });
  it('rejects 4 copies of a common', () => {
    const card = base({ id: 'x-001' });
    const issues = validateDeck(['x-001', 'x-001', 'x-001', 'x-001'], new Map([['x-001', card]]));
    expect(issues.some(i => i.message.includes('copies'))).toBe(true);
  });
  it('rejects unknown card ids', () => {
    expect(validateDeck(['nope'], new Map()).some(i => i.severity === 'error')).toBe(true);
  });
  it('statBudget follows the formula', () => {
    expect(statBudget(0)).toBe(2); expect(statBudget(1)).toBe(4);
    expect(statBudget(5)).toBe(12); expect(statBudget(15)).toBe(32);
  });
});
