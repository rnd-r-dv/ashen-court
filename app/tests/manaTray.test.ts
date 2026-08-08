import { describe, expect, it } from 'vitest';
import { pipStates } from '../src/components/ManaTray.js';

describe('pipStates', () => {
  it('marks unspent crystals available and spent ones spent', () => {
    expect(pipStates(3, 5)).toEqual(['full', 'full', 'full', 'spent', 'spent']);
  });

  it('shows every crystal available on a fresh turn', () => {
    expect(pipStates(5, 5)).toEqual(['full', 'full', 'full', 'full', 'full']);
  });

  it('shows every crystal spent when tapped out', () => {
    expect(pipStates(0, 3)).toEqual(['spent', 'spent', 'spent']);
  });

  it('renders nothing before the first crystal is earned', () => {
    expect(pipStates(0, 0)).toEqual([]);
  });

  it('clamps to 15 so a runaway mana effect cannot overflow the rail', () => {
    expect(pipStates(20, 40)).toHaveLength(15);
  });

  it('never reports more available than the player has', () => {
    // Defensive: mana should never exceed maxMana, but the rail must not lie.
    expect(pipStates(9, 3)).toEqual(['full', 'full', 'full']);
  });
});
