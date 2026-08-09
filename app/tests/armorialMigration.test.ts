/**
 * Whole-tree Armorial migration guard (Task 9 of the discover-armorial plan).
 *
 * Task 4 pinned the canonical tincture tokens in theme.css; Task 9 is the
 * sweep that deletes every Task-4 compatibility alias and converts the last
 * violet/gothic consumers (menu, mode select, deck pick, Victory, LAN,
 * Forge, Deck Builder, hand, pass overlay, ambient background, match fx) to
 * the flat Armorial register. This guard is the enforcement that the sweep
 * is COMPLETE: it scans every app/src CSS and TSX source recursively
 * and fails on any of the banned constructs, so a reintroduced legacy token,
 * gradient, glow, or shadow is a build-breaking change — not a style choice.
 *
 * The guard deliberately strips comments before matching (except the
 * gules/or selector checks, which run on the real rule text): prose may
 * legitimately *name* a banned construct while explaining that it is gone,
 * and those explanations are the spec for the flat world.
 *
 * Categories (each is one test):
 *  1. Legacy Task-4 tokens  --bg-0/--bg-1/--bg-2/--ember/--gold/--accent/
 *     --border/--gold-dim/--ember-dim/--text-faint/--glow-gold/--glow-ember.
 *  2. CSS gradients         linear-gradient()/radial-gradient() (and
 *     repeating-* / conic forms — any gradient is a gradient).
 *  3. SVG gradients         <linearGradient>/<radialGradient> elements.
 *  4. Shadows               any box-shadow/text-shadow whose value is not
 *     exactly `none` (CSS property or inline React style).
 *  5. Drop-shadows          any filter: drop-shadow( recipe, including the
 *     deleted `cardview-target-glow` keyframes/class.
 *  6. Reserved hexes        raw #A81E22 / #B8913C appear only in theme.css
 *     (as the --gules / --or values — never hardcoded in a consumer).
 *  7. Gules discipline      var(--gules) is damage/death FX only, enforced
 *     by an explicit file + selector allowlist.
 *  8. Or discipline         var(--or) is legendary + active-turn only,
 *     enforced by an explicit file + selector allowlist.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = join(APP_ROOT, 'src');

/** Every app/src source file that the guard governs: .css and .tsx. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (abs.endsWith('.css') || abs.endsWith('.tsx')) out.push(abs);
    }
  };
  walk(SRC_ROOT);
  return out.sort();
}

/** Strip comments so prose may name the banned constructs (and explain why
 *  they are gone). Block comments and full-line // comments are removed;
 *  `//` inside string literals (URLs, paths) is left alone because only
 *  line-leading comments are matched. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
}

interface Offender {
  file: string;
  line: number;
  snippet: string;
}

function lineFor(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

function snippet(src: string, index: number): string {
  const from = src.lastIndexOf('\n', index) + 1;
  const to = src.indexOf('\n', index);
  return src.slice(from, to === -1 ? src.length : to).trim().slice(0, 160);
}

function collect(src: string, re: RegExp): Offender[] {
  const out: Offender[] = [];
  re.lastIndex = 0;
  for (const m of src.matchAll(re)) {
    out.push({ file: '', line: lineFor(src, m.index as number), snippet: snippet(src, m.index as number) });
  }
  return out;
}

/** The selector of the innermost rule containing `index` (for allowlists).
 *  Comment text is stripped from the selector so a comment can never smuggle
 *  an allowlisted selector name in front of a misbehaving rule. */
function enclosingSelector(css: string, index: number): string {
  let depth = 0;
  let lastOpen = -1;
  let selector = '';
  for (let i = 0; i < index; i++) {
    const ch = css[i];
    if (ch === '{') {
      depth += 1;
      selector = css.slice(lastOpen + 1, i).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
      lastOpen = i;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      lastOpen = i;
    }
  }
  return selector;
}

/** Short filename (last path segment) — the coarse file gate for the
 *  gules/or allowlists. */
function baseName(abs: string): string {
  return abs.slice(abs.lastIndexOf('/') + 1);
}

/** The one regex for every legacy Task-4 token. The `(?![\w-])` guard keeps
 *  `--border-radius`-style derivatives and `--ember-drift-x` (a plain
 *  custom property, since renamed --gameover-drift-x) from false-matching. */
const LEGACY_TOKEN_RE =
  /--(?:bg-[012]|ember(?:-dim)?|gold(?:-dim)?|accent|border|text-faint|glow-(?:gold|ember))(?![\w-])/g;

const CSS_GRADIENT_RE = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;
const SVG_GRADIENT_RE = /<(?:linear|radial)Gradient/g;
const CSS_SHADOW_RE = /(?:box-shadow|text-shadow)\s*:\s*([^;}]+)/g;
const TSX_SHADOW_RE = /(?:boxShadow|textShadow)\s*:\s*'([^']*)'/g;
const CSS_DROP_SHADOW_RE = /filter\s*:\s*[^;}]*drop-shadow\(/g;
const TARGET_GLOW_RE = /cardview-target-glow/g;
const RAW_HEX_RE = /#A81E22|#B8913C/gi;
const GULES_RE = /var\(--gules\)/g;
const OR_RE = /var\(--or\)/g;

/**
 * Gules is the one reserved damage tincture: damage numerals, combat and
 * death strikes, and the projectile damage landing (impact base and the
 * fireball orb — the fireball itself is damage en route). Everything else
 * is a misuse; the selector check is what stops a non-damage rule from
 * sneaking a gules declaration into an allowlisted file.
 */
const GULES_FILE_ALLOW = new Set(['damagepopup.css', 'animations.css', 'projectile.css']);
const GULES_SELECTOR_ALLOW = [
  'damagepopup--damage',
  'combat-strike',
  'death-strike',
  'projectile-impact',
  'projectile-orb--fireball',
];

/** Or is legendary + active-turn only: the legendary rarity hairline and
 *  deck-list count, the active side's margin/register rules, and the active
 *  turn banner. Everything else is a misuse. */
const OR_FILE_ALLOW = new Set(['card.css', 'board.css', 'turnbanner.css', 'deckbuilder.css']);
const OR_SELECTOR_ALLOW = ['rarity-legendary', 'board-zone--active', 'turnbanner--mine'];

describe('armorial whole-tree migration guard (Task 9)', () => {
  it('no legacy Task-4 tokens remain in any app/src css/tsx', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles()) {
      const rel = relative(APP_ROOT, abs);
      const src = stripComments(readFileSync(abs, 'utf8'));
      for (const o of collect(src, LEGACY_TOKEN_RE)) offenders.push({ ...o, file: rel });
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('no CSS gradients remain anywhere in app/src (CSS rules and TSX inline styles)', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles()) {
      const rel = relative(APP_ROOT, abs);
      const src = stripComments(readFileSync(abs, 'utf8'));
      for (const o of collect(src, CSS_GRADIENT_RE)) offenders.push({ ...o, file: rel });
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('no SVG <linearGradient>/<radialGradient> elements in any app/src tsx', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles().filter((f) => f.endsWith('.tsx'))) {
      const rel = relative(APP_ROOT, abs);
      const src = stripComments(readFileSync(abs, 'utf8'));
      for (const o of collect(src, SVG_GRADIENT_RE)) offenders.push({ ...o, file: rel });
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('no box-shadow/text-shadow values other than none (CSS + inline styles)', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles()) {
      const rel = relative(APP_ROOT, abs);
      const src = stripComments(readFileSync(abs, 'utf8'));
      if (abs.endsWith('.css')) {
        CSS_SHADOW_RE.lastIndex = 0;
        for (const m of src.matchAll(CSS_SHADOW_RE)) {
          const value = (m[1] as string).trim().replace(/\s*!important\s*$/, '');
          if (!/^none$/i.test(value)) {
            offenders.push({ file: rel, line: lineFor(src, m.index as number), snippet: snippet(src, m.index as number) });
          }
        }
      } else {
        TSX_SHADOW_RE.lastIndex = 0;
        for (const m of src.matchAll(TSX_SHADOW_RE)) {
          if ((m[1] as string).trim() !== 'none') {
            offenders.push({ file: rel, line: lineFor(src, m.index as number), snippet: snippet(src, m.index as number) });
          }
        }
      }
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('no filter: drop-shadow( recipes, including cardview-target-glow', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles()) {
      const rel = relative(APP_ROOT, abs);
      const src = stripComments(readFileSync(abs, 'utf8'));
      if (abs.endsWith('.css')) {
        for (const o of collect(src, CSS_DROP_SHADOW_RE)) offenders.push({ ...o, file: rel });
        for (const o of collect(src, TARGET_GLOW_RE)) offenders.push({ ...o, file: rel });
      }
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('raw #A81E22 / #B8913C appear only in theme.css (the --gules / --or values)', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles()) {
      const rel = relative(APP_ROOT, abs);
      if (rel === 'src/theme.css') continue;
      const src = readFileSync(abs, 'utf8');
      for (const o of collect(src, RAW_HEX_RE)) offenders.push({ ...o, file: rel });
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('var(--gules) is damage/death FX only (file + selector allowlist)', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles().filter((f) => f.endsWith('.css'))) {
      const rel = relative(APP_ROOT, abs);
      const css = readFileSync(abs, 'utf8');
      GULES_RE.lastIndex = 0;
      for (const m of css.matchAll(GULES_RE)) {
        const sel = enclosingSelector(css, m.index as number);
        const ok = GULES_FILE_ALLOW.has(baseName(abs)) && GULES_SELECTOR_ALLOW.some((s) => sel.includes(s));
        if (!ok) offenders.push({ file: rel, line: lineFor(css, m.index as number), snippet: `selector "${sel}"` });
      }
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });

  it('var(--or) is legendary + active-turn only (file + selector allowlist)', () => {
    const offenders: Offender[] = [];
    for (const abs of sourceFiles().filter((f) => f.endsWith('.css'))) {
      const rel = relative(APP_ROOT, abs);
      const css = readFileSync(abs, 'utf8');
      OR_RE.lastIndex = 0;
      for (const m of css.matchAll(OR_RE)) {
        const sel = enclosingSelector(css, m.index as number);
        const ok = OR_FILE_ALLOW.has(baseName(abs)) && OR_SELECTOR_ALLOW.some((s) => sel.includes(s));
        if (!ok) offenders.push({ file: rel, line: lineFor(css, m.index as number), snippet: `selector "${sel}"` });
      }
    }
    expect(offenders, offenders.map((o) => `${o.file}:${o.line} ${o.snippet}`).join('\n')).toEqual([]);
  });
});
