import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card as CardSpec } from '@ashen/core';
import CardView from '../src/components/CardView.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A creature whose stats every assertion hand-checks against. Reflect 0
 *  here is deliberate: this fixture predates the three-stat contract and the
 *  plate must truthfully show the engine's 0 counter-damage for an absent
 *  reflect — never "undefined" and never a borrowed attack value. */
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

// Task 5B: the decorative capacity-slot helper is gone — the board draws no
// empty slot outlines beside the creatures already down (the engine's normal
// cap of seven is untouched; it lives in core as BOARD_CAP). Its absence is
// pinned in boardFormation.test.ts; this suite now covers only the plate.

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

  it('attack, reflect and health carry accessible labels at hand size', () => {
    render('hand');
    const atk = host!.querySelector('.card__stat--attack')!;
    const refl = host!.querySelector('.card__stat--reflect')!;
    const hp = host!.querySelector('.card__stat--health')!;
    // Accessible label names the stat on the outer mark; a bare number does
    // not. The plate prints NO stat words — the glyph carries the meaning
    // and the label announces it (Task 4, reflect plan).
    expect(atk.getAttribute('aria-label')).toBe('Attack 4');
    expect(refl.getAttribute('aria-label')).toBe('Reflect 0');
    expect(hp.getAttribute('aria-label')).toBe('Health 5');
    expect(atk.textContent).not.toContain('Attack');
    expect(hp.textContent).not.toContain('Health');
  });

  it('attack, reflect and health carry accessible labels at board size', () => {
    // Board minis still show the three-mark rail — the labels must survive
    // the zoom, not vanish with the cost gem. (This fixture's def carries no
    // explicit reflect, so the plate truthfully shows Reflect 0.)
    render('board');
    const atk = host!.querySelector('.card__stat--attack')!;
    const refl = host!.querySelector('.card__stat--reflect')!;
    const hp = host!.querySelector('.card__stat--health')!;
    expect(atk.getAttribute('aria-label')).toBe('Attack 4');
    expect(refl.getAttribute('aria-label')).toBe('Reflect 0');
    expect(hp.getAttribute('aria-label')).toBe('Health 5');
    expect(atk.textContent).not.toContain('Attack');
    expect(hp.textContent).not.toContain('Health');
  });

  it('exposes the card archetype as data-archetype for the house tincture', () => {
    // card.css maps [data-archetype='ember'] to --house: var(--house-ember);
    // the frame/register identity, never the art mount.
    render('hand');
    expect(host!.querySelector('.card')!.getAttribute('data-archetype')).toBe('ember');
  });
});
