// App shell router (Task 28, extended Task 31). State-machine screen routing
// (no react-router): App holds the current Screen in useState and renders a
// switch. A small navigation context lets any screen navigate.
//
// Match flow (Task 31): onDeckPickComplete builds a real MatchScreenSetup
// (core Game over the production pool + saved custom cards, local driver,
// bot config for bot mode) and routes to the real Match screen. Victory
// (Task 35) is wired with rematch (driver.reset over a fresh seed) and
// change-deck. Hotseat v1 plays player 0 only — the pass flow is Task 32.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Screen } from './types.js';
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

// ---- App ----

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [modeIntent, setModeIntent] = useState<'bot' | 'hotseat'>('bot');
  const [pending, setPending] = useState<PendingMatch | null>(null);
  const [matchEntry, setMatchEntry] = useState<MatchEntry | null>(null);

  const navigate = useCallback((next: Screen) => setScreen(next), []);
  const startModeSelect = useCallback((mode: 'bot' | 'hotseat') => {
    setModeIntent(mode);
    setScreen({ name: 'modeSelect' });
  }, []);

  const nav = useMemo<Nav>(() => ({ navigate, startModeSelect }), [navigate, startModeSelect]);

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
          myPlayer={matchEntry?.setup.bot ? matchEntry.setup.myPlayer : undefined}
          onRematch={handleRematch}
          onChangeDeck={handleChangeDeck}
          onMenu={() => navigate({ name: 'menu' })}
        />
      )}
      {screen.name === 'lanHost' && <LanPlaceholder kind="host" />}
      {screen.name === 'lanJoin' && <LanPlaceholder kind="join" />}
    </NavContext.Provider>
  );
}

// ---- placeholder screens (router wiring only, replaced by later tasks) ----

function BackToMenuButton() {
  const { navigate } = useNav();
  return (
    <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
      Back to menu
    </button>
  );
}

/** LAN host/join ship in Tasks 33/34 — the menu buttons route here until then. */
function LanPlaceholder({ kind }: { kind: 'host' | 'join' }) {
  const task = kind === 'host' ? 33 : 34;
  return (
    <div className="shell">
      <h1 className="shell-title">LAN {kind === 'host' ? 'Host' : 'Join'}</h1>
      <p className="shell-note">LAN play comes in Task {task} — router wiring only.</p>
      <BackToMenuButton />
    </div>
  );
}
