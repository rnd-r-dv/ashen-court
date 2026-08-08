import { describe, expect, it } from 'vitest';
import { BOARD_CAP } from '@ashen/core';
import { slotCount } from '../src/components/Board.js';

describe('slotCount', () => {
  it('shows the full capacity when the board is empty', () => {
    expect(slotCount(0)).toBe(BOARD_CAP);
  });

  it('shows only the remaining room once creatures are down', () => {
    expect(slotCount(3)).toBe(BOARD_CAP - 3);
  });

  it('shows no empty slots on a full board', () => {
    expect(slotCount(BOARD_CAP)).toBe(0);
  });

  it('never returns a negative count', () => {
    // Defensive: a future effect could exceed the cap transiently.
    expect(slotCount(BOARD_CAP + 2)).toBe(0);
  });
});
