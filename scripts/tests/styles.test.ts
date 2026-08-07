// scripts/tests/styles.test.ts
import { describe, expect, it } from 'vitest';
import { GLOBAL_SUFFIX, STYLE_BLOCKS, styleFor } from '../art/styles.js';

const ARCHETYPES = [
  'ember', 'choir', 'vermin', 'dragon', 'roots', 'dance',
  'bone', 'pact', 'coven', 'star', 'vigil', 'storm',
];

describe('style blocks', () => {
  it('covers all 12 archetypes plus neutral and token', () => {
    for (const a of [...ARCHETYPES, 'neutral', 'token']) {
      expect(STYLE_BLOCKS[a], `missing style block for ${a}`).toBeTruthy();
    }
    expect(Object.keys(STYLE_BLOCKS)).toHaveLength(14);
  });

  it('keeps every authored block distinct, so archetypes do not read alike', () => {
    // 'token' is deliberately an alias of 'neutral' (tokens belong to no deck),
    // so it is excluded — the other 13 must all differ.
    const authored = Object.entries(STYLE_BLOCKS)
      .filter(([k]) => k !== 'token')
      .map(([, v]) => v);
    expect(new Set(authored).size).toBe(authored.length);
  });

  it('routes tokens to the neutral look — they belong to no deck', () => {
    expect(styleFor('token')).toBe(styleFor('neutral'));
  });

  it('falls back to neutral for an unknown archetype rather than throwing', () => {
    expect(styleFor('not-a-real-archetype')).toBe(STYLE_BLOCKS['neutral']);
  });

  it('suppresses text in the global suffix — FLUX renders lettering readily', () => {
    expect(GLOBAL_SUFFIX).toContain('no text');
    expect(GLOBAL_SUFFIX).toContain('no lettering');
    expect(GLOBAL_SUFFIX).toContain('no watermark');
  });

  it('never mentions pixel dimensions anywhere', () => {
    const all = [GLOBAL_SUFFIX, ...Object.values(STYLE_BLOCKS)].join(' ');
    expect(all).not.toMatch(/\d{3,4}\s*[x×]\s*\d{3,4}/);
  });
});
