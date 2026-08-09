// DiscoverOverlay tests (Task 3). Renders the real overlay in jsdom and pins
// the accessibility contract end to end:
//   - the owner sees three full CardView size="preview" plates (only the
//     owner — a non-owner sees a bare waiting state with no candidate names);
//   - click and the 1/2/3 shortcuts submit the correct candidate index;
//   - ArrowLeft/ArrowRight move focus in a ring (wrapping);
//   - Tab/Shift+Tab wrap among the three choice buttons;
//   - Escape cannot dismiss an unresolved choice (there is no dismiss path);
//   - the modal contract: role="dialog", aria-modal="true", an explicit
//     heading (aria-labelledby), initial focus on the first card.
//
// No mocks: a real CardRegistry (buildPool) supplies getCard, and onChoose is
// a plain spy the component must call with the chosen index.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { buildPool, CardRegistry } from '@ashen/core';
import type { Card, PendingChoice, PlayerIndex } from '@ashen/core';
import DiscoverOverlay from '../src/components/DiscoverOverlay.js';
import type { DiscoverOverlayProps } from '../src/components/DiscoverOverlay.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const registry = new CardRegistry(buildPool());
function getCard(id: string): Card | undefined {
  try {
    return registry.get(id);
  } catch {
    return undefined;
  }
}
function choice(player: PlayerIndex, cardIds: string[]): PendingChoice {
  return { kind: 'discover', player, cardIds };
}

const CANDIDATES = ['neutral-boar', 'neutral-militia', 'neutral-scroll'];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(props: DiscoverOverlayProps) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(DiscoverOverlay, props));
  });
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target not found');
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Dispatch a keydown on the focused element (bubbles to the overlay handler). */
function press(keyValue: string, shiftKey = false) {
  act(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: keyValue, shiftKey, bubbles: true }),
    );
  });
}

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('DiscoverOverlay — owner view', () => {
  it('shows the owner three full preview card plates inside three choice buttons', () => {
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const buttons = document.querySelectorAll<HTMLButtonElement>('.discover-choice');
    expect(buttons.length).toBe(3);
    const plates = document.querySelectorAll('.discover-choice .cardview--preview');
    expect(plates.length).toBe(3);
    // The plates are the actual candidate cards, in order.
    expect(plates[0]!.textContent).toContain('Wild Boar');
    expect(plates[1]!.textContent).toContain('Village Militia');
    expect(plates[2]!.textContent).toContain('Scroll of Lore');
    // Every candidate name is visible — nothing is hidden from the owner.
    for (const b of buttons) expect(b.textContent!.length).toBeGreaterThan(0);
  });

  it('initializes focus on the first card button', () => {
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const first = document.querySelector<HTMLButtonElement>('.discover-choice');
    expect(first).not.toBeNull();
    expect(document.activeElement).toBe(first);
  });

  it('submits the correct index on click', () => {
    const onChoose = vi.fn();
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose });
    const buttons = document.querySelectorAll<HTMLButtonElement>('.discover-choice');
    click(buttons[1]);
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(1);
    click(buttons[2]);
    expect(onChoose).toHaveBeenLastCalledWith(2);
  });

  it('submits the correct index via the 1/2/3 shortcuts', () => {
    const onChoose = vi.fn();
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose });
    press('1');
    expect(onChoose).toHaveBeenLastCalledWith(0);
    press('2');
    expect(onChoose).toHaveBeenLastCalledWith(1);
    press('3');
    expect(onChoose).toHaveBeenLastCalledWith(2);
    expect(onChoose).toHaveBeenCalledTimes(3);
  });

  it('moves focus with ArrowRight/ArrowLeft, wrapping at both ends', () => {
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const buttons = document.querySelectorAll<HTMLButtonElement>('.discover-choice');
    expect(document.activeElement).toBe(buttons[0]);
    press('ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    press('ArrowRight');
    expect(document.activeElement).toBe(buttons[2]);
    press('ArrowRight'); // wraps last -> first
    expect(document.activeElement).toBe(buttons[0]);
    press('ArrowLeft'); // wraps first -> last
    expect(document.activeElement).toBe(buttons[2]);
    press('ArrowLeft');
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('wraps focus with Tab and Shift+Tab among the three buttons', () => {
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const buttons = document.querySelectorAll<HTMLButtonElement>('.discover-choice');
    press('Tab', false); // 1 -> 2 (no wrap yet)
    expect(document.activeElement).toBe(buttons[1]);
    press('Tab', false);
    expect(document.activeElement).toBe(buttons[2]);
    press('Tab', false); // wrap last -> first
    expect(document.activeElement).toBe(buttons[0]);
    press('Tab', true); // wrap first -> last (Shift+Tab)
    expect(document.activeElement).toBe(buttons[2]);
    press('Tab', true);
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('cannot dismiss an unresolved choice with Escape', () => {
    const onChoose = vi.fn();
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose });
    press('Escape');
    // The dialog is still mounted, still the owner view, and no choice made.
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelectorAll('.discover-choice').length).toBe(3);
    expect(onChoose).not.toHaveBeenCalled();
    // Focus did not leave the ring.
    const buttons = document.querySelectorAll<HTMLButtonElement>('.discover-choice');
    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe('DiscoverOverlay — modal contract', () => {
  it('renders a labelled modal dialog with an explicit heading', () => {
    mount({ choice: choice(0, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    const title = dialog!.querySelector('#discover-title');
    expect(title).not.toBeNull();
    expect(dialog!.getAttribute('aria-labelledby')).toBe('discover-title');
    expect(title!.textContent).toContain('Discover');
    // The board behind may be dimmed by a flat veil — never a gradient/glow
    // (visual rule; the veil is a plain translucent layer).
    const veil = document.querySelector('.discover-veil');
    expect(veil).not.toBeNull();
  });
});

describe('DiscoverOverlay — non-owner view', () => {
  it('shows only the waiting copy to a non-owner — no candidate names', () => {
    mount({ choice: choice(1, CANDIDATES), viewer: 0, getCard, onChoose: vi.fn() });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Opponent is choosing a card');
    // No candidate names leak: no plates, no choice buttons, no card art.
    expect(dialog!.querySelectorAll('.cardview').length).toBe(0);
    expect(dialog!.querySelectorAll('.discover-choice').length).toBe(0);
    expect(dialog!.textContent).not.toContain('Wild Boar');
    expect(dialog!.textContent).not.toContain('Village Militia');
    expect(dialog!.textContent).not.toContain('Scroll of Lore');
  });

  it('ignores keyboard input in the non-owner view', () => {
    const onChoose = vi.fn();
    mount({ choice: choice(1, CANDIDATES), viewer: 0, getCard, onChoose });
    press('1');
    press('ArrowRight');
    press('Tab');
    press('Escape');
    expect(onChoose).not.toHaveBeenCalled();
  });
});
