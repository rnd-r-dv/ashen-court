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
import Board from '../src/components/Board.js';
import type { BoardTargeting } from '../src/components/Board.js';
import { BOARD_CAP, heroPowerText } from '@ashen/core';
import type { Card as CardSpec, CreatureState, GameState, Intent, PlayerIndex, PlayerState, TargetRef } from '@ashen/core';

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

      // attack with ready creatures (token band included — tokens attack too)
      for (let i = 0; i < 6; i++) {
        const ready = document.querySelector(
          '.board-row--bottom .cardview:not(.cardview--exhausted):not(.cardview--frozen), ' +
            '.board-row--tokens--bottom .cardview:not(.cardview--exhausted):not(.cardview--frozen)',
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

// ---------------------------------------------------------------------------
// Task 6: the board reads as a ruled page — normal creatures in two banded
// registers, tokens in subordinate sub-bands that never consume a normal-row
// slot. Renders the real Board with a synthetic GameState (real CardView
// stack, no mocks) so the row structure and live-card language are both real.
// ---------------------------------------------------------------------------

const WARDEN: CardSpec = {
  id: 'warden',
  name: 'Warden',
  type: 'creature',
  cost: 3,
  attack: 3,
  health: 3,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'ember',
  art: { preset: 'ember', palette: ['#7a1f1f', '#2b0d0d'], seed: 1 },
  author: 'curated',
  version: 1,
};

function creature(id: string, token: boolean, owner: PlayerIndex = 0): CreatureState {
  return {
    id,
    cardId: 'warden',
    owner,
    attack: 3,
    health: 3,
    maxHealth: 3,
    keywords: [],
    exhausted: false,
    attacksLeft: 1,
    shields: 0,
    warded: false,
    frozen: false,
    silenced: false,
    token,
    spellPower: 0,
  };
}

function playerState(board: CreatureState[]): PlayerState {
  return {
    hero: {
      name: 'Pyra Emberveil',
      hp: 30,
      maxHp: 30,
      shields: 0,
      // A real effect so heroPowerText is non-empty — the permanent blazon
      // assertions in the Task 7 suite read the generated sentence.
      power: { name: 'Ember Bolt', cost: 2, effects: [{ kind: 'dealDamage', value: 2, target: 'any' }] },
      usedPower: false,
      discountMostExpensive: 0,
      discountNextSpell: 0,
    },
    deck: [],
    hand: [],
    board,
    artifacts: [],
    mana: 1,
    maxMana: 5,
    surged: false,
    overload: 0,
    lockedMana: 2,
  };
}

function boardState(foeBoard: CreatureState[], meBoard: CreatureState[]): GameState {
  return {
    players: [playerState(meBoard), playerState(foeBoard)],
    turn: 0,
    phase: 'main',
    seed: 1,
    mulligansDone: [true, true],
    rngState: { seed: 1, calls: 0 },
    log: [],
    pendingChoice: null,
    pendingChoiceQueue: [],
  };
}

describe('board registers and token sub-bands (Task 6)', () => {
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;

  function renderBoard(
    state: GameState,
    opts?: { legal?: Intent[]; myTurn?: boolean; targeting?: BoardTargeting | null },
  ) {
    const legal = opts?.legal ?? [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        createElement(Board, {
          state,
          viewer: 0,
          getCard: () => WARDEN,
          legal,
          targeting: opts?.targeting ?? null,
          myTurn: opts?.myTurn ?? false,
          onSelectAttacker: () => {},
          onTargetClick: () => {},
          onHeroPower: () => {},
          onEndTurn: () => {},
          onCancel: () => {},
          onInspect: () => {},
        }),
      );
    });
  }

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('partitions both sides: normal registers plus subordinate token bands', () => {
    const foe = [creature('foe-1', false, 1), creature('foe-2', false, 1), creature('foe-token', true, 1)];
    const me = [creature('me-1', false), creature('me-token-1', true), creature('me-token-2', true)];
    renderBoard(boardState(foe, me));

    // enemy register: 2 normals + capacity outlines, tokens counted out
    expect(host!.querySelectorAll('.board-row--top .board-slot')).toHaveLength(2);
    expect(host!.querySelectorAll('.board-row--top .board-slot--empty')).toHaveLength(BOARD_CAP - 2);
    const foeTokens = host!.querySelectorAll('.board-row--tokens--top .board-slot');
    expect(foeTokens).toHaveLength(1);
    expect(foeTokens[0]!.getAttribute('data-creature-id')).toBe('foe-token');

    // friendly register: 1 normal + capacity outlines — tokens never consume
    // a normal-row slot
    expect(host!.querySelectorAll('.board-row--bottom .board-slot')).toHaveLength(1);
    expect(host!.querySelectorAll('.board-row--bottom .board-slot--empty')).toHaveLength(BOARD_CAP - 1);
    expect(host!.querySelectorAll('.board-row--tokens--bottom .board-slot')).toHaveLength(2);
  });

  it('renders tokens with the same CardView language at a smaller scale', () => {
    renderBoard(boardState([], [creature('me-token-1', true)]));
    const slot = host!.querySelector('.board-row--tokens--bottom .board-slot')!;
    expect(slot.getAttribute('data-creature-id')).toBe('me-token-1');
    // same live-stat language as a normal board plate
    expect(slot.querySelector('.cardview')).not.toBeNull();
    expect(slot.querySelector('.card__stat--attack')!.getAttribute('aria-label')).toBe('Attack 3');
    expect(slot.querySelector('.card__stat--health')!.getAttribute('aria-label')).toBe('Health 3');
    // and it is a smaller scale — a token slot, not a normal-row slot
    expect(slot.classList.contains('board-slot--token')).toBe(true);
  });

  it('keeps normal creatures selectable as attackers in the friendly register', () => {
    renderBoard(boardState([], [creature('me-1', false), creature('me-token-1', true)]), {
      myTurn: true,
      legal: [{ kind: 'attack', attackerId: 'me-1', target: { type: 'hero', player: 1 } }],
      targeting: { kind: 'attack', attackerId: 'me-1' },
    });
    const slot = host!.querySelector('.board-row--bottom .board-slot')!;
    expect(slot.querySelector('.card--selected')).not.toBeNull();
    // the token band renders beside it, untouched
    expect(host!.querySelector('.board-row--tokens--bottom .cardview')).not.toBeNull();
  });

  it('passes the friendly lockedMana through to the mana tray', () => {
    renderBoard(boardState([], []));
    expect(host!.querySelectorAll('[aria-label="Locked mana"]')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Task 7: inspection replaces nothing — it layers onto the click grammar.
// When idle, a left-click on an attack-ready friendly creature still selects
// the attacker; a left-click on an enemy creature or a friendly creature
// without attack-selection precedence inspects it. While targeting, a valid
// target left-click resolves targeting rather than inspecting. A right-click
// on either side ALWAYS suppresses the native context menu and inspects —
// including during targeting. Both house margins carry a permanent
// hero-power blazon (name, cost, generated text) and the hover-only `title`
// tooltip is gone from the hero power button.
// ---------------------------------------------------------------------------
describe('board inspection and hero blazons (Task 7)', () => {
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;

  interface RenderOpts {
    legal?: Intent[];
    myTurn?: boolean;
    targeting?: BoardTargeting | null;
    onInspect?: (id: string) => void;
    onSelectAttacker?: (id: string) => void;
    onTargetClick?: (ref: TargetRef) => void;
  }

  function renderBoard(state: GameState, opts: RenderOpts = {}) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        createElement(Board, {
          state,
          viewer: 0,
          getCard: () => WARDEN,
          legal: opts.legal ?? [],
          targeting: opts.targeting ?? null,
          myTurn: opts.myTurn ?? false,
          onSelectAttacker: opts.onSelectAttacker ?? (() => {}),
          onTargetClick: opts.onTargetClick ?? (() => {}),
          onHeroPower: () => {},
          onEndTurn: () => {},
          onCancel: () => {},
          onInspect: opts.onInspect ?? (() => {}),
        }),
      );
    });
  }

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = null;
    root = null;
  });

  it('left-click on an enemy creature while idle inspects it', () => {
    const onInspect = vi.fn();
    renderBoard(boardState([creature('foe-1', false, 1)], []), { onInspect });
    click(host!.querySelector('.board-row--top .cardview'));
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith('foe-1');
  });

  it('left-click on a friendly attack-ready creature still selects the attacker', () => {
    const onInspect = vi.fn();
    const onSelectAttacker = vi.fn();
    renderBoard(boardState([], [creature('me-1', false)]), {
      myTurn: true,
      legal: [{ kind: 'attack', attackerId: 'me-1', target: { type: 'hero', player: 1 } }],
      onInspect,
      onSelectAttacker,
    });
    click(host!.querySelector('.board-row--bottom .cardview'));
    expect(onSelectAttacker).toHaveBeenCalledTimes(1);
    expect(onSelectAttacker).toHaveBeenCalledWith('me-1');
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('left-click on a friendly creature without attack precedence inspects it', () => {
    const onInspect = vi.fn();
    renderBoard(boardState([], [creature('me-1', false)]), { onInspect });
    click(host!.querySelector('.board-row--bottom .cardview'));
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith('me-1');
  });

  it('left-click on a valid target while targeting resolves targeting, not inspection', () => {
    const onInspect = vi.fn();
    const onTargetClick = vi.fn();
    renderBoard(boardState([creature('foe-1', false, 1)], [creature('me-1', false)]), {
      myTurn: true,
      legal: [{ kind: 'attack', attackerId: 'me-1', target: { type: 'creature', id: 'foe-1' } }],
      targeting: { kind: 'attack', attackerId: 'me-1' },
      onInspect,
      onTargetClick,
    });
    click(host!.querySelector('.board-row--top .cardview'));
    expect(onTargetClick).toHaveBeenCalledTimes(1);
    expect(onTargetClick).toHaveBeenCalledWith({ type: 'creature', id: 'foe-1' });
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('right-click inspects and prevents the context menu — even while targeting', () => {
    const onInspect = vi.fn();
    renderBoard(boardState([creature('foe-1', false, 1)], [creature('me-1', false)]), {
      myTurn: true,
      legal: [{ kind: 'attack', attackerId: 'me-1', target: { type: 'creature', id: 'foe-1' } }],
      targeting: { kind: 'attack', attackerId: 'me-1' },
      onInspect,
    });
    const el = host!.querySelector('.board-row--top .cardview')!;
    let prevented = false;
    act(() => {
      const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      prevented = !el.dispatchEvent(evt);
    });
    expect(prevented).toBe(true);
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith('foe-1');
  });

  it('right-click on an attack-ready friendly creature inspects instead of selecting', () => {
    const onInspect = vi.fn();
    const onSelectAttacker = vi.fn();
    renderBoard(boardState([], [creature('me-1', false)]), {
      myTurn: true,
      legal: [{ kind: 'attack', attackerId: 'me-1', target: { type: 'hero', player: 1 } }],
      onInspect,
      onSelectAttacker,
    });
    const el = host!.querySelector('.board-row--bottom .cardview')!;
    let prevented = false;
    act(() => {
      const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      prevented = !el.dispatchEvent(evt);
    });
    expect(prevented).toBe(true);
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith('me-1');
    expect(onSelectAttacker).not.toHaveBeenCalled();
  });

  it('renders a permanent hero-power blazon in both house margins', () => {
    renderBoard(boardState([], []));
    const blazons = host!.querySelectorAll('.heroblazon');
    expect(blazons).toHaveLength(2);
    expect(host!.querySelectorAll('.board-zone--top .heroblazon')).toHaveLength(1);
    expect(host!.querySelectorAll('.board-zone--bottom .heroblazon')).toHaveLength(1);
    // Name, cost, and the GENERATED power text, all without hover.
    const text = heroPowerText({ name: 'Ember Bolt', cost: 2, effects: [{ kind: 'dealDamage', value: 2, target: 'any' }] });
    expect(text.length).toBeGreaterThan(0);
    for (const b of blazons) {
      expect(b.textContent).toContain('Ember Bolt');
      expect(b.textContent).toContain('2');
      expect(b.textContent).toContain(text);
    }
  });

  it('drops the hover-only title from the hero power button', () => {
    renderBoard(boardState([], []));
    const btn = host!.querySelector<HTMLButtonElement>('.heroportrait-power');
    expect(btn).not.toBeNull();
    expect(btn!.hasAttribute('title')).toBe(false);
    // The player's legal-power behavior survives: the button is still there
    // and still the power control (the blazon is read-only).
    expect(btn!.textContent).toContain('Ember Bolt');
  });
});
