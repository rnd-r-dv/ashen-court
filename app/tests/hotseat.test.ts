// Hotseat pass-and-play tests (Task 32). Covers the playerVisibility pure
// helper (the pass-and-play contract: a player sees their hand only while
// they are the acting player — own main turn or their own mulligan) and a
// driver-level hotseat game where BOTH players are humans submitting through
// one useMatch hook — asserting, via the helper (not the DOM), that
// visibility flips exactly at each pass point.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  buildPool,
  CardRegistry,
  createBot,
  DECK_DEFS,
  expandDeck,
  Game,
  HEROES,
  mulliganPolicy,
} from '@ashen/core';
import type { GameState, MatchSetup, PlayerIndex } from '@ashen/core';
import { createLocalDriver } from '../src/game/drivers.js';
import { playerVisibility } from '../src/game/playerVisibility.js';
import { useMatch } from '../src/game/useMatch.js';
import type { UseMatchApi, UseMatchOpts } from '../src/game/useMatch.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pool = new CardRegistry(buildPool());
const deck = expandDeck(DECK_DEFS.ember);

function makeSetup(seed: number): MatchSetup {
  return { seed, decks: [deck, deck], heroes: [HEROES[0]!, HEROES[6]!] };
}

function makeGame(seed: number): Game {
  return Game.create(makeSetup(seed), pool);
}

/** The engine's mulligan actor: player 0 first, then player 1 (turn stays 0). */
function mulliganActor(state: GameState): PlayerIndex {
  return (state.mulligansDone[0] ? 1 : 0) as PlayerIndex;
}

/** Mount useMatch in a real react-dom root; `api` is a LIVE getter (see drivers.test.ts). */
function mountHook(opts: UseMatchOpts): { api: UseMatchApi; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const holder: { api: UseMatchApi | undefined } = { api: undefined };
  function Probe() {
    const result = useMatch(opts);
    useEffect(() => {
      holder.api = result;
    });
    return null;
  }
  act(() => {
    root.render(createElement(Probe));
  });
  if (!holder.api) throw new Error('useMatch did not mount');
  return {
    get api() {
      return holder.api as UseMatchApi;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('playerVisibility', () => {
  it('shows the viewer\'s hand on their own main turn and hides it on the opponent\'s', () => {
    const g = makeGame(11);
    g.submit({ kind: 'mulligan', keep: [] });
    g.submit({ kind: 'mulligan', keep: [] });
    // main phase, turn 0 → player 0's turn
    expect(g.state.phase).toBe('main');
    expect(playerVisibility(g.state, 0)).toBe(true);
    expect(playerVisibility(g.state, 1)).toBe(false);

    // player 0 ends turn → player 1's turn: the pass point
    g.submit({ kind: 'endTurn' });
    expect(playerVisibility(g.state, 0)).toBe(false);
    expect(playerVisibility(g.state, 1)).toBe(true);

    // and back
    g.submit({ kind: 'endTurn' });
    expect(playerVisibility(g.state, 0)).toBe(true);
    expect(playerVisibility(g.state, 1)).toBe(false);
  });

  it('mulligan: only the player still to mulligan sees their hand, flipping between the two', () => {
    const g = makeGame(12);
    // game start: player 0 is the mulligan actor
    expect(g.state.phase).toBe('mulligan');
    expect(playerVisibility(g.state, 0)).toBe(true);
    expect(playerVisibility(g.state, 1)).toBe(false);

    // after player 0 mulligans, the actor is player 1 — the pass point
    g.submit({ kind: 'mulligan', keep: [] });
    expect(mulliganActor(g.state)).toBe(1);
    expect(playerVisibility(g.state, 0)).toBe(false);
    expect(playerVisibility(g.state, 1)).toBe(true);

    // after player 1 mulligans, the match begins on player 0's turn
    g.submit({ kind: 'mulligan', keep: [] });
    expect(g.state.phase).toBe('main');
    expect(playerVisibility(g.state, 0)).toBe(true);
  });

  it('hides both hands at game over', () => {
    const g = makeGame(13);
    // The pure helper only reads phase/turn/mulligansDone — a real state with
    // the phase overridden is a faithful input for the game-over branch.
    const over: GameState = { ...g.state, phase: 'gameOver' };
    expect(playerVisibility(over, 0)).toBe(false);
    expect(playerVisibility(over, 1)).toBe(false);
  });
});

describe('hotseat pass-and-play (useMatch, both players human)', () => {
  it('flips visibility at every pass point through one shared driver', async () => {
    const driver = createLocalDriver(makeGame(21));
    const hook = mountHook({ driver, myPlayer: 0 }); // no bot — both humans
    try {
      // player 0's mulligan: their hand is up
      expect(playerVisibility(hook.api.state, 0)).toBe(true);
      expect(playerVisibility(hook.api.state, 1)).toBe(false);
      act(() => {
        hook.api.submit({ kind: 'mulligan', keep: [] });
      });
      // pass point: player 1 must mulligan now — player 0's hand hides
      expect(playerVisibility(hook.api.state, 0)).toBe(false);
      expect(playerVisibility(hook.api.state, 1)).toBe(true);
      act(() => {
        hook.api.submit({ kind: 'mulligan', keep: [] });
      });
      expect(hook.api.state.phase).toBe('main');

      // player 0's main turn 0: visible
      expect(playerVisibility(hook.api.state, 0)).toBe(true);
      // player 0 passes → player 1's turn 1: hide player 0, show player 1
      act(() => {
        hook.api.submit({ kind: 'endTurn' });
      });
      expect(playerVisibility(hook.api.state, 0)).toBe(false);
      expect(playerVisibility(hook.api.state, 1)).toBe(true);
      // player 1 passes back → player 0's turn 2
      act(() => {
        hook.api.submit({ kind: 'endTurn' });
      });
      expect(playerVisibility(hook.api.state, 0)).toBe(true);
      expect(playerVisibility(hook.api.state, 1)).toBe(false);
    } finally {
      hook.unmount();
    }
  });

  it('keeps visibility with the acting player across a full two-human match', async () => {
    const driver = createLocalDriver(makeGame(22));
    const hook = mountHook({ driver, myPlayer: 0 }); // no bot — both humans
    try {
      const g = driver.game();
      // Each step the engine expects the mulligan actor / current player to
      // act; that player's hand is visible, the other's hidden — exactly the
      // pass-and-play invariant the UI renders from.
      for (let guard = 0; g.state.phase !== 'gameOver' && guard < 10000; guard++) {
        const actor: PlayerIndex =
          g.state.phase === 'mulligan' ? mulliganActor(g.state) : g.currentPlayer();
        expect(playerVisibility(hook.api.state, actor)).toBe(true);
        expect(playerVisibility(hook.api.state, (1 - actor) as PlayerIndex)).toBe(false);
        const intent =
          g.state.phase === 'mulligan'
            ? mulliganPolicy(g, actor)
            : createBot('recruit').chooseIntent(g, actor);
        act(() => {
          hook.api.submit(intent);
        });
      }
      expect(g.state.phase).toBe('gameOver');
      // the hook's mirrored state reflects the end, and both hands hide
      expect(playerVisibility(hook.api.state, 0)).toBe(false);
      expect(playerVisibility(hook.api.state, 1)).toBe(false);
    } finally {
      hook.unmount();
    }
  });
});
