import { useEffect, useRef } from 'react';

/**
 * useHotkeys (Task 41): window-level keyboard shortcuts for the match.
 *
 * Handlers are keyed by lowercase key (the object literal uses `' '` for
 * Space). Matching is case-insensitive. Two guard rails:
 *
 *   - Typing in a form control (INPUT/TEXTAREA/SELECT or a contentEditable
 *     region) never fires a hotkey — the mulligan toggles and Forge inputs
 *     are real inputs/buttons, so shortcuts must not fire while typing.
 *   - Events with ctrl/meta/alt held are ignored (browser/OS chords), and
 *     auto-repeats (held key) are dropped so a held `E` cannot double-fire
 *     an End Turn.
 *
 * Space additionally calls preventDefault so it neither scrolls the page nor
 * re-activates whatever button currently has focus.
 *
 * The handlers object is re-read from a ref every event, so callers can pass
 * a fresh object literal per render with zero re-subscription cost.
 */

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useHotkeys(handlers: HotkeyMap): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Typing in a form control never fires a hotkey.
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }
      // Modifier chords are reserved for browser/OS shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Held-key auto-repeat must not double-fire actions (e.g. End Turn).
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      const handler = handlersRef.current[key];
      if (!handler) return;
      // Space's default would scroll the page or activate a focused button.
      if (key === ' ') e.preventDefault();
      handler(e);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
