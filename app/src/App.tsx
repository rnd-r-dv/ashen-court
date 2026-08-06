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
import type { PlayerIndex } from '@ashen/core';
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
  myPlayer: PlayerIndex;
  driver: LanMatchDriver;
}

// ---- App ----

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [modeIntent, setModeIntent] = useState<'bot' | 'hotseat'>('bot');
  const [pending, setPending] = useState<PendingMatch | null>(null);
  const [matchEntry, setMatchEntry] = useState<MatchEntry | null>(null);
  const [lanSession, setLanSession] = useState<LanSession | null>(null);
  const lanSessionRef = useRef<LanSession | null>(null);
  lanSessionRef.current = lanSession;

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
    } catch {
      // A saved deck can reference custom cards that were later deleted —
      // Game's constructor validates and throws; send the player back rather
      // than crashing the router.
      window.alert('That deck contains cards that are no longer available. Please pick again.');
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
  useEffect(() => {
    const s = lanSession;
    if (!s) return;
    const handler = (m: ServerMessage) => {
      if (m.type !== 'rematchStart') return;
      const session = lanSessionRef.current;
      if (!session) return;
      const nextSeed = session.driver.game().state.seed + 1; // server does seed += 1 per rematch
      const hero = HEROES.find(h => h.name === session.room.heroId) ?? HEROES[0]!;
      session.driver.reset({
        decks: [session.room.deckIds, session.room.deckIds],
        heroes: [hero, hero],
        seed: nextSeed,
      });
      navigate({ name: 'match', setup: { driver: session.driver, myPlayer: session.myPlayer, mode: 'lan' } });
    };
    s.client.addMessageHandler(handler);
    return () => s.client.removeMessageHandler(handler);
  }, [lanSession, navigate]);

  function lanLeave() {
    if (!lanSession) return;
    lanSession.client.close();
    setLanSession(null);
  }

  function lanRematch() {
    lanSession?.client.send({ type: 'rematch' });
  }

  return (
    <NavContext.Provider value={nav}>
      {/* Ambient layer: fixed, z-index -1, pointer-events none — shows on every screen. */}
      <Background />
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

