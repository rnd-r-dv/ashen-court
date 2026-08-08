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
      <span className="deckcount-icon" aria-hidden="true">▤</span>
      <span className="deckcount-num">{remaining}</span>
    </div>
  );
}
