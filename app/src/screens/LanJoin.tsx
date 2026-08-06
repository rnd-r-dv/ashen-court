// LAN join screen (Task 34 + fix round 2). Enter a 4-letter room code
// (auto-uppercased) → joinRoom → wait for the host → 'joined' feeds the room
// params (seed, deckIds, full card registry) into useLanMatch → gameStart →
// register the LAN session with App (onSessionReady) → Match.
//
// Fix round 2: the screen's own message handler is removed on unmount, the
// client remembers the room code for reconnect re-attach, and onStatus
// surfaces a closed connection as an error.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNav } from '../App.js';
import type { LanSession } from '../App.js';
import { connectLan } from '../game/lanClient.js';
import type { LanClient, LanStatus } from '../game/lanClient.js';
import { heroNameForDeck } from '../game/lanDriver.js';
import { useLanMatch } from '../game/useLanMatch.js';
import type { LanRoomParams } from '../game/useLanMatch.js';
import type { PlayerIndex } from '@ashen/core';
import type { ServerMessage } from '@ashen/server/protocol';
import './shell.css';
import './lan.css';

export default function LanJoin({ onSessionReady }: { onSessionReady: (s: LanSession) => void }) {
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

  // Stable references for handler cleanup (the screen unmounts at match entry;
  // the session client must not keep this screen's pre-match handler alive).
  const clientRef = useRef<LanClient | null>(null);
  clientRef.current = client;

  const handleMessage = useCallback((m: ServerMessage) => {
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
        break; // roomCreated / opponentJoined / events / intent / rematchStart — not ours
    }
  }, []);

  // I1: a closed connection (grace window expired / intentional close) is
  // surfaced as an error the joining screen can show.
  const onStatus = useCallback((s: LanStatus) => {
    if (s === 'closed') setError('Connection closed — rejoin by code to continue.');
  }, []);

  // 'joined' + 'gameStart' arrive in one burst; navigate once the shadow
  // driver exists (useLanMatch builds it from the 'joined' params).
  useEffect(() => {
    if (started && driver && myPlayer !== null && client && room) {
      onSessionReady({ mode: 'lanJoin', client, room, myPlayer, driver });
      navigate({ name: 'match', setup: { driver, myPlayer, mode: 'lan' } });
    }
  }, [started, driver, myPlayer, client, room, onSessionReady, navigate]);

  // Unmount cleanup: drop this screen's pre-match handler from the client.
  useEffect(() => () => clientRef.current?.removeMessageHandler(handleMessage), [handleMessage]);

  function join() {
    const trimmed = code.trim();
    if (trimmed.length !== 4) {
      setError('Enter the 4-letter room code');
      return;
    }
    setError(null);
    setSubmittedCode(trimmed);
    setJoining(true);
    const c = connectLan(handleMessage, onStatus);
    c.setRoomCode(trimmed); // reconnect re-attach (fix round 2)
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
