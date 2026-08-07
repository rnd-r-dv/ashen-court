// Bug 23: Match must thread its animation scale into <Hand>. Hand declares
// and uses `animScale` (handEnter(animScale)), but Match rendered it without
// the prop, so the hand-draw lift always ran at full duration while every
// other animation halved in fast mode.
//
// The duration itself lives inside a Framer variant and never reaches the
// DOM in jsdom, so the assertion is on the wiring: Hand is replaced by a
// prop-recording stub and Match's render is inspected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import Match from '../src/screens/Match.js';
import { buildMatchEntry } from '../src/game/matchSetup.js';
import { saveSettings } from '../src/storage.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rec = vi.hoisted(() => ({ props: [] as { animScale?: number }[] }));

vi.mock('../src/components/Hand.js', () => ({
  default: (props: { animScale?: number }) => {
    rec.props.push(props);
    return null;
  },
}));

const SPACING = 180;

let root: Root | null = null;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function mountHotseat() {
  const entry = buildMatchEntry({
    mode: 'hotseat',
    decks: [
      { slug: 'ember', name: 'Ember Court' },
      { slug: 'bone', name: 'Bone Horde' },
    ],
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Match, { setup: entry.setup }));
  });
  // Both mulligans through the engine → main phase, where Hand renders.
  act(() => {
    void entry.setup.driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  act(() => {
    void entry.setup.driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  expect(entry.setup.driver.game().state.phase).toBe('main');
}

/** animScale from Match's most recent <Hand> render. */
function lastAnimScale(): number | undefined {
  const last = rec.props.at(-1);
  if (!last) throw new Error('Hand never rendered');
  return last.animScale;
}

beforeEach(() => {
  vi.useFakeTimers();
  rec.props.length = 0;
  localStorage.clear();
});

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  root = null;
});

describe('bug 23 — fast mode scales the hand-draw animation', () => {
  it('passes the full-speed scale to Hand by default', () => {
    saveSettings({ fastMode: false });
    mountHotseat();
    expect(lastAnimScale()).toBe(1);
  });

  it('passes the halved fast-mode scale to Hand', () => {
    saveSettings({ fastMode: true });
    mountHotseat();
    expect(lastAnimScale()).toBe(0.5);
  });

  it('follows the F hotkey flipping fast mode mid-match', () => {
    saveSettings({ fastMode: false });
    mountHotseat();
    expect(lastAnimScale()).toBe(1);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    });
    expect(lastAnimScale()).toBe(0.5);
  });
});
