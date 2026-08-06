// Board screen integration test (Task 31): renders the real Match screen in
// jsdom and simulates the human click-through from the manual check —
// mulligan keep/redraw toggles + confirm, play a card (instant and targeted),
// attack, hero power, end turn — versus a recruit bot auto-played by
// useMatch, across several turns. Math.random is pinned so the bot deck pick
// and the game seed are deterministic (no flaky draws). Mirrors
// drivers.test.ts's fake-timer conventions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import Match from '../src/screens/Match.js';
import { buildMatchEntry } from '../src/game/matchSetup.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PACING = 300;

let root: Root | null = null;
let entry: ReturnType<typeof buildMatchEntry>;

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Match, { setup: entry.setup }));
  });
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target not found');
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Advance until it is the human's turn again (or the game ends). */
function waitForHumanTurn(guard = 400) {
  for (let i = 0; i < guard; i++) {
    const g = entry.setup.driver.game();
    if (g.state.phase === 'gameOver') return;
    if (g.state.phase === 'main' && g.currentPlayer() === 0) return;
    advance(PACING);
  }
  throw new Error('bot turn never finished');
}

beforeEach(() => {
  vi.useFakeTimers();
  // Pinned randomness: fixed game seed and a fixed bot archetype pick.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  entry = buildMatchEntry({
    mode: 'bot',
    difficulty: 'recruit',
    decks: [{ slug: 'ember', name: 'Ember' }],
  });
  mount();
});

afterEach(() => {
  act(() => {
    root!.unmount();
  });
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Match board (Task 31)', () => {
  it('full human click-through across turns against the recruit bot', () => {
    const game = () => entry.setup.driver.game();

    // ---- mulligan ----
    expect(game().state.phase).toBe('mulligan');
    const toggles = document.querySelectorAll('.mulligan-toggle');
    expect(toggles.length).toBe(3); // player 0 starts with 3 cards
    // toggle every card to redraw, then confirm
    toggles.forEach((t) => click(t));
    click(document.querySelector('.match--mulligan .shell-btn-primary'));
    expect(game().state.mulligansDone[0]).toBe(true);
    expect(game().state.players[0].hand.length).toBe(3); // redrew all 3
    // bot mulligans (paced) → main phase
    advance(PACING * 2);
    expect(game().state.phase).toBe('main');

    let playedCards = 0;
    let attacks = 0;
    let powersUsed = 0;

    // ---- play several turns ----
    for (let t = 0; t < 6; t++) {
      // board chrome present
      expect(document.querySelectorAll('.heroportrait').length).toBe(2);
      expect(document.querySelectorAll('.board-enemyhand .cardview').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('.hand-slot').length).toBeGreaterThan(0);

      // play cards until no legal card remains
      for (let plays = 0; plays < 6; plays++) {
        const playable = document.querySelector('.hand-slot .card--playable');
        if (!playable) break;
        const handBefore = game().state.players[0].hand.length;
        click(playable.closest('.cardview'));
        const target = document.querySelector('.cardview--target, .heroportrait--target');
        if (target) click(target); // targeted effect: pick the first valid target
        advance(10);
        if (game().state.players[0].hand.length < handBefore) playedCards += 1;
      }
      advance(PACING);

      // attack with ready creatures
      for (let i = 0; i < 6; i++) {
        const ready = document.querySelector(
          '.board-row--bottom .cardview:not(.cardview--exhausted):not(.cardview--frozen)',
        );
        if (!ready) break;
        click(ready);
        const target = document.querySelector('.cardview--target, .heroportrait--target');
        if (!target) break; // creature was not actually selectable
        click(target);
        attacks += 1;
        advance(10);
      }

      // hero power if legal
      const power = document.querySelector<HTMLButtonElement>('.heroportrait-power:not(:disabled)');
      if (power) {
        const before = game().state.players[0].hero.usedPower;
        click(power);
        const target = document.querySelector('.cardview--target, .heroportrait--target');
        if (target) click(target);
        advance(10);
        if (game().state.players[0].hero.usedPower && !before) powersUsed += 1;
      }

      // end turn; wait out the bot's full turn
      click(document.querySelector('.board-endturn'));
      waitForHumanTurn();
      if (game().state.phase === 'gameOver') break;
    }

    // the click-through actually exercised the interactions
    expect(playedCards).toBeGreaterThan(0);
    expect(attacks + powersUsed).toBeGreaterThan(0);
    const g = game();
    expect(g.state.turn).toBeGreaterThanOrEqual(6);
    expect(g.state.players[0].board.length + g.state.players[0].hand.length).toBeGreaterThan(0);
  });
});
