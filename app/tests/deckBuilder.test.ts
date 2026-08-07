// Deck builder delete-path tests (audit 07 bug 21). deleteDeck returns false
// when localStorage rejects the write (I1/I9); the screen discarded that and
// unconditionally cleared the working deck + toasted "Deleted deck", so a
// quota-rejected delete told the user the deck was gone AND wiped their
// working list — while a reload brought the deck straight back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { DECK_DEFS, expandDeck } from '@ashen/core';
import { loadDecks, saveDeck } from '../src/storage.js';
import DeckBuilder from '../src/screens/DeckBuilder.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => localStorage.clear());

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

async function mountBuilder() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(DeckBuilder));
  });
  return host;
}

async function click(btn: HTMLButtonElement) {
  await act(async () => {
    btn.click();
  });
}

/** Drive the "Load a saved deck" <select> — this is what sets activeDeckId. */
async function loadSaved(slug: string) {
  const select = host!.querySelector('#deck-load') as HTMLSelectElement;
  await act(async () => {
    select.value = slug;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function deleteBtn(): HTMLButtonElement {
  return host!.querySelector('.deckbuilder-delete-btn') as HTMLButtonElement;
}

function nameInput(): HTMLInputElement {
  return host!.querySelector('#deck-name') as HTMLInputElement;
}

function toastText(): string {
  return host!.querySelector('.deckbuilder-toast')?.textContent ?? '';
}

describe('DeckBuilder delete deck', () => {
  it('does not claim success or clear the working deck when the write is rejected', async () => {
    const ids = expandDeck(DECK_DEFS.ember);
    saveDeck('mine', ids);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mountBuilder();
    await loadSaved('mine');
    expect(nameInput().value).toBe('mine');

    // Quota rejection on the delete write (deleteDeck → write → false). Swap
    // the global rather than spy: jsdom's Storage is a Proxy and vi.spyOn
    // cannot shadow its methods (same convention as storage.test.ts). Reads
    // still proxy to the real store so the screen keeps rendering.
    const real = globalThis.localStorage;
    const readOnlyStore: Storage = {
      get length() { return real.length; },
      clear() {},
      key(i: number) { return real.key(i); },
      getItem(k: string) { return real.getItem(k); },
      removeItem() {},
      setItem() { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); },
    };
    Object.defineProperty(globalThis, 'localStorage', { value: readOnlyStore, configurable: true, writable: true });
    try {
      await click(deleteBtn());
      expect(toastText()).not.toMatch(/Deleted deck/);
      expect(toastText()).toMatch(/could not be deleted|storage/i);
      // Working state survives — the deck is still loaded and still saved.
      expect(nameInput().value).toBe('mine');
      expect(deleteBtn().disabled).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true, writable: true });
    }
    expect(Object.keys(loadDecks())).toEqual(['custom:mine']);
  });

  it('clears state and reports success on a delete that actually lands', async () => {
    saveDeck('mine', expandDeck(DECK_DEFS.ember));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mountBuilder();
    await loadSaved('mine');
    await click(deleteBtn());

    expect(toastText()).toMatch(/Deleted deck "mine"/);
    expect(nameInput().value).toBe('');
    expect(deleteBtn().disabled).toBe(true);
    expect(loadDecks()).toEqual({});
  });

  it('a cancelled confirm leaves everything untouched', async () => {
    saveDeck('mine', expandDeck(DECK_DEFS.ember));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await mountBuilder();
    await loadSaved('mine');
    await click(deleteBtn());

    expect(toastText()).toBe('');
    expect(nameInput().value).toBe('mine');
    expect(Object.keys(loadDecks())).toEqual(['custom:mine']);
  });
});
