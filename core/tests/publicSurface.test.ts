import { describe, expect, it } from 'vitest';
import { BOARD_CAP } from '../src/index.js';

describe('public surface', () => {
  it('exports BOARD_CAP so the UI can draw the right number of slots', () => {
    // Hardcoding 7 in the app would desync the outline from the rule.
    expect(BOARD_CAP).toBe(7);
  });
});
