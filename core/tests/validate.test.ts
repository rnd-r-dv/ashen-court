import { describe, it, expect } from 'vitest';
import { validateCard, validateDeck, RARITY_COPY_LIMIT, statBudget } from '../src/validate.js';
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
