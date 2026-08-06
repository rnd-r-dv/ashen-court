import { describe, it, expect } from 'vitest';
import { createRng, pickRandom } from '../src/rng.js';

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42); const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('differs across seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
  it('produces floats in [0,1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('pickRandom returns a uniform member and consumes rng', () => {
    const r = createRng(3); const arr = ['a', 'b', 'c'];
    const out = pickRandom(r, arr);
    expect(arr).toContain(out);
  });
});
