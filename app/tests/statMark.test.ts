// Task 4 (reflect-dynamic-combat plan): card stat words are replaced by
// compact authored marks. A creature card renders exactly three symbol-number
// pairs — a gules blade for Attack, an azure returning arrow for Reflect, a
// green heart for Health — in that DOM order, with no printed stat words and
// no bare number in the accessibility tree. The icon glyphs are authored
// inline `currentColor` SVG paths (no emoji, no icon package, no remote
// asset), the returning-arrow mark is deliberately NOT a shield silhouette,
// and the mark colors are the plan's muted tokens: `--stat-attack` aliases
// the canonical damage gules, while `--stat-reflect` (azure) and
// `--stat-health` (green) stay distinct from every house field.
//
// The semantic half renders the REAL CardView → Card → CardFrame stack in
// jsdom (real components, no mocks) so the tests prove the full threading
// path, not just the leaf component. The icon-source half reads the shipped
// source files the way the Armorial offline contract reads fonts.css — the
// build artifacts, not a mock of them.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card as CardSpec } from '@ashen/core';
import CardView from '../src/components/CardView.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Definition fixture: a creature whose def carries 4 Attack / 2 Reflect /
 * 5 Health. The name deliberately contains none of the stat words so
 * text-content assertions can prove the words are absent from the plate.
 */
const def = (): CardSpec => ({
  id: 'stat-warden',
  name: 'Iron Warden',
  type: 'creature',
  cost: 3,
  attack: 4,
  reflect: 2,
  health: 5,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'ember',
  art: { preset: 'ember', palette: [], seed: 1 },
  author: 'curated',
  version: 1,
});

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(node);
  });
}

/** The three stat marks currently on the plate, in DOM order. */
function marks(): HTMLElement[] {
  return [...host!.querySelectorAll<HTMLElement>('.card__stat')];
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

describe('card stat marks — semantics (Task 4 Step 1)', () => {
  it('renders exactly three symbol-number pairs in Attack → Reflect → Health order', () => {
    render(createElement(CardView, { card: def() }));
    const m = marks();
    expect(m).toHaveLength(3);
    expect(m.map((el) => el.className)).toEqual([
      'card__stat card__stat--attack',
      'card__stat card__stat--reflect',
      'card__stat card__stat--health',
    ]);
    // Each pair is a numeral beside its glyph, in the same DOM order.
    expect(m.map((el) => el.textContent!.trim())).toEqual(['4', '2', '5']);
  });

  it('prints no stat words on the plate', () => {
    // The whole-plate text (name, cost, ribbon, rules, flavor, numerals)
    // must not contain the words — the meaning moved to the glyph + label.
    render(createElement(CardView, { card: def() }));
    for (const word of ['Attack', 'Reflect', 'Health']) {
      expect(host!.textContent, `plate contains "${word}"`).not.toContain(word);
    }
    // The old word-over-numeral label element is gone entirely.
    expect(host!.querySelector('.card__stat-label')).toBeNull();
  });

  it('names every mark in the accessibility tree — no bare number', () => {
    render(createElement(CardView, { card: def() }));
    for (const el of marks()) {
      // The outer mark is exposed as an image whose name is "Attack N" etc.
      // role="img" also makes the numeral inside presentational, so the
      // number is never read as a bare digit beside a name.
      expect(el.getAttribute('role')).toBe('img');
      const label = el.getAttribute('aria-label') ?? '';
      expect(label).toMatch(/^(Attack|Reflect|Health) \d+$/);
      expect(el.textContent!.trim()).toBe(label.split(' ')[1]!);
    }
  });

  it('renders exactly three rail glyphs, all aria-hidden', () => {
    render(createElement(CardView, { card: def() }));
    const svgs = [...host!.querySelectorAll<SVGElement>('.card__stats svg')];
    expect(svgs).toHaveLength(3);
    for (const s of svgs) {
      expect(s.getAttribute('aria-hidden')).toBe('true');
      expect(s.getAttribute('viewBox')).not.toBeNull();
    }
  });

  it('uses the definition reflect on hand cards', () => {
    render(createElement(CardView, { card: def() }));
    expect(marks()[1]!.getAttribute('aria-label')).toBe('Reflect 2');
  });

  it('uses live CreatureState reflect over the definition on board cards', () => {
    // Live stats override the def for all three axes at once — the same
    // live-state-over-definition rule Task 0 established for attack/health.
    render(
      createElement(CardView, {
        card: def(),
        size: 'board',
        stats: { attack: 9, reflect: 7, health: 3 },
      }),
    );
    const m = marks();
    expect(m[0]!.getAttribute('aria-label')).toBe('Attack 9');
    expect(m[1]!.getAttribute('aria-label')).toBe('Reflect 7');
    expect(m[2]!.getAttribute('aria-label')).toBe('Health 3');
  });

  it('renders Reflect 0 for live state with no reflect (engine truth)', () => {
    // Legacy deserialized CreatureState may lack reflect; the engine treats
    // that as 0 counter-damage (game.ts: defender.reflect ?? 0). The plate
    // must show the same 0, never the def's number and never "undefined".
    render(
      createElement(CardView, {
        card: def(),
        size: 'board',
        stats: { attack: 4, health: 5 } as { attack: number; reflect: number; health: number },
      }),
    );
    expect(marks()[1]!.getAttribute('aria-label')).toBe('Reflect 0');
    expect(host!.textContent).not.toContain('undefined');
  });

  it('keeps live keywords and silence over the board creature definition', () => {
    // Task 0's rule must survive the rail rewrite: the live keyword array
    // wins and a silenced creature renders no rules text.
    const withTriggers: CardSpec = { ...def(), keywords: ['taunt'] };
    render(
      createElement(CardView, {
        card: withTriggers,
        size: 'board',
        stats: { attack: 4, reflect: 2, health: 5 },
        keywords: ['stealth'],
        silenced: true,
      }),
    );
    const chips = [...host!.querySelectorAll('.kwchip')].map((el) => el.textContent!.trim());
    expect(chips).toEqual(['stealth']);
    expect(chips).not.toContain('taunt');
    expect(host!.querySelector('.card__text')).toBeNull();
  });

  it('a board card still omits cost from the DOM', () => {
    render(createElement(CardView, { card: def(), size: 'board' }));
    // The mana gem must leave the DOM at board size, not merely be styled
    // away — a rendered gem reads as a third defense stat (PRODUCT.md).
    expect(host!.querySelector('.card__cost')).toBeNull();
    expect(marks()).toHaveLength(3);
  });

  it('renders no stat marks for spells', () => {
    render(createElement(CardView, { card: { ...def(), type: 'spell' } }));
    expect(marks()).toHaveLength(0);
  });
});

describe('card stat marks — icon source (Task 4 Step 2)', () => {
  // Captured in a const: Vite's jsdom transform rewrites the literal
  // `new URL(rel, import.meta.url)` asset pattern (same idiom as
  // cardTextWell.test.ts / armorialContract.test.ts).
  const here = import.meta.url;
  let statmark = '';
  beforeAll(() => {
    statmark = readFileSync(
      fileURLToPath(new URL('../src/components/StatMark.tsx', here)),
      'utf8',
    );
  });

  it('contains exactly three authored inline SVG path glyphs', () => {
    // Count on comment-stripped source (same idiom as the armorial
    // migration guard): the doc comments legitimately NAME the tokens while
    // explaining the contract. Only executable code is a regression.
    const executable = statmark.replace(/\/\*[\s\S]*?\*\//g, '');
    // Three authored glyph paths — one per kind — inside the component's
    // single inline <svg> element. CardFrame mounts three StatMarks (one
    // per rail cell), so the PLATE renders three svgs; the semantic suite
    // above proves that. Here the contract is the authored source: exactly
    // three glyphs, exactly one svg, no icon package behind them.
    expect((executable.match(/<path/g) ?? []).length).toBe(3);
    expect((executable.match(/<svg/g) ?? []).length).toBe(1);
  });

  it('contains no emoji code points', () => {
    // Platform glyphs and emoji are banned for stat marks (plan Global
    // Constraints) — the glyphs are authored SVG, not codepoints. The scan
    // covers emoji blocks, dingbats, arrows/misc symbols, and variation
    // selectors (the FE0E/FE0F presentation selectors the ribbon's unicode
    // type icons rely on are likewise banned here).
    expect(statmark).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{FE0E}]/u);
  });

  it('imports no icon package', () => {
    // The only import allowed is React itself (for the ReactElement type).
    // An icon package (lucide, react-icons, feather, heroicons, …) would
    // ship network/CDN or duplicated assets and break the offline contract.
    const specifiers = [...statmark.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    expect(specifiers).toEqual(['react']);
  });

  it('references no remote asset', () => {
    expect(statmark).not.toMatch(/https?:\/\//);
    expect(statmark).not.toMatch(/url\(/);
    expect(statmark).not.toMatch(/<img\b/);
    expect(statmark).not.toMatch(/<use\b/);
  });

  it('the returning-arrow mark is not a shield silhouette', () => {
    // A shield silhouette is a closed polygon/plate (rounded bottom,
    // pointed top); a returning arrow is an OPEN arc with a head. The
    // reflect glyph must never read as "defense plate" — Reflect is the
    // counter-strike, not a wall. Assert on the actual authored path data.
    const d = /reflect:\s*\(\s*<path\s+d="([^"]+)"/.exec(statmark)?.[1];
    expect(d).toBeDefined();
    expect(d).not.toMatch(/[Zz]/); // never closes into a plate
    expect(d).toMatch(/[Aa]/); // an arc sweep, not a polygon
    expect(d).toMatch(/[Mm]/); // a head, not a closed blob
  });

  it('the marks consume the plan muted tokens in statmark.css', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../src/components/statmark.css', here)),
      'utf8',
    );
    for (const token of ['--stat-attack', '--stat-reflect', '--stat-health']) {
      expect(css, `statmark.css must consume ${token}`).toContain(`var(${token})`);
    }
  });
});

describe('stat-mark tincture tokens (Task 4 Step 6)', () => {
  const here = import.meta.url;
  const theme = readFileSync(
    fileURLToPath(new URL('../src/theme.css', here)),
    'utf8',
  );
  const token = (name: string): string | undefined =>
    new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(theme)?.[1]?.trim();

  it('--stat-attack aliases the canonical damage gules', () => {
    // The plan's explicit alias: the attack glyph is the world's one red,
    // meaning hurt. The migration guard's raw-hex exemption applies only to
    // theme.css, so the alias lives here by VALUE (identical hex), keeping
    // gules discipline enforceable everywhere else unchanged.
    expect(token('--stat-attack')).toBe(token('--gules'));
  });

  it('--stat-reflect and --stat-health are distinct from every house field and or', () => {
    const houses = [
      'ember', 'choir', 'vermin', 'dragon', 'roots', 'dance',
      'bone', 'pact', 'coven', 'star', 'vigil', 'storm',
    ].map((h) => token(`--house-${h}`));
    const reflect = token('--stat-reflect');
    const health = token('--stat-health');
    expect(reflect).toBeDefined();
    expect(health).toBeDefined();
    // Blue and green are restrained stat colors, never a house identity
    // field and never the reserved gold.
    expect(houses).not.toContain(reflect);
    expect(houses).not.toContain(health);
    expect(reflect).not.toBe(token('--or'));
    expect(health).not.toBe(token('--or'));
    expect(reflect).not.toBe(health);
  });
});

describe('stat-mark size floor (Task 4 Step 7a)', () => {
  const here = import.meta.url;
  const cardCss = readFileSync(
    fileURLToPath(new URL('../src/components/card.css', here)),
    'utf8',
  );

  it('floors the rail numeral in declared px, not a scalar', () => {
    // Zero-shot comparison finding 10: type sized as a fraction of a layout
    // variable collapses with the card. The base hand/preview numeral must
    // stay legible at the minimum supported hand scale (0.66, the height
    // floor Task 5A pins): 0.66 × 25px = 16.5px effective ≥ the 16px bar.
    // Never shrink this type to fit — contract spacing first.
    const base = /\.card__stat-value\s*\{([^}]*)\}/.exec(cardCss)?.[1] ?? '';
    const size = Number(/font-size:\s*([\d.]+)px/.exec(base)?.[1]);
    expect(size, `declared ${size}px × 0.66 = ${(size * 0.66).toFixed(1)}px effective`).toBeGreaterThanOrEqual(25);
  });
});
