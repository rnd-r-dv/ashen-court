// Match-entry failure messaging (audit 07 bug 19). buildMatchEntry runs the
// Game constructor, which throws for ANY deck-validation error — unknown card
// ids, token cards, copy-limit violations, or a wrong card count. App used to
// hardcode "cards that are no longer available", which is a guess: a saved
// 1-card deck reports a missing-card problem that does not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { DECK_DEFS, expandDeck } from '@ashen/core';
import { saveDeck } from '../src/storage.js';
import App from '../src/App.js';

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

async function mountApp() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(App));
  });
  return host;
}

function buttonWith(text: string): HTMLButtonElement {
  const b = [...host!.querySelectorAll('button')].find((el) => el.textContent?.includes(text));
  if (!b) throw new Error(`no button matching "${text}"`);
  return b as HTMLButtonElement;
}

async function click(btn: HTMLButtonElement) {
  await act(async () => {
    btn.click();
  });
}

/** Menu → Play vs Bot → Recruit lands on the bot deck-pick grid. */
async function gotoBotDeckPick() {
  await mountApp();
  await click(buttonWith('Play vs Bot'));
  await click(buttonWith('Recruit'));
}

describe('App deck-pick match entry errors', () => {
  it('reports the real validation reason for an undersized custom deck', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    saveDeck('tiny', ['ember-cinderling']);
    await gotoBotDeckPick();
    await click(buttonWith('tiny'));
    expect(alert).toHaveBeenCalledTimes(1);
    const message = String(alert.mock.calls[0]![0]);
    // The engine's own detail — "Deck must be exactly 60 cards (has 1)".
    expect(message).toMatch(/exactly 60/);
    expect(message).toMatch(/1/);
    // …and NOT the old hardcoded guess.
    expect(message).not.toMatch(/no longer available/);
  });

  it('reports the real reason for a deck referencing a deleted custom card', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const ids = expandDeck(DECK_DEFS.ember).slice(0, 59);
    saveDeck('ghosted', [...ids, 'custom-deleted-card']);
    await gotoBotDeckPick();
    await click(buttonWith('ghosted'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String(alert.mock.calls[0]![0])).toMatch(/custom-deleted-card/);
  });

  it('does not alert and routes into the match for a valid curated deck', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await gotoBotDeckPick();
    await click(buttonWith('The Ember Court'));
    expect(alert).not.toHaveBeenCalled();
  });
});
