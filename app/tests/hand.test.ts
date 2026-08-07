// Hand slot-key tests (bug 24). useStableHandKeys exists so that surviving
// hand cards keep their DOM node across a play from the middle (no remount →
// no replayed handEnter draw animation), while a genuinely new card gets a
// fresh key so its draw animation DOES play.
//
// The hook only ever sees `string[]` of card ids — the engine has no
// per-copy instance identity — so the two properties are asserted at the DOM
// level: node object identity across re-renders is exactly what React's
// keyed reconciliation preserves or discards.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card as CardSpec } from '@ashen/core';
import Hand from '../src/components/Hand.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function card(id: string): CardSpec {
  return {
    id,
    name: id.toUpperCase(),
    type: 'spell',
    cost: 1,
    keywords: [],
    effects: [],
    rarity: 'common',
    archetype: 'test',
    art: { preset: 'ember', palette: ['#a33', '#511'], seed: 1 },
    author: 'curated',
    version: 1,
  };
}

const POOL: Record<string, CardSpec> = { a: card('a'), b: card('b') };
const getCard = (id: string): CardSpec | undefined => POOL[id];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Render the real Hand with the given hand contents. */
function render(hand: string[]) {
  act(() => {
    root!.render(
      createElement(Hand, {
        hand,
        getCard,
        playable: new Set<number>(),
        interactive: true,
        targeting: false,
        onCardClick: () => {},
      }),
    );
  });
}

/** The per-slot animated wrappers, in DOM order (one per hand card). */
function slots(): Element[] {
  return [...container!.querySelectorAll('.hand-slot-anim')];
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('Hand slot keys (bug 24)', () => {
  it('keeps every surviving slot mounted when a duplicate is played from the middle', () => {
    render(['a', 'a', 'b']);
    const before = slots();
    expect(before).toHaveLength(3);

    // Play the FIRST copy of `a` (engine splices it out; order preserved).
    render(['a', 'b']);
    const after = slots();
    expect(after).toHaveLength(2);
    // Neither survivor may remount: the surviving `a` must still be one of
    // the two `a` nodes, and `b` must be its original node.
    expect(before).toContain(after[0]);
    expect(after[1]).toBe(before[2]);
  });

  it('gives a card drawn in the same update as a duplicate play a fresh slot', () => {
    // hand [a, b] → play `a` and draw another `a` in one resolution (one
    // state-mirror update, so the hook only ever sees [a,b] → [b,a]).
    render(['a', 'b']);
    const before = slots();
    expect(before).toHaveLength(2);

    render(['b', 'a']);
    const after = slots();
    expect(after).toHaveLength(2);
    // `b` survived — same node, no remount, no replayed draw animation.
    expect(after[0]).toBe(before[1]);
    // The `a` in hand is a freshly drawn card, NOT the one that was played:
    // it must mount fresh so handEnter runs. Reusing the played card's node
    // silently swallows the draw animation.
    expect(after[1]).not.toBe(before[0]);
  });

  it('does not remount anything when the hand is unchanged', () => {
    render(['a', 'a', 'b']);
    const before = slots();
    render(['a', 'a', 'b']);
    expect(slots()).toEqual(before);
  });

  it('gives each newly drawn copy of an already-held id its own fresh slot', () => {
    render(['a']);
    const before = slots();
    render(['a', 'a']);
    const after = slots();
    expect(after[0]).toBe(before[0]); // held card untouched
    expect(after[1]).not.toBe(before[0]); // the drawn copy is new
  });
});
