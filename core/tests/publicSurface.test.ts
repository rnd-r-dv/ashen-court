import { describe, expect, it } from 'vitest';
import { BOARD_CAP, KEYWORD_COST } from '../src/index.js';

describe('public surface', () => {
  it('exports BOARD_CAP so the UI can draw the right number of slots', () => {
    // Hardcoding 7 in the app would desync the outline from the rule.
    expect(BOARD_CAP).toBe(7);
  });

  it('exports KEYWORD_COST so the Forge can derive its keyword picker', () => {
    // The Forge implements the same authoring contract validate.ts enforces
    // and needs the keyword SET as data, not as a hand-copied literal — a
    // literal silently dropped venom and stealth when they joined the union.
    expect(Object.keys(KEYWORD_COST).sort()).toEqual(
      ['taunt', 'rush', 'charge', 'windfury', 'lifesteal', 'ward', 'shield', 'venom', 'stealth'].sort(),
    );
  });
});
