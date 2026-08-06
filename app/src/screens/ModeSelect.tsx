// Mode select screen (Task 28). Two variants driven by App's mode intent:
// - bot: 3 difficulty cards (Recruit / Veteran / Grandmaster + flavor) → deckPick
// - hotseat: no difficulty — straight to deckPick (two sequential picks)
// (Editable player names for hotseat arrive with the pass-device flow in Task 32.)
import { useNav } from '../App.js';
import type { BotLevel } from '../types.js';
import './shell.css';

interface DifficultyInfo {
  level: BotLevel;
  title: string;
  flavor: string;
}

const DIFFICULTIES: DifficultyInfo[] = [
  {
    level: 'recruit',
    title: 'Recruit',
    flavor: 'Plays random legal moves — great for learning the UI.',
  },
  {
    level: 'veteran',
    title: 'Veteran',
    flavor: 'A greedy heuristic — scores every action and takes the best line.',
  },
  {
    level: 'grandmaster',
    title: 'Grandmaster',
    flavor: 'Bounded lookahead to depth 2–3 with a ~1s time budget. No mercy.',
  },
];

export default function ModeSelect({ mode }: { mode: 'bot' | 'hotseat' }) {
  const { navigate } = useNav();

  function pickDifficulty(level: BotLevel) {
    navigate({ name: 'deckPick', mode: 'bot', difficulty: level });
  }

  function startHotseat() {
    navigate({ name: 'deckPick', mode: 'hotseat' });
  }

  if (mode === 'hotseat') {
    // Straight to deck pick — hotseat has no difficulty tier.
    return (
      <div className="shell">
        <h1 className="shell-title">Hotseat</h1>
        <p className="shell-subtitle">Two players, one screen. Pass the device between turns.</p>
        <button type="button" className="shell-btn shell-btn-primary" onClick={startHotseat}>
          Choose decks
        </button>
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="shell">
      <h1 className="shell-title">Choose an opponent</h1>
      <p className="shell-subtitle">Pick a bot difficulty.</p>
      <div className="shell-cards">
        {DIFFICULTIES.map((d) => (
          <button
            type="button"
            key={d.level}
            className="shell-card"
            onClick={() => pickDifficulty(d.level)}
          >
            <span className="shell-card-title">{d.title}</span>
            <span className="shell-card-flavor">{d.flavor}</span>
          </button>
        ))}
      </div>
      <button type="button" className="shell-btn" onClick={() => navigate({ name: 'menu' })}>
        Back
      </button>
    </div>
  );
}
