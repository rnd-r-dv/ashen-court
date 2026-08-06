// Main menu screen (Task 28). Entry points into every mode + tools, plus the
// fast-mode settings toggle (persisted via storage.ts). Styling is shell.css;
// the full theme system lands in Task 36.
import { useState } from 'react';
import { useNav } from '../App.js';
import { loadSettings, saveSettings } from '../storage.js';
import './shell.css';

export default function Menu() {
  const { navigate, startModeSelect } = useNav();
  const [fastMode, setFastMode] = useState(() => loadSettings().fastMode);

  function toggleFastMode() {
    setFastMode((prev) => {
      const next = !prev;
      saveSettings({ fastMode: next });
      return next;
    });
  }

  return (
    <div className="shell shell-menu">
      <h1 className="shell-title shell-menu-title">Ashen Court</h1>
      <p className="shell-subtitle">A dark-fantasy trading card game</p>

      <nav className="shell-menu-buttons">
        <button type="button" className="shell-btn shell-btn-primary" onClick={() => startModeSelect('bot')}>
          Play vs Bot
        </button>
        <button type="button" className="shell-btn" onClick={() => startModeSelect('hotseat')}>
          Hotseat
        </button>
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'lanHost' })}>
          LAN Host
        </button>
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'lanJoin' })}>
          LAN Join
        </button>
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'forge' })}>
          Forge
        </button>
        <button type="button" className="shell-btn" onClick={() => navigate({ name: 'deckBuilder' })}>
          Deck Builder
        </button>
      </nav>

      <label className="shell-toggle">
        <input type="checkbox" checked={fastMode} onChange={toggleFastMode} />
        Fast mode <span className="shell-muted">(skip animations)</span>
      </label>
    </div>
  );
}
