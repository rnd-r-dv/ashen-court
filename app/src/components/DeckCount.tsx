import './deckcount.css';

/**
 * Cards remaining in a player's deck. Neither player could previously see
 * this, so fatigue and card advantage were invisible — you could not tell how
 * close either side was to decking out.
 *
 * Deck only: PlayerState has no discard or graveyard (core/src/types.ts), and
 * adding one is an engine change, which this work explicitly does not make.
 */
export interface DeckCountProps {
  /** Cards left in this player's deck. */
  remaining: number;
  /** Whose deck this is — labels the readout for screen readers. */
  label: string;
}

/** Below this the player is close enough to fatigue that it should be loud. */
const LOW_WATER = 5;

export default function DeckCount({ remaining, label }: DeckCountProps) {
  const low = remaining <= LOW_WATER;
  return (
    <div
      className={`deckcount${low ? ' deckcount--low' : ''}`}
      aria-label={`${label}: ${remaining} cards left in deck`}
      title={`${remaining} cards left in deck`}
    >
      {/* Drawn deck glyph (Task 6): a flat two-card stack — the Armorial
          world draws its icons; no Unicode stand-ins. */}
      <svg className="deckcount-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <rect x="2" y="1.5" width="8" height="6" rx="0.5" fill="none" />
        <rect x="1.5" y="4.5" width="9" height="6" rx="0.5" fill="none" />
      </svg>
      <span className="deckcount-num">{remaining}</span>
    </div>
  );
}
