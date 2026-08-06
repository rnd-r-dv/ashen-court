import type { Card } from '@ashen/core';
import { validateCard } from '@ashen/core';

// localStorage keys (shared with the app's other modules)
const KEY_CARDS = 'tcg.customCards';
const KEY_DECKS = 'tcg.decks';
const KEY_SETTINGS = 'tcg.settings';

/** Read + parse a JSON value; corrupt JSON or missing key → fallback. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- custom cards ----

export function loadCustomCards(): Card[] {
  return read<Card[]>(KEY_CARDS, []);
}

/** Upsert by card id. */
export function saveCustomCard(card: Card): void {
  const cards = loadCustomCards();
  const idx = cards.findIndex((c) => c.id === card.id);
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  write(KEY_CARDS, cards);
}

export function deleteCustomCard(id: string): void {
  write(KEY_CARDS, loadCustomCards().filter((c) => c.id !== id));
}

// ---- deck overlay (deck id → 60 card ids) ----

export function loadDecks(): Record<string, string[]> {
  return read<Record<string, string[]>>(KEY_DECKS, {});
}

/** No length validation at the storage layer — the deck builder enforces 60. */
export function saveDeck(id: string, cardIds: string[]): void {
  const decks = loadDecks();
  decks[id] = cardIds;
  write(KEY_DECKS, decks);
}

export function deleteDeck(id: string): void {
  const decks = loadDecks();
  delete decks[id];
  write(KEY_DECKS, decks);
}

// ---- settings ----

export interface Settings {
  fastMode: boolean;
}

export function loadSettings(): Settings {
  return { fastMode: false, ...read<Partial<Settings>>(KEY_SETTINGS, {}) };
}

export function saveSettings(s: Settings): void {
  write(KEY_SETTINGS, s);
}

// ---- JSON import/export ----

export function exportCardsJson(cards: Card[]): string {
  return JSON.stringify(cards, null, 2);
}

/** Parse + validate. Throws on invalid JSON or the first error-severity issue. */
export function importCardsJson(text: string): Card[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!Array.isArray(parsed)) throw new Error('Invalid JSON: expected an array of cards');
  const cards: Card[] = [];
  for (const raw of parsed) {
    const candidate = raw as Card;
    const firstError = validateCard(candidate).find((i) => i.severity === 'error');
    if (firstError) throw new Error(`Invalid card ${candidate.id ?? '?'}: ${firstError.message}`);
    cards.push(candidate);
  }
  return cards;
}
