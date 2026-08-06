import { describe, it, expect } from 'vitest';
import { buildPool, TOKEN_CARDS } from '../src/data/index.js';
import { validateCard, validateDeck } from '../src/validate.js';
import { CardRegistry } from '../src/cards.js';

describe('pool', () => {
  it('every curated card passes validateCard with no errors', () => {
    const pool = buildPool();
    for (const c of pool) {
      const issues = validateCard(c);
      expect(issues.filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
  });
  it('ids are unique', () => {
    const ids = buildPool().map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('includes mana-surge and tokens', () => {
    const pool = buildPool();
    expect(pool.some(c => c.id === 'mana-surge')).toBe(true);
    expect(TOKEN_CARDS.length).toBeGreaterThanOrEqual(6);
  });
  it('tokens cannot be used in decks', () => {
    const reg = new CardRegistry(buildPool());
    const issues = validateDeck(['token-rat'], reg.pool());
    expect(issues.some(i => i.severity === 'error')).toBe(true);
  });
});
