// LAN host screen (Task 34 + fix round 2). Pick a deck (lightweight inline
// single-pick grid reusing DeckPick's deck sources: @ashen/core DECK_DEFS/HEROES
// + the loadDecks() custom overlays) → create a room on the LAN server → show
// the big room code with a copy button → waiting spinner until an opponent
// joins → gameStart → register the LAN session with App (onSessionReady, so
// Victory/rematch wiring has the client + driver after this screen unmounts)
// → navigate to the Match screen with the LAN driver.
//
// Fix round 2: the screen's own message handler is removed on unmount (the
// driver owns echo application and lives on the client), the client remembers
// the room code for reconnect re-attach, and onStatus surfaces a closed
// connection as an error.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardRegistry, DECK_DEFS, HEROES, buildPool, expandDeck, validateDeck } from '@ashen/core';
import type { ArchetypeId } from '@ashen/core';
import type { ServerMessage } from '@ashen/server/protocol';
import { useNav } from '../App.js';
import type { LanSession } from '../App.js';
import { connectLan } from '../game/lanClient.js';
import type { LanClient, LanStatus } from '../game/lanClient.js';
import { heroNameForDeck } from '../game/lanDriver.js';
import { useLanMatch } from '../game/useLanMatch.js';
import type { LanRoomParams } from '../game/useLanMatch.js';
import { loadCustomCards, loadDecks } from '../storage.js';
import './shell.css';
import './lan.css';

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
  return Object.entries(overlays).map(([slug, cardIds]) => ({
    slug,
    name: slug in CURATED_INFO ? CURATED_INFO[slug as ArchetypeId].name : slug,
    tag: 'Custom deck',
    cards: cardIds.length,
    custom: true,
  }));
}

/** The host's deck → the createRoom payload. Validates against the merged
 *  registry so an invalid custom overlay never reaches the server (whose
 *  makeGame throws on invalid decks). */
function roomParamsFor(deck: DeckCard): LanRoomParams {
  const deckIds = deck.custom ? (loadDecks()[deck.slug] ?? []) : expandDeck(DECK_DEFS[deck.slug as ArchetypeId]);
  const customCards = loadCustomCards();
  return {
    deckIds,
    customCards,
    heroId: heroNameForDeck(deckIds),
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

  const curated = useMemo(buildCurated, []);
  const custom = useMemo(buildCustom, []);
  const { driver } = useLanMatch({ client, room, myPlayer: 0 });

  // Stable references for handler cleanup (the screen unmounts at match entry;
  // the session client must not keep this screen's pre-match handler alive).
  const clientRef = useRef<LanClient | null>(null);
  clientRef.current = client;

  const handleMessage = useCallback((m: ServerMessage) => {
    switch (m.type) {
      case 'roomCreated':
        setCode(m.code);
        clientRef.current?.setRoomCode(m.code); // reconnect re-attach (fix round 2)
        break;
      case 'opponentJoined':
        setOpponent(m.opponentName);
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
      onSessionReady({ mode: 'lanHost', client, room, myPlayer: 0, driver });
      navigate({ name: 'match', setup: { driver, myPlayer: 0, mode: 'lan' } });
    }
  }, [started, driver, client, room, onSessionReady, navigate]);

  // Unmount cleanup: drop this screen's pre-match handler from the client.
  useEffect(() => () => clientRef.current?.removeMessageHandler(handleMessage), [handleMessage]);

  function startHosting(deck: DeckCard) {
    const params = roomParamsFor(deck);
    const registry = new CardRegistry([...buildPool(), ...params.customCards]);
    const issues = validateDeck(params.deckIds, registry.pool()).filter(i => i.severity === 'error');
    if (issues.length > 0) {
      setError(`Deck invalid: ${issues.map(i => i.message).join('; ')}`);
      return;
    }
    setPicked(deck);
    setRoom(params);
    const c = connectLan(handleMessage, onStatus);
    setClient(c);
    c.send({ type: 'createRoom', name: 'You', deckIds: params.deckIds, customCards: params.customCards, heroId: params.heroId, seed: params.seed });
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
        <section className="shell-section">
          <h2 className="shell-section-title">Curated decks</h2>
          <div className="shell-grid">
            {curated.map((deck) => (
              <button type="button" key={`curated-${deck.slug}`} className="shell-card deck-card" onClick={() => startHosting(deck)}>
                <span className="deck-card-name">{deck.name}</span>
                {deck.hero ? <span className="deck-card-hero">{deck.hero}</span> : null}
                <span className="deck-card-tag">{deck.tag}</span>
                <span className="deck-card-badge">{deck.cards} cards</span>
              </button>
            ))}
          </div>
        </section>
        <section className="shell-section">
          <h2 className="shell-section-title">Custom decks</h2>
          {custom.length === 0 ? (
            <p className="shell-empty">No custom decks yet — save one in the Deck Builder.</p>
          ) : (
            <div className="shell-grid">
              {custom.map((deck) => (
                <button type="button" key={`custom-${deck.slug}`} className="shell-card deck-card" onClick={() => startHosting(deck)}>
                  <span className="deck-card-name">{deck.name}</span>
                  <span className="deck-card-tag">{deck.tag}</span>
                  <span className="deck-card-badge">{deck.cards} cards</span>
                </button>
              ))}
            </div>
          )}
        </section>
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
