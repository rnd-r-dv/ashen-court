import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Card } from '@ashen/core';
import { buildPool, validateDeck } from '@ashen/core';
import { exportCardsJson, importCardsJson, loadCustomCards, saveCustomCard } from '../storage.js';
import './importexport.css';

/**
 * JSON import/export toolbar (Task 29). Reusable across screens:
 *
 *  - mode="cards": export all saved custom cards as 'ashen-custom-cards.json'
 *    (pretty JSON via exportCardsJson); import parses + validates via
 *    importCardsJson, saves each card to storage, then reports the count.
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
  URL.revokeObjectURL(url);
}

/** 'ashen-deck.json' → 'ashen-deck' (basename without .json). */
function nameFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '').replace(/\.[^/.]+$/, '');
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
      if (ids.length === 0) {
        showToast('Nothing to export — the deck is empty.');
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
    for (const card of cards) saveCustomCard(card);
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
