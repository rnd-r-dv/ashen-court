import { useMemo, useRef, useState } from 'react';
import type { Card as CardSpec, CardType } from '@ashen/core';
import { buildPool, DECK_DEFS } from '@ashen/core';
import { loadCustomCards, saveDeck, deleteDeck } from '../storage.js';
import { addCard, deckStatus, filterPool, removeCard } from '../deckBuild.js';
import Card from '../components/Card.js';
import ImportExport from '../components/ImportExport.js';
import './forge.css';          // .card-preview styling for the Card stub (Task 25)
import './deckbuilder.css';

/**
 * Deck builder screen (Task 27). Left: the full card pool (curated +
 * custom, deduped, tokens hidden) with search/archetype/type/cost filters —
 * click a card to add a copy. Right: the working deck list with per-card
 * copy counts and remove buttons. Status banner shows count/60 plus
 * validation issues; save is gated on exactly 60 cards with zero errors.
 */

const TYPES: (CardType | '')[] = ['', 'creature', 'spell', 'artifact'];
const ARCHETYPES: string[] = ['', ...Object.keys(DECK_DEFS)];

const RARITY_COLOR: Record<CardSpec['rarity'], string> = {
  common: '#8f93a5',
  rare: '#3f8ef7',
  epic: '#a96ef7',
  legendary: '#f7b23f',
};

/** Lowercase; runs of non-alphanumerics → '-'; dashes trimmed at both ends. Empty → ''. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function DeckBuilder() {
  const [deck, setDeck] = useState<string[]>([]);
  const [deckName, setDeckName] = useState('');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const [search, setSearch] = useState('');
  const [archetype, setArchetype] = useState('');
  const [type, setType] = useState<CardType | ''>('');
  const [costMin, setCostMin] = useState('0');
  const [costMax, setCostMax] = useState('15');

  // Pool = curated buildPool() ∪ saved custom cards, deduped by id. Tokens
  // stay in the pool map (so addCard/deckStatus see them) but are hidden
  // from the builder grid — validateDeck rejects them if added.
  const poolMap: Map<string, CardSpec> = useMemo(() => {
    const map = new Map<string, CardSpec>();
    for (const c of [...buildPool(), ...loadCustomCards()]) {
      if (!map.has(c.id)) map.set(c.id, c);
    }
    return map;
  }, []);

  const pool = useMemo(() => [...poolMap.values()], [poolMap]);

  const min = costMin === '' ? 0 : Math.max(0, Number(costMin) || 0);
  const max = costMax === '' ? 15 : Math.min(15, Number(costMax) || 15);
  const cost: [number, number] = [min, max];

  const visible = useMemo(
    () => filterPool(pool, { search, archetype, type, cost }).filter((c) => c.archetype !== 'token'),
    [pool, search, archetype, type, cost],
  );

  const status = useMemo(() => deckStatus(deck, poolMap), [deck, poolMap]);
  const errors = status.issues.filter((i) => i.severity === 'error');
  const warnings = status.issues.filter((i) => i.severity === 'warning');

  const slug = slugify(deckName);
  const canSave = status.count === 60 && errors.length === 0 && slug !== '';

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of deck) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [deck]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  function onAdd(id: string) {
    const result = addCard(deck, id, poolMap);
    if (result.error) {
      showToast(result.error);
      return;
    }
    setDeck(result.list);
  }

  function onRemove(id: string) {
    setDeck(removeCard(deck, id));
  }

  function onSave() {
    if (!canSave) return;
    saveDeck(slug, deck);
    setActiveDeckId(slug);
    showToast(`Saved deck "${deckName.trim()}" (${deck.length} cards)`);
    // keep building — the working list stays as-is
  }

  function onDelete() {
    if (!activeDeckId) return;
    if (!window.confirm(`Delete deck "${activeDeckId}"? This cannot be undone.`)) return;
    deleteDeck(activeDeckId);
    setActiveDeckId(null);
    setDeck([]);
    setDeckName('');
    showToast(`Deleted deck "${activeDeckId}"`);
  }

  /** ImportExport deck mode: load a validated imported deck into the builder. */
  function onImportedDeck(ids: string[], name: string) {
    setDeck(ids);
    setDeckName(name);
    setActiveDeckId(null);   // a fresh import is not the saved overlay
  }

  return (
    <div className="deckbuilder">
      <header className="deckbuilder-header">
        <h1>Deck Builder</h1>
        <p className="deckbuilder-subtitle">Assemble a 60-card deck from the curated pool and your custom cards.</p>
        <ImportExport mode="deck" deckIds={deck} onImportedDeck={onImportedDeck} />
      </header>

      <div className="deckbuilder-layout">
        {/* left: pool grid */}
        <section className="deckbuilder-pool">
          <div className="deckbuilder-filters">
            <input
              className="deckbuilder-input"
              type="search"
              placeholder="Search cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cards"
            />
            <select
              className="deckbuilder-input"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              aria-label="Archetype filter"
            >
              <option value="">All archetypes</option>
              {ARCHETYPES.slice(1).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              className="deckbuilder-input"
              value={type}
              onChange={(e) => setType(e.target.value as CardType | '')}
              aria-label="Type filter"
            >
              {TYPES.map((t) => (
                <option key={t || 'all'} value={t}>{t === '' ? 'All types' : t}</option>
              ))}
            </select>
            <label className="deckbuilder-cost">
              <span>Cost</span>
              <input
                className="deckbuilder-input"
                type="number"
                min={0}
                max={15}
                value={costMin}
                onChange={(e) => setCostMin(e.target.value)}
                aria-label="Minimum cost"
              />
              <span>–</span>
              <input
                className="deckbuilder-input"
                type="number"
                min={0}
                max={15}
                value={costMax}
                onChange={(e) => setCostMax(e.target.value)}
                aria-label="Maximum cost"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="deckbuilder-empty">No cards match the current filters.</p>
          ) : (
            <div className="deckbuilder-grid">
              {visible.map((c) => (
                <button
                  key={c.id}
                  className="deckbuilder-grid-item"
                  onClick={() => onAdd(c.id)}
                  title={`Add ${c.name} (${c.cost})`}
                >
                  <Card card={c} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* right: working deck */}
        <aside className="deckbuilder-side">
          <section className="deckbuilder-section">
            <h2 className="deckbuilder-side-title">Deck ({status.count}/60)</h2>
            <div className="deckbuilder-rows">
              {deck.length === 0 && (
                <p className="deckbuilder-empty">Click cards on the left to add copies.</p>
              )}
              {deck.map((id, i) => {
                const card = poolMap.get(id);
                const n = counts.get(id) ?? 0;
                return (
                  <div className="deckbuilder-row" key={`${id}-${i}`}>
                    <span className="deckbuilder-row-name">{card?.name ?? id}</span>
                    <span
                      className="deckbuilder-row-count"
                      style={{ color: card ? RARITY_COLOR[card.rarity] : undefined }}
                    >
                      ×{n}
                    </span>
                    <button
                      className="deckbuilder-row-remove"
                      onClick={() => onRemove(id)}
                      aria-label={`Remove ${card?.name ?? id}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`deckbuilder-status${status.count === 60 && errors.length === 0 ? ' ok' : ''}`}>
            <span className="deckbuilder-status-count">
              {status.count}/60 cards
              {status.count === 60 && errors.length === 0 && ' — ready'}
            </span>
            {warnings.map((i, n) => (
              <p className="deckbuilder-issue deckbuilder-issue-warning" key={`w${n}`}>{i.message}</p>
            ))}
            {errors.map((i, n) => (
              <p className="deckbuilder-issue deckbuilder-issue-error" key={`e${n}`}>{i.message}</p>
            ))}
          </section>

          <section className="deckbuilder-section">
            <label className="deckbuilder-label" htmlFor="deck-name">Deck name</label>
            <input
              id="deck-name"
              className="deckbuilder-input"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g. Ember Court"
              aria-label="Deck name"
            />
            <div className="deckbuilder-actions">
              <button className="deckbuilder-save-btn" onClick={onSave} disabled={!canSave}>
                {slug === ''
                  ? 'Name your deck'
                  : canSave
                    ? 'Save deck'
                    : `Save blocked (${status.count !== 60 ? `${status.count}/60` : `${errors.length} issue${errors.length === 1 ? '' : 's'}`})`}
              </button>
              <button className="deckbuilder-delete-btn" onClick={onDelete} disabled={activeDeckId === null}>
                Delete deck
              </button>
            </div>
          </section>
        </aside>
      </div>

      {toast && <div className="deckbuilder-toast">{toast}</div>}
    </div>
  );
}
