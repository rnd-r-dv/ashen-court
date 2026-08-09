// App shell router (Task 28, extended Task 31 + Task 34 fix round 2).
// State-machine screen routing (no react-router): App holds the current Screen
// in useState and renders a switch. A small navigation context lets any screen
// navigate.
//
// Match flow (Task 31): onDeckPickComplete builds a real MatchScreenSetup
// (core Game over the production pool + saved custom cards, local driver,
// bot config for bot mode) and routes to the real Match screen. Victory
// (Task 35) is wired with rematch (driver.reset over a fresh seed) and
// change-deck. Hotseat v1 plays player 0 only — the pass flow is Task 32.
//
// LAN flow (Task 34, fix round 2): the LAN screens report their session up
// (onSessionReady) when the game starts. App keeps it for the Victory wiring:
// the LAN client survives match + victory (the screens unmount at match
// entry), so rematch sends {type:'rematch'} over the wire and a session-level
// rematchStart listener resets the driver at seed+1 and routes back to the
// Match screen. Change-Deck / Main-Menu close the session and return to the
// LAN host/join screens.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Screen } from './types.js';
import { HEROES } from '@ashen/core';
import type { HeroSpec, PlayerIndex } from '@ashen/core';
import type { ServerMessage } from '@ashen/server/protocol';
import type { LanClient } from './game/lanClient.js';
import type { LanMatchDriver } from './game/lanDriver.js';
import type { LanRoomParams } from './game/useLanMatch.js';
import { buildMatchEntry, rematchSetup } from './game/matchSetup.js';
import type { MatchEntry, MatchEntryRequest } from './game/matchSetup.js';
import Menu from './screens/Menu.js';
import ModeSelect from './screens/ModeSelect.js';
import DeckPick from './screens/DeckPick.js';
import type { DeckPickResult } from './screens/DeckPick.js';
import Forge from './screens/Forge.js';
import DeckBuilder from './screens/DeckBuilder.js';
import Match from './screens/Match.js';
import Victory from './screens/Victory.js';
import LanHost from './screens/LanHost.js';
import LanJoin from './screens/LanJoin.js';
import Background from './components/Background.js';

// ---- navigation context ----

export interface Nav {
  navigate: (screen: Screen) => void;
  /** Enter mode-select for a local mode (bot → difficulty pick, hotseat → straight to deck pick). */
  startModeSelect: (mode: 'bot' | 'hotseat') => void;
}

const NavContext = createContext<Nav>({
  navigate: () => {},
  startModeSelect: () => {},
});

export function useNav(): Nav {
  return useContext(NavContext);
}

// ---- match entry building (Task 31) ----

/** Pending match selection, held in App state and converted to a setup at entry. */
export type PendingMatch = MatchEntryRequest;

// ---- LAN session (Task 34 fix round 2) ----------------

/** The live LAN session, reported by LanHost/LanJoin at gameStart and kept in
 *  App so Victory/rematch wiring survives the screens' unmount at match entry.
 *  The driver owns the shadow (echo application lives on the client); App only
 *  needs it to reset on rematchStart and to send {type:'rematch'}. */
export interface LanSession {
  mode: 'lanHost' | 'lanJoin';
  client: LanClient;
  room: LanRoomParams;
  driver: LanMatchDriver;
  /** Live seat: reads the driver's wire-assigned seat rather than a value
   *  frozen at gameStart. A mid-game reconnect can REMAP the seat (audit 06
   *  I2: both players away → the first rejoin reclaims the host slot), so
   *  Victory/rematch bookkeeping must track the CURRENT seat. */
  get myPlayer(): PlayerIndex;
}

/** Session-level banner state (audit 06 I3): mid-match feedback that survives
 *  the LAN screens' unmount at match entry. 'left' offers a return-to-menu
 *  affordance; 'reconnected' marks a seat remap; 'error' is a plain toast. */
type LanNotice = { kind: 'error' | 'left' | 'reconnected'; text: string };

// ---- App ----

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [modeIntent, setModeIntent] = useState<'bot' | 'hotseat'>('bot');
  const [pending, setPending] = useState<PendingMatch | null>(null);
  const [matchEntry, setMatchEntry] = useState<MatchEntry | null>(null);
  const [lanSession, setLanSession] = useState<LanSession | null>(null);
  const [lanNotice, setLanNotice] = useState<LanNotice | null>(null);
  const lanSessionRef = useRef<LanSession | null>(null);
  lanSessionRef.current = lanSession;
  /** Last-known wire seat, for reconnect seat-change detection (I2). */
  const seatRef = useRef<PlayerIndex | null>(null);

  const navigate = useCallback((next: Screen) => setScreen(next), []);
  const startModeSelect = useCallback((mode: 'bot' | 'hotseat') => {
    setModeIntent(mode);
    setScreen({ name: 'modeSelect' });
  }, []);

  const nav = useMemo<Nav>(() => ({ navigate, startModeSelect }), [navigate, startModeSelect]);

  const onSessionReady = useCallback((s: LanSession) => setLanSession(s), []);

  function onDeckPickComplete(pick: DeckPickResult) {
    if (pick.mode !== 'bot' && pick.mode !== 'hotseat') return; // LAN picks route elsewhere (Task 34)
    const pendingMatch: PendingMatch = {
      mode: pick.mode,
      difficulty: pick.difficulty,
      decks: pick.decks,
    };
    setPending(pendingMatch);
    try {
      const entry = buildMatchEntry(pendingMatch);
      setMatchEntry(entry);
      navigate({ name: 'match', setup: entry.setup });
    } catch (err) {
      // Game's constructor runs validateDeck and throws on ANY error, carrying
      // the real detail ("Deck 0 invalid: Deck must be exactly 60 cards (has
      // 12)."). Audit 07 bug 19: this used to hardcode "cards that are no
      // longer available", which names only one of several possible causes —
      // an undersized saved deck reported a missing-card problem that did not
      // exist. Surface the engine's own reason, stripped of the "Deck N
      // invalid:" seat prefix that means nothing to a player.
      const raw = err instanceof Error ? err.message : String(err);
      const detail = raw.replace(/^Deck \d+ invalid:\s*/, '');
      window.alert(`That deck can't be played.\n\n${detail}\n\nPlease pick again.`);
    }
  }

  function handleRematch() {
    if (!matchEntry) return;
    // Fresh seed, same decks/heroes; the driver's reset swaps in the new game.
    matchEntry.setup.driver.reset(rematchSetup(matchEntry));
    navigate({ name: 'match', setup: matchEntry.setup });
  }

  function handleChangeDeck() {
    const mode = pending?.mode ?? 'bot';
    if (mode === 'bot') navigate({ name: 'deckPick', mode: 'bot', difficulty: pending?.difficulty });
    else navigate({ name: 'deckPick', mode: 'hotseat' });
  }

  // ---- LAN session listeners (fix round 2) ----

  // Rematch handshake: Victory's Rematch button sends {type:'rematch'} via the
  // client; when BOTH players have requested it the server resets the game at
  // seed+1 and broadcasts rematchStart. This listener (registered per session,
  // alive across match + victory — the screens unmount at match entry) resets
  // the driver to the new seed and routes back to the Match screen.
  //
  // I3 (audit 06): the SAME session-level listener surfaces mid-match errors
  // and opponent-leaves. The LAN screens (and the hook's setError) unmount at
  // gameStart, so the old driver onError landed on a dead setter and playerLeft
  // reached nobody — App owns the session and must own this feedback.
  useEffect(() => {
    const s = lanSession;
    if (!s) return;
    // Reference seat for reconnect seat-change detection (a 'joined' carrying
    // a different player index means the seat was remapped — both players
    // were away and the first rejoin took the host slot).
    seatRef.current = s.myPlayer;
    const handler = (m: ServerMessage) => {
      if (m.type === 'rematchStart') {
        const session = lanSessionRef.current;
        if (!session) return;
        // M5 (audit 06): the server's post-increment seed rides on the wire
        // message — no client-side state.seed + 1 derivation (implicit
        // coupling that silently desyncs if the increment ever drifts).
        const nextSeed = m.seed;
        // Task 45: both players' real heroes + decks live in the room state
        // (host's own + the guest's from opponentJoined / joined).
        const heroes = session.room.heroes.map(name => HEROES.find(h => h.name === name) ?? HEROES[0]!);
        session.driver.reset({
          decks: session.room.decks,
          heroes: heroes as [HeroSpec, HeroSpec],
          seed: nextSeed,
        });
        navigate({ name: 'match', setup: { driver: session.driver, myPlayer: session.myPlayer, mode: 'lan' } });
        return;
      }
      if (m.type === 'error') { setLanNotice({ kind: 'error', text: m.message }); return; }
      if (m.type === 'playerLeft') { setLanNotice({ kind: 'left', text: m.reason }); return; }
      if (m.type === 'joined') {
        // A reconnect 'joined' carries the wire seat (I2). A change vs. the
        // last known seat means the seat was remapped — surface it so the UI
        // never silently submits the wrong seat's intents; a same-seat
        // re-attach clears any stale notice (reconnected / opponent back).
        const prev = seatRef.current;
        if (prev !== null && m.player !== prev) {
          setLanNotice({ kind: 'reconnected', text: `Reconnected as Player ${m.player + 1}` });
        } else {
          setLanNotice(null);
        }
        seatRef.current = m.player;
        return;
      }
      if (m.type === 'opponentJoined') { setLanNotice(null); return; }
      if (m.type === 'opponentReconnected') {
        // Bug 6: the opponent dropped and came back. The 'left' banner was set
        // by its playerLeft and nothing retracted it before — this player is
        // still connected, so it never receives its OWN 'joined'. Clear only
        // the stale disconnect banner: an unrelated error/seat-remap notice
        // must survive.
        setLanNotice(prev => (prev?.kind === 'left' ? null : prev));
        return;
      }
    };
    s.client.addMessageHandler(handler);
    return () => s.client.removeMessageHandler(handler);
  }, [lanSession, navigate]);

  function lanLeave() {
    if (!lanSession) return;
    lanSession.client.close();
    setLanSession(null);
    setLanNotice(null); // a session-level banner must not linger on other screens
  }

  function lanRematch() {
    lanSession?.client.send({ type: 'rematch' });
  }

  return (
    <NavContext.Provider value={nav}>
      {/* Ambient layer: fixed, z-index -1, pointer-events none — shows on every screen. */}
      <Background />
      {/* I3 (audit 06): session-level mid-match banner — errors, opponent
          leaves (with a return-to-menu exit) and reconnect seat remaps. Alive
          across match + victory because the LAN screens unmount at entry. */}
      {lanNotice ? (
        <div role="alert" className="app-notice">
          <span>{lanNotice.text}</span>
          {lanNotice.kind === 'left' ? (
            <button
              type="button"
              className="shell-btn"
              onClick={() => { setLanNotice(null); lanLeave(); navigate({ name: 'menu' }); }}
            >
              Return to Menu
            </button>
          ) : null}
          <button type="button" className="shell-btn" onClick={() => setLanNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {screen.name === 'menu' && <Menu />}
      {screen.name === 'modeSelect' && <ModeSelect mode={modeIntent} />}
      {screen.name === 'deckPick' && (
        <DeckPick mode={screen.mode} difficulty={screen.difficulty} onComplete={onDeckPickComplete} />
      )}
      {screen.name === 'deckBuilder' && <DeckBuilder />}
      {screen.name === 'forge' && <Forge />}
      {screen.name === 'match' && <Match setup={screen.setup} />}
      {screen.name === 'victory' && (
        <Victory
          result={screen.result}
          myPlayer={lanSession ? lanSession.myPlayer : matchEntry?.setup.bot ? matchEntry.setup.myPlayer : undefined}
          lan={lanSession !== null}
          onRematch={lanSession ? lanRematch : handleRematch}
          onChangeDeck={lanSession ? () => { lanLeave(); navigate({ name: lanSession.mode === 'lanHost' ? 'lanHost' : 'lanJoin' }); } : handleChangeDeck}
          onMenu={() => { lanLeave(); navigate({ name: 'menu' }); }}
        />
      )}
      {screen.name === 'lanHost' && <LanHost onSessionReady={onSessionReady} />}
      {screen.name === 'lanJoin' && <LanJoin onSessionReady={onSessionReady} />}
    </NavContext.Provider>
  );
}

