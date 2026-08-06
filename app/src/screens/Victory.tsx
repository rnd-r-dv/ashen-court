// Victory/defeat screen (Task 35). Pure props-driven component: the match
// flow (Task 30) hands it a MatchResult and callbacks. Renders a winner
// banner, a per-side stats grid from result.stats, and Rematch / Change Deck
// / Main Menu actions.
//
// LAN rematch: the wire handshake (send 'rematch', wait for both) lands with
// the LAN client in Task 34. Here the Rematch button simply fires onRematch —
// the caller is expected to send the rematch message over the wire — then
// shows a "Waiting for opponent…" state until the parent navigates away.
// TODO(Task 34): LAN rematch handshake — onRematch should post the rematch
// message; this screen just signals intent.
import { useState } from 'react';
import type { PlayerIndex } from '@ashen/core';
import type { MatchResult } from '../types.js';
import './victory.css';

export interface VictoryProps {
  result: MatchResult;
  /** Local player index → banner reads Victory/Defeat. Omit for hotseat (banner shows the winner name). */
  myPlayer?: PlayerIndex;
  /** LAN match: rematch enters a waiting state after onRematch fires. */
  lan?: boolean;
  onRematch: () => void;
  onChangeDeck: () => void;
  onMenu: () => void;
}

type Tone = 'win' | 'lose' | 'draw';

function banner(result: MatchResult, myPlayer?: PlayerIndex): { title: string; tone: Tone } {
  if (result.winner === 'draw') return { title: 'Draw', tone: 'draw' };
  if (myPlayer === undefined) return { title: `Player ${result.winner + 1} wins`, tone: 'win' };
  return result.winner === myPlayer
    ? { title: 'Victory', tone: 'win' }
    : { title: 'Defeat', tone: 'lose' };
}

export default function Victory({ result, myPlayer, lan, onRematch, onChangeDeck, onMenu }: VictoryProps) {
  const [waiting, setWaiting] = useState(false);
  const { title, tone } = banner(result, myPlayer);
  const { stats } = result;

  function handleRematch() {
    setWaiting(true);
    onRematch();
  }

  const rematchLabel = lan && waiting ? 'Waiting for opponent…' : 'Rematch';

  return (
    <div className="shell victory">
      <h1 className={`victory-banner victory-banner--${tone}`}>{title}</h1>
      <p className="shell-subtitle">
        {result.winner === 'draw'
          ? 'Both heroes fell. The court grants neither victory.'
          : result.winner === myPlayer
            ? 'The court is yours.'
            : myPlayer === undefined
              ? `Player ${result.winner + 1} takes the match.`
              : 'The court slips from your grasp.'}
      </p>

      <div className="victory-stats" role="table" aria-label="Match statistics">
        <div className="victory-stats-row victory-stats-head" role="row">
          <span className="victory-stats-corner" role="columnheader" />
          <span className="victory-stats-player" role="columnheader">Player 1</span>
          <span className="victory-stats-player" role="columnheader">Player 2</span>
        </div>
        <div className="victory-stats-row" role="row">
          <span className="victory-stats-label" role="rowheader">Damage taken</span>
          <span className="victory-stats-value" role="cell">{stats.damageDealt[0]}</span>
          <span className="victory-stats-value" role="cell">{stats.damageDealt[1]}</span>
        </div>
        <div className="victory-stats-row" role="row">
          <span className="victory-stats-label" role="rowheader">Cards played</span>
          <span className="victory-stats-value" role="cell">{stats.cardsPlayed[0]}</span>
          <span className="victory-stats-value" role="cell">{stats.cardsPlayed[1]}</span>
        </div>
        <div className="victory-stats-row" role="row">
          <span className="victory-stats-label" role="rowheader">Turns</span>
          <span className="victory-stats-value victory-stats-turns" role="cell">{stats.turns}</span>
          <span className="victory-stats-empty" role="cell" />
        </div>
      </div>

      <nav className="victory-actions">
        <button
          type="button"
          className="shell-btn shell-btn-primary"
          onClick={handleRematch}
          disabled={waiting}
        >
          {rematchLabel}
        </button>
        <button type="button" className="shell-btn" onClick={onChangeDeck}>
          Change Deck
        </button>
        <button type="button" className="shell-btn" onClick={onMenu}>
          Main Menu
        </button>
      </nav>
    </div>
  );
}
