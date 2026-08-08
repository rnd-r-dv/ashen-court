// LAN join screen (Task 34 + fix round 2 + Task 45 + Task 46). Enter the room
// code (auto-uppercased) → PICK YOUR OWN DECK (Task 45: same curated + custom
// sources as the host, via the shared LanDeckGrid) → joinRoom carrying the
// deck choice → wait for the host → 'joined' feeds the room params (seed,
// both decks, hero names, full card registry) into useLanMatch → gameStart →
// register the LAN session with App (onSessionReady) → Match.
//
// Task 46 — code-only join. The code now carries the host's address (see
// server/src/lanCode.ts), so this screen asks for ONE thing. The previous
// round's separate "host address" field is gone: the address it wanted is
// exactly what the code already encodes, and asking a player to read an IP off
// their friend's screen was the whole problem it was meant to solve.
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
import { ADDR_CODE_LENGTH, ROOM_CODE_LENGTH, parseJoinCode } from '@ashen/server/lanCode';
import { loadCustomCards, loadDecks } from '../storage.js';
import './shell.css';
import './lan.css';

type Stage = 'code' | 'deck' | 'joining';

/** Letters a full code can hold, hyphen excluded (state stores letters only). */
const MAX_CODE_LETTERS = ROOM_CODE_LENGTH + ADDR_CODE_LENGTH;

/**
 * Letters-only code as the player should SEE it: the hyphen is presentation,
 * grouping room id and address so a long string stays readable when read aloud.
 * parseJoinCode strips it again, so it never has to be typed.
 */
function displayCode(letters: string): string {
  return letters.length > ROOM_CODE_LENGTH
    ? `${letters.slice(0, ROOM_CODE_LENGTH)}-${letters.slice(ROOM_CODE_LENGTH)}`
    : letters;
}

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
  // The host machine, DECODED FROM THE CODE (Task 46). Each player runs their
  // own app instance, so the guest's page is served by the GUEST's machine —
  // without an explicit host the client dialled the guest's own port 8080 and
  // either hung forever or reported 'Room not found' against an empty local
  // server. null means "this machine", which is what a bare 4-letter code
  // means and what keeps the two-browsers-on-one-box flow working.
  const [hostAddr, setHostAddr] = useState<string | null>(null);
  const [status, setStatus] = useState<LanStatus | null>(null);

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
  // surfaced as an error the joining screen can show. 'reconnecting' is kept
  // too: a socket that never opens (wrong address, server not running, port
  // blocked) otherwise left this screen spinning "Waiting for the game to
  // start…" for the full 5-minute grace window with no hint that nothing was
  // getting through.
  const onStatus = useCallback((s: LanStatus) => {
    setStatus(s);
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

  /** Code entry → deck pick. The code is the only input: parseJoinCode both
   *  validates it and yields the host to dial, so there is nothing else to
   *  ask for. */
  function next() {
    if (parseJoinCode(code) === null) {
      setError(`Enter the room code from the host's screen (${ROOM_CODE_LENGTH} letters, or ${ROOM_CODE_LENGTH}+${ADDR_CODE_LENGTH} with the address)`);
      return;
    }
    setError(null);
    setStage('deck');
  }

  /** Deck pick → joinRoom: build the deck params, validate client-side (parity
   *  with the host), connect, remember the full join payload for reconnect and
   *  send the joinRoom carrying the guest's deck + hero (Task 45). */
  function pickDeck(deck: DeckCard) {
    // Re-parsed here rather than carried from next(): the deck stage can be
    // reached, backed out of and re-entered with a corrected code.
    const parsed = parseJoinCode(code);
    if (parsed === null) {
      setError('That room code is not valid — go back and re-enter it');
      return;
    }
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
    setSubmittedCode(displayCode(code));
    setHostAddr(parsed.host);
    setStage('joining');
    // The address half is consumed HERE, choosing which machine to dial; only
    // the room id goes on the wire (the server accepts either, but the room is
    // keyed by the id).
    const c = connectLan(handleMessage, onStatus, parsed.host);
    c.setJoinPayload({ code: parsed.roomId, deckIds, customCards, heroId }); // reconnect re-attach (fix round 2 + 45)
    setClient(c);
    c.send({ type: 'joinRoom', code: parsed.roomId, deckIds, customCards, heroId });
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
          <p className="shell-subtitle">Enter the room code from the host's screen.</p>
          <label className="lan-label" htmlFor="lan-code-input">
            Room code
          </label>
          <input
            id="lan-code-input"
            className="lan-code-input"
            // State holds letters only; the hyphen is added for display and
            // stripped again by parseJoinCode, so it never has to be typed.
            value={displayCode(code)}
            // M3 (audit 06): server codes use CODE_ALPHABET
            // 'ABCDEFGHJKLMNPQRSTUVWXYZ' (A-Z minus O/I) — filter to that
            // alphabet so typing O or I can never produce a guaranteed
            // 'Room not found' code. The filter also drops the display hyphen
            // back out on every keystroke.
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z]/g, '').slice(0, MAX_CODE_LETTERS))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') next();
            }}
            placeholder="ABCD-EFGHJKL"
            maxLength={MAX_CODE_LETTERS + 1}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <p className="lan-hint">
            The whole code, exactly as the host sees it — the second half tells your game which machine to
            connect to.
          </p>
          <div className="lan-row">
            <button
              type="button"
              className="shell-btn shell-btn-primary"
              onClick={next}
              disabled={parseJoinCode(code) === null}
            >
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
            Room code <strong>{displayCode(code)}</strong> — pick the deck you'll play.
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
            Joining room <strong>{submittedCode}</strong> on <strong>{hostAddr ?? 'this machine'}</strong>…
          </p>
          <div className="lan-waiting">
            <span className="lan-spinner" aria-hidden="true" />
            {opponent ? (
              <p className="lan-note">
                Playing against <strong>{opponent}</strong> — starting…
              </p>
            ) : status === 'reconnecting' ? (
              // The socket dropped or never opened. Say so instead of spinning
              // silently: an unreachable host is otherwise indistinguishable
              // from a host who has not started the match.
              //
              // Task 46: the address is no longer typed, so "check the address"
              // is not advice a player can act on. These are the two causes
              // that remain — and the browser permission is the one that cost a
              // full debugging session to find, because macOS reports a blocked
              // app's LAN destinations as simply unreachable.
              <p className="lan-note">
                Can't reach <strong>{hostAddr ?? 'this machine'}</strong> — retrying. Check that the host is
                running <code>npm run server</code>, and that this browser is allowed to reach local
                devices (on macOS: System Settings → Privacy &amp; Security → Local Network).
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
