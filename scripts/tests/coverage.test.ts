// scripts/tests/coverage.test.ts
import { describe, expect, it } from 'vitest';
import { inCoverage, parseCoverage } from '../art/coverage.js';

describe('coverage', () => {
  it('includes everything under all', () => {
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(inCoverage(r, 'all')).toBe(true);
    }
  });

  it('drops commons under rare+', () => {
    expect(inCoverage('common', 'rare+')).toBe(false);
    expect(inCoverage('rare', 'rare+')).toBe(true);
    expect(inCoverage('epic', 'rare+')).toBe(true);
    expect(inCoverage('legendary', 'rare+')).toBe(true);
  });

  it('keeps only epic and legendary under epic+ — the cost fallback', () => {
    expect(inCoverage('common', 'epic+')).toBe(false);
    expect(inCoverage('rare', 'epic+')).toBe(false);
    expect(inCoverage('epic', 'epic+')).toBe(true);
    expect(inCoverage('legendary', 'epic+')).toBe(true);
  });

  it('parses the three documented values', () => {
    expect(parseCoverage('all')).toBe('all');
    expect(parseCoverage('rare+')).toBe('rare+');
    expect(parseCoverage('epic+')).toBe('epic+');
  });

  it('rejects an unknown value loudly rather than defaulting', () => {
    // Silently defaulting to 'all' on a typo would burn the whole daily
    // request allowance — or, on a paid model, real money — by accident.
    expect(() => parseCoverage('epic')).toThrow(/coverage/i);
    expect(() => parseCoverage('')).toThrow(/coverage/i);
  });
});
