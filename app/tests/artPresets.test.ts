import { describe, it, expect } from 'vitest';
import { buildPool } from '@ashen/core';
import { PRESETS } from '../src/components/artPresets.js';

describe('art presets', () => {
  it('every curated card references a known preset', () => {
    const known = new Set(Object.keys(PRESETS));
    const unknown = buildPool().filter((card) => !known.has(card.art.preset));
    expect(unknown.map((card) => `${card.id} -> ${card.art.preset}`)).toEqual([]);
  });

  it('all preset gradient pairs are distinct', () => {
    const gradients = new Set(Object.values(PRESETS).map((p) => JSON.stringify(p.gradient)));
    expect(gradients.size).toBe(Object.keys(PRESETS).length);
  });
});
