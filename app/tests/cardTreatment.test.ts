// app/tests/cardTreatment.test.ts
import { describe, expect, it } from 'vitest';
import { treatmentFor } from '../src/components/cardTreatment.js';

describe('treatmentFor', () => {
  it('gives epic and legendary the full-bleed treatment when art exists', () => {
    expect(treatmentFor('epic', true)).toBe('bleed');
    expect(treatmentFor('legendary', true)).toBe('bleed');
  });

  it('keeps common and rare banded even with art', () => {
    expect(treatmentFor('common', true)).toBe('banded');
    expect(treatmentFor('rare', true)).toBe('banded');
  });

  it('keeps epic and legendary banded when art is missing', () => {
    // Full-bleed over a procedural two-stop gradient would put rules text on
    // a flat colour field and read as broken, not premium. Both conditions
    // are required.
    expect(treatmentFor('epic', false)).toBe('banded');
    expect(treatmentFor('legendary', false)).toBe('banded');
  });

  it('is banded for everything when nothing has been generated yet', () => {
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(treatmentFor(r, false)).toBe('banded');
    }
  });
});
