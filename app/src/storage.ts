import type { Card } from '@ashen/core';
import { buildPool, validateCard } from '@ashen/core';
import { poolRuleIssues, normalizeLegacyReflect } from './forge/formState.js';

// localStorage keys (shared with the app's other modules)
const KEY_CARDS = 'tcg.customCards';
const KEY_DECKS = 'tcg.decks';
const KEY_SETTINGS = 'tcg.settings';

/**
 * Custom-deck overlay namespace (audit 05 I4). Overlays are stored under
 * 'custom:<slug>' so a custom deck whose slug matches a curated archetype id
 * (e.g. 'ember') can never resolve to the curated deck in matchSetup.
 */
const CUSTOM_DECK_PREFIX = 'custom:';

/** Internal overlay key for a custom deck slug (namespaced, I4). */
export function deckKey(slug: string): string {
  return `${CUSTOM_DECK_PREFIX}${slug}`;
}

/** The clean slug behind a namespaced overlay key; null for non-namespaced keys. */
export function deckSlug(key: string): string | null {
  return key.startsWith(CUSTOM_DECK_PREFIX) ? key.slice(CUSTOM_DECK_PREFIX.length) : null;
}

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

/**
 * Persist a JSON value; returns false when localStorage rejects the write
 * (e.g. a QuotaExceededError from an oversized card image) so callers can
 * surface a 'storage full' message instead of dying silently (audit 05 I1).
 */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---- custom cards ----

/** Read + shape-check saved custom cards; wrong-shape storage falls back to [].
 * Task 1 bridge: legacy creatures saved before Reflect existed are normalized
 * to Reflect = Attack at read time, so stored cards validate and fight with
 * mirror-stat parity (schemaVersion-2 cards missing Reflect are NOT repaired). */
export function loadCustomCards(): Card[] {
  const raw = read<unknown>(KEY_CARDS, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Card => typeof c === 'object' && c !== null)
    .map(normalizeLegacyReflect);
}

/**
 * Upsert by card id. Throws when the id collides with a curated/token card id
 * or with an existing custom card of a different name — such a card would be
 * silently overwritten or saved-but-invisible, since every pool dedup favors
 * buildPool() first (audit 05 I2). Returns false when the write fails (I1).
 */
export function saveCustomCard(card: Card): boolean {
  const existing = loadCustomCards();
  if (buildPool().some((c) => c.id === card.id)) {
    throw new Error(`Cannot save "${card.name}": id ${card.id} is taken by a curated card. Rename it.`);
  }
  const clash = existing.find((c) => c.id === card.id && c.name !== card.name);
  if (clash) {
    throw new Error(`Cannot save "${card.name}": id ${card.id} is already used by "${clash.name}". Rename it.`);
  }
  const idx = existing.findIndex((c) => c.id === card.id);
  const next = [...existing];
  if (idx >= 0) next[idx] = card;
  else next.push(card);
  return write(KEY_CARDS, next);
}

/**
 * Delete a custom card. Throws when the card is referenced elsewhere: another
 * custom card's summon/copyCard effect resolves it (deleting it would crash
 * the engine mid-match — audit 05 C2), or a saved deck overlay contains it.
 *
 * Returns false when localStorage rejects the write, exactly like
 * saveCustomCard (I1/I9). A discarded return here is a silent no-op: the UI
 * would report "deleted" while the card survives the next reload.
 */
export function deleteCustomCard(id: string): boolean {
  const cards = loadCustomCards();
  const referencers: string[] = [];
  for (const c of cards) {
    if (c.id === id) continue;
    const allEffects = [...c.effects, ...(c.triggers ?? []).flatMap((t) => t.effects)];
    const references = allEffects.some(
      (e) => (e.kind === 'summon' || e.kind === 'copyCard') && e.cardId === id,
    );
    if (references) referencers.push(c.id);
  }
  for (const [deckId, cardIds] of Object.entries(loadDecks())) {
    if (cardIds.includes(id)) referencers.push(`deck:${deckId}`);
  }
  if (referencers.length > 0) {
    throw new Error(`Cannot delete ${id}: referenced by ${referencers.join(', ')}`);
  }
  return write(KEY_CARDS, cards.filter((c) => c.id !== id));
}

// ---- deck overlay (custom:<slug> → 60 card ids) ----

/**
 * Read + shape-check saved custom-deck overlays, keyed by their NAMESPACED
 * keys ('custom:<slug>', I4). Legacy raw-key overlays and wrong-shape entries
 * are dropped (M5).
 */
export function loadDecks(): Record<string, string[]> {
  const raw = read<unknown>(KEY_DECKS, {});
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(CUSTOM_DECK_PREFIX)) continue;
    if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) continue;
    out[key] = value;
  }
  return out;
}

/** No length validation at the storage layer — the deck builder enforces 60. */
export function saveDeck(slug: string, cardIds: string[]): boolean {
  const decks = loadDecks();
  decks[deckKey(slug)] = cardIds;
  return write(KEY_DECKS, decks);
}

/** Returns false when localStorage rejects the write, like saveDeck (I1/I9). */
export function deleteDeck(slug: string): boolean {
  const decks = loadDecks();
  delete decks[deckKey(slug)];
  return write(KEY_DECKS, decks);
}

// ---- settings ----

export interface Settings {
  fastMode: boolean;
}

export function loadSettings(): Settings {
  const parsed = read<unknown>(KEY_SETTINGS, {});
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { fastMode: false };
  return { fastMode: false, ...(parsed as Partial<Settings>) };
}

export function saveSettings(s: Settings): boolean {
  return write(KEY_SETTINGS, s);
}

// ---- JSON import/export ----

export function exportCardsJson(cards: Card[]): string {
  return JSON.stringify(cards, null, 2);
}

/**
 * Parse + validate. Throws on invalid JSON, the first error-severity issue,
 * or a token-archetype card. The pool-reference rule (C1) runs against
 * buildPool() ∪ existing custom cards so an import can never smuggle in a
 * summon/copyCard reference that would crash the engine at resolution.
 */
export function importCardsJson(text: string): Card[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!Array.isArray(parsed)) throw new Error('Invalid JSON: expected an array of cards');
  const fullPool = new Map<string, Card>();
  for (const c of [...buildPool(), ...loadCustomCards()]) {
    if (!fullPool.has(c.id)) fullPool.set(c.id, c);
  }
  const cards: Card[] = [];
  for (const raw of parsed) {
    // I5 runs BEFORE the bridge: null/primitive elements must reach the
    // 'malformed card data' path (see the try/catch below), not crash inside
    // normalization.
    // Task 1 bridge: legacy exports carry creatures with no `reflect`;
    // normalize to Reflect = Attack before validation so they import cleanly
    // (schemaVersion-2 cards missing Reflect stay broken and are rejected).
    const candidate = (
      raw !== null && typeof raw === 'object' ? normalizeLegacyReflect(raw as Card) : raw
    ) as Card;
    // I5: never touch .id on a null/primitive element — optional chaining keeps
    // the documented 'Invalid card <id>: …' contract for '[null]' payloads.
    const id = candidate?.id ?? '?';
    // M6: token-archetype cards are engine-internal; importing one would be
    // importable-but-unusable (hidden from the builder, rejected by decks).
    if (candidate?.archetype === 'token') {
      throw new Error(`Invalid card ${id}: Token archetype cards cannot be imported.`);
    }
    // validateCard + pool rule assume a full Card shape (keywords, effects,
    // …); a structurally-broken object would crash them with a raw TypeError.
    // Convert any crash into the standard per-card error message so the
    // import UI always shows a clean "Invalid card <id>" toast (Task 29).
    let firstError: { message: string } | undefined;
    try {
      firstError = validateCard(candidate).find((i) => i.severity === 'error');
      if (!firstError) {
        firstError = poolRuleIssues(candidate, fullPool).find((i) => i.severity === 'error');
      }
    } catch {
      firstError = { message: 'malformed card data' };
    }
    if (firstError) throw new Error(`Invalid card ${id}: ${firstError.message}`);
    // M6: imported cards are user-owned — a 'curated' author tag would imply
    // engine origin and break custom-card semantics downstream.
    candidate.author = 'custom';
    cards.push(candidate);
  }
  return cards;
}
