// InspectPanel (Task 7 of the discover-armorial plan): the read-only modal
// that explains a board creature with a FULL preview plate carrying LIVE
// state — attack/health from the CreatureState (not the def), the creature's
// CURRENT keyword array as interactive KeywordChip describe buttons, status
// badges + a status legend, and cardText() suppressed when the creature is
// silenced. Accessibility is part of correctness, same as DiscoverOverlay:
//   - role="dialog" + aria-modal, labelled by the card name;
//   - initial focus on the Close button;
//   - Tab/Shift+Tab wrap at both ends of the panel's focusables (the trap
//     also catches focus that somehow lands outside the dialog);
//   - Escape closes; a click on the flat backdrop veil closes;
//   - closing restores focus to the board slot that opened the panel.
// The keyword chips keep their interactive popovers (portalled above the
// overlay at z 60) — no nested buttons, no staticKeywords.
//
// Board-level click wiring (left/right click precedence, target-vs-inspect)
// lives in board.test.ts; this file tests the panel itself plus the fixture
// conventions the Board tests share.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card as CardSpec, CreatureState } from '@ashen/core';
import InspectPanel from '../src/components/InspectPanel.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Definition fixture: a creature whose DEF carries a taunt keyword and a
 * deathrattle trigger (cardText generates "Deathrattle: Deal 1 damage to all
 * enemies."). The live CreatureState overrides both, so the plate proves the
 * LIVE fields win — attack/health, keywords, and the silenced flag.
 */
const def = (): CardSpec => ({
  id: 'warden',
  name: 'Warden',
  type: 'creature',
  cost: 3,
  attack: 3,
  health: 3,
  keywords: ['taunt'],
  effects: [],
  triggers: [{ when: 'deathrattle', effects: [{ kind: 'dealDamage', value: 1, target: 'allEnemies' }] }],
  rarity: 'common',
  archetype: 'ember',
  art: { preset: 'ember', palette: ['#7a1f1f', '#2b0d0d'], seed: 1 },
  author: 'curated',
  version: 1,
});

/** Live creature: 7/5/2 (Attack/Reflect/Health), exhausted, frozen, 2 shields, keyword stealth —
 *  deliberately different from the def (3/3, taunt) so any assertion that
 *  reads the DEF instead of the creature fails loudly. */
function creature(overrides: Partial<CreatureState> = {}): CreatureState {
  return {
    id: 'warden-1',
    cardId: 'warden',
    owner: 0,
    attack: 7,
    reflect: 5,
    health: 2,
    maxHealth: 2,
    keywords: ['stealth'],
    exhausted: true,
    attacksLeft: 0,
    shields: 2,
    warded: false,
    frozen: true,
    silenced: false,
    token: false,
    spellPower: 0,
    ...overrides,
  };
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function renderPanel(state: CreatureState, onClose: () => void = () => {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(createElement(InspectPanel, { creature: state, def: def(), onClose }));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
  // The cleanup-restores-focus effect runs on unmount; clear any residual
  // document listeners and focused elements so tests do not bleed.
  document.body.innerHTML = '';
});

describe('InspectPanel live plate (Task 7)', () => {
  it('renders a modal dialog labelled by the card name', () => {
    renderPanel(creature());
    const dialog = host!.querySelector('.inspect-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('role')).toBe('dialog');
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-label')).toBe('Warden');
  });

  it('shows live attack and health from the CreatureState, not the def', () => {
    renderPanel(creature());
    const dialog = host!.querySelector('.inspect-dialog')!;
    expect(dialog.querySelector('.card__stat--attack')!.getAttribute('aria-label')).toBe('Attack 7');
    expect(dialog.querySelector('.card__stat--health')!.getAttribute('aria-label')).toBe('Health 2');
  });

  it('renders the live keyword array as interactive KeywordChip buttons', () => {
    renderPanel(creature());
    const chips = [...host!.querySelectorAll('.kwchip')];
    // LIVE keywords win: stealth (gained at runtime), not the def's taunt.
    expect(chips.map((c) => (c.textContent ?? '').trim())).toEqual(['stealth']);
    // Interactive describe buttons — a nested <button> problem does not exist
    // here, so the chips must keep their popover affordance.
    expect(chips[0]!.tagName).toBe('BUTTON');
  });

  it('shows the live statuses in plate language and in a status legend', () => {
    renderPanel(creature());
    // Plate language: frozen tint class, exhausted dimming, shield badge.
    expect(host!.querySelector('.cardview--frozen')).not.toBeNull();
    expect(host!.querySelector('.cardview--exhausted')).not.toBeNull();
    const badges = [...host!.querySelectorAll('.cardview-badge')].map((b) => b.textContent ?? '');
    expect(badges).toContain('frozen');
    expect(badges).toContain('shield 2');
    // Legend: exhausted + frozen + shield are named for the reader.
    const legend = host!.querySelector('.inspect-status');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toContain('Exhausted');
    expect(legend!.textContent).toContain('Frozen');
    expect(legend!.textContent).toContain('Shield 2');
  });

  it('renders the generated rules text for a live creature', () => {
    renderPanel(creature());
    expect(host!.textContent).toMatch(/Deathrattle: Deal 1 damage to all enemies/);
  });

  it('suppresses the generated rules text when the creature is silenced', () => {
    renderPanel(creature({ silenced: true }));
    expect(host!.querySelector('.card__text')).toBeNull();
    // The def's deathrattle trigger text must not leak through silence.
    expect(host!.textContent).not.toMatch(/Deathrattle:/);
  });

  it('never renders the board mini text well (the plate is a full preview)', () => {
    // The inspect plate is the READ surface — a full 240x336 preview plate,
    // not a board mini. The board mini's hidden well stays hidden.
    renderPanel(creature());
    expect(host!.querySelector('.card--preview')).not.toBeNull();
    expect(host!.querySelector('.card--board')).toBeNull();
  });
});

describe('InspectPanel accessibility (Task 7)', () => {
  it('moves initial focus to the Close button', () => {
    renderPanel(creature());
    expect(document.activeElement).toBe(host!.querySelector('.inspect-close'));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderPanel(creature(), onClose);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on a click inside the dialog', () => {
    const onClose = vi.fn();
    renderPanel(creature(), onClose);
    act(() => {
      host!.querySelector('.inspect-veil')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      host!.querySelector('.inspect-dialog')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab and Shift+Tab focus at the panel edges', () => {
    renderPanel(creature());
    const close = host!.querySelector('.inspect-close')!;
    const chips = [...host!.querySelectorAll('.kwchip')];
    const last = chips[chips.length - 1]!;

    // Forward: Tab from the last focusable wraps to the first (Close).
    (last as HTMLElement).focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(close);

    // Backward: Shift+Tab from the first wraps to the last focusable.
    (close as HTMLElement).focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the board slot that opened the panel', () => {
    const slot = document.createElement('div');
    slot.setAttribute('data-creature-id', 'warden-1');
    slot.tabIndex = -1; // programmatically focusable, not in the tab order
    document.body.appendChild(slot);
    renderPanel(creature());
    act(() => {
      root!.unmount();
    });
    expect(document.activeElement).toBe(slot);
    slot.remove();
  });
});
