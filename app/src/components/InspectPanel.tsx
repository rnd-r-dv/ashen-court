import { useEffect, useRef } from 'react';
import type { Card as CardSpec, CreatureState } from '@ashen/core';
import CardView from './CardView.js';
import './inspect.css';

/**
 * InspectPanel (Task 7): the read-only modal that explains a board creature.
 * The player opens it with a left-click on a non-actionable creature or a
 * right-click on any revealed creature — the board mini's text well stays
 * hidden (it is noise at zoom 0.5), so this full preview plate is where a
 * board creature's keywords, generated rules text, and live statuses live.
 *
 * The plate is LIVE, not a snapshot of the definition:
 *   - attack/health come from the CreatureState (damage and buffs read right);
 *   - `keywords` is the creature's CURRENT array (silence empties it,
 *     giveKeyword appends) and renders as interactive KeywordChip describe
 *     buttons — a plain modal has no nested-button constraint, so the chips
 *     keep their popover affordance;
 *   - `silenced` suppresses the def's generated rules text (its triggers live
 *     on the CARD, so only the flag can suppress them);
 *   - `status` carries exhausted/frozen/shields into the plate's own
 *     language, and a legend below the plate names each status in words.
 *
 * Accessibility is part of correctness (same bar as DiscoverOverlay):
 *   - role="dialog" + aria-modal, labelled by the card name;
 *   - initial focus lands on the Close button;
 *   - Tab/Shift+Tab wrap at both ends of the panel's focusables (and re-trap
 *     focus that somehow lands outside the dialog);
 *   - Escape closes, a click on the flat backdrop veil closes;
 *   - closing restores focus to the board slot that opened the panel (slots
 *     are programmatically focusable via tabIndex=-1).
 *
 * The KeywordChip popovers are portalled to document.body at z-index 60 —
 * above this overlay (35) — so they stay visible and dismiss via their own
 * document listeners; Escape with a popover open closes popover and panel
 * together, which is the "back out" intent either way.
 */

/** Focusables inside the dialog — the trap's ring. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export interface InspectPanelProps {
  /** The LIVE creature being inspected (re-renders while open). */
  creature: CreatureState;
  /** The immutable card definition the creature was summoned from. */
  def: CardSpec;
  onClose: () => void;
}

export default function InspectPanel({ creature, def, onClose }: InspectPanelProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // A ref so the document listeners never re-subscribe when Match re-renders
  // (a live stat change while the panel is open must not steal focus).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // Initial focus: the Close button (neutral — nothing auto-opens).
    closeRef.current?.focus();

    function focusables(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      const list = focusables();
      if (!root || list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && root.contains(active);
      // Wrap at both ends; if focus has escaped the dialog entirely, pull it
      // back in from the nearest edge.
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to the board slot that opened the panel. Creature ids
      // are `${cardId}-N` (effects.ts nextCreatureId) — selector-safe.
      const slot = document.querySelector(`[data-creature-id="${creature.id}"]`);
      if (slot instanceof HTMLElement) slot.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creature.id]);

  const statuses: string[] = [];
  if (creature.exhausted) statuses.push('Exhausted');
  if (creature.frozen) statuses.push('Frozen');
  if (creature.shields > 0) statuses.push(`Shield ${creature.shields}`);

  return (
    <div className="inspect-overlay">
      <div className="inspect-veil" aria-hidden="true" onClick={onClose} />
      <div
        className="inspect-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={def.name}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="inspect-head">
          <h2 className="inspect-title">{def.name}</h2>
          <button type="button" className="inspect-close" ref={closeRef} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="inspect-plate">
          <CardView
            card={def}
            size="preview"
            stats={{ attack: creature.attack, reflect: creature.reflect, health: creature.health }}
            keywords={creature.keywords}
            silenced={creature.silenced}
            status={{ exhausted: creature.exhausted, frozen: creature.frozen, shields: creature.shields }}
          />
        </div>
        {statuses.length > 0 && <p className="inspect-status">{statuses.join(' · ')}</p>}
      </div>
    </div>
  );
}
