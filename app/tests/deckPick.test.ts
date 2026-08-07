// Deck-pick screen tests (audit 07 bug 17). The hotseat highlight used the
// GRID index as an index into `picks` (which holds at most 2 entries), so a
// deck picked anywhere past grid position 1 never highlighted. The highlight
// means "this deck is one of the already locked-in picks" — a content match
// against the picks array, not a positional one.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { saveDeck } from '../src/storage.js';
import DeckPick from '../src/screens/DeckPick.js';
import type { DeckPickResult } from '../src/screens/DeckPick.js';
import type { Mode } from '../src/types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => localStorage.clear());

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mount(mode: Mode, onComplete: (p: DeckPickResult) => void = () => {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(DeckPick, { mode, onComplete }));
  });
  return host;
}

/** All deck buttons in the curated grid (first shell-grid) or custom grid. */
function grids(): { curated: HTMLButtonElement[]; custom: HTMLButtonElement[] } {
  const all = [...host!.querySelectorAll('.shell-grid')] as HTMLElement[];
  const toButtons = (el: HTMLElement | undefined) =>
    el ? ([...el.querySelectorAll('button.deck-card')] as HTMLButtonElement[]) : [];
  return { curated: toButtons(all[0]), custom: toButtons(all[1]) };
}

async function click(btn: HTMLButtonElement) {
  await act(async () => {
    btn.click();
  });
}

describe('DeckPick hotseat highlight', () => {
  it('highlights a locked-in pick that sits deep in the curated grid', async () => {
    await mount('hotseat');
    const { curated } = grids();
    expect(curated.length).toBe(12);
    const target = curated[5]!; // grid position 5 — picks[5] is always undefined
    await click(target);
    const after = grids().curated;
    expect(after[5]!.className).toContain('selected');
    // …and nothing else lit up.
    expect(after.filter((b) => b.className.includes('selected'))).toHaveLength(1);
  });

  it('keeps player 1s pick highlighted while player 2 chooses, then shows both', async () => {
    const picks: DeckPickResult[] = [];
    await mount('hotseat', (p) => picks.push(p));
    await click(grids().curated[3]!);
    expect(grids().curated[3]!.className).toContain('selected');
    await click(grids().curated[9]!);
    const after = grids().curated;
    expect(after[3]!.className).toContain('selected');
    expect(after[9]!.className).toContain('selected');
    expect(picks).toHaveLength(1);
    expect(picks[0]!.decks).toHaveLength(2);
  });

  it('a custom pick never cross-highlights the curated grid', async () => {
    saveDeck('my-deck', ['a', 'b']);
    await mount('hotseat');
    const { custom } = grids();
    expect(custom).toHaveLength(1);
    await click(custom[0]!);
    expect(grids().custom[0]!.className).toContain('selected');
    expect(grids().curated.some((b) => b.className.includes('selected'))).toBe(false);
  });

  it('redoing player 1s pick clears the highlight', async () => {
    await mount('hotseat');
    await click(grids().curated[7]!);
    expect(grids().curated[7]!.className).toContain('selected');
    const redo = [...host!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes("Redo Player 1's pick"),
    ) as HTMLButtonElement;
    await click(redo);
    expect(grids().curated.some((b) => b.className.includes('selected'))).toBe(false);
  });
});

describe('DeckPick bot highlight', () => {
  it('highlights the single pick wherever it sits in the grid', async () => {
    await mount('bot');
    await click(grids().curated[8]!);
    expect(grids().curated[8]!.className).toContain('selected');
  });
});

describe('DeckPick custom deck labels', () => {
  it('shows the clean slug for a namespaced custom overlay', async () => {
    saveDeck('my-deck', ['a', 'b']);
    await mount('bot');
    const name = grids().custom[0]!.querySelector('.deck-card-name')?.textContent;
    expect(name).toBe('my-deck');
  });
});
