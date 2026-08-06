// App shell router (Task 28). State-machine screen routing (no react-router):
// App holds the current Screen in useState and renders a switch. A small
// navigation context lets any screen navigate. The 'match' screen is a
// placeholder until Task 30 lands the real MatchDriver.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { MatchDriver, MatchResult, MatchScreenSetup, Mode, Screen } from './types.js';
import Menu from './screens/Menu.js';
import ModeSelect from './screens/ModeSelect.js';
import DeckPick from './screens/DeckPick.js';
import type { DeckPickResult } from './screens/DeckPick.js';
import Forge from './screens/Forge.js';
import DeckBuilder from './screens/DeckBuilder.js';
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

// ---- match placeholder state (Task 28) ----

/** Pending match selection, held in App state so the placeholder can render it. */
export interface PendingMatch {
  mode: Mode;
  difficulty?: DeckPickResult['difficulty'];
  decks: DeckPickResult['decks']; // pick order: player 0 first
}

// The real MatchScreenSetup is built at match entry by Task 30
// (createLocalDriver / createLanDriver). Until then the 'match' screen is a
// placeholder that renders `pending` (App state) and never touches setup.
// TODO(Task 30): wire real MatchDriver
const PLACEHOLDER_SETUP: MatchScreenSetup = {
  driver: undefined as unknown as MatchDriver,
  myPlayer: 0,
};

// ---- App ----

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [modeIntent, setModeIntent] = useState<'bot' | 'hotseat'>('bot');
  const [pending, setPending] = useState<PendingMatch | null>(null);

  const navigate = useCallback((next: Screen) => setScreen(next), []);
  const startModeSelect = useCallback((mode: 'bot' | 'hotseat') => {
    setModeIntent(mode);
    setScreen({ name: 'modeSelect' });
  }, []);

  const nav = useMemo<Nav>(() => ({ navigate, startModeSelect }), [navigate, startModeSelect]);

  function onDeckPickComplete(pick: DeckPickResult) {
    setPending({ mode: pick.mode, difficulty: pick.difficulty, decks: pick.decks });
    navigate({ name: 'match', setup: PLACEHOLDER_SETUP });
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
      {screen.name === 'match' && <MatchPlaceholder pending={pending} />}
      {screen.name === 'victory' && <VictoryPlaceholder result={screen.result} />}
      {screen.name === 'lanHost' && <LanHost />}
      {screen.name === 'lanJoin' && <LanJoin />}
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

/**
 * Temporary match screen (Task 28). Renders the pending deck pick so the
 * menu → mode select → deck pick flow is walkable before the engine wiring
 * exists. Replaced by the real Match screen in Task 30.
 * TODO(Task 30): wire real MatchDriver
 */
function MatchPlaceholder({ pending }: { pending: PendingMatch | null }) {
  return (
    <div className="shell">
      <h1 className="shell-title">Match</h1>
      {pending ? (
        <>
          <p className="shell-subtitle">
            Mode: <strong>{pending.mode}</strong>
            {pending.difficulty ? (
              <>
                {' '}· Difficulty: <strong>{pending.difficulty}</strong>
              </>
            ) : null}
          </p>
          <ul className="shell-list">
            {pending.decks.map((deck, i) => (
              <li key={`${deck.slug}-${i}`}>
                Player {i + 1}: <strong>{deck.name}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="shell-subtitle">No match selected.</p>
      )}
      <p className="shell-note">The match engine lands in Task 30 — this is a placeholder screen.</p>
      <BackToMenuButton />
    </div>
  );
}

/** Deck builder ships in Task 27 — the menu button routes here until then. */
function DeckBuilderPlaceholder() {
  return (
    <div className="shell">
      <h1 className="shell-title">Deck Builder</h1>
      <p className="shell-note">The deck builder screen lands in Task 27 — router wiring only.</p>
      <BackToMenuButton />
    </div>
  );
}

/** Victory/defeat ships in Task 35 — the router case exists so the union is complete. */
function VictoryPlaceholder({ result }: { result: MatchResult }) {
  return (
    <div className="shell">
      <h1 className="shell-title">Victory</h1>
      <p className="shell-subtitle">Winner: <strong>{String(result.winner)}</strong></p>
      <p className="shell-note">The victory/defeat screen with match stats lands in Task 35.</p>
      <BackToMenuButton />
    </div>
  );
}
