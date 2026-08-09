/**
 * Armorial foundation contract (Task 4 of the discover-armorial plan).
 *
 * These four static artifacts are browser-consumed: index.html is copied
 * into the production build with its HTML comments intact, and fonts.css /
 * theme.css drive the rendered page. The assertions here are the offline /
 * build contract, not implementation trivia:
 *
 *  1. The direction comment survives into the page before the app root.
 *  2. All fonts are self-hosted under /fonts/ (no network at page load).
 *  3. No `http` text anywhere in fonts.css — a remote font URL would break
 *     offline play and is a build-breaking change, not a style choice.
 *  4. The canonical Armorial tincture tokens hold the exact contract values.
 *
 * Each test names the production break it catches: removing/moving/editing
 * the comment, pointing a URL off /fonts/, reintroducing a remote fetch,
 * changing a token value, or deleting a referenced font file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readAppFile(relative: string): string {
  return readFileSync(join(APP_ROOT, relative), 'utf8');
}

/** The direction comment, verbatim — must be the first child of <body>. */
const DIRECTION_COMMENT = `<!--
THESIS: Twelve archetypes are twelve houses; heraldry is already a strict grammar for
  encoding identity in a fixed vocabulary, which is what "cards are data" means here.
  Refuses the torch-lit tavern the category always ships, and its flat-gray opposite.
OWN-WORLD: A roll of arms. Flat heraldic tinctures in a woodcut register on an iron-gall
  ground, cream engraved hairlines, charges drawn as flat SVG. No bevels, gradients,
  glows, or faux metal. Cardo throughout.
STORY: A player reads the field as a page of arms: whose house holds what, what each
  figure is, and what every number means.
FIRST VIEWPORT: The board as a ruled page. Two banded registers divided by an engraved
  rule, each under its house banner in the margin; the token row a subordinate sub-band.
FORM: Blazon x codex (armorial), grounded candidate 5 of 7, user-pinned toward archaic.
  Seed key b730d38a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md.
-->`;

/** Canonical Armorial tokens, exactly as pinned in the task brief. */
const CANONICAL_TOKENS: Record<string, string> = {
  '--ground': '#14120F',
  '--ground-deep': '#0C0B09',
  '--ground-rise': '#1D1A15',
  '--line': '#E8E0CE',
  '--line-dim': 'rgba(232, 224, 206, 0.38)',
  '--text': '#E8E0CE',
  '--text-dim': '#A79E8A',
  '--gules': '#A81E22',
  '--or': '#B8913C',
  '--house-ember': '#B4341C',
  '--house-choir': '#C9BFA4',
  '--house-vermin': '#6B7A3A',
  '--house-dragon': '#8C5A1E',
  '--house-roots': '#3C6B44',
  '--house-dance': '#4A2F63',
  '--house-bone': '#8A8578',
  '--house-pact': '#6B1F2E',
  '--house-coven': '#2F3E6B',
  '--house-star': '#3E5C7A',
  '--house-vigil': '#A88C3E',
  '--house-storm': '#4A6B75',
  '--beat': '140ms',
  '--beat-long': '320ms',
};

function tokenDeclarations(themeCss: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  // Match --name: value; pairs in the :root block (value = anything up to the
  // terminating semicolon, trimmed).
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
  for (const match of themeCss.matchAll(re)) {
    declarations[match[1] as string] = (match[2] as string).trim();
  }
  return declarations;
}

describe('armorial offline/build contract', () => {
  it('the direction comment is the first child of <body>, before the app root', () => {
    const html = readAppFile('index.html');
    const commentAt = html.indexOf(DIRECTION_COMMENT);
    expect(commentAt).toBeGreaterThan(-1);
    // It must sit between the opening <body> tag and the app mount point so
    // it survives as the first <body> child in the production build.
    const bodyAt = html.indexOf('<body>');
    const rootAt = html.indexOf('<div id="root"></div>');
    expect(bodyAt).toBeGreaterThan(-1);
    expect(rootAt).toBeGreaterThan(bodyAt);
    expect(commentAt).toBeGreaterThan(bodyAt);
    expect(commentAt).toBeLessThan(rootAt);
  });

  it('every font URL in fonts.css is self-hosted under /fonts/', () => {
    const css = readAppFile('src/fonts.css');
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)].map((m) => (m[1] as string).trim());
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('/fonts/'))).toBe(true);
  });

  it('fonts.css contains no http/https remote references', () => {
    const css = readAppFile('src/fonts.css');
    expect(css.toLowerCase().includes('http')).toBe(false);
  });

  it('every referenced font file exists in public/fonts (offline contract)', () => {
    const css = readAppFile('src/fonts.css');
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)].map((m) => (m[1] as string).trim());
    expect(urls.length).toBeGreaterThan(0);
    const missing = urls
      .filter((u) => u.startsWith('/fonts/'))
      .map((u) => join(APP_ROOT, 'public', u.replace(/^\/fonts\//, 'fonts/')))
      .filter((p) => !existsSync(p));
    expect(missing).toEqual([]);
  });

  it('the canonical Armorial tokens hold their exact contract values', () => {
    const themeCss = readAppFile('src/theme.css');
    const declarations = tokenDeclarations(themeCss);
    const mismatches = Object.entries(CANONICAL_TOKENS)
      .filter(([name, expected]) => declarations[name] !== expected)
      .map(([name, expected]) => `${name}: expected "${expected}", got "${declarations[name] ?? '<missing>'}"`);
    expect(mismatches).toEqual([]);
  });


  it('keeps the radius scale strictly increasing', () => {
    const declarations = tokenDeclarations(readAppFile('src/theme.css'));
    const radius = ['--radius-sm', '--radius-md', '--radius-lg'].map((name) => Number.parseFloat(declarations[name] ?? 'NaN'));
    expect(radius.every(Number.isFinite)).toBe(true);
    expect(radius[0]! < radius[1]!).toBe(true);
    expect(radius[1]! < radius[2]!).toBe(true);
  });
});

describe('armorial whole-app CSS artifact contract', () => {
  /** All app/src CSS files, as absolute paths. */
  function cssFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const abs = join(dir, entry);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (abs.endsWith('.css')) out.push(abs);
      }
    };
    walk(join(APP_ROOT, 'src'));
    return out;
  }

  /** Strip CSS block comments so prose may name the dead tokens. */
  function executableCss(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  it('no executable app CSS references the deleted --glow-gold / --glow-ember tokens', () => {
    // Task 4 Step 5 deleted the glow token definitions and every consumer.
    // A reintroduced `var(--glow-gold)`/`var(--glow-ember)` is an undefined
    // variable that invalidates the whole declaration (e.g. the active
    // hero-portrait ring) — a build-breaking change, not a style choice.
    const offenders: string[] = [];
    for (const abs of cssFiles()) {
      const rel = relative(APP_ROOT, abs);
      const executable = executableCss(readFileSync(abs, 'utf8'));
      if (/--glow-(gold|ember)/.test(executable)) {
        offenders.push(`${rel} references --glow-gold/--glow-ember`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
