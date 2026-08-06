// LAN join screen (Task 34). Enter a 4-letter room code (auto-uppercased) →
// joinRoom → wait for the host → 'joined' feeds the room params (seed,
// deckIds, full card registry) into useLanMatch → gameStart → Match.
import { useEffect, useState } from 'react';
import { useNav } from '../App.js';
import { connectLan } from '../game/lanClient.js';
import type { LanClient } from '../game/lanClient.js';
import { heroNameForDeck } from '../game/lanDriver.js';
import { useLanMatch } from '../game/useLanMatch.js';
import type { LanRoomParams } from '../game/useLanMatch.js';
import type { PlayerIndex } from '@ashen/core';
import type { ServerMessage } from '@ashen/server/protocol';
import './shell.css';
import './lan.css';

export default function LanJoin() {
  const { navigate } = useNav();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [client, setClient] = useState<LanClient | null>(null);
  const [room, setRoom] = useState<LanRoomParams | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerIndex | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState('');

  const { driver } = useLanMatch({ client, room, myPlayer });

  // 'joined' + 'gameStart' arrive in one burst; navigate once the shadow
  // driver exists (useLanMatch builds it from the 'joined' params).
  useEffect(() => {
    if (started && driver && myPlayer !== null) {
      navigate({ name: 'match', setup: { driver, myPlayer } });
    }
  }, [started, driver, myPlayer, navigate]);

  function handleMessage(m: ServerMessage) {
    switch (m.type) {
      case 'joined':
        setRoom({
          deckIds: m.deckIds,
          customCards: m.cards, // full merged registry (pool + host customs)
          heroId: heroNameForDeck(m.deckIds),
          seed: m.seed,
        });
        setMyPlayer(m.player);
        setOpponent(m.opponentName);
        break;
      case 'gameStart':
        setStarted(true);
        break;
      case 'error':
        setError(m.message);
        setJoining(false);
        break;
      case 'playerLeft':
        setError(m.reason);
        break;
      default:
        break; // roomCreated / opponentJoined / events / rematchStart — not ours
    }
  }

  function join() {
    const trimmed = code.trim();
    if (trimmed.length !== 4) {
      setError('Enter the 4-letter room code');
      return;
    }
    setError(null);
    setSubmittedCode(trimmed);
    setJoining(true);
    const c = connectLan(handleMessage);
    setClient(c);
    c.send({ type: 'joinRoom', code: trimmed });
  }

  function leave() {
    client?.close();
    navigate({ name: 'menu' });
  }

  return (
    <div className="shell">
      <h1 className="shell-title">LAN Join</h1>
      {!joining ? (
        <>
          <p className="shell-subtitle">Enter the host's room code to join.</p>
          <label className="lan-label" htmlFor="lan-code-input">
            Room code
          </label>
          <input
            id="lan-code-input"
            className="lan-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
            placeholder="ABCD"
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="lan-row">
            <button type="button" className="shell-btn shell-btn-primary" onClick={join} disabled={code.length !== 4}>
              Join room
            </button>
          </div>
          {error ? <p className="lan-error">{error}</p> : null}
          <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
            Back
          </button>
        </>
      ) : (
        <>
          <p className="shell-subtitle">
            Joining room <strong>{submittedCode}</strong>…
          </p>
          <div className="lan-waiting">
            <span className="lan-spinner" aria-hidden="true" />
            {opponent ? (
              <p className="lan-note">
                Playing against <strong>{opponent}</strong> — starting…
              </p>
            ) : (
              <p className="lan-note">Waiting for the game to start…</p>
            )}
          </div>
          {error ? <p className="lan-error">{error}</p> : null}
          <button type="button" className="shell-btn" onClick={leave}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
