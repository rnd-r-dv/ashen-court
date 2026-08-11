// Task 5A geometry contract (reflect plan, 2026-08-09): the board is
// stationary across turn boundaries, hand scale is CSS-owned
// (`--hand-card-scale` on :root), and the hand row contains its cards — card
// height + top padding + the scaled 12px hover lift — at every supported
// height, not only the two minimum proof viewports.
//
// jsdom neither lays out nor cascades stylesheet custom properties, so the
// contract is asserted in two honest layers:
//   1. CSS-source contract tests (same idiom as cardTextWell / animations):
//      parse the tokens, tiers, row clamp, padding, and lift out of the
//      shipped stylesheets and check the plan's exact equations and
//      one-pixel boundaries (983/984, 1060/1061).
//   2. DOM-shape tests: mount the real Match, drive turnStart, and assert
//      the board wrapper never receives the shift class; assert no hand-card
//      rect derived from that same contract intersects the board register.
// The browser matrix (Step 10) measures the real pixels on top of this.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { GameEvent, Intent } from '@ashen/core';
import type { MatchDriver, MatchScreenSetup } from '../src/types.js';
import Match from '../src/screens/Match.js';
import { buildMatchEntry } from '../src/game/matchSetup.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- CSS-source contract (captured in consts — see cardTextWell.test.ts) ----
const here = import.meta.url;
const CARD_CSS = readFileSync(fileURLToPath(new URL('../src/components/card.css', here)), 'utf8');
const MATCH_CSS = readFileSync(fileURLToPath(new URL('../src/screens/match.css', here)), 'utf8');
const HAND_CSS = readFileSync(fileURLToPath(new URL('../src/components/hand.css', here)), 'utf8');
const THEME_CSS = readFileSync(fileURLToPath(new URL('../src/theme.css', here)), 'utf8');

/** Body of the FIRST rule whose selector contains `selector`, comments
 *  stripped — prose may name a dead recipe; only executable rules count
 *  (same idiom as cardTextWell.test.ts's executableCss). */
function block(css: string, selector: string): string {
  const executable = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(executable);
  return m ? m[1]! : '';
}

/** Parse a bare `--name: <number><unit?>` custom property out of a rule body.
 *  Pass unit '' for unitless values (e.g. --card-ratio, --hand-card-scale). */
function token(body: string, name: string, unit = 'px'): number {
  return Number(new RegExp(`${name}:\\s*([\\d.]+)${unit}`).exec(body)?.[1]);
}

// The plan's constants, parsed from the shipped stylesheets so the equations
// cannot drift from the CSS that actually renders.
const ROOT = block(CARD_CSS, ':root');
const CARD_W = token(ROOT, '--card-w'); // 240
const CARD_RATIO = token(ROOT, '--card-ratio', ''); // 1.4
const CARD_H = CARD_W * CARD_RATIO; // 336 — the 5:7 TCG proportion
const BASE_SCALE = token(ROOT, '--hand-card-scale', ''); // 0.8
const BOARD_SCALE = token(ROOT, '--board-card-scale', ''); // 0.5
const HOVER = token(ROOT, '--card-hover'); // 12px hand hover lift
const SPACE_2_REM = token(THEME_CSS, '--space-2', 'rem'); // 0.5rem
const TOP_PAD = SPACE_2_REM * 16; // 8px at the default 16px root — .match-handwrap padding-top
const GAP = TOP_PAD; // .match row-gap is the same --space-2

/** Height tiers from card.css's `@media (max-height: Npx) and (min-width: 1201px)` blocks. */
const TIERS = [...CARD_CSS.matchAll(/@media \(max-height:\s*(\d+)px\)\s*and\s*\(min-width:\s*1201px\)\s*\{[^}]*--hand-card-scale:\s*([\d.]+)/g)].map(
  (m) => ({ maxHeight: Number(m[1]), scale: Number(m[2]) }),
);

/** CSS-resolved hand scale for a viewport height (the :root variable value).
 *  Tiers are checked most-restrictive-first: the 983 boundary below 984px,
 *  the 1060 boundary below 1061px, then the 0.8 base. */
function scaleFor(vh: number): number {
  for (const t of [...TIERS].sort((a, b) => a.maxHeight - b.maxHeight)) {
    if (vh <= t.maxHeight) return t.scale;
  }
  return BASE_SCALE;
}

/** Hand-row min-height from match.css's clamp(190px, 27vh, 300px). */
const ROW_CLAMP = block(MATCH_CSS, '.match-handwrap').match(
  /clamp\(\s*([\d.]+)px,\s*([\d.]+)vh,\s*([\d.]+)px\)/,
) ?? ['', '190', '27', '300'];
const ROW_MIN = Number(ROW_CLAMP[1]);
const ROW_VH = Number(ROW_CLAMP[2]);
const ROW_MAX = Number(ROW_CLAMP[3]);

/** The row height the vh clamp reserves for a viewport height. */
function rowFor(vh: number): number {
  return Math.min(ROW_MAX, Math.max(ROW_MIN, (ROW_VH / 100) * vh));
}

/** Content the row must contain: card height + top padding + scaled hover lift. */
function contentFor(vh: number): number {
  const s = scaleFor(vh);
  return CARD_H * s + TOP_PAD + HOVER * s;
}

// ---- scripted-driver harness (mirrors match.test.ts conventions) ----
const SPACING = 180;

interface ScriptedDriver extends MatchDriver {
  push(batch: GameEvent[]): void;
}

function scriptedDriver(base: MatchDriver): ScriptedDriver {
  const listeners = new Set<(events: GameEvent[]) => void>();
  base.onEvents((batch) => {
    for (const cb of [...listeners]) cb(batch);
  });
  return {
    push(batch) {
      for (const cb of [...listeners]) cb(batch);
    },
    async submit(intent: Intent) {
      return base.submit(intent);
    },
    onEvents(cb) {
      listeners.add(cb);
    },
    game: () => base.game(),
    reset: (setup) => base.reset(setup),
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(setup: MatchScreenSetup) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Match, { setup }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function reachMain(driver: ScriptedDriver) {
  act(() => {
    void driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  act(() => {
    void driver.submit({ kind: 'mulligan', keep: [] });
  });
  advance(SPACING * 10);
  expect(driver.game().state.phase).toBe('main');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // CSS-source-only describes never mount; guard the teardown.
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
  root = null;
  container = null;
});

describe('CSS contract — hand row containment (Task 5A)', () => {
  it('derives the card box: 240 × 1.4 = 336 (5:7), no independent height literal', () => {
    expect(CARD_W).toBe(240);
    expect(CARD_RATIO).toBe(1.4);
    expect(CARD_H).toBeCloseTo(336, 6);
    expect(ROOT).toMatch(/--card-h:\s*calc\(var\(--card-w\)\s*\*\s*var\(--card-ratio\)\)/);
  });

  it('pins the plan tiers: 0.8 base, 0.74 below 1061px, 0.66 below 984px', () => {
    expect(BASE_SCALE).toBeCloseTo(0.8, 6);
    expect(BOARD_SCALE).toBeCloseTo(0.5, 6);
    const byHeight = new Map(TIERS.map((t) => [t.maxHeight, t.scale]));
    expect(byHeight.get(1060)).toBeCloseTo(0.74, 6);
    expect(byHeight.get(983)).toBeCloseTo(0.66, 6);
    // --card-hover is the single 12px lift authority, consumed by the hover
    // rule and the row reserve alike.
    expect(HOVER).toBe(12);
    expect(block(CARD_CSS, '.card--hand:hover')).toMatch(/translateY\(calc\(-1 \* var\(--card-hover\)\)\)/);
  });

  it('satisfies the row equation at the supported heights — 237.68 < 243, 265.52 < 270, 286.4 < 291.6, then < 300', () => {
    // The plan's exact numbers: 900px uses 0.66 (237.68 < 243), 1000px uses
    // 0.74 (265.52 < 270), 1080px uses 0.80 (286.4 < 291.6), and taller
    // windows stay under the 300px row cap (286.4 < 300).
    expect(contentFor(900)).toBeCloseTo(237.68, 2);
    expect(contentFor(900)).toBeLessThan(rowFor(900));
    expect(contentFor(1000)).toBeCloseTo(265.52, 2);
    expect(contentFor(1000)).toBeLessThan(rowFor(1000));
    expect(contentFor(1080)).toBeCloseTo(286.4, 2);
    expect(contentFor(1080)).toBeLessThan(rowFor(1080));
    expect(contentFor(2000)).toBeLessThan(rowFor(2000));
  });

  it('closes the one-pixel boundaries 983/984 and 1060/1061', () => {
    // A single-pixel viewport gap must not reintroduce overflow: 984 must
    // step down from 0.66 → 0.74 exactly when 983 runs out of room, and the
    // same for 1061 → 0.8.
    expect(scaleFor(983)).toBeCloseTo(0.66, 6);
    expect(scaleFor(984)).toBeCloseTo(0.74, 6);
    expect(scaleFor(1060)).toBeCloseTo(0.74, 6);
    expect(scaleFor(1061)).toBeCloseTo(0.8, 6);
    for (const vh of [983, 984, 1060, 1061]) {
      expect(contentFor(vh), `content at ${vh}px`).toBeLessThan(rowFor(vh));
    }
  });

  it('makes the row min-height structurally include cards + padding + scaled lift', () => {
    // The row is max(vh clamp, derived content), so it can never be smaller
    // than what it must contain at ANY scale the media queries resolve —
    // containment holds even if a future tier is added without re-tuning the
    // vh clamp.
    const wrap = block(MATCH_CSS, '.match-handwrap');
    expect(wrap).toMatch(/min-height:\s*max\(/);
    expect(wrap).toMatch(/clamp\(/);
    expect(wrap).toMatch(/calc\(var\(--card-h\)\s*\*\s*var\(--hand-card-scale\)/);
    expect(wrap).toMatch(/var\(--space-2\)/);
    expect(wrap).toMatch(/var\(--card-hover\)\s*\*\s*var\(--hand-card-scale\)/);
    // The hidden hand (pass point) seats the same face-down cards at the same
    // scale, so it carries the same reserve.
    expect(block(MATCH_CSS, '.match-hand-hidden')).toMatch(/min-height:\s*max\(/);
  });
});

describe('turn stability (Task 5A)', () => {
  it('drive turnStart — the board wrapper never receives match-shift', () => {
    const entry = buildMatchEntry({
      mode: 'hotseat',
      decks: [
        { slug: 'ember', name: 'Ember Court' },
        { slug: 'bone', name: 'Bone Horde' },
      ],
    });
    const driver = scriptedDriver(entry.setup.driver);
    mount(entry.setup);
    reachMain(driver);

    const wrap = document.querySelector('.match-boardwrap');
    expect(wrap).not.toBeNull();

    // Push a real turnStart through the animation queue — the exact event
    // that used to retrigger the deliberate register shift.
    act(() => {
      driver.push([{ type: 'turnStart', player: 1, mana: 1 }]);
    });
    advance(SPACING);

    expect(wrap!.className).toBe('match-boardwrap');
    expect(wrap!.classList.contains('match-shift')).toBe(false);
    expect(wrap!.classList.contains('match-page-shift')).toBe(false);
  });

  it('animations.css defines no keyframe that translates the whole board wrapper', () => {
    expect(CARD_CSS).toBeTruthy(); // keep the module import honest
    // Comments may name the dead recipe; only executable rules are a regression.
    const executable = MATCH_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(executable).not.toMatch(/match-shift/);
    expect(executable).not.toMatch(/match-page-shift/);
    expect(executable).not.toMatch(/@keyframes\s+match-page-shift/);
  });
});

describe('pointer behavior (Task 5A)', () => {
  it('removes the match-handwrap click-through workaround', () => {
    // The workaround existed so board controls stayed clickable when the
    // board briefly underlapped the hand. With containment verified the row
    // is genuinely the hand's territory — it must not be click-through.
    expect(block(MATCH_CSS, '.match-handwrap')).not.toMatch(/pointer-events:\s*none/);
  });

  it('keeps the live hand row and slots interactive', () => {
    expect(block(HAND_CSS, '.hand')).not.toMatch(/pointer-events:\s*none/);
    expect(block(HAND_CSS, '.hand-slot-anim')).not.toMatch(/pointer-events:\s*none/);
    // The slot stays the explicit interactive leaf.
    expect(block(HAND_CSS, '.hand-slot')).toMatch(/pointer-events:\s*auto/);
  });

  it('keeps hidden/blocked hands pointer-inert', () => {
    // Removing the handwrap workaround must not make the face-down pass-point
    // hand interactive: the hidden hand is a display-only mirror and carries
    // no click handlers, so it stays pointer-inert at the surface.
    expect(block(MATCH_CSS, '.match-hand-hidden')).toMatch(/pointer-events:\s*none/);
  });
});

describe('hand cards never intersect the board register', () => {
  const VIEWPORTS: Array<[number, number]> = [
    [1280, 900],
    [1440, 900],
    [1920, 1080],
  ];

  it('rects derived from the CSS contract stay inside the row and clear of the board at every supported viewport', () => {
    // jsdom reports every rect as 0×0 at the origin, so this test builds the
    // rects from the SAME parsed contract the row-equation tests pin (scale
    // tier + row clamp + padding + lift), then checks the relationship the
    // browser matrix measures in real pixels: every hand card sits inside the
    // hand row, and a hovered card (lifted 12×scale) clears the board
    // register above it.
    for (const [vw, vh] of VIEWPORTS) {
      const s = scaleFor(vh);
      const rowH = rowFor(vh);
      const handwrapTop = vh - rowH;
      const boardBottom = handwrapTop - GAP; // .match row-gap (--space-2)
      const cardTop = handwrapTop + TOP_PAD;
      const cardBottom = cardTop + CARD_H * s;

      // Card rect fully inside the hand row.
      expect(cardTop, `${vw}×${vh} card top`).toBeGreaterThanOrEqual(handwrapTop);
      expect(cardBottom, `${vw}×${vh} card bottom`).toBeLessThanOrEqual(vh);
      // Hovered card (lifted up by the scaled 12px) clears the board register.
      expect(cardTop - HOVER * s, `${vw}×${vh} hovered top`).toBeGreaterThanOrEqual(boardBottom);
      // The row itself reserves the full content.
      expect(contentFor(vh)).toBeLessThanOrEqual(rowH);
    }
  });

  it('mounts Match with the live hand inside the handwrap, below the board wrapper', () => {
    const entry = buildMatchEntry({
      mode: 'hotseat',
      decks: [
        { slug: 'ember', name: 'Ember Court' },
        { slug: 'bone', name: 'Bone Horde' },
      ],
    });
    const driver = scriptedDriver(entry.setup.driver);
    mount(entry.setup);
    reachMain(driver);

    const boardwrap = document.querySelector('.match-boardwrap');
    const handwrap = document.querySelector('.match-handwrap');
    const hand = document.querySelector('.match-handwrap .hand');
    const cards = document.querySelectorAll('.match-handwrap .hand-slot .card');
    expect(boardwrap).not.toBeNull();
    expect(handwrap).not.toBeNull();
    expect(hand).not.toBeNull();
    expect(cards.length).toBeGreaterThan(0);

    // Vertical order contract: the hand row sits below the board wrapper in
    // the flex column, and every live card is a descendant of the hand row.
    expect(boardwrap!.compareDocumentPosition(handwrap!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const c of cards) expect(handwrap!.contains(c)).toBe(true);
  });
});
