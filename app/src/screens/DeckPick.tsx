// Deck pick screen (Task 28). Grid of the 12 curated decks (from @ashen/core
// DECK_DEFS + HEROES: name, hero, archetype tag, copy badge), plus a
// custom-decks section from loadDecks() (storage overlay map keyed by slug)
// and an empty state showing the saved custom-card count.
//
// Bot mode: one selection. Hotseat: two sequential selections (Player 1 then
// Player 2). Final selection reports through onComplete — App stores it as the
// pending match and routes to the Task 30 match placeholder.
import { useMemo, useState } from 'react';
import { DECK_DEFS, HEROES, expandDeck } from '@ashen/core';
import type { ArchetypeId } from '@ashen/core';
import { useNav } from '../App.js';
import type { BotLevel, Mode } from '../types.js';
import { loadCustomCards, loadDecks } from '../storage.js';
import './shell.css';

/** What a deck-pick flow reports back to App. */
export interface DeckPickResult {
  mode: Mode;
  difficulty?: BotLevel;
  decks: { slug: string; name: string }[]; // pick order: player 0 first
}

interface DeckCard {
  slug: string;
  name: string;
  hero?: string;
  tag: string;
  cards: number;
  custom: boolean;
}

/** Display names + archetype tags for the 12 curated decks (spec table). */
const CURATED_INFO: Record<ArchetypeId, { name: string; tag: string }> = {
  ember: { name: 'The Ember Court', tag: 'Burn / Aggro' },
  choir: { name: 'The Hollow Choir', tag: 'Control' },
  vermin: { name: 'The Vermin Swarm', tag: 'Zoo' },
  dragon: { name: 'The Dragonflight', tag: 'Midrange tribal' },
  roots: { name: 'The Elder Roots', tag: 'Ramp' },
  dance: { name: 'The Shadow Dancers', tag: 'Combo' },
  bone: { name: 'The Bone Horde', tag: 'Token swarm' },
  pact: { name: 'The Grave Pact', tag: 'Self-damage / life-swap' },
  coven: { name: 'The Night Coven', tag: 'Debuff control' },
  star: { name: 'The Starforged', tag: 'Big-mana cheat' },
  vigil: { name: 'The Eternal Vigil', tag: 'Sustain grind' },
  storm: { name: 'The Stormwrought', tag: 'Tempo spells' },
};

function buildCurated(): DeckCard[] {
  // DECK_DEFS and HEROES share archetype order, so the zip is positional.
  return (Object.keys(DECK_DEFS) as ArchetypeId[]).map((slug, i) => {
    const hero = HEROES[i];
    return {
      slug,
      name: CURATED_INFO[slug].name,
      hero: hero ? hero.name : 'Unknown hero',
      tag: CURATED_INFO[slug].tag,
      cards: expandDeck(DECK_DEFS[slug]).length,
      custom: false,
    };
  });
}

function buildCustom(): DeckCard[] {
  const overlays = loadDecks(); // slug → card ids (deck builder overlays)
  return Object.entries(overlays).map(([slug, cardIds]) => {
    const curated = slug in CURATED_INFO ? CURATED_INFO[slug as ArchetypeId] : undefined;
    return {
      slug,
      name: curated ? curated.name : slug,
      tag: 'Custom deck',
      cards: cardIds.length,
      custom: true,
    };
  });
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

  function renderDeckCard(deck: DeckCard, index: number) {
    const selected = hotseat
      ? picks[index]?.slug === deck.slug && picks[index]?.custom === deck.custom
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
        <div className="shell-grid">{curated.map(renderDeckCard)}</div>
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
          <div className="shell-grid">{custom.map((d, i) => renderDeckCard(d, i))}</div>
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
