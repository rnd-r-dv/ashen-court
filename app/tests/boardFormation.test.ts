// Task 5B: centered dynamic board formations without spawn reflow (reflect
// plan, 2026-08-09). The board draws no decorative empty capacity slots;
// each side is one centered max-content formation (normals + an
// always-mounted token sub-band), and the player register's outer bounds are
// byte-identical before and after a token spawn because the token register
// reserves exactly one token card's width.
//
// jsdom neither lays out nor cascades stylesheet custom properties, so the
// contract is asserted in the same two honest layers as matchGeometry:
//   1. DOM-shape tests mount the real Board with a synthetic GameState and
//      assert structure, stable order, and the accessibility toggle.
//   2. CSS-source contract tests parse the shipped board.css (and the :root
//      card tokens) and check the exact formation equation at 1280×900.
// The browser matrix (Step 9) measures the real pixels on top of this.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { BOARD_CAP } from '@ashen/core';
import type { Card as CardSpec, CreatureState, GameState, PlayerIndex, PlayerState } from '@ashen/core';
import Board from '../src/components/Board.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const here = import.meta.url;
const BOARD_CSS = readFileSync(fileURLToPath(new URL('../src/components/board.css', here)), 'utf8');
const CARD_CSS = readFileSync(fileURLToPath(new URL('../src/components/card.css', here)), 'utf8');
const BOARD_TSX = readFileSync(fileURLToPath(new URL('../src/components/Board.tsx', here)), 'utf8');

/** Body of the FIRST rule whose selector contains `selector`, comments
 *  stripped — prose may name a dead recipe; only executable rules count
 *  (same idiom as matchGeometry.test.ts). */
function block(css: string, selector: string): string {
  const executable = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(executable);
  return m ? m[1]! : '';
}

/** Parse a bare `--name: <number><unit?>` custom property out of a rule body. */
function token(body: string, name: string, unit = 'px'): number {
  return Number(new RegExp(`${name}:\\s*([\\d.]+)${unit}`).exec(body)?.[1]);
}

// The plan's formation constants, parsed from the shipped stylesheets so the
// equations cannot drift from the CSS that actually renders.
const ROOT = block(CARD_CSS, ':root');
const CARD_W = token(ROOT, '--card-w'); // 240
const BOARD_SCALE = token(ROOT, '--board-card-scale', ''); // 0.5
const BOARD_CARD_W = CARD_W * BOARD_SCALE; // 120 — one board mini
const ROW = block(BOARD_CSS, '.board-row');
const TOKEN_REG = block(BOARD_CSS, '.board-token-register');
const BOARD = block(BOARD_CSS, '.board');
const TOKEN_ZOOM = token(BOARD, '--token-zoom', ''); // 0.72 — the token sub-scale

/** The formation gap at a viewport width: clamp(8px, GAP_VW vw, 16px). */
const GAP_VW = Number(/gap:\s*clamp\(\s*8px,\s*([\d.]+)vw,\s*16px\)/.exec(ROW)?.[1] ?? '0');
function gapAt(vw: number): number {
  return Math.min(16, Math.max(8, (GAP_VW / 100) * vw));
}

/** Total width of the always-mounted token register: one token card's
 *  reserve (content min-width) + its padding-left + its 1px dashed rule. */
function tokenRegisterWidthAt(vw: number): number {
  const pad = Number(
    /padding-left:\s*clamp\(\s*8px,\s*([\d.]+)vw,\s*16px\)/.exec(TOKEN_REG)?.[1] ?? `${GAP_VW}`,
  );
  const padAt = Math.min(16, Math.max(8, (pad / 100) * vw));
  return BOARD_CARD_W * TOKEN_ZOOM + padAt + 1;
}

/** Warden — the same synthetic fixture board.test.ts uses, so both suites
 *  exercise the identical plate language. */
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
    reflect: 3,
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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderBoard(state: GameState) {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      createElement(Board, {
        state,
        viewer: 0,
        getCard: () => WARDEN,
        legal: [],
        targeting: null,
        myTurn: false,
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

describe('formations without capacity slots (Task 5B)', () => {
  it('no longer exports the slotCount capacity-slot helper', async () => {
    const mod = await import('../src/components/Board.js');
    expect((mod as Record<string, unknown>).slotCount).toBeUndefined();
  });

  it('renders no decorative empty capacity slots', () => {
    // A half-empty board must show exactly the occupied creatures — no
    // dashed outlines "reserving" the remaining normal capacity.
    renderBoard(boardState([], [creature('me-1', false)]));
    expect(host!.querySelectorAll('.board-slot--empty')).toHaveLength(0);
    expect(host!.querySelectorAll('.board-row--bottom .board-slot:not(.board-slot--token)')).toHaveLength(1);
    // the empty-slot CSS is gone from the shipped stylesheet too
    expect(BOARD_CSS).not.toMatch(/board-slot--empty/);
  });

  it('renders 1, 2, and 7 normal creatures once in stable DOM order', () => {
    for (const n of [1, 2, 7]) {
      const normals = Array.from({ length: n }, (_, i) => creature(`me-${i}`, false));
      renderBoard(boardState([], normals));
      const slots = host!.querySelectorAll('.board-row--bottom .board-slot:not(.board-slot--token)');
      expect(slots, `one slot per normal at ${n}`).toHaveLength(n);
      // DOM order is the board's visual state (slot points drive combat FX):
      // splitting must never reorder the normal formation.
      const ids = [...slots].map((s) => s.getAttribute('data-creature-id'));
      expect(ids).toEqual(normals.map((c) => c.id));
    }
  });

  it('keeps the normal board capacity at exactly seven', () => {
    // The engine cap is untouched — the UI change is cosmetic.
    expect(BOARD_CAP).toBe(7);
    renderBoard(
      boardState([], Array.from({ length: BOARD_CAP }, (_, i) => creature(`me-${i}`, false))),
    );
    expect(host!.querySelectorAll('.board-row--bottom .board-slot:not(.board-slot--token)')).toHaveLength(7);
  });

  it('keeps tokens a separate partition that never consumes a normal slot', () => {
    const foe = [creature('foe-1', false, 1), creature('foe-2', false, 1), creature('foe-token', true, 1)];
    const me = [creature('me-1', false), creature('me-token-1', true), creature('me-token-2', true)];
    renderBoard(boardState(foe, me));

    // normal formations hold exactly the non-token creatures
    expect(host!.querySelectorAll('.board-row--top .board-slot:not(.board-slot--token)')).toHaveLength(2);
    expect(host!.querySelectorAll('.board-row--bottom .board-slot:not(.board-slot--token)')).toHaveLength(1);
    // tokens live only in the always-mounted token registers
    const foeTokens = host!.querySelectorAll('.board-token-register--top .board-slot');
    expect(foeTokens).toHaveLength(1);
    expect(foeTokens[0]!.getAttribute('data-creature-id')).toBe('foe-token');
    expect(host!.querySelectorAll('.board-token-register--bottom .board-slot')).toHaveLength(2);
  });

  it('keeps the data-creature-id anchors on real plates', () => {
    renderBoard(boardState([creature('foe-1', false, 1)], [creature('me-1', false), creature('me-t1', true)]));
    expect(host!.querySelector('.board-row--top .board-slot')!.getAttribute('data-creature-id')).toBe('foe-1');
    expect(host!.querySelector('.board-token-register--bottom .board-slot')!.getAttribute('data-creature-id')).toBe(
      'me-t1',
    );
  });
});

describe('spawn-stable player registers (Task 5B)', () => {
  it('always mounts a token register inside each player register', () => {
    renderBoard(boardState([], []));
    const registers = host!.querySelectorAll('.board-player-register');
    expect(registers).toHaveLength(2);
    for (const r of registers) {
      expect(r.querySelector('.board-token-register')).not.toBeNull();
    }
    expect(host!.querySelectorAll('.board-token-register')).toHaveLength(2);
  });

  it('hides empty token content and exposes it once a token appears', () => {
    renderBoard(boardState([], []));
    const reg = host!.querySelector('.board-zone--bottom .board-token-register')!;
    // mounted but accessibly hidden — the reserve stays in the layout
    expect(reg).not.toBeNull();
    expect(reg.getAttribute('aria-hidden')).toBe('true');
    expect(reg.childElementCount).toBe(0);

    renderBoard(boardState([], [creature('me-t1', true)]));
    const reg2 = host!.querySelector('.board-zone--bottom .board-token-register')!;
    expect(reg2.hasAttribute('aria-hidden')).toBe(false);
    expect(reg2.getAttribute('aria-label')).toBe('Your tokens');
    expect(reg2.querySelector('.board-slot')).not.toBeNull();
  });

  it('keeps the outer player-register structure identical when a token appears', () => {
    // The register row definition (classes, mount) is constant across the
    // spawn — only the token register's own visibility/aria state toggles,
    // so the outer bounds cannot move.
    renderBoard(boardState([], [creature('me-1', false)]));
    const before = host!.querySelector('.board-zone--bottom .board-player-register')!;
    const beforeRow = before.querySelector('.board-row')!;
    const beforeToken = before.querySelector('.board-token-register')!;
    expect(beforeRow.childElementCount).toBe(2); // normals + token register

    renderBoard(boardState([], [creature('me-1', false), creature('me-t1', true)]));
    const after = host!.querySelector('.board-zone--bottom .board-player-register')!;
    expect(after.className).toBe(before.className);
    expect(after.querySelector('.board-row')!.className).toBe(beforeRow.className);
    expect(after.querySelector('.board-token-register')!.className).toBe(beforeToken.className);
  });

  it('never gates the token register mount on tokens.length', () => {
    // A conditional mount (`{tokens.length > 0 && ...}`) would let the empty
    // band unmount and the register's height jump on the first spawn. The
    // register must be mounted unconditionally; only its content state flips.
    const executable = BOARD_TSX.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(executable).not.toMatch(/tokens\.length\s*>\s*0\s*&&/);
  });

  it('hides empty token content with visibility, not display:none', () => {
    // `:empty` hides only the band's content once the last token's exit
    // finishes (AnimatePresence keeps the exiting plate in the DOM, so the
    // dissolve still plays), while the reserve keeps its layout box.
    const emptyRule = block(BOARD_CSS, '.board-token-register:empty');
    expect(emptyRule).toMatch(/visibility:\s*hidden/);
    expect(emptyRule).not.toMatch(/display:\s*none/);
  });

  it('centers max-content formations with auto margins and no wrap', () => {
    expect(ROW).toMatch(/width:\s*max-content/);
    expect(ROW).toMatch(/margin:\s*0\s+auto/);
    // wrapping would reorder the formation onto a second line — never allowed
    expect(ROW).not.toMatch(/flex-wrap:\s*wrap/);
  });

  it('reserves exactly one token card in the token register', () => {
    // The band's min-width is derived from the card tokens (--card-w ×
    // --board-card-scale × --token-zoom), never a copied literal, and the
    // one-token reserve is what makes the 0→1 spawn byte-identical.
    expect(TOKEN_ZOOM).toBeCloseTo(0.72, 6);
    expect(TOKEN_REG).toMatch(
      /min-width:\s*calc\(var\(--card-w\)\s*\*\s*var\(--board-card-scale\)\s*\*\s*var\(--token-zoom\)\)/,
    );
  });

  it('fits seven normal cards plus the token reserve on one line at 1280×900', () => {
    // Formation width = 7 board minis + 7 gaps (6 between normals + 1 before
    // the token register) + the one-token reserve. At 1280 the register body
    // is 1037px wide (board 1200 − margin 139 − zone gap 24, measured in the
    // Task 5B browser report). The formation must fit without scaling — the
    // gap contracts before the card scale would ever change.
    const g = gapAt(1280);
    const reserve = tokenRegisterWidthAt(1280);
    const formation = 7 * BOARD_CARD_W + 7 * g + reserve;
    expect(g).toBeGreaterThanOrEqual(8);
    expect(formation).toBeLessThanOrEqual(1036);
    // and the SAME equation holds with the board minis at their base scale —
    // no width-tier zoom can be required at the supported floor.
    expect(BOARD_CARD_W).toBe(120);
  });

  it('keeps an empty pointer-inert combat lane between the zones', () => {
    renderBoard(boardState([], []));
    const lane = host!.querySelector('.board-combat-lane');
    expect(lane).not.toBeNull();
    expect(lane!.childElementCount).toBe(0);
    expect(lane!.getAttribute('aria-hidden')).toBe('true');
    const top = host!.querySelector('.board-zone--top')!;
    const bottom = host!.querySelector('.board-zone--bottom')!;
    expect(top.compareDocumentPosition(lane!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lane!.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block(BOARD_CSS, '.board-combat-lane')).toMatch(/pointer-events:\s*none/);
  });
});
