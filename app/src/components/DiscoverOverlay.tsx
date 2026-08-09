// DiscoverOverlay (Task 3): the discover modal. Renders the pending choice
// for its owner as three full preview card plates and a bare waiting state
// ("Opponent is choosing a card…") for everyone else — candidate names never
// reach a non-owner. Accessibility is part of correctness:
//   - role="dialog" + aria-modal="true", labelled by an explicit heading;
//   - initial focus lands on the first candidate;
//   - ArrowLeft/ArrowRight move focus in a ring (wrapping at both ends);
//   - Tab/Shift+Tab wrap among the three choice buttons (no focus escape);
//   - 1/2/3 submit the candidate by index (component-scoped keydown: the
//     handler lives on the overlay root, so it dies with the overlay);
//   - Escape cannot dismiss an unresolved choice — there is no dismiss path.
// The board behind may be dimmed with a flat translucent veil (never a
// gradient or glow). Pure presentational: Match decides when to show it and
// what onChoose submits.
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Card as CardSpec, PendingChoice, PlayerIndex } from '@ashen/core';
import CardView from './CardView.js';
import './discover.css';

export interface DiscoverOverlayProps {
  choice: PendingChoice;
  viewer: PlayerIndex;
  getCard(id: string): CardSpec | undefined;
  onChoose(choice: number): void;
}

export default function DiscoverOverlay({ choice, viewer, getCard, onChoose }: DiscoverOverlayProps) {
  const isOwner = viewer === choice.player;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Initial focus: the first candidate for the owner; the dialog itself for a
  // non-owner (a non-interactive waiting state should still receive focus).
  useEffect(() => {
    if (isOwner) buttonRefs.current[0]?.focus();
    else dialogRef.current?.focus();
    // The owner/choice identity cannot change while mounted — run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveFocus(step: number) {
    const buttons = buttonRefs.current;
    const count = buttons.length;
    if (count === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement | null);
    const next = index === -1 ? 0 : (index + step + count) % count;
    buttons[next]?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isOwner) return; // a non-owner has no choices to navigate
    switch (e.key) {
      case '1':
      case '2':
      case '3':
        e.preventDefault();
        onChoose(Number(e.key) - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Tab': {
        // Full focus-cycle management: Tab/Shift+Tab walk the ring and wrap at
        // both ends so focus never escapes the three choice buttons (jsdom has
        // no native Tab traversal, so the cycle must be explicit).
        const buttons = buttonRefs.current;
        const count = buttons.length;
        if (count === 0) break;
        e.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement | null);
        const current = index === -1 ? 0 : index;
        buttons[(current + (e.shiftKey ? count - 1 : 1)) % count]?.focus();
        break;
      }
      default:
        break; // Escape intentionally does nothing — the choice must resolve.
    }
  }

  return (
    <div className="discover-overlay" onKeyDown={onKeyDown}>
      <div className="discover-veil" aria-hidden="true" />
      <div
        className="discover-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 id="discover-title" className="shell-title">
          Discover a card
        </h2>
        {isOwner ? (
          <>
            <p className="shell-subtitle">
              Choose one of three cards to add to your hand — 1, 2 or 3, or click a card.
            </p>
            <div className="discover-choices">
              {choice.cardIds.map((id, i) => {
                const card = getCard(id);
                if (!card) return null;
                return (
                  <button
                    type="button"
                    key={id}
                    ref={(el) => {
                      buttonRefs.current[i] = el;
                    }}
                    className="discover-choice"
                    aria-label={`Card ${i + 1}: ${card.name}`}
                    onClick={() => onChoose(i)}
                  >
                    <CardView card={card} size="preview" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="discover-waiting">Opponent is choosing a card…</p>
        )}
      </div>
    </div>
  );
}
