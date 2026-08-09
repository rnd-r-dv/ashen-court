import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { KEYWORD_TEXT } from '@ashen/core';
import KeywordChip from '../src/components/KeywordChip.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(node); });
}

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  host = null;
  root = null;
});

describe('KeywordChip', () => {
  it('shows no description until clicked', () => {
    render(createElement(KeywordChip, { keyword: 'taunt' }));
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.taunt);
  });

  it('reveals the engine text on click', () => {
    render(createElement(KeywordChip, { keyword: 'ward' }));
    const btn = host!.querySelector('button')!;
    act(() => { btn.click(); });
    // The popover is portalled to document.body, so query the document.
    expect(document.body.textContent).toContain(KEYWORD_TEXT.ward);
  });

  it('closes on a second click', () => {
    render(createElement(KeywordChip, { keyword: 'shield' }));
    const btn = host!.querySelector('button')!;
    act(() => { btn.click(); });
    act(() => { btn.click(); });
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.shield);
  });

  it('closes on Escape', () => {
    render(createElement(KeywordChip, { keyword: 'lifesteal' }));
    act(() => { host!.querySelector('button')!.click(); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.lifesteal);
  });

  it('does not let the click reach an enclosing card', () => {
    // Board creatures are clickable for attack targeting. A chip click must
    // describe the keyword WITHOUT also selecting an attacker.
    let outer = 0;
    render(
      createElement(
        'div',
        { onClick: () => { outer += 1; } },
        createElement(KeywordChip, { keyword: 'rush' }),
      ),
    );
    act(() => { host!.querySelector('button')!.click(); });
    expect(outer).toBe(0);
  });

  it('describes every keyword the engine defines', () => {
    for (const k of Object.keys(KEYWORD_TEXT) as (keyof typeof KEYWORD_TEXT)[]) {
      expect(KEYWORD_TEXT[k].length).toBeGreaterThan(0);
    }
  });

  it('plain variant renders a static span — visible text, no button, no popover', () => {
    // Used inside the discover choice buttons (Task 3 review round 1): the
    // keyword text stays visible on the plate, but as a non-interactive
    // span — a <button> here would nest inside the choice button (invalid
    // DOM) and a describe affordance would steal the choice click.
    render(createElement(KeywordChip, { keyword: 'taunt', variant: 'plain' }));
    const chip = host!.querySelector('.kwchip--plain');
    expect(chip).not.toBeNull();
    expect(chip!.tagName).toBe('SPAN');
    expect(chip!.textContent).toBe('taunt');
    expect(host!.querySelector('button')).toBeNull();
    // Nothing to click — the keyword text is not a describe control.
    act(() => {
      chip!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain(KEYWORD_TEXT.taunt);
  });
});
