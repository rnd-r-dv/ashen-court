import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Card } from '@ashen/core';
import {
  buildPool,
  DECK_DEFS,
  expandDeck,
  validateCard,
  validateDeck,
} from '@ashen/core';
import {
  exportCardsJson,
  importCardsJson,
  saveCustomCard,
  loadCustomCards,
} from '../src/storage.js';
import ImportExport from '../src/components/ImportExport.js';

// React 18's act() requires the testing-environment flag (see drivers.test.ts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A valid 1-cost 1/1 creature fixture (validated by @ashen/core). */
const validCard = (over: Partial<Card> = {}): Card => ({
  id: 'custom-import-001',
  name: 'Import Test',
  type: 'creature',
  cost: 1,
  attack: 1,
  health: 1,
  reflect: 1,
  keywords: [],
  effects: [],
  rarity: 'common',
  archetype: 'neutral',
  art: { preset: 'ember', palette: ['#2a1a3e', '#ff6b35'], seed: 7 },
  author: 'custom',
  version: 1,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('JSON import/export round-trip', () => {
  it('fixtures pass core validation', () => {
    const cards = [
      validCard(),
      validCard({ id: 'custom-import-002', name: 'Second', cost: 2, attack: 2, health: 2 }),
    ];
    for (const c of cards) {
      expect(validateCard(c).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('round-trips a Card[] through exportCardsJson → importCardsJson', () => {
    const cards = [
      validCard(),
      validCard({
        id: 'custom-import-002',
        name: 'Ash Hound',
        cost: 3,
        attack: 2,
        health: 4,
        keywords: ['taunt'],
        rarity: 'rare',
        flavor: 'Burns bright at dawn.',
        art: { preset: 'bone', palette: ['#2b2118', '#e8d5b0'], glyph: '✦', seed: 11 },
        version: 2,
      }),
    ];
    const json = exportCardsJson(cards);
    expect(importCardsJson(json)).toEqual(cards);
  });

  // Task 1 compatibility bridge: exports/imports written before the Reflect
  // contract existed carry creatures with no `reflect`. Import normalizes them
  // deterministically to Reflect = Attack (ids and `version` untouched) so
  // they pass core validation and fight with mirror-stat parity. Task 3
  // replaces this bridge with an explicit Forge input + schemaVersion migration.
  it('normalizes legacy imports missing Reflect to Reflect = Attack (Task 1 bridge)', () => {
    const legacy = validCard({ id: 'legacy-import-001', name: 'Old Import', version: 5 });
    delete legacy.reflect;   // shape as exported before the field existed
    const [imported] = importCardsJson(JSON.stringify([legacy]));
    expect(imported!.reflect).toBe(1);      // attack of the legacy 1/1
    expect(imported!.id).toBe('legacy-import-001'); // identity preserved
    expect(imported!.version).toBe(5);      // revision value preserved
  });

  it('does NOT silently repair a schemaVersion-2 creature missing Reflect (Task 3 owns the gate)', () => {
    const schema2 = validCard({ id: 'schema2-import', schemaVersion: 2 });
    delete schema2.reflect;
    // a 2-stamped card is authored, not legacy — the import gate must reject it
    expect(() => importCardsJson(JSON.stringify([schema2]))).toThrow(/reflect >= 0/);
  });

  it('import rejects invalid JSON', () => {
    expect(() => importCardsJson('not json at all')).toThrow('Invalid JSON');
  });

  it('import rejects a non-array payload (e.g. a deck blob)', () => {
    expect(() => importCardsJson(JSON.stringify({ deck: ['a', 'b', 'c'] }))).toThrow(
      'expected an array',
    );
  });

  it('import rejects the first invalid card with its id in the message', () => {
    const bad = JSON.stringify([
      validCard(),
      { id: 'BAD ID!', name: 'Bad', type: 'creature', cost: 1 },
    ]);
    expect(() => importCardsJson(bad)).toThrow('BAD ID!');
  });
});

describe('deck import', () => {
  it('a 60-card curated deck validates clean against pool ∪ custom cards', () => {
    const ids = expandDeck(DECK_DEFS.ember);
    expect(ids).toHaveLength(60);
    const pool = new Map<string, Card>();
    for (const c of [...buildPool(), ...loadCustomCards()]) pool.set(c.id, c);
    expect(validateDeck(ids, pool).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('a 3-card deck reports the exactly-60 error', () => {
    const pool = new Map<string, Card>();
    for (const c of buildPool()) pool.set(c.id, c);
    const issues = validateDeck(['ember-cinderling', 'ember-cinderling', 'ember-cinderling'], pool);
    expect(issues.some((i) => i.message.includes('exactly 60'))).toBe(true);
  });
});

describe('bulk import persistence', () => {
  it('saving each imported card via saveCustomCard persists them all', () => {
    const cards = [validCard(), validCard({ id: 'custom-import-002', name: 'Second' })];
    const imported = importCardsJson(exportCardsJson(cards));
    for (const c of imported) saveCustomCard(c);
    expect(loadCustomCards()).toEqual(cards);
  });
});

// ---- component-level import/export (audit 07: bugs 13, 14, 15) ----

/**
 * Mount the real ImportExport toolbar in jsdom and drive its hidden file
 * input / export button. Follows match.test.ts's harness conventions
 * (createRoot + act, no testing-library in this workspace).
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

async function mount(props: Parameters<typeof ImportExport>[0]) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(ImportExport, props));
  });
  return host;
}

/** Feed `text` to the hidden file input as `filename` and drain the FileReader. */
async function selectFile(text: string, filename: string) {
  const input = host!.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File([text], filename, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // FileReader.readAsText resolves on a macrotask in jsdom.
    await new Promise((r) => setTimeout(r, 20));
  });
}

function toastText(): string {
  return host!.querySelector('.importexport-toast')?.textContent ?? '';
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

describe('ImportExport cards import is all-or-nothing (bug 13)', () => {
  it('writes NOTHING when a later card collides with a curated card id', async () => {
    await mount({ mode: 'cards' });
    const payload = JSON.stringify([
      validCard({ id: 'custom-batch-a', name: 'A' }),
      // saveCustomCard throws on this id — it is taken by a curated card.
      validCard({ id: 'ember-cinderling', name: 'Collides' }),
      validCard({ id: 'custom-batch-c', name: 'C' }),
    ]);
    await selectFile(payload, 'cards.json');
    expect(toastText()).toMatch(/ember-cinderling/);
    // The pre-import batch check must abort before ANY card is committed.
    expect(loadCustomCards()).toEqual([]);
  });

  it('writes NOTHING when a later card collides with an existing custom card id', async () => {
    saveCustomCard(validCard({ id: 'custom-existing', name: 'Original' }));
    await mount({ mode: 'cards' });
    const payload = JSON.stringify([
      validCard({ id: 'custom-batch-a', name: 'A' }),
      validCard({ id: 'custom-existing', name: 'Different Name' }),
    ]);
    await selectFile(payload, 'cards.json');
    expect(loadCustomCards().map((c) => c.id)).toEqual(['custom-existing']);
    expect(loadCustomCards()[0]!.name).toBe('Original');
  });

  it('rejects duplicate ids WITHIN the imported batch, with zero writes', async () => {
    await mount({ mode: 'cards' });
    const payload = JSON.stringify([
      validCard({ id: 'custom-dupe', name: 'First' }),
      validCard({ id: 'custom-dupe', name: 'Second' }),
    ]);
    await selectFile(payload, 'cards.json');
    expect(toastText()).toMatch(/custom-dupe/);
    expect(loadCustomCards()).toEqual([]);
  });

  it('reports how many cards actually saved when storage fills mid-commit', async () => {
    // Quota cannot be pre-flighted: the first write lands, the second is
    // rejected. The toast must state the real count, not a bare "Import failed".
    const real = globalThis.localStorage;
    const backing = new Map<string, string>();
    let writes = 0;
    // storage.test.ts's convention: swap the global rather than spy — jsdom's
    // Storage is a Proxy and vi.spyOn cannot shadow its methods.
    const flaky: Storage = {
      get length() { return backing.size; },
      clear() { backing.clear(); },
      key() { return null; },
      getItem(k: string) { return backing.get(k) ?? null; },
      removeItem(k: string) { backing.delete(k); },
      setItem(k: string, v: string) {
        writes += 1;
        if (writes > 1) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        backing.set(k, v);
      },
    };
    Object.defineProperty(globalThis, 'localStorage', { value: flaky, configurable: true, writable: true });
    try {
      await mount({ mode: 'cards' });
      const payload = JSON.stringify([
        validCard({ id: 'custom-quota-a', name: 'A' }),
        validCard({ id: 'custom-quota-b', name: 'B' }),
      ]);
      await selectFile(payload, 'cards.json');
      expect(toastText()).toMatch(/1 of 2/);
      expect(toastText()).not.toBe('Import failed: storage is full — some cards could not be saved.');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true, writable: true });
    }
  });

  it('commits every card when the whole batch is clean', async () => {
    const imported: Card[][] = [];
    await mount({ mode: 'cards', onImportedCards: (cs) => imported.push(cs) });
    const payload = JSON.stringify([
      validCard({ id: 'custom-ok-a', name: 'A' }),
      validCard({ id: 'custom-ok-b', name: 'B' }),
    ]);
    await selectFile(payload, 'cards.json');
    expect(loadCustomCards().map((c) => c.id)).toEqual(['custom-ok-a', 'custom-ok-b']);
    expect(imported).toHaveLength(1);
    expect(toastText()).toBe('Imported 2 cards.');
  });
});

describe('ImportExport download object URL lifetime (bug 14)', () => {
  it('defers revokeObjectURL past the click that starts the download', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((): string => {
      const u = `blob:ashen-${created.length}`;
      created.push(u);
      return u;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((u: string) => {
      revoked.push(u);
    }) as typeof URL.revokeObjectURL;
    try {
      saveCustomCard(validCard({ id: 'custom-export-a', name: 'A' }));
      await mount({ mode: 'cards' });
      const exportBtn = host!.querySelector('.importexport-btn') as HTMLButtonElement;
      // Fake timers, or this races: the deferred revoke is one macrotask away
      // and act()'s async flush can let the event loop turn before the assert.
      vi.useFakeTimers();
      try {
        await act(async () => {
          exportBtn.click();
        });
        expect(created).toHaveLength(1);
        // Synchronous revoke races (and can cancel) the download navigation.
        expect(revoked).toEqual([]);
        vi.advanceTimersByTime(1);
        // …but it must still be revoked, or the blob leaks for the page's life.
        expect(revoked).toEqual(created);
      } finally {
        vi.useRealTimers();
      }
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe('ImportExport deck filename → deck name (bug 15)', () => {
  it('strips only the .json extension from a dotted filename', async () => {
    const names: string[] = [];
    await mount({ mode: 'deck', onImportedDeck: (_ids, name) => names.push(name) });
    await selectFile(JSON.stringify({ deck: expandDeck(DECK_DEFS.ember) }), 'my.deck.json');
    expect(names).toEqual(['my.deck']);
  });

  it('leaves a name with no extension intact', async () => {
    const names: string[] = [];
    await mount({ mode: 'deck', onImportedDeck: (_ids, name) => names.push(name) });
    await selectFile(JSON.stringify({ deck: expandDeck(DECK_DEFS.bone) }), 'ashen-deck.json');
    expect(names).toEqual(['ashen-deck']);
  });
});
