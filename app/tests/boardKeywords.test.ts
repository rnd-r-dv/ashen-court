// Board card live-state rendering (Task 0): a board creature's keywords and
// rules text must reflect its LIVE CreatureState, not the immutable card
// definition. The engine mutates `CreatureState.keywords` (silence empties it,
// giveKeyword appends) and sets `CreatureState.silenced` (which suppresses the
// card def's triggers — those live on the CARD, not the creature, so clearing
// the array can never remove them). Board.tsx passes those two live fields in;
// CardView/Card/CardFrame must render them instead of the def. Hand cards omit
// both props and keep the def's chips and text.
//
// Renders the real CardView → Card → CardFrame stack (real components, real
// cardText) in jsdom — no mocks.
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card as CardSpec } from '@ashen/core';
import CardView from '../src/components/CardView.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Definition fixture: a creature whose DEF carries a taunt keyword and a
 * deathrattle trigger (so cardText generates "Deathrattle: ..."). The name
 * deliberately contains neither keyword so text-content assertions can tell
 * chips apart from the nameplate.
 */
const def = (): CardSpec => ({
  id: 'test-taunt-death',
  name: 'Test Creature',
  type: 'creature',
  cost: 3,
  attack: 3,
  health: 3,
  keywords: ['taunt'],
  effects: [],
  triggers: [{ when: 'deathrattle', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] }],
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'ember', palette: [], seed: 1 },
  author: 'curated',
  version: 1,
});

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(node); });
}

/** Keyword chip labels currently on the rendered card (in DOM order). */
function chips(): string[] {
  return [...host!.querySelectorAll('.kwchip')].map((el) => (el.textContent ?? '').trim());
}

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  host = null;
  root = null;
});

describe('board card live keywords and silence', () => {
  it('renders live keywords and silence over the board creature definition', () => {
    // Def has taunt + a deathrattle; the live creature has been silenced and
    // its keywords emptied to stealth. Only the LIVE state may appear.
    render(
      createElement(CardView, {
        card: def(),
        size: 'board',
        stats: { attack: 3, health: 3 },
        keywords: ['stealth'],
        silenced: true,
      }),
    );
    expect(chips()).toEqual(['stealth']);
    expect(chips()).not.toContain('taunt');
    // Silenced creatures render no rules text: the def's deathrattle trigger
    // text must not leak through.
    expect(host!.textContent).not.toMatch(/Deathrattle:/);
    expect(host!.querySelector('.card__text')).toBeNull();
  });

  it('shows a keyword the definition never had when the live state gains it', () => {
    // Inverse case: the runtime creature GAINED stealth (giveKeyword). The
    // def never carried it, so a stealth chip proves the live array wins.
    // Not silenced here — the def's deathrattle text still renders.
    render(
      createElement(CardView, {
        card: def(),
        size: 'board',
        stats: { attack: 3, health: 3 },
        keywords: ['taunt', 'stealth'],
      }),
    );
    expect(chips()).toEqual(['taunt', 'stealth']);
    expect(host!.textContent).toMatch(/Deathrattle:/);
  });

  it('keeps the immutable card-definition text when the props are omitted', () => {
    // Hand cards omit both props: the def's taunt chip and generated
    // deathrattle text render unchanged.
    render(createElement(CardView, { card: def() }));
    expect(chips()).toEqual(['taunt']);
    expect(chips()).not.toContain('stealth');
    expect(host!.textContent).toMatch(/Deathrattle:/);
  });
});
