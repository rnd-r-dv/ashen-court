// scripts/tests/prompt.test.ts
import { describe, expect, it } from 'vitest';
import { aspectForRarity, buildCardPrompt, buildHeroPrompt } from '../art/prompt.js';
import { SUBJECT_OVERRIDES } from '../art/overrides.js';
import { styleFor } from '../art/styles.js';

const seraph = {
  id: 'choir-seraph',
  name: 'Seraph of Lament',
  flavor: 'She weeps for the wounded, and every wound she deals she carries home like a hymn.',
  archetype: 'choir',
  rarity: 'rare' as const,
};

describe('aspectForRarity', () => {
  it('gives epic and legendary the portrait ratio for full-bleed', () => {
    expect(aspectForRarity('epic')).toBe('3:4');
    expect(aspectForRarity('legendary')).toBe('3:4');
  });

  it('gives common and rare the landscape ratio for the banded panel', () => {
    expect(aspectForRarity('common')).toBe('3:2');
    expect(aspectForRarity('rare')).toBe('3:2');
  });
});

describe('buildCardPrompt', () => {
  it('composes style block, then name and flavor, then the global suffix', () => {
    const { prompt } = buildCardPrompt(seraph);
    const style = prompt.indexOf(styleFor('choir'));
    const subject = prompt.indexOf('Seraph of Lament');
    const suffix = prompt.indexOf('no lettering');
    expect(style).toBeGreaterThanOrEqual(0);
    expect(subject).toBeGreaterThan(style);
    expect(suffix).toBeGreaterThan(subject);
  });

  it('uses the card flavor as the subject line', () => {
    expect(buildCardPrompt(seraph).prompt).toContain('carries home like a hymn');
  });

  it('carries the rarity-derived aspect ratio', () => {
    expect(buildCardPrompt(seraph).aspectRatio).toBe('3:2');
    expect(buildCardPrompt({ ...seraph, rarity: 'legendary' }).aspectRatio).toBe('3:4');
  });

  it('prefers an override over the flavor line', () => {
    SUBJECT_OVERRIDES['choir-seraph'] = 'A cracked marble statue of a mourning angel';
    try {
      const { prompt } = buildCardPrompt(seraph);
      expect(prompt).toContain('cracked marble statue');
      expect(prompt).not.toContain('carries home like a hymn');
    } finally {
      delete SUBJECT_OVERRIDES['choir-seraph'];
    }
  });

  it('falls back to the name alone when a card somehow has no flavor', () => {
    const { prompt } = buildCardPrompt({ ...seraph, flavor: undefined });
    expect(prompt).toContain('Seraph of Lament');
    expect(prompt).not.toContain('undefined');
  });

  it('gives neutrals the neutral block, not an archetype look', () => {
    const { prompt } = buildCardPrompt({ ...seraph, archetype: 'neutral' });
    expect(prompt).toContain(styleFor('neutral'));
    expect(prompt).not.toContain(styleFor('choir'));
  });

  it('gives tokens the neutral block too', () => {
    const { prompt } = buildCardPrompt({ ...seraph, archetype: 'token' });
    expect(prompt).toContain(styleFor('neutral'));
  });

  it('never emits pixel dimensions', () => {
    expect(buildCardPrompt(seraph).prompt).not.toMatch(/\d{3,4}\s*[x×]\s*\d{3,4}/);
  });
});

describe('buildHeroPrompt', () => {
  it('is always square, whatever the archetype', () => {
    expect(buildHeroPrompt('Vespera Dawnlight', 'choir').aspectRatio).toBe('1:1');
    expect(buildHeroPrompt('Pyra Emberveil', 'ember').aspectRatio).toBe('1:1');
  });

  it('asks for a bust framed for a circular crop', () => {
    const { prompt } = buildHeroPrompt('Vespera Dawnlight', 'choir');
    expect(prompt).toContain('Vespera Dawnlight');
    expect(prompt).toContain('portrait bust');
    expect(prompt).toContain(styleFor('choir'));
  });
});
