// Deck pick screen (Task 28). Grid of the 12 curated decks (from @ashen/core
// DECK_DEFS + HEROES: name, hero, archetype tag, copy badge), plus a
// custom-decks section from loadDecks() (storage overlay map keyed by slug)
// and an empty state showing the saved custom-card count.
//
// Bot mode: one selection. Hotseat: two sequential selections (Player 1 then
// Player 2). Final selection reports through onComplete — App stores it as the
// pending match and routes to the Task 30 match placeholder.
import { useMemo, useState } from 'react';
import { useNav } from '../App.js';
import type { BotLevel, Mode } from '../types.js';
import { loadCustomCards } from '../storage.js';
// Audit 07 bug 18: the deck-source builders live in ONE module. DeckPick used
// to carry a near-verbatim copy of CURATED_INFO/buildCurated/buildCustom and
// the two copies had already drifted (the LAN one rendered raw 'custom:<slug>'
// keys). The module keeps its lanDecks name — LanHost/LanJoin/LanDeckGrid
// import it and those files are not part of this fix.
import { buildCurated, buildCustom } from '../game/lanDecks.js';
import type { DeckCard } from '../game/lanDecks.js';
import './shell.css';

/** What a deck-pick flow reports back to App. */
export interface DeckPickResult {
  mode: Mode;
  difficulty?: BotLevel;
  decks: { slug: string; name: string }[]; // pick order: player 0 first
}

export default function DeckPick({
  mode,
  difficulty,
  onComplete,
}: {
  mode: Mode;
  difficulty?: BotLevel;
  onComplete: (pick: DeckPickResult) => void;
}) {
  const { navigate } = useNav();
  const [picked, setPicked] = useState<DeckCard | null>(null); // bot single pick
  const [picks, setPicks] = useState<DeckCard[]>([]); // hotseat: player 0 then player 1

  const curated = useMemo(buildCurated, []);
  const custom = useMemo(buildCustom, []);

  const hotseat = mode === 'hotseat';
  const nextPlayer = picks.length; // 0 → "Player 1", 1 → "Player 2"

  function select(deck: DeckCard) {
    if (hotseat) {
      const next = [...picks, deck];
      setPicks(next);
      if (next.length >= 2) {
        onComplete({
          mode,
          decks: next.map((d) => ({ slug: d.slug, name: d.name })),
        });
      }
    } else {
      setPicked(deck);
      onComplete({
        mode,
        difficulty,
        decks: [{ slug: deck.slug, name: deck.name }],
      });
    }
  }

  function heading(): string {
    if (hotseat) {
      return `Choose deck for Player ${nextPlayer + 1}`;
    }
    return difficulty ? `Choose your deck — ${difficulty}` : 'Choose your deck';
  }

  function renderDeckCard(deck: DeckCard) {
    // Audit 07 bug 17: the highlight means "this deck is one of the picks
    // already locked in". It used to index `picks` (at most 2 entries) by the
    // deck's GRID position, so a deck chosen anywhere past grid position 1
    // checked an always-undefined slot and never lit up. Match by content
    // instead; the `.custom` comparison keeps the curated and custom grids
    // from cross-highlighting each other.
    const selected = hotseat
      ? picks.some((p) => p.slug === deck.slug && p.custom === deck.custom)
      : picked?.slug === deck.slug && picked?.custom === deck.custom;
    return (
      <button
        type="button"
        key={`${deck.custom ? 'custom' : 'curated'}-${deck.slug}`}
        className={`shell-card deck-card${selected ? ' selected' : ''}`}
        onClick={() => select(deck)}
      >
        <span className="deck-card-name">{deck.name}</span>
        {deck.hero ? <span className="deck-card-hero">{deck.hero}</span> : null}
        <span className="deck-card-tag">{deck.tag}</span>
        <span className="deck-card-badge">{deck.cards} cards</span>
      </button>
    );
  }

  return (
    <div className="shell">
      <h1 className="shell-title">{heading()}</h1>

      {hotseat && picks.length > 0 && (
        <p className="shell-subtitle">
          {picks.length === 1 ? (
            <>
              Player 1 locked in: <strong>{picks[0]?.name}</strong>
            </>
          ) : (
            <>
              Player 1: <strong>{picks[0]?.name}</strong> · Player 2: <strong>{picks[1]?.name}</strong>
            </>
          )}
        </p>
      )}

      <section className="shell-section">
        <h2 className="shell-section-title">Curated decks</h2>
        <div className="shell-grid">{curated.map((d) => renderDeckCard(d))}</div>
      </section>

      <section className="shell-section">
        <h2 className="shell-section-title">Custom decks</h2>
        {custom.length === 0 ? (
          <p className="shell-empty">
            No custom decks yet — save one in the Deck Builder. You have{' '}
            <strong>{loadCustomCards().length}</strong> custom card
            {loadCustomCards().length === 1 ? '' : 's'} in the Forge.
          </p>
        ) : (
          <div className="shell-grid">{custom.map((d) => renderDeckCard(d))}</div>
        )}
      </section>

      <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
        Back
      </button>
      {hotseat && picks.length === 1 && (
        <button type="button" className="shell-btn" onClick={() => setPicks([])}>
          Redo Player 1's pick
        </button>
      )}
    </div>
  );
}
