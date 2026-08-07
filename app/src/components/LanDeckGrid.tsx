// Shared LAN deck-pick grid (Task 45). Presentational component rendering the
// two deck sections (Curated decks grid + Custom decks grid — the same
// shell-grid/deck-card markup LanHost used inline before Task 45) and handing
// the picked deck to the parent via onPick. Both LanHost (host picks before
// createRoom) and LanJoin (guest picks before joinRoom) render it. CSS comes
// from the parent screens' shell.css/lan.css imports.
import { useMemo } from 'react';
import type { DeckCard } from '../game/lanDecks.js';
import { buildCurated, buildCustom } from '../game/lanDecks.js';

export default function LanDeckGrid({ onPick }: { onPick: (deck: DeckCard) => void }) {
  const curated = useMemo(buildCurated, []);
  const custom = useMemo(buildCustom, []);
  return (
    <>
      <section className="shell-section">
        <h2 className="shell-section-title">Curated decks</h2>
        <div className="shell-grid">
          {curated.map((deck) => (
            <button type="button" key={`curated-${deck.slug}`} className="shell-card deck-card" onClick={() => onPick(deck)}>
              <span className="deck-card-name">{deck.name}</span>
              {deck.hero ? <span className="deck-card-hero">{deck.hero}</span> : null}
              <span className="deck-card-tag">{deck.tag}</span>
              <span className="deck-card-badge">{deck.cards} cards</span>
            </button>
          ))}
        </div>
      </section>
      <section className="shell-section">
        <h2 className="shell-section-title">Custom decks</h2>
        {custom.length === 0 ? (
          <p className="shell-empty">No custom decks yet — save one in the Deck Builder.</p>
        ) : (
          <div className="shell-grid">
            {custom.map((deck) => (
              <button type="button" key={`custom-${deck.slug}`} className="shell-card deck-card" onClick={() => onPick(deck)}>
                <span className="deck-card-name">{deck.name}</span>
                <span className="deck-card-tag">{deck.tag}</span>
                <span className="deck-card-badge">{deck.cards} cards</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
