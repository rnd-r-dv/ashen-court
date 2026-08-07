// LAN join screen (Task 34 + fix round 2 + Task 45). Enter a 4-letter room
// code (auto-uppercased) → PICK YOUR OWN DECK (Task 45: same curated + custom
// sources as the host, via the shared LanDeckGrid) → joinRoom carrying the
// deck choice → wait for the host → 'joined' feeds the room params (seed,
// both decks, hero names, full card registry) into useLanMatch → gameStart →
// register the LAN session with App (onSessionReady) → Match.
//
// Fix round 2: the screen's own message handler is removed on unmount, the
// client remembers the room code for reconnect re-attach, and onStatus
// surfaces a closed connection as an error. Task 45: the remembered payload
// is the FULL joinRoom message (setJoinPayload), and the room params' heroes
// come from the wire (not derived locally).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardRegistry, DECK_DEFS, buildPool, expandDeck, validateDeck } from '@ashen/core';
import type { PlayerIndex } from '@ashen/core';
import { useNav } from '../App.js';
import type { LanSession } from '../App.js';
import LanDeckGrid from '../components/LanDeckGrid.js';
import { connectLan } from '../game/lanClient.js';
import type { LanClient, LanStatus } from '../game/lanClient.js';
import { heroNameForDeck } from '../game/lanDriver.js';
import type { DeckCard } from '../game/lanDecks.js';
import { useLanMatch } from '../game/useLanMatch.js';
import type { LanRoomParams } from '../game/useLanMatch.js';
import type { ServerMessage } from '@ashen/server/protocol';
import { loadCustomCards, loadDecks } from '../storage.js';
import './shell.css';
import './lan.css';

type Stage = 'code' | 'deck' | 'joining';

export default function LanJoin({ onSessionReady }: { onSessionReady: (s: LanSession) => void }) {
  const { navigate } = useNav();
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('code');
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
        // The server resolved the setup: both decks, hero NAMES, seed and the
        // merged registry (Task 45 — no more local hero derivation).
        setRoom({
          decks: m.decks,
          heroes: m.heroes,
          customCards: m.cards,
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
        setStage('code'); // back to the code entry so a corrected retry works
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
      // I2 (audit 06): the session's seat is LIVE — the getter reads the
      // driver's wire seat (myPlayer here is only the initial join seat), so
      // a mid-game reconnect seat remap reaches Victory/rematch bookkeeping.
      onSessionReady({ mode: 'lanJoin', client, room, driver, get myPlayer() { return driver.seat ?? myPlayer; } });
      navigate({ name: 'match', setup: { driver, myPlayer, mode: 'lan' } });
    }
  }, [started, driver, myPlayer, client, room, onSessionReady, navigate]);

  // Unmount cleanup: drop this screen's pre-match handler from the client.
  useEffect(() => () => clientRef.current?.removeMessageHandler(handleMessage), [handleMessage]);

  /** Code entry → deck pick: a valid 4-letter code moves to the deck stage. */
  function next() {
    const trimmed = code.trim();
    if (trimmed.length !== 4) {
      setError('Enter the 4-letter room code');
      return;
    }
    setError(null);
    setStage('deck');
  }

  /** Deck pick → joinRoom: build the deck params, validate client-side (parity
   *  with the host), connect, remember the full join payload for reconnect and
   *  send the joinRoom carrying the guest's deck + hero (Task 45). */
  function pickDeck(deck: DeckCard) {
    const trimmed = code.trim();
    const deckIds = deck.custom ? (loadDecks()[deck.slug] ?? []) : expandDeck(DECK_DEFS[deck.slug as keyof typeof DECK_DEFS]);
    const customCards = loadCustomCards();
    const heroId = heroNameForDeck(deckIds);
    // Parity with LanHost: validate against the merged pool + own customs, so
    // an invalid custom overlay never reaches the server.
    const registry = new CardRegistry([...buildPool(), ...customCards]);
    const issues = validateDeck(deckIds, registry.pool()).filter(i => i.severity === 'error');
    if (issues.length > 0) {
      setError(`Deck invalid: ${issues.map(i => i.message).join('; ')}`);
      return;
    }
    setError(null);
    setSubmittedCode(trimmed);
    setStage('joining');
    const c = connectLan(handleMessage, onStatus);
    c.setJoinPayload({ code: trimmed, deckIds, customCards, heroId }); // reconnect re-attach (fix round 2 + 45)
    setClient(c);
    c.send({ type: 'joinRoom', code: trimmed, deckIds, customCards, heroId });
  }

  function leave() {
    client?.close();
    navigate({ name: 'menu' });
  }

  return (
    <div className="shell">
      {stage === 'code' ? (
        <>
          <h1 className="shell-title">LAN Join</h1>
          <p className="shell-subtitle">Enter the host's room code to join.</p>
          <label className="lan-label" htmlFor="lan-code-input">
            Room code
          </label>
          <input
            id="lan-code-input"
            className="lan-code-input"
            value={code}
            // M3 (audit 06): server codes use CODE_ALPHABET
            // 'ABCDEFGHJKLMNPQRSTUVWXYZ' (A-Z minus O/I) — filter to that
            // alphabet so typing O or I can never produce a guaranteed
            // 'Room not found' code.
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z]/g, '').slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') next();
            }}
            placeholder="ABCD"
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="lan-row">
            <button type="button" className="shell-btn shell-btn-primary" onClick={next} disabled={code.length !== 4}>
              Next
            </button>
          </div>
          {error ? <p className="lan-error">{error}</p> : null}
          <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
            Back
          </button>
        </>
      ) : stage === 'deck' ? (
        <>
          <h1 className="shell-title">LAN Join — choose your deck</h1>
          <p className="shell-subtitle">
            Room code <strong>{code}</strong> — pick the deck you'll play.
          </p>
          {error ? <p className="lan-error">{error}</p> : null}
          <LanDeckGrid onPick={pickDeck} />
          <button type="button" className="shell-btn" onClick={() => { setError(null); setStage('code'); }}>
            Back
          </button>
        </>
      ) : (
        <>
          <h1 className="shell-title">LAN Join</h1>
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
