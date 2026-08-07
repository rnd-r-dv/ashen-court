# Art Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline script that generates real illustration for Ashen Court's card pool via OpenRouter FLUX, plus the app-side resolver that serves those images with a procedural-SVG fallback.

**Architecture:** Four pure, unit-tested modules (`styles`, `prompt`, `coverage`, `paths`) and one impure CLI (`generate`) that composes them with `fetch` and `sharp`. The app consumes the output through a single resolver backed by Vite's `import.meta.glob`, so "does this card have art" is answered at build time, never by probing for 404s.

**Tech Stack:** TypeScript (ESM), tsx, vitest, sharp, OpenRouter Images API (`black-forest-labs/flux.2-klein-4b:free`; the contract doc lives at the non-`:free` path).

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-08-ui-overhaul-design.md`. **Every task's requirements implicitly include this section.**

- **ESM throughout.** Relative imports carry the `.js` extension even in `.ts` source. `type: module` in every workspace package.
- **`strict` + `noUncheckedIndexedAccess`.** The `!` assertions on indexed access are intentional, not sloppiness.
- **The engine is off-limits.** `ArtRecipe` is presentation only and never reaches `Game`. Nothing in this plan may touch `core/src/engine/`, the LAN protocol, or `app/src/storage.ts`.
- **Never put pixel dimensions in the prompt.** Output size comes from the sampler's latent grid via `aspect_ratio`; prompt text cannot change it. FLUX.2 renders legible text unusually well, so `"480x320"` in a prompt risks being painted into the illustration.
- **`aspect_ratio` is derived from `card.rarity`, never operator-set:** `3:4` for rarity ≥ epic (full-bleed), `3:2` below it (banded), `1:1` for heroes.
- **`OPENROUTER_API_KEY` comes from the environment.** Never committed, never written to a file, never logged.
- **Default to the free model variant `black-forest-labs/flux.2-klein-4b:free`** (verified 2026-08-08). Free tier is capped at **20 requests/minute** and **50/day** under $10 lifetime credits, **1000/day** above. **This account is on the 1000/day tier**, so a full 297-image pass fits in one run of roughly 16 minutes and the 20/minute rate is the only real constraint. Requests must still be spaced, and a daily-cap 429 must stop the run cleanly rather than grinding through failures — it should never fire here, but it is what keeps the script correct on a 50/day account.
- **`--model` is only safe across FLUX-schema models.** `recraft/recraft-v3:free` takes an `image_config` object instead and does not document `aspect_ratio`; using it is client work, not a flag.
- **Existing suite is 402 tests across 50 files and must stay green.** Run `npm test` before every commit.
- **Do not commit generated images in the same commit as code.** Images are reviewed separately.

## Toolchain gotcha — read before Task 8

`core/package.json` declares `"main": "src/index.ts"` — a **raw TypeScript file**, with no build output (`npm run build -w core` is `tsc --noEmit`). So `import { buildPool } from '@ashen/core'` only resolves under a TypeScript-aware loader.

- `npx tsx scripts/art/generate.ts` — **works**
- `npm run art:generate` — **works** (the script is `tsx scripts/art/generate.ts`)
- `vitest` — **works** (Vite transforms it)
- `node scripts/art/generate.ts` — **fails** with an unhelpful parse error

Always invoke the CLI through `npm run art:generate` or `npx tsx`. Never plain `node`.

## Verified facts (do not re-derive)

```
buildPool() = 285 cards, all 285 carry flavor text, 12 heroes
  12 archetypes x 21 = 252   keys: ember choir vermin dragon roots dance bone pact coven star vigil storm
  neutral            =  26   archetype key 'neutral'
  token              =   7   archetype key 'token'
by rarity: common=151  rare=68  epic=40  legendary=26
HEROES is positionally zipped with Object.keys(DECK_DEFS): index 0 = ember = Pyra Emberveil,
  1 = choir = Vespera Dawnlight, 2 = vermin = Rat King Moulder, 3 = dragon = Seraphina Skywing,
  4 = roots = Oldroot, 5 = dance = Nyx Nightshade, 6 = bone = Baron Von Bone,
  7 = pact = Morticia Gravefall, 8 = coven = Morwenna Hex, 9 = star = Archon Stellara,
  10 = vigil = Ser Aldric the Vigilant, 11 = storm = Zephyra Stormveil
```

## File Structure

| File | Responsibility |
|---|---|
| `scripts/vitest.config.ts` | Create — node-environment vitest project for `scripts/` |
| `scripts/art/styles.ts` | Create — 13 style blocks + global suffix. Data only, no logic. |
| `scripts/art/overrides.ts` | Create — sparse `cardId → subject` repair map. Starts empty. |
| `scripts/art/prompt.ts` | Create — pure prompt + aspect composition. No fs, no network. |
| `scripts/art/coverage.ts` | Create — pure `all`/`rare+`/`epic+` predicate. |
| `scripts/art/paths.ts` | Create — pure output-path and slug helpers. |
| `scripts/art/openrouter.ts` | Create — API client: fetch, error mapping, retry. |
| `scripts/art/generate.ts` | Create — CLI. The only impure orchestrator. |
| `app/src/art/resolveArt.ts` | Create — glob-backed resolver with an injectable pure core. |
| `vitest.workspace.ts` | Modify — add `'scripts'` |
| `package.json` | Modify — add `sharp` + `tsx` devDeps, `art:generate` script |

---

## Task 1: Scripts workspace and toolchain

**Files:**
- Create: `scripts/vitest.config.ts`
- Create: `scripts/art/.gitkeep`
- Modify: `vitest.workspace.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a `scripts` vitest project so every later task's tests actually run; `npx tsx` and `sharp` available at the repo root.

- [ ] **Step 1: Add the dependencies**

`tsx` currently resolves only because `server/package.json` declares it and npm hoists it. Depending on a transitive hoist is fragile — declare both explicitly at the root.

```bash
cd "/Users/lucas/Local Storage/PROJECTS/tcg"
npm install -D sharp tsx
```

Expected: root `package.json` `devDependencies` gains `sharp` and `tsx` alongside the existing `typescript` and `vitest`. Run from the repo root with no `-w` flag so they land at the root, not inside a workspace.

`sharp` is a native module and will compile on install; if it fails, that is an environment problem to solve now rather than at Task 8.

- [ ] **Step 2: Create the vitest project config**

Mirror `server/vitest.config.ts` — node environment, tests colocated under `tests/`.

```ts
// scripts/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Register the project in the workspace**

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['core', 'server', 'app', 'scripts']);
```

- [ ] **Step 4: Add the run script**

In root `package.json` `scripts`, add:

```json
"art:generate": "tsx scripts/art/generate.ts"
```

- [ ] **Step 5: Prove the wiring with a throwaway test**

```ts
// scripts/tests/wiring.test.ts
import { describe, expect, it } from 'vitest';

describe('scripts workspace', () => {
  it('is picked up by the vitest workspace', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: **403 passed (403)**, 51 files — the existing 402 plus this one. If the count is still 402, the `scripts` project is not registered; recheck Step 3.

- [ ] **Step 7: Delete the throwaway test**

```bash
rm scripts/tests/wiring.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.workspace.ts scripts/
git commit -m "chore(scripts): add scripts vitest project, sharp and tsx devDeps"
```

---

## Task 2: Style blocks

**Files:**
- Create: `scripts/art/styles.ts`
- Test: `scripts/tests/styles.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export const GLOBAL_SUFFIX: string;
  export const STYLE_BLOCKS: Record<string, string>;  // 14 keys: 12 archetypes + 'neutral' + 'token'
  export function styleFor(archetype: string): string;
  ```

**Context:** the 12 archetype identities already exist as gradient/accent/glyph/shape triples in `app/src/components/artPresets.ts`. These style blocks are the prose version of the same identities. Read that file before writing them.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/styles.test.ts
import { describe, expect, it } from 'vitest';
import { GLOBAL_SUFFIX, STYLE_BLOCKS, styleFor } from '../art/styles.js';

const ARCHETYPES = [
  'ember', 'choir', 'vermin', 'dragon', 'roots', 'dance',
  'bone', 'pact', 'coven', 'star', 'vigil', 'storm',
];

describe('style blocks', () => {
  it('covers all 12 archetypes plus neutral and token', () => {
    for (const a of [...ARCHETYPES, 'neutral', 'token']) {
      expect(STYLE_BLOCKS[a], `missing style block for ${a}`).toBeTruthy();
    }
    expect(Object.keys(STYLE_BLOCKS)).toHaveLength(14);
  });

  it('keeps every authored block distinct, so archetypes do not read alike', () => {
    // 'token' is deliberately an alias of 'neutral' (tokens belong to no deck),
    // so it is excluded — the other 13 must all differ.
    const authored = Object.entries(STYLE_BLOCKS)
      .filter(([k]) => k !== 'token')
      .map(([, v]) => v);
    expect(new Set(authored).size).toBe(authored.length);
  });

  it('routes tokens to the neutral look — they belong to no deck', () => {
    expect(styleFor('token')).toBe(styleFor('neutral'));
  });

  it('falls back to neutral for an unknown archetype rather than throwing', () => {
    expect(styleFor('not-a-real-archetype')).toBe(STYLE_BLOCKS['neutral']);
  });

  it('suppresses text in the global suffix — FLUX renders lettering readily', () => {
    expect(GLOBAL_SUFFIX).toContain('no text');
    expect(GLOBAL_SUFFIX).toContain('no lettering');
    expect(GLOBAL_SUFFIX).toContain('no watermark');
  });

  it('never mentions pixel dimensions anywhere', () => {
    const all = [GLOBAL_SUFFIX, ...Object.values(STYLE_BLOCKS)].join(' ');
    expect(all).not.toMatch(/\d{3,4}\s*[x×]\s*\d{3,4}/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/styles.test.ts`
Expected: FAIL — `Failed to resolve import "../art/styles.js"`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/styles.ts

/**
 * Prose style blocks — layer 1 of the three-layer prompt (see the design spec,
 * section 3.3). One per archetype, plus a deliberately unplaced 'neutral'.
 *
 * These are the prose form of the identities already locked in
 * app/src/components/artPresets.ts (each archetype has a gradient, an accent
 * colour, a glyph and a silhouette shape). Keep the two in sympathy: if an
 * archetype's palette changes there, its block should change here.
 */

/**
 * Appended to every prompt. The text-suppression clause is load-bearing rather
 * than boilerplate: FLUX.2's headline capability is rendering legible text, so
 * without it the model will happily paint words into card art.
 */
export const GLOBAL_SUFFIX =
  'dark fantasy illustration, painterly, dramatic chiaroscuro, single centred subject, ' +
  'subject centred with headroom, wide landscape composition, ' +
  'no text, no lettering, no watermark, no border, no frame';

export const STYLE_BLOCKS: Record<string, string> = {
  ember:
    'forge-lit red and molten orange, drifting ash and cinders, a cracked volcanic keep',
  choir:
    'pale cathedral light, cold blue and bone-white, drifting incense and frost, a ruined gothic sanctuary',
  vermin:
    'sickly green and wet brown, guttering tallow light, a flooded undercity of pipes and refuse',
  dragon:
    'antique gold and deep indigo, high thin air, a cloud-wreathed mountain eyrie',
  roots:
    'mossy green and damp bark, shafts of low sun, an overgrown forest hall swallowed by roots',
  dance:
    'violet shadow and knife-edge highlight, smoke and silk, a moonlit rooftop above a sleeping city',
  bone:
    'dry ivory and dust-gold, still air, an ossuary of stacked skulls and guttered candles',
  pact:
    'grave-lilac and cold iron, low creeping mist, a sunken cemetery under a starless sky',
  coven:
    'hexed yellow-green and bruised purple, hanging charms, a swamp coven-house on stilts',
  star:
    'pale gold and deep night blue, drifting constellations, an observatory open to the void',
  vigil:
    'warm parchment and burnished steel, steady lamplight, a fortified watchpost at dusk',
  storm:
    'storm-grey and electric blue, sheeting rain, a wind-lashed cliff above a breaking sea',

  /**
   * Deliberately low-chroma and unplaced. A neutral card is played in all 12
   * decks, so it must not import a rival archetype's palette — today they share
   * the 'arcane' preset, which is why Bulwark Knight reads as though it belongs
   * to some other deck.
   */
  neutral:
    'muted stone grey and weathered iron, plain overcast light, an unremarkable ' +
    'borderland of rock and scrub, no strong colour cast',
};

/**
 * Tokens are summoned onto the board and are seen in play, so they need art —
 * but they belong to no deck, so they take the neutral look. Aliased rather
 * than duplicated so the two can never drift.
 */
STYLE_BLOCKS['token'] = STYLE_BLOCKS['neutral']!;

/** Unknown archetypes fall back to neutral. A missing block must never throw
 *  mid-run and abandon a batch that has already been paid for. */
export function styleFor(archetype: string): string {
  return STYLE_BLOCKS[archetype] ?? STYLE_BLOCKS['neutral']!;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/styles.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/styles.ts scripts/tests/styles.test.ts
git commit -m "feat(art): 13 prose style blocks + global prompt suffix"
```

---

## Task 3: Coverage predicate

**Files:**
- Create: `scripts/art/coverage.ts`
- Test: `scripts/tests/coverage.test.ts`

**Interfaces:**
- Consumes: `Rarity` from `@ashen/core`
- Produces:
  ```ts
  export type Coverage = 'all' | 'rare+' | 'epic+';
  export const COVERAGES: readonly Coverage[];
  export function inCoverage(rarity: Rarity, coverage: Coverage): boolean;
  export function parseCoverage(raw: string): Coverage;   // throws on unknown
  ```

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/coverage.test.ts
import { describe, expect, it } from 'vitest';
import { inCoverage, parseCoverage } from '../art/coverage.js';

describe('coverage', () => {
  it('includes everything under all', () => {
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(inCoverage(r, 'all')).toBe(true);
    }
  });

  it('drops commons under rare+', () => {
    expect(inCoverage('common', 'rare+')).toBe(false);
    expect(inCoverage('rare', 'rare+')).toBe(true);
    expect(inCoverage('epic', 'rare+')).toBe(true);
    expect(inCoverage('legendary', 'rare+')).toBe(true);
  });

  it('keeps only epic and legendary under epic+ — the cost fallback', () => {
    expect(inCoverage('common', 'epic+')).toBe(false);
    expect(inCoverage('rare', 'epic+')).toBe(false);
    expect(inCoverage('epic', 'epic+')).toBe(true);
    expect(inCoverage('legendary', 'epic+')).toBe(true);
  });

  it('parses the three documented values', () => {
    expect(parseCoverage('all')).toBe('all');
    expect(parseCoverage('rare+')).toBe('rare+');
    expect(parseCoverage('epic+')).toBe('epic+');
  });

  it('rejects an unknown value loudly rather than defaulting', () => {
    // Silently defaulting to 'all' on a typo would burn the whole daily
    // request allowance — or, on a paid model, real money — by accident.
    expect(() => parseCoverage('epic')).toThrow(/coverage/i);
    expect(() => parseCoverage('')).toThrow(/coverage/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/coverage.test.ts`
Expected: FAIL — cannot resolve `../art/coverage.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/coverage.ts
import type { Rarity } from '@ashen/core';

/**
 * How much of the pool gets generated art. 'epic+' is the designated fallback
 * if the smoke batch reports a per-image cost that makes the full pool
 * unattractive: 78 images against 297, and epics and legendaries are the cards
 * a player stops to look at.
 */
export type Coverage = 'all' | 'rare+' | 'epic+';

export const COVERAGES: readonly Coverage[] = ['all', 'rare+', 'epic+'];

/** Ascending rarity order — index comparison drives the threshold. */
const ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const FLOOR: Record<Coverage, Rarity> = {
  'all': 'common',
  'rare+': 'rare',
  'epic+': 'epic',
};

export function inCoverage(rarity: Rarity, coverage: Coverage): boolean {
  return ORDER.indexOf(rarity) >= ORDER.indexOf(FLOOR[coverage]);
}

/** Throws on anything unrecognised. Defaulting a typo to 'all' would spend
 *  roughly $12 by accident, so this fails loudly by design. */
export function parseCoverage(raw: string): Coverage {
  if ((COVERAGES as readonly string[]).includes(raw)) return raw as Coverage;
  throw new Error(`Unknown --coverage "${raw}". Expected one of: ${COVERAGES.join(', ')}`);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/coverage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/coverage.ts scripts/tests/coverage.test.ts
git commit -m "feat(art): coverage predicate (all | rare+ | epic+)"
```

---

## Task 4: Paths and slugs

**Files:**
- Create: `scripts/art/paths.ts`
- Test: `scripts/tests/paths.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CARD_ART_DIR: string;   // 'app/src/assets/art/cards'
  export const HERO_ART_DIR: string;   // 'app/src/assets/art/heroes'
  export function heroSlug(heroName: string): string;
  export function cardArtPath(cardId: string): string;
  export function heroArtPath(heroName: string): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/paths.test.ts
import { describe, expect, it } from 'vitest';
import { cardArtPath, heroArtPath, heroSlug } from '../art/paths.js';

describe('paths', () => {
  it('slugs a hero name', () => {
    expect(heroSlug('Vespera Dawnlight')).toBe('vespera-dawnlight');
    expect(heroSlug('Ser Aldric the Vigilant')).toBe('ser-aldric-the-vigilant');
    expect(heroSlug('Baron Von Bone')).toBe('baron-von-bone');
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(heroSlug("Morwenna  Hex!")).toBe('morwenna-hex');
    expect(heroSlug('  Oldroot  ')).toBe('oldroot');
  });

  it('puts card art under app/src so Vite can glob it', () => {
    // Under public/ Vite would not enumerate or content-hash these.
    expect(cardArtPath('choir-seraph')).toBe('app/src/assets/art/cards/choir-seraph.jpg');
  });

  it('puts hero art under its own directory, keyed by slug', () => {
    expect(heroArtPath('Rat King Moulder')).toBe('app/src/assets/art/heroes/rat-king-moulder.jpg');
  });

  it('produces a distinct slug for all 12 heroes', () => {
    const names = [
      'Pyra Emberveil', 'Vespera Dawnlight', 'Rat King Moulder', 'Seraphina Skywing',
      'Oldroot', 'Nyx Nightshade', 'Baron Von Bone', 'Morticia Gravefall',
      'Morwenna Hex', 'Archon Stellara', 'Ser Aldric the Vigilant', 'Zephyra Stormveil',
    ];
    expect(new Set(names.map(heroSlug)).size).toBe(12);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/paths.test.ts`
Expected: FAIL — cannot resolve `../art/paths.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/paths.ts

/**
 * Output lives under app/src, NOT app/public. Vite only enumerates and
 * content-hashes assets it can see through the module graph, and
 * import.meta.glob is what gives the app a build-time answer to "does this
 * card have art" instead of probing for 404s at runtime.
 */
export const CARD_ART_DIR = 'app/src/assets/art/cards';
export const HERO_ART_DIR = 'app/src/assets/art/heroes';

/** Lowercase; runs of non-alphanumerics collapse to '-'; dashes trimmed at
 *  both ends. Mirrors the slugify already used by the deck builder. */
export function heroSlug(heroName: string): string {
  return heroName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Card ids are already slug-safe by construction (e.g. 'choir-seraph'). */
export function cardArtPath(cardId: string): string {
  return `${CARD_ART_DIR}/${cardId}.jpg`;
}

export function heroArtPath(heroName: string): string {
  return `${HERO_ART_DIR}/${heroSlug(heroName)}.jpg`;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/paths.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/paths.ts scripts/tests/paths.test.ts
git commit -m "feat(art): output paths and hero slugs"
```

---

## Task 5: Overrides map

**Files:**
- Create: `scripts/art/overrides.ts`

**Interfaces:**
- Produces: `export const SUBJECT_OVERRIDES: Record<string, string>;`

This task has no test of its own — it is a data file that starts empty, and Task 6 tests the behaviour that consumes it.

- [ ] **Step 1: Write the file**

```ts
// scripts/art/overrides.ts

/**
 * Per-card subject overrides — the repair path, not the main path.
 *
 * Layer 2 of the prompt is normally `${card.name}. ${card.flavor}`, and all 285
 * curated cards carry flavor text, so there is no gap to fill. An entry here
 * replaces that line for one card whose flavor produces a bad image (wrong
 * subject, unreadable composition, accidental lettering).
 *
 * Workflow: add the entry, then regenerate just that card:
 *   npm run art:generate -- --force choir-seraph
 *
 * Expected to stay small. A large map means the style blocks are wrong and
 * should be fixed instead.
 */
export const SUBJECT_OVERRIDES: Record<string, string> = {
  // 'choir-seraph': 'A weeping winged figure in tattered vestments, wings folded, ...',
};
```

- [ ] **Step 2: Commit**

```bash
git add scripts/art/overrides.ts
git commit -m "feat(art): empty subject-override map for prompt repairs"
```

---

## Task 6: The prompt builder

**Files:**
- Create: `scripts/art/prompt.ts`
- Test: `scripts/tests/prompt.test.ts`

**Interfaces:**
- Consumes: `styleFor`, `GLOBAL_SUFFIX` (Task 2); `SUBJECT_OVERRIDES` (Task 5)
- Produces:
  ```ts
  export type AspectRatio = '3:4' | '3:2' | '1:1';
  export interface PromptInput {
    id: string; name: string; flavor?: string; archetype: string; rarity: Rarity;
  }
  export interface BuiltPrompt { prompt: string; aspectRatio: AspectRatio; }
  export function aspectForRarity(rarity: Rarity): AspectRatio;
  export function buildCardPrompt(card: PromptInput): BuiltPrompt;
  export function buildHeroPrompt(heroName: string, archetype: string): BuiltPrompt;
  ```

**This is the most important module in the plan.** It is pure — no fs, no network — precisely so prompt wording can be iterated for free.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/prompt.test.ts
import { describe, expect, it } from 'vitest';
import { aspectForRarity, buildCardPrompt, buildHeroPrompt } from '../art/prompt.js';
import { SUBJECT_OVERRIDES } from '../art/overrides.js';
import { styleFor } from '../art/styles.js';

const seraph = {
  id: 'choir-seraph',
  name: 'Seraph of Lament',
  flavor: 'She weeps for the wounded, and every wound she deals she carries home like a hymn.',
  archetype: 'choir',
  rarity: 'rare' as const,
};

describe('aspectForRarity', () => {
  it('gives epic and legendary the portrait ratio for full-bleed', () => {
    expect(aspectForRarity('epic')).toBe('3:4');
    expect(aspectForRarity('legendary')).toBe('3:4');
  });

  it('gives common and rare the landscape ratio for the banded panel', () => {
    expect(aspectForRarity('common')).toBe('3:2');
    expect(aspectForRarity('rare')).toBe('3:2');
  });
});

describe('buildCardPrompt', () => {
  it('composes style block, then name and flavor, then the global suffix', () => {
    const { prompt } = buildCardPrompt(seraph);
    const style = prompt.indexOf(styleFor('choir'));
    const subject = prompt.indexOf('Seraph of Lament');
    const suffix = prompt.indexOf('no lettering');
    expect(style).toBeGreaterThanOrEqual(0);
    expect(subject).toBeGreaterThan(style);
    expect(suffix).toBeGreaterThan(subject);
  });

  it('uses the card flavor as the subject line', () => {
    expect(buildCardPrompt(seraph).prompt).toContain('carries home like a hymn');
  });

  it('carries the rarity-derived aspect ratio', () => {
    expect(buildCardPrompt(seraph).aspectRatio).toBe('3:2');
    expect(buildCardPrompt({ ...seraph, rarity: 'legendary' }).aspectRatio).toBe('3:4');
  });

  it('prefers an override over the flavor line', () => {
    SUBJECT_OVERRIDES['choir-seraph'] = 'A cracked marble statue of a mourning angel';
    try {
      const { prompt } = buildCardPrompt(seraph);
      expect(prompt).toContain('cracked marble statue');
      expect(prompt).not.toContain('carries home like a hymn');
    } finally {
      delete SUBJECT_OVERRIDES['choir-seraph'];
    }
  });

  it('falls back to the name alone when a card somehow has no flavor', () => {
    const { prompt } = buildCardPrompt({ ...seraph, flavor: undefined });
    expect(prompt).toContain('Seraph of Lament');
    expect(prompt).not.toContain('undefined');
  });

  it('gives neutrals the neutral block, not an archetype look', () => {
    const { prompt } = buildCardPrompt({ ...seraph, archetype: 'neutral' });
    expect(prompt).toContain(styleFor('neutral'));
    expect(prompt).not.toContain(styleFor('choir'));
  });

  it('gives tokens the neutral block too', () => {
    const { prompt } = buildCardPrompt({ ...seraph, archetype: 'token' });
    expect(prompt).toContain(styleFor('neutral'));
  });

  it('never emits pixel dimensions', () => {
    expect(buildCardPrompt(seraph).prompt).not.toMatch(/\d{3,4}\s*[x×]\s*\d{3,4}/);
  });
});

describe('buildHeroPrompt', () => {
  it('is always square, whatever the archetype', () => {
    expect(buildHeroPrompt('Vespera Dawnlight', 'choir').aspectRatio).toBe('1:1');
    expect(buildHeroPrompt('Pyra Emberveil', 'ember').aspectRatio).toBe('1:1');
  });

  it('asks for a bust framed for a circular crop', () => {
    const { prompt } = buildHeroPrompt('Vespera Dawnlight', 'choir');
    expect(prompt).toContain('Vespera Dawnlight');
    expect(prompt).toContain('portrait bust');
    expect(prompt).toContain(styleFor('choir'));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/prompt.test.ts`
Expected: FAIL — cannot resolve `../art/prompt.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/prompt.ts
import type { Rarity } from '@ashen/core';
import { SUBJECT_OVERRIDES } from './overrides.js';
import { GLOBAL_SUFFIX, styleFor } from './styles.js';

/**
 * Three-layer prompt composition (design spec section 3.3):
 *   1. archetype style block   — the deck's look
 *   2. subject                 — `${name}. ${flavor}`, or an override
 *   3. global suffix           — house style + text suppression
 *
 * Pure by design: no fs, no network. Prompt wording is the part most likely to
 * need iteration, and iterating it must cost nothing.
 */

export type AspectRatio = '3:4' | '3:2' | '1:1';

export interface PromptInput {
  id: string;
  name: string;
  flavor?: string;
  archetype: string;
  rarity: Rarity;
}

export interface BuiltPrompt {
  prompt: string;
  aspectRatio: AspectRatio;
}

/**
 * Derived from rarity, never operator-set. Epic and legendary get the
 * full-bleed card treatment, which needs art shaped like the whole portrait
 * card; everything else fills the landscape panel of the banded layout.
 * Letting these two decisions drift apart would crop every affected card.
 */
export function aspectForRarity(rarity: Rarity): AspectRatio {
  return rarity === 'epic' || rarity === 'legendary' ? '3:4' : '3:2';
}

/** Layer 2. All 285 curated cards carry flavor, so the fallback is defensive. */
function subjectFor(card: PromptInput): string {
  const override = SUBJECT_OVERRIDES[card.id];
  if (override) return override;
  return card.flavor ? `${card.name}. ${card.flavor}` : card.name;
}

export function buildCardPrompt(card: PromptInput): BuiltPrompt {
  return {
    prompt: [styleFor(card.archetype), subjectFor(card), GLOBAL_SUFFIX].join('. '),
    aspectRatio: aspectForRarity(card.rarity),
  };
}

/**
 * Heroes render inside a 92px circle (heroportrait.css), so they are always
 * square and always framed as a bust — a full-figure composition would lose
 * its subject to the circular mask.
 */
export function buildHeroPrompt(heroName: string, archetype: string): BuiltPrompt {
  const subject = `${heroName}, portrait bust, head and shoulders, facing the viewer`;
  return {
    prompt: [styleFor(archetype), subject, GLOBAL_SUFFIX].join('. '),
    aspectRatio: '1:1',
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/prompt.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/prompt.ts scripts/tests/prompt.test.ts
git commit -m "feat(art): pure three-layer prompt builder with rarity-derived aspect"
```

---

## Task 7: OpenRouter client

**Files:**
- Create: `scripts/art/openrouter.ts`
- Test: `scripts/tests/openrouter.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GenerateResult {
    bytes: Buffer; mediaType: string; costUsd: number; provider: string | null;
  }
  export interface GenerateOptions {
    prompt: string; aspectRatio: string; apiKey: string;
    fetchImpl?: typeof fetch; maxRetries?: number; sleep?: (ms: number) => Promise<void>;
  }
  export function generateImage(opts: GenerateOptions): Promise<GenerateResult>;
  ```

`fetchImpl` and `sleep` are injected **only** so the tests can run without network or real delays. Production callers omit both.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/openrouter.test.ts
import { describe, expect, it, vi } from 'vitest';
import { generateImage, RateLimitedError } from '../art/openrouter.js';

const PNG_B64 = Buffer.from('fake-image-bytes').toString('base64');

function okResponse(cost = 0.04) {
  return new Response(
    JSON.stringify({
      created: 1,
      data: [{ b64_json: PNG_B64, media_type: 'image/jpeg' }],
      usage: { cost },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function errResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: { code: status, message } }), { status });
}

const base = { prompt: 'a knight', aspectRatio: '3:2', apiKey: 'sk-test', sleep: async () => {} };

describe('generateImage', () => {
  it('decodes the image and reports the charge', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(0.037));
    const res = await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.bytes.toString()).toBe('fake-image-bytes');
    expect(res.mediaType).toBe('image/jpeg');
    expect(res.costUsd).toBe(0.037);
  });

  it('sends exactly the documented fields and nothing else', async () => {
    // An unlisted field is rejected with 400, so this guards against someone
    // "helpfully" adding width/height.
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/images');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(
      ['aspect_ratio', 'model', 'n', 'output_format', 'prompt'].sort(),
    );
    expect(body.model).toBe('black-forest-labs/flux.2-klein-4b:free');
    expect(body.aspect_ratio).toBe('3:2');
    expect(body.n).toBe(1);
    expect(body.output_format).toBe('jpeg');
  });

  it('sends the key as a bearer token and never in the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
    expect(init.body as string).not.toContain('sk-test');
  });

  it('retries a 429 and succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(errResponse(429, 'rate limited'))
      .mockResolvedValueOnce(okResponse());
    const res = await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.costUsd).toBe(0.04);
  });

  it('retries a 502 — upstream failures are not billed', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(errResponse(502, 'upstream failed'))
      .mockResolvedValueOnce(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 400 — a bad prompt will fail identically forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(400, 'moderation blocked'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/moderation blocked/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a 402 — retrying with no credits just burns time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(402, 'insufficient credits'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/insufficient credits/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries and surfaces the last error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(429, 'still limited'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 2 }),
    ).rejects.toThrow(/still limited/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('reports a surviving 429 as RateLimitedError — the free daily cap', async () => {
    // The free tier allows 50 requests/day under $10 lifetime credits. A 429
    // that outlives seconds of backoff is that cap, and no amount of further
    // waiting inside one run will clear it.
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(429, 'daily limit'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 1 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('does not label a 502 as rate limited', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(502, 'upstream'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 1 }),
    ).rejects.not.toBeInstanceOf(RateLimitedError);
  });

  it('defaults to the free model and lets --model override it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    let body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.model).toBe('black-forest-labs/flux.2-klein-4b:free');

    fetchImpl.mockClear();
    await generateImage({
      ...base, model: 'black-forest-labs/flux.2-max:free',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.model).toBe('black-forest-labs/flux.2-max:free');
  });

  it('throws a clear error when the response carries no image', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], usage: { cost: 0 } }), { status: 200 }),
    );
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/no image/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/openrouter.test.ts`
Expected: FAIL — cannot resolve `../art/openrouter.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/openrouter.ts

/**
 * OpenRouter Images API client for black-forest-labs/flux.2-klein-4b.
 * Contract: https://openrouter.ai/black-forest-labs/flux.2-klein-4b/llms.txt
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/images';

/**
 * Default to the FREE variant (verified 2026-08-08). It takes the same request
 * fields as the paid model, so nothing else changes.
 *
 * Swappable via --model, but only across models sharing THIS request schema —
 * the other BFL variants (flux.2-klein-4b, flux.2-pro:free, flux.2-max:free)
 * do. Non-FLUX models do not: recraft/recraft-v3:free, for instance, takes an
 * `image_config` object with style/strength/rgb_colors and does not document
 * aspect_ratio at all. Pointing --model at one of those is schema work, not a
 * flag change.
 */
export const DEFAULT_MODEL = 'black-forest-labs/flux.2-klein-4b:free';

/**
 * Only 429 (rate limited) and 502 (upstream failure, not billed) are worth
 * retrying. 400 moderation, 401 bad key, 402 no credits, 403 spend limit and
 * 404 no provider all fail identically on a second attempt.
 */
const RETRYABLE = new Set([429, 502]);

export interface GenerateResult {
  bytes: Buffer;
  mediaType: string;
  costUsd: number;
  /** Serving provider, when OpenRouter reports it — logged so a cheaper
   *  provider can be pinned later if per-image cost comes back high. */
  provider: string | null;
}

export interface GenerateOptions {
  prompt: string;
  aspectRatio: string;
  apiKey: string;
  /** Defaults to DEFAULT_MODEL (the free variant). */
  model?: string;
  /** Injected by tests only. Production omits it. */
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Injected by tests only, to skip real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
}

/** Thrown when a 429 outlives its retries. On the free tier that almost
 *  always means the DAILY cap, not the per-minute one — backing off further
 *  cannot help, so the caller should stop the run and resume tomorrow. */
export class RateLimitedError extends Error {}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateImage(opts: GenerateOptions): Promise<GenerateResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;

  // Exactly the documented fields. An unlisted field is rejected with 400 —
  // in particular there is NO width/height/size parameter, so do not add one.
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio,
    output_format: 'jpeg',
    n: 1,
  };

  let lastError = new Error('no attempt made');
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = await res.json() as {
        data?: Array<{ b64_json?: string; media_type?: string }>;
        usage?: { cost?: number };
        provider?: string;
      };
      const first = json.data?.[0];
      if (!first?.b64_json) {
        throw new Error('OpenRouter returned no image in data[0].b64_json');
      }
      return {
        bytes: Buffer.from(first.b64_json, 'base64'),
        mediaType: first.media_type ?? 'image/jpeg',
        costUsd: json.usage?.cost ?? 0,
        provider: json.provider ?? null,
      };
    }

    const message = await readErrorMessage(res);
    lastStatus = res.status;
    lastError = new Error(`OpenRouter ${res.status}: ${message}`);
    if (!RETRYABLE.has(res.status)) throw lastError;
    // Exponential backoff: 1s, 2s, 4s.
    if (attempt < maxRetries) await sleep(1000 * 2 ** attempt);
  }

  // A 429 that outlived seconds of backoff is the daily cap, not the
  // per-minute one. Distinguished so the CLI can stop cleanly and tell the
  // operator to resume tomorrow instead of grinding through 200 more failures.
  if (lastStatus === 429) throw new RateLimitedError(lastError.message);
  throw lastError;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json() as { error?: { message?: string } };
    return json.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/openrouter.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/openrouter.ts scripts/tests/openrouter.test.ts
git commit -m "feat(art): OpenRouter client with selective retry and cost reporting"
```

---

## Task 8: The CLI

**Files:**
- Create: `scripts/art/generate.ts`
- Test: `scripts/tests/generateArgs.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7, plus `buildPool` and `HEROES` from `@ashen/core`
- Produces: `export interface Args {...}` and `export function parseArgs(argv: string[]): Args;`
  (the orchestrator itself is not exported — it runs on invocation)

Only `parseArgs` is unit-tested. The orchestration is exercised by the real `--dry-run` in Task 9, because mocking fs + sharp + fetch together would test the mocks rather than the code.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tests/generateArgs.test.ts
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../art/generate.js';

describe('parseArgs', () => {
  it('defaults to the safest possible run', () => {
    const a = parseArgs([]);
    // Safe means: spends nothing until explicitly told to, on the free model.
    expect(a.dryRun).toBe(true);
    expect(a.coverage).toBe('all');
    expect(a.only).toBeNull();
    expect(a.limit).toBeNull();
    expect(a.force).toEqual([]);
    expect(a.heroes).toBe(true);
    expect(a.model).toBe('black-forest-labs/flux.2-klein-4b:free');
  });

  it('accepts --model for the other FLUX variants', () => {
    // Only across models sharing the FLUX request schema. Non-FLUX models
    // (e.g. recraft/recraft-v3:free, which takes an image_config object) need
    // schema work in openrouter.ts, not just this flag.
    expect(parseArgs(['--model', 'black-forest-labs/flux.2-max:free']).model)
      .toBe('black-forest-labs/flux.2-max:free');
  });

  it('turns off dry-run only when --commit is passed explicitly', () => {
    expect(parseArgs(['--commit']).dryRun).toBe(false);
  });

  it('parses coverage', () => {
    expect(parseArgs(['--coverage', 'epic+']).coverage).toBe('epic+');
  });

  it('rejects an unknown coverage rather than defaulting to all', () => {
    expect(() => parseArgs(['--coverage', 'epic'])).toThrow(/coverage/i);
  });

  it('parses limit as a positive integer', () => {
    expect(parseArgs(['--limit', '3']).limit).toBe(3);
    expect(() => parseArgs(['--limit', '0'])).toThrow(/limit/i);
    expect(() => parseArgs(['--limit', 'three'])).toThrow(/limit/i);
  });

  it('parses --only and --no-heroes', () => {
    expect(parseArgs(['--only', 'choir']).only).toBe('choir');
    expect(parseArgs(['--no-heroes']).heroes).toBe(false);
  });

  it('collects repeated --force ids', () => {
    expect(parseArgs(['--force', 'choir-seraph', '--force', 'ember-imp']).force)
      .toEqual(['choir-seraph', 'ember-imp']);
  });

  it('keeps --force and --limit independent', () => {
    // Regression guard for the Stage 0 batch: --force must select WHICH cards,
    // --limit only caps how many. An earlier version let --force waive the
    // coverage filter without restricting the job set, so a forced + limited
    // run generated the first N cards in pool order instead of the forced ids.
    const a = parseArgs(['--force', 'x', '--force', 'y', '--limit', '3']);
    expect(a.force).toEqual(['x', 'y']);
    expect(a.limit).toBe(3);
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    // Silently ignoring --limt would generate the whole pool by accident.
    expect(() => parseArgs(['--limt', '3'])).toThrow(/unknown/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/tests/generateArgs.test.ts`
Expected: FAIL — cannot resolve `../art/generate.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/art/generate.ts
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { buildPool, DECK_DEFS, HEROES } from '@ashen/core';
import { inCoverage, parseCoverage, type Coverage } from './coverage.js';
import { DEFAULT_MODEL, generateImage, RateLimitedError } from './openrouter.js';
import type { GenerateResult } from './openrouter.js';
import { cardArtPath, heroArtPath } from './paths.js';
import { buildCardPrompt, buildHeroPrompt, type BuiltPrompt } from './prompt.js';

/**
 * Offline art generation CLI. Run from the repo root:
 *
 *   npm run art:generate -- --dry-run
 *   npm run art:generate -- --commit --force a --force b --force c   # Stage 0
 *   npm run art:generate -- --commit --coverage epic+
 *   npm run art:generate -- --commit --model black-forest-labs/flux.2-max:free
 *
 * DEFAULTS TO --dry-run and to the FREE model variant. Both a real request and
 * a paid model require an explicit flag.
 *
 * Free tier is capped at 20 requests/minute and 50/day (1000/day once $10 of
 * credits has ever been purchased). Requests are spaced automatically, so a
 * full 297-image pass takes ~16 minutes on the 1000/day tier. A daily-cap 429
 * stops the run cleanly — re-running the same command later resumes, because
 * anything already written is skipped.
 */

/** Written size per aspect — derived from what the UI renders at 2x DPR. */
const TARGET_SIZE: Record<string, { width: number; height: number }> = {
  '3:2': { width: 480, height: 320 },   // banded card panel, 220x147 CSS
  '3:4': { width: 528, height: 704 },   // full-bleed card,    240x336 CSS
  '1:1': { width: 256, height: 256 },   // hero circle,         92x92  CSS
};

/**
 * Free-tier limit is 20 requests/minute, so requests are spaced at least this
 * far apart. 3.2s leaves headroom against clock skew and request duration.
 * Harmless on the paid variant, which is why it is unconditional.
 */
const MIN_REQUEST_SPACING_MS = 3200;

export interface Args {
  dryRun: boolean;
  coverage: Coverage;
  only: string | null;
  limit: number | null;
  force: string[];
  heroes: boolean;
  model: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: true, coverage: 'all', only: null, limit: null, force: [],
    heroes: true, model: DEFAULT_MODEL,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    switch (flag) {
      case '--commit': args.dryRun = false; break;
      case '--dry-run': args.dryRun = true; break;
      case '--no-heroes': args.heroes = false; break;
      case '--coverage': args.coverage = parseCoverage(argv[++i] ?? ''); break;
      case '--only': args.only = argv[++i] ?? null; break;
      case '--force': args.force.push(argv[++i] ?? ''); break;
      case '--model': args.model = argv[++i] ?? DEFAULT_MODEL; break;
      case '--limit': {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`--limit expects a positive integer, got "${argv[i]}"`);
        }
        args.limit = n;
        break;
      }
      default:
        // Never ignore an unknown flag: a typo'd --limt would silently
        // generate the entire pool.
        throw new Error(`Unknown flag "${flag}"`);
    }
  }
  return args;
}

interface Job { key: string; outPath: string; built: BuiltPrompt; }

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function buildJobs(args: Args): Job[] {
  const forced = new Set(args.force);
  const jobs: Job[] = [];

  for (const card of buildPool()) {
    // --force means "exactly these cards". Without this branch, --force merely
    // waived the coverage filter, so `--force a --force b --force c --limit 3`
    // still enumerated the whole pool and then sliced the first three in pool
    // order — generating three arbitrary cards instead of the three asked for.
    if (forced.size > 0) {
      if (!forced.has(card.id)) continue;
    } else {
      if (args.only !== null && card.archetype !== args.only) continue;
      if (!inCoverage(card.rarity, args.coverage)) continue;
    }
    jobs.push({
      key: card.id,
      outPath: resolve(cardArtPath(card.id)),
      built: buildCardPrompt(card),
    });
  }

  // Forced runs are card-only: --force names card ids, never hero names.
  if (args.heroes && forced.size === 0) {
    // HEROES is positionally zipped with Object.keys(DECK_DEFS) — index i of
    // one matches index i of the other. Both the app and the server rely on
    // this ordering; do not sort either side.
    const keys = Object.keys(DECK_DEFS);
    HEROES.forEach((hero, i) => {
      if (args.only !== null && keys[i] !== args.only) return;
      jobs.push({
        key: hero.name,
        outPath: resolve(heroArtPath(hero.name)),
        built: buildHeroPrompt(hero.name, keys[i]!),
      });
    });
  }

  return jobs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const forced = new Set(args.force);

  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!args.dryRun && !apiKey) {
    console.error('OPENROUTER_API_KEY is not set. Export it before running with --commit.');
    process.exit(1);
  }

  let jobs = buildJobs(args);

  // Skip anything already generated, so a crashed run resumes for free.
  const pending: Job[] = [];
  for (const job of jobs) {
    if (!forced.has(job.key) && await exists(job.outPath)) continue;
    pending.push(job);
  }
  jobs = args.limit === null ? pending : pending.slice(0, args.limit);

  console.log(`${jobs.length} image(s) to generate` +
    (args.dryRun ? ' — DRY RUN, nothing will be spent or written' : ''));

  if (args.dryRun) {
    for (const job of jobs) {
      console.log(`\n--- ${job.key}  [${job.built.aspectRatio}]\n${job.built.prompt}`);
    }
    console.log(`\nDry run complete. ${jobs.length} prompt(s) shown, $0.00 spent.`);
    return;
  }

  console.log(`model: ${args.model}`);

  let total = 0;
  let done = 0;
  for (const [i, job] of jobs.entries()) {
    // Free tier allows 20 requests/minute. Space them rather than burst and
    // eat 429s; the first request is not delayed.
    if (i > 0) await new Promise((r) => setTimeout(r, MIN_REQUEST_SPACING_MS));

    // Annotated, not `let res;` — the latter is an implicit any that leans on
    // control-flow inference to recover a type, which is fragile under strict.
    let res: GenerateResult;
    try {
      res = await generateImage({
        prompt: job.built.prompt,
        aspectRatio: job.built.aspectRatio,
        apiKey: apiKey!,
        model: args.model,
      });
    } catch (err) {
      if (err instanceof RateLimitedError) {
        // Free tier: 50 requests/day under $10 lifetime credits, 1000 above.
        // Nothing in this run can clear that, so stop cleanly. Everything
        // already written is skipped on the next run, so re-running the same
        // command tomorrow resumes exactly here.
        console.error(
          `\nRate limited after ${done} image(s) — this is almost certainly the ` +
          `free tier's DAILY cap.\nRe-run the same command tomorrow; the ` +
          `${done} image(s) already written will be skipped.`,
        );
        break;
      }
      throw err;
    }

    done++;
    total += res.costUsd;

    const meta = await sharp(res.bytes).metadata();
    const target = TARGET_SIZE[job.built.aspectRatio]!;
    await mkdir(dirname(job.outPath), { recursive: true });
    await writeFile(
      job.outPath,
      await sharp(res.bytes)
        .resize(target.width, target.height, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer(),
    );

    const mp = ((meta.width ?? 0) * (meta.height ?? 0)) / 1e6;
    console.log(
      `[${i + 1}/${jobs.length}] ${job.key}  ` +
      `src=${meta.width}x${meta.height} (${mp.toFixed(2)}MP)  ` +
      `provider=${res.provider ?? 'unknown'}  ` +
      `$${res.costUsd.toFixed(4)}  running=$${total.toFixed(2)}`,
    );
  }

  const perImage = done > 0 ? total / done : 0;
  console.log(`\nDone. ${done}/${jobs.length} image(s), $${total.toFixed(2)} total, ` +
    `$${perImage.toFixed(4)}/image.`);
  if (perImage > 0) {
    console.log(`Extrapolated spend: all=297 -> $${(perImage * 297).toFixed(2)}  ` +
      `rare+=146 -> $${(perImage * 146).toFixed(2)}  ` +
      `epic+=78 -> $${(perImage * 78).toFixed(2)}`);
  } else {
    console.log('$0.00 charged — the free variant. The binding constraint is the ' +
      'daily request cap (50/day under $10 lifetime credits, 1000/day above), ' +
      'not money: all=297, rare+=146, epic+=78 requests.');
  }
}

// Only run when invoked directly, so the test can import parseArgs safely.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run scripts/tests/generateArgs.test.ts`
Expected: PASS, 8 tests.

The bottom-of-file guard exists so the test can `import { parseArgs }` without `main()` firing. It compares `import.meta.url` against `process.argv[1]`'s basename: under `tsx scripts/art/generate.ts` those match and `main()` runs; under vitest `argv[1]` is the vitest binary, so they do not.

If `main()` nevertheless executes during the test — you will see the job count printed in the test output — replace the guard with an explicit opt-out:

```ts
if (!process.env['ART_GENERATE_NO_MAIN']) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

and add this as the **first line** of `scripts/tests/generateArgs.test.ts`, before any import of `generate.js`:

```ts
process.env['ART_GENERATE_NO_MAIN'] = '1';
```

Prefer the original guard if it works — it needs no test-side cooperation.

- [ ] **Step 5: Commit**

```bash
npm test
git add scripts/art/generate.ts scripts/tests/generateArgs.test.ts
git commit -m "feat(art): generation CLI, dry-run by default"
```

---

## Task 9: Dry run — verify prompts without spending

**Files:** none changed. This task is a verification gate.

- [ ] **Step 1: Dry-run three archetypes**

```bash
cd "/Users/lucas/Local Storage/PROJECTS/tcg"
npm run art:generate -- --only choir --limit 3
```

Expected: three prompts printed, each ending `$0.00 spent`. Read them. Confirm:
- the Hollow Choir style block appears
- the card's real flavor text appears
- `no text, no lettering, no watermark` appears
- **no pixel dimensions appear anywhere**
- rares/commons show `[3:2]`, epics/legendaries show `[3:4]`

- [ ] **Step 2: Confirm the safety default**

```bash
npm run art:generate -- --limit 1
```

Expected: still a dry run — the output must say `DRY RUN, nothing will be spent`. If this spends money, `parseArgs` defaults are wrong. **Stop and fix before continuing.**

- [ ] **Step 3: Confirm coverage counts**

```bash
npm run art:generate -- --coverage epic+ --no-heroes | head -1
npm run art:generate -- --coverage all --no-heroes | head -1
```

Expected: `66 image(s) to generate` and `285 image(s) to generate` respectively.

---

## Task 10: Stage 0 — the smoke batch (HUMAN GATE)

**Files:** creates 3 images under `app/src/assets/art/`.

> **STOP HERE AFTER THIS TASK.** This is the gate from spec §3.5. Do not proceed to bulk generation without explicit human approval of the images.
>
> On the free variant this is primarily a **quality** gate — three images cost $0.00 and 3 of the day's request allowance. It remains a cost gate whenever `--model` points at a paid variant.

- [ ] **Step 1: Generate exactly three images**

```bash
export OPENROUTER_API_KEY=...        # never commit this

# Confirm the exact three first — costs nothing.
npm run art:generate -- --force choir-smite --force neutral-knight --force star-meteor

# Then spend.
npm run art:generate -- --commit \
  --force choir-smite --force neutral-knight --force star-meteor
```

`--force` selects exactly these three, so `--limit` is unnecessary here. Verify from the dry run that all three ids exist and that the printed cards are what you expect — one Hollow Choir spell, one neutral, one from a third archetype. If an id is wrong the dry run prints fewer than three prompts; fix the ids before adding `--commit`.

- [ ] **Step 2: Record the measurements**

From the output, write down: source resolution, megapixels, serving provider, per-image cost (expected `$0.0000` on the free variant), and whether the run reported extrapolated spend or the request-cap note.

**If per-image cost is not $0.00 on a `:free` model, stop and report it** — that means the `:free` suffix did not take effect and the paid variant is being billed.

- [ ] **Step 3: Look at the images**

Open the three JPEGs. Check for: accidental text or lettering, subject matching the card, composition that survives a crop, and the three reading as the same visual world.

- [ ] **Step 4: Report and stop**

Report the numbers and the images to the human. **Await an explicit coverage decision (`all` / `rare+` / `epic+`) before any further generation.** Do not commit the images yet.

---

## Task 11: App-side art resolver

**Files:**
- Create: `app/src/art/resolveArt.ts`
- Test: `app/tests/resolveArt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function makeResolver(
    map: Record<string, string>, dir: string, ext?: string,
  ): (key: string) => string | null;
  export function resolveCardArt(cardId: string): string | null;
  export function resolveHeroArt(heroName: string): string | null;
  ```

`makeResolver` exists so the lookup logic is testable without Vite. `resolveCardArt`/`resolveHeroArt` are the thin production bindings over `import.meta.glob`.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/resolveArt.test.ts
import { describe, expect, it } from 'vitest';
import { makeResolver } from '../src/art/resolveArt.js';

// Shaped exactly like an import.meta.glob(..., { eager: true, as: 'url' }) map:
// absolute-ish source paths as keys, emitted URLs as values.
const MAP = {
  '/src/assets/art/cards/choir-seraph.jpg': '/assets/choir-seraph-a1b2c3.jpg',
  '/src/assets/art/cards/ember-imp.jpg': '/assets/ember-imp-d4e5f6.jpg',
};

const resolve = makeResolver(MAP, '/src/assets/art/cards');

describe('makeResolver', () => {
  it('returns the hashed URL for a card that has art', () => {
    expect(resolve('choir-seraph')).toBe('/assets/choir-seraph-a1b2c3.jpg');
  });

  it('returns null for a card with no art, so the caller can fall back', () => {
    expect(resolve('vigil-smite')).toBeNull();
  });

  it('does not match on a partial id', () => {
    // 'seraph' must not accidentally resolve 'choir-seraph'.
    expect(resolve('seraph')).toBeNull();
  });

  it('is empty-safe — a pool with no generated art yet resolves nothing', () => {
    const none = makeResolver({}, '/src/assets/art/cards');
    expect(none('choir-seraph')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/tests/resolveArt.test.ts`
Expected: FAIL — cannot resolve `../src/art/resolveArt.js`.

- [ ] **Step 3: Write the implementation**

```ts
// app/src/art/resolveArt.ts

/**
 * Generated-art lookup, with a build-time answer.
 *
 * Vite's import.meta.glob enumerates the asset directory at build time and
 * hands back content-hashed URLs, so "does this card have art" is settled
 * before the app runs. The alternative — constructing a URL and letting the
 * <img> 404 — would flash a broken image for every card without art, which
 * during incremental generation is most of them.
 *
 * A miss returns null and the caller falls back to the procedural SVG in
 * CardArt, which is what keeps Forge custom cards working and lets the pool be
 * generated a slice at a time.
 */

/** Pure lookup core, extracted so it is testable without Vite. */
export function makeResolver(
  map: Record<string, string>,
  dir: string,
  ext = '.jpg',
): (key: string) => string | null {
  return (key: string) => map[`${dir}/${key}${ext}`] ?? null;
}

const CARD_DIR = '/src/assets/art/cards';
const HERO_DIR = '/src/assets/art/heroes';

const cardMap = import.meta.glob('../assets/art/cards/*.jpg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

const heroMap = import.meta.glob('../assets/art/heroes/*.jpg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

/** Glob keys are relative to this module; normalise them to absolute-ish
 *  project paths so the resolver's key format is stable and testable. */
function normalise(map: Record<string, string>, dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(map)) {
    const file = path.split('/').pop();
    if (file) out[`${dir}/${file}`] = url;
  }
  return out;
}

const cards = normalise(cardMap, CARD_DIR);
const heroes = normalise(heroMap, HERO_DIR);

export const resolveCardArt = makeResolver(cards, CARD_DIR);

/** Mirrors scripts/art/paths.ts heroSlug — the two must agree exactly, or
 *  every hero portrait silently misses. */
export function heroSlug(heroName: string): string {
  return heroName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const heroResolver = makeResolver(heroes, HERO_DIR);
export function resolveHeroArt(heroName: string): string | null {
  return heroResolver(heroSlug(heroName));
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/tests/resolveArt.test.ts`
Expected: PASS, 4 tests.

If vitest fails on `import.meta.glob` in the jsdom environment, the glob calls must be evaluated lazily. Move them inside the exported functions behind a module-level cache. Do **not** delete the test.

- [ ] **Step 5: Add a slug-agreement test**

The script and the app each own a `heroSlug`. They must agree or every portrait misses silently.

```ts
// append to app/tests/resolveArt.test.ts
import { heroSlug } from '../src/art/resolveArt.js';

describe('heroSlug agrees with the generator', () => {
  it('matches scripts/art/paths.ts for all 12 hero names', () => {
    const expected: Record<string, string> = {
      'Pyra Emberveil': 'pyra-emberveil',
      'Vespera Dawnlight': 'vespera-dawnlight',
      'Rat King Moulder': 'rat-king-moulder',
      'Seraphina Skywing': 'seraphina-skywing',
      'Oldroot': 'oldroot',
      'Nyx Nightshade': 'nyx-nightshade',
      'Baron Von Bone': 'baron-von-bone',
      'Morticia Gravefall': 'morticia-gravefall',
      'Morwenna Hex': 'morwenna-hex',
      'Archon Stellara': 'archon-stellara',
      'Ser Aldric the Vigilant': 'ser-aldric-the-vigilant',
      'Zephyra Stormveil': 'zephyra-stormveil',
    };
    for (const [name, slug] of Object.entries(expected)) {
      expect(heroSlug(name)).toBe(slug);
    }
  });
});
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all green, 5 new tests in this file.

- [ ] **Step 7: Commit**

```bash
git add app/src/art/resolveArt.ts app/tests/resolveArt.test.ts
git commit -m "feat(art): build-time art resolver with procedural fallback"
```

---

## Task 12: Bulk generation (HUMAN GATE — requires Task 10 approval)

**Files:** creates images under `app/src/assets/art/`.

- [ ] **Step 1: Generate at the approved coverage**

```bash
export OPENROUTER_API_KEY=...
npm run art:generate -- --commit --coverage <approved>
```

Already-generated files are skipped, so this resumes the smoke batch rather than repeating it.

- [ ] **Step 2: Review the output**

Open the directory as a contact sheet. Flag any image with visible text, a wrong subject, or a composition that will not survive its crop.

- [ ] **Step 3: Repair flagged cards**

For each, add a subject line to `scripts/art/overrides.ts`, then:

```bash
npm run art:generate -- --commit --force <cardId>
```

- [ ] **Step 4: Verify repo size before committing**

```bash
du -sh app/src/assets/art
```

Expected: roughly 9–11MB at full coverage. If it is far larger, the `sharp` resize in Task 8 is not running — do not commit until it is.

- [ ] **Step 5: Commit images separately from code**

```bash
git add app/src/assets/art
git commit -m "assets: generated card and hero art (<coverage>)"
```

---

## Self-review notes

- **Spec coverage:** §3.2 → Tasks 2–8; §3.3 → Tasks 2, 5, 6; §3.4 → Tasks 6, 7; §3.5 → Tasks 3, 8, 10, 12; §3.6 → Tasks 4, 8; §3.7 → Task 8; §3.8 → Task 11. §4 and §5 belong to the other two plans.
- **Known gap, deliberate:** the CLI orchestration in Task 8 has no unit test; Task 9's real dry run covers it. Mocking fs + sharp + fetch together would assert the mocks.
- **Type consistency:** `Coverage`, `AspectRatio`, `BuiltPrompt`, `GenerateResult`, `Args`, `Job` are each defined once and referenced by those exact names throughout.
- **`heroSlug` is duplicated** in `scripts/art/paths.ts` and `app/src/art/resolveArt.ts` — deliberately, because `scripts/` must not import from `app/src/`. Task 11 Step 5 pins them to each other with a test.
