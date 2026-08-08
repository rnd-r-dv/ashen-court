// LAN host screen (Task 34 + fix round 2 + Task 45). Pick a deck (shared
// LanDeckGrid reusing DeckPick's deck sources: @ashen/core DECK_DEFS/HEROES
// + the loadDecks() custom overlays) → create a room on the LAN server → show
// the big room code with a copy button → waiting spinner until an opponent
// joins (Task 45: opponentJoined now carries the resolved setup so the room
// state reflects the guest's deck for App's LanSession) → gameStart → register
// the LAN session with App (onSessionReady, so Victory/rematch wiring has the
// client + driver after this screen unmounts) → navigate to the Match screen
// with the LAN driver.
//
// Fix round 2: the screen's own message handler is removed on unmount (the
// driver owns echo application and lives on the client), the client remembers
// the room code for reconnect re-attach, and onStatus surfaces a closed
// connection as an error.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardRegistry, DECK_DEFS, buildPool, expandDeck, validateDeck } from '@ashen/core';
import type { ServerMessage } from '@ashen/server/protocol';
import { useNav } from '../App.js';
import type { LanSession } from '../App.js';
import LanDeckGrid from '../components/LanDeckGrid.js';
import { connectLan } from '../game/lanClient.js';
import type { LanClient, LanStatus } from '../game/lanClient.js';
import { heroNameForDeck } from '../game/lanDriver.js';
import type { DeckCard } from '../game/lanDecks.js';
import { useLanMatch } from '../game/useLanMatch.js';
import type { LanRoomParams } from '../game/useLanMatch.js';
import { loadCustomCards, loadDecks } from '../storage.js';
import './shell.css';
import './lan.css';

/** The host's deck → the createRoom payload. Validates against the merged
 *  registry so an invalid custom overlay never reaches the server (whose
 *  makeGame throws on invalid decks). Task 45: the guest slot is a placeholder
 *  ([deckIds, deckIds] + same hero) until opponentJoined corrects it with the
 *  guest's real deck/hero from the wire. */
function roomParamsFor(deck: DeckCard): LanRoomParams {
  const deckIds = deck.custom ? (loadDecks()[deck.slug] ?? []) : expandDeck(DECK_DEFS[deck.slug as keyof typeof DECK_DEFS]);
  const customCards = loadCustomCards();
  const heroId = heroNameForDeck(deckIds);
  return {
    decks: [deckIds, deckIds],
    heroes: [heroId, heroId],
    customCards,
    seed: Math.floor(Math.random() * 1e9),
  };
}

export default function LanHost({ onSessionReady }: { onSessionReady: (s: LanSession) => void }) {
  const { navigate } = useNav();
  const [picked, setPicked] = useState<DeckCard | null>(null);
  const [client, setClient] = useState<LanClient | null>(null);
  const [room, setRoom] = useState<LanRoomParams | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { driver } = useLanMatch({ client, room, myPlayer: 0 });

  // Stable references for handler cleanup (the screen unmounts at match entry;
  // the session client must not keep this screen's pre-match handler alive).
  const clientRef = useRef<LanClient | null>(null);
  clientRef.current = client;
  // The createRoom params, captured so the roomCreated handler (registered
  // once) can build the reconnect payload without a stale closure.
  const paramsRef = useRef<LanRoomParams | null>(null);
  paramsRef.current = room;

  const handleMessage = useCallback((m: ServerMessage) => {
    switch (m.type) {
      case 'roomCreated':
        setCode(m.code);
        // Reconnect re-attach: remember the FULL joinRoom payload (code + this
        // host's deck choice) so a reconnect re-attaches validly (Task 45).
        {
          const params = paramsRef.current;
          if (params) {
            clientRef.current?.setJoinPayload({ code: m.code, deckIds: params.decks[0], customCards: params.customCards, heroId: params.heroes[0] });
          }
        }
        break;
      case 'opponentJoined':
        setOpponent(m.opponentName);
        // The guest's real deck/hero arrive on the wire — correct the
        // placeholder room state so App's LanSession/rematch bookkeeping
        // carries the guest deck (the driver rebuilds its own shadow via its
        // wire handler; this update is only for LanSession).
        setRoom({ decks: m.decks, heroes: m.heroes, customCards: m.cards, seed: m.seed });
        break;
      case 'gameStart':
        setStarted(true);
        break;
      case 'error':
        setError(m.message);
        break;
      case 'playerLeft':
        setError(m.reason);
        break;
      default:
        break; // joined / events / intent / rematchStart are the driver's + App's business
    }
  }, []);

  // I1: a closed connection (grace window expired / intentional close) is
  // surfaced as an error the waiting room can show.
  const onStatus = useCallback((s: LanStatus) => {
    if (s === 'closed') setError('Connection closed — rejoin by code to continue.');
  }, []);

  // gameStart → the driver is ready (host's shadow exists from mount) → hand
  // the session to App (Victory/rematch wiring) → Match.
  useEffect(() => {
    if (started && driver && client && room) {
      // I2 (audit 06): the session's seat is LIVE — the getter reads the
      // driver's wire seat, so a mid-game reconnect seat remap (both players
      // away → first rejoin reclaims the host slot) reaches Victory/rematch
      // bookkeeping instead of the gameStart-frozen 0.
      onSessionReady({ mode: 'lanHost', client, room, driver, get myPlayer() { return driver.seat ?? 0; } });
      navigate({ name: 'match', setup: { driver, myPlayer: 0, mode: 'lan' } });
    }
  }, [started, driver, client, room, onSessionReady, navigate]);

  // Unmount cleanup: drop this screen's pre-match handler from the client.
  useEffect(() => () => clientRef.current?.removeMessageHandler(handleMessage), [handleMessage]);

  function startHosting(deck: DeckCard) {
    const params = roomParamsFor(deck);
    const registry = new CardRegistry([...buildPool(), ...params.customCards]);
    const issues = validateDeck(params.decks[0], registry.pool()).filter(i => i.severity === 'error');
    if (issues.length > 0) {
      setError(`Deck invalid: ${issues.map(i => i.message).join('; ')}`);
      return;
    }
    setPicked(deck);
    setRoom(params);
    const c = connectLan(handleMessage, onStatus);
    setClient(c);
    c.send({ type: 'createRoom', name: 'You', deckIds: params.decks[0], customCards: params.customCards, heroId: params.heroes[0], seed: params.seed });
  }

  function leave() {
    client?.close();
    navigate({ name: 'menu' });
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (non-secure context): legacy fallback.
      const el = document.createElement('textarea');
      el.value = code;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* give up silently */
      }
      document.body.removeChild(el);
    }
  }

  if (!picked || !code) {
    // Stage 1: pick the deck.
    return (
      <div className="shell">
        <h1 className="shell-title">LAN Host — choose your deck</h1>
        {error ? <p className="lan-error">{error}</p> : null}
        <LanDeckGrid onPick={startHosting} />
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
          Back
        </button>
      </div>
    );
  }

  // Stage 2: room code + waiting for the opponent.
  return (
    <div className="shell">
      <h1 className="shell-title">LAN Host</h1>
      <p className="shell-subtitle">
        Deck: <strong>{picked.name}</strong>
      </p>
      <p className="lan-label">Share this room code</p>
      <div className="lan-room-code gothic-frame">{code}</div>
      {/* Task 46: the code's second half encodes this machine's address, which
          is what lets the other player join by code alone. A code WITHOUT it
          means the server found no LAN address — worth saying, because such a
          code is joinable only from this machine and would otherwise fail with
          a bare "can't reach". */}
      <p className="lan-hint">
        {code.includes('-')
          ? "Read out the whole code — its second half tells your opponent's game which machine to reach."
          : 'This server found no LAN address, so only browsers on this machine can join. Check that you are connected to a network, then restart npm run server.'}
      </p>
      <div className="lan-row">
        <button type="button" className="shell-btn" onClick={copyCode}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <div className="lan-waiting">
        <span className="lan-spinner" aria-hidden="true" />
        {opponent ? (
          <p className="lan-note">Opponent joined: <strong>{opponent}</strong> — starting…</p>
        ) : (
          <p className="lan-note">Waiting for an opponent to join…</p>
        )}
      </div>
      {error ? <p className="lan-error">{error}</p> : null}
      <button type="button" className="shell-btn" onClick={leave}>
        Cancel
      </button>
    </div>
  );
}
