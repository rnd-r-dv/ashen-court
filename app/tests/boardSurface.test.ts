import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { BOARD_CAP } from '@ashen/core';
import type { Card as CardSpec } from '@ashen/core';
import { slotCount } from '../src/components/Board.js';
import CardView from '../src/components/CardView.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A creature whose stats every assertion hand-checks against. */
const CREATURE: CardSpec = {
  id: 'surface-warden',
  name: 'Surface Warden',
  type: 'creature',
  cost: 3,
  attack: 4,
  health: 5,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'ember',
  art: { preset: 'ember', palette: ['#7a1f1f', '#2b0d0d'], seed: 1 },
  author: 'curated',
  version: 1,
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function render(size: 'hand' | 'board') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(createElement(CardView, { card: CREATURE, size }));
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

describe('card plate surface', () => {
  it('hand plate carries a cost marker', () => {
    // The mana cost is live information in hand, so the gem renders there.
    render('hand');
    const cost = host!.querySelector('.card__cost');
    expect(cost).not.toBeNull();
    expect(cost!.getAttribute('aria-label')).toBe('3 mana');
  });

  it('board plate carries no cost marker', () => {
    // A board creature's cost is already paid; a rendered gem would read as a
    // third defense stat — exactly the misread recorded in app/PRODUCT.md.
    // The cost must be absent from the DOM, not merely styled away.
    render('board');
    expect(host!.querySelector('.card__cost')).toBeNull();
  });

  it('attack and health carry accessible labels at hand size', () => {
    render('hand');
    const atk = host!.querySelector('.card__stat--attack')!;
    const hp = host!.querySelector('.card__stat--health')!;
    // Accessible label names the stat; a bare number does not.
    expect(atk.getAttribute('aria-label')).toBe('Attack 4');
    expect(hp.getAttribute('aria-label')).toBe('Health 5');
    // And the word is VISIBLE (Cardo small caps), not just announced.
    expect(atk.textContent).toContain('Attack');
    expect(hp.textContent).toContain('Health');
  });

  it('attack and health carry accessible labels at board size', () => {
    // Board minis still show stats — the labels must survive the zoom, not
    // vanish with the cost gem.
    render('board');
    const atk = host!.querySelector('.card__stat--attack')!;
    const hp = host!.querySelector('.card__stat--health')!;
    expect(atk.getAttribute('aria-label')).toBe('Attack 4');
    expect(hp.getAttribute('aria-label')).toBe('Health 5');
    expect(atk.textContent).toContain('Attack');
    expect(hp.textContent).toContain('Health');
  });

  it('exposes the card archetype as data-archetype for the house tincture', () => {
    // card.css maps [data-archetype='ember'] to --house: var(--house-ember);
    // the frame/register identity, never the art mount.
    render('hand');
    expect(host!.querySelector('.card')!.getAttribute('data-archetype')).toBe('ember');
  });
});
