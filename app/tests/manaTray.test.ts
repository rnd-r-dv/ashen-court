import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import ManaTray, { pipStates } from '../src/components/ManaTray.js';
import type { ManaTrayProps } from '../src/components/ManaTray.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderTray(props: ManaTrayProps) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(createElement(ManaTray, props));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

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

describe('locked mana pips (Task 6)', () => {
  it('renders exactly the lockedMana count of struck-through pips', () => {
    renderTray({ mana: 3, maxMana: 5, lockedMana: 2 });
    const locked = host!.querySelectorAll('[aria-label="Locked mana"]');
    expect(locked).toHaveLength(2);
  });

  it('renders no locked pips when lockedMana is omitted', () => {
    renderTray({ mana: 3, maxMana: 5 });
    expect(host!.querySelectorAll('[aria-label="Locked mana"]')).toHaveLength(0);
  });

  it('keeps locked pips visible after ordinary mana is spent', () => {
    // Tap down to 1 mana: the normal rail marks 4 spent, but the 2 locked
    // pips are a separate ledger entry and must survive the spending.
    renderTray({ mana: 1, maxMana: 5, lockedMana: 2 });
    expect(host!.querySelectorAll('.manatray-pip--spent')).toHaveLength(4);
    expect(host!.querySelectorAll('.manatray-pip--locked')).toHaveLength(2);
    expect(host!.querySelectorAll('[aria-label="Locked mana"]')).toHaveLength(2);
  });

  it('leaves the normal rail and pipStates untouched', () => {
    // The locked column is presentation on top of the unchanged rail: same
    // full/spent split as pipStates(3,5), plus 2 locked pips beside it.
    renderTray({ mana: 3, maxMana: 5, lockedMana: 2 });
    expect(host!.querySelectorAll('.manatray-pip--full')).toHaveLength(3);
    expect(host!.querySelectorAll('.manatray-pip--spent')).toHaveLength(2);
    expect(pipStates(3, 5)).toEqual(['full', 'full', 'full', 'spent', 'spent']);
  });
});
