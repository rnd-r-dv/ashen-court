import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Card } from '@ashen/core';
import { buildPool, validateDeck } from '@ashen/core';
import { exportCardsJson, importCardsJson, loadCustomCards, saveCustomCard } from '../storage.js';
import { deckExportError } from '../deckBuild.js';
import './importexport.css';

/**
 * JSON import/export toolbar (Task 29). Reusable across screens:
 *
 *  - mode="cards": export all saved custom cards as 'ashen-custom-cards.json'
 *    (pretty JSON via exportCardsJson); import parses + validates via
 *    importCardsJson, PRE-FLIGHTS the whole batch (importBatchError, audit 07
 *    bug 13) so a bad card aborts with zero writes, then commits and reports
 *    the count actually saved.
 *  - mode="deck": export the working deck's ids as { deck: [...] } in
 *    'ashen-deck.json'; import validates the ids against the full pool
 *    (buildPool() ∪ custom cards) and hands a clean deck to the caller.
 *
 * Export uses a Blob + programmatic <a download> click; import uses a hidden
 * file input. All outcomes surface as a self-contained toast, so screens can
 * drop the component into a header/toolbar without wiring their own toast.
 */

export interface ImportExportProps {
  mode: 'cards' | 'deck';
  /** Deck mode: the current working deck's card ids (exported as { deck: [...] }). */
  deckIds?: string[];
  /** Cards mode: called after a successful import (cards already saved to storage). */
  onImportedCards?: (cards: Card[]) => void;
  /** Deck mode: called with a validated deck + a name derived from the file. */
  onImportedDeck?: (ids: string[], name: string) => void;
}

const CARDS_FILENAME = 'ashen-custom-cards.json';
const DECK_FILENAME = 'ashen-deck.json';

/** Trigger a browser download of `text` under `filename` (Blob + <a download>). */
function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Audit 07 bug 14: revoking in the same task as the click races the download
  // — some browsers cancel a save that has not started fetching the blob yet.
  // Deferring one macrotask lets the navigation begin; the revoke still runs,
  // so the blob does not leak for the lifetime of the page.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 'ashen-deck.json' → 'ashen-deck' (basename without .json).
 *
 * Audit 07 bug 15: only the .json extension comes off. A second, generic
 * `.replace(/\.[^/.]+$/, '')` used to run after it and ate the real last
 * segment of a dotted name ('my.deck.json' → 'my.deck' → 'my').
 */
function nameFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '');
}

/**
 * Pre-flight a whole card batch against everything checkable WITHOUT writing
 * (audit 07 bug 13). Returns the first blocking reason, or null when the batch
 * is safe to commit.
 *
 * saveCustomCard throws on an id collision, so the old per-card commit loop
 * wrote every card up to the failure and then reported a bare "Import failed"
 * — a 5-card file whose 3rd card collided left 2 cards silently installed.
 * Running every non-write check over the FULL batch first turns that into a
 * zero-write abort.
 *
 * Mirrors saveCustomCard's own rules (storage.ts, audit 05 I2) plus one the
 * commit loop could never see: duplicate ids *inside* the imported file, which
 * would upsert over each other (same name) or throw halfway (different name).
 */
export function importBatchError(cards: Card[], existing: Card[]): string | null {
  const curated = new Set(buildPool().map((c) => c.id));
  const seen = new Set<string>();
  for (const card of cards) {
    if (curated.has(card.id)) {
      return `Cannot save "${card.name}": id ${card.id} is taken by a curated card. Rename it.`;
    }
    const clash = existing.find((c) => c.id === card.id && c.name !== card.name);
    if (clash) {
      return `Cannot save "${card.name}": id ${card.id} is already used by "${clash.name}". Rename it.`;
    }
    if (seen.has(card.id)) {
      return `Duplicate id ${card.id} in the imported file — every card needs a unique id.`;
    }
    seen.add(card.id);
  }
  return null;
}

export default function ImportExport({ mode, deckIds, onImportedCards, onImportedDeck }: ImportExportProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  // ---- export ----

  function onExport() {
    if (mode === 'cards') {
      const cards = loadCustomCards();
      if (cards.length === 0) {
        showToast('Nothing to export — no custom cards saved yet.');
        return;
      }
      downloadText(exportCardsJson(cards), CARDS_FILENAME);
      showToast(`Exported ${cards.length} custom card${cards.length === 1 ? '' : 's'}.`);
    } else {
      const ids = deckIds ?? [];
      const pool = new Map<string, Card>();
      for (const c of [...buildPool(), ...loadCustomCards()]) pool.set(c.id, c);
      // M4: a non-60 or invalid deck would fail its own import — refuse to export it.
      const blocked = deckExportError(ids, pool);
      if (blocked) {
        showToast(blocked);
        return;
      }
      downloadText(JSON.stringify({ deck: ids }, null, 2), DECK_FILENAME);
      showToast(`Exported a ${ids.length}-card deck.`);
    }
  }

  // ---- import ----

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';   // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      if (mode === 'cards') importCards(text);
      else importDeck(text, file.name);
    };
    reader.readAsText(file);
  }

  function importCards(text: string) {
    let cards: Card[];
    try {
      cards = importCardsJson(text);
    } catch (err) {
      showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    // Audit 07 bug 13: check the WHOLE batch before writing anything, so a
    // collision on card 3 of 5 can no longer leave cards 1-2 installed.
    const blocked = importBatchError(cards, loadCustomCards());
    if (blocked) {
      showToast(`Import failed: ${blocked}`);
      return;
    }
    // Only a quota rejection survives the pre-flight, and it cannot be
    // predicted without writing. storage.ts has no bulk single-write helper,
    // so this loop is NOT atomic — say exactly how many cards landed rather
    // than claiming a guarantee we do not have.
    let saved = 0;
    try {
      for (const card of cards) {
        if (!saveCustomCard(card)) break;
        saved += 1;
      }
    } catch (err) {
      // Unreachable after the pre-flight; kept so an unforeseen storage.ts
      // rule still reports its reason plus the true saved count.
      const reason = err instanceof Error ? err.message : String(err);
      showToast(`Import stopped after ${saved} of ${cards.length}: ${reason}`);
      return;
    }
    if (saved < cards.length) {
      showToast(`Storage full — imported ${saved} of ${cards.length} cards. Free space and re-import.`);
      return;
    }
    onImportedCards?.(cards);
    showToast(`Imported ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
  }

  function importDeck(text: string, filename: string) {
    let ids: string[];
    try {
      const parsed: unknown = JSON.parse(text);
      const deck = (parsed as { deck?: unknown })?.deck;
      if (!Array.isArray(deck) || deck.some((x) => typeof x !== 'string')) {
        throw new Error('expected { deck: string[] }');
      }
      ids = deck as string[];
    } catch (err) {
      const message = err instanceof Error && err.message !== 'expected { deck: string[] }'
        ? 'Invalid JSON'
        : 'expected { deck: string[] }';
      showToast(`Import failed: ${message}`);
      return;
    }
    // pool = curated buildPool() ∪ saved custom cards, deduped by id.
    const pool = new Map<string, Card>();
    for (const c of [...buildPool(), ...loadCustomCards()]) {
      if (!pool.has(c.id)) pool.set(c.id, c);
    }
    const issues = validateDeck(ids, pool).filter((i) => i.severity === 'error');
    if (issues.length > 0) {
      showToast(`Import failed: ${issues[0]?.message ?? 'invalid deck'}`);
      return;
    }
    onImportedDeck?.(ids, nameFromFilename(filename));
    showToast(`Imported a ${ids.length}-card deck.`);
  }

  const importLabel = mode === 'cards' ? 'Import cards' : 'Import deck';

  return (
    <div className="importexport">
      <div className="importexport-actions">
        <button type="button" className="importexport-btn" onClick={onExport}>
          Export JSON
        </button>
        <button type="button" className="importexport-btn" onClick={() => fileRef.current?.click()}>
          {importLabel}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={onFile}
        />
      </div>
      {toast && <div className="importexport-toast" role="status">{toast}</div>}
    </div>
  );
}
