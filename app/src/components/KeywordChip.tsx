import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Keyword } from '@ashen/core';
import { KEYWORD_TEXT } from '@ashen/core';
import './keywordchip.css';

/**
 * A keyword and, on click, what it means.
 *
 * The text comes from KEYWORD_TEXT in core — the same generated source the
 * engine documents itself with — so a chip can never describe a rule the
 * engine does not implement.
 *
 * CLICK, not hover. app/PRODUCT.md records the hero power's `title` tooltip
 * as a known weakness that must not be extended; hover also cannot be reached
 * on a board creature, which renders at zoom 0.5.
 *
 * The popover is PORTALLED to document.body. The chip lives inside
 * `.card__body`, which is `overflow: hidden` inside a fixed 240x336 box, so an
 * in-flow popover would be clipped by its own parent. Fixed positioning from
 * the chip's client rect escapes that, and because `zoom` scales the layout
 * box, getBoundingClientRect already reports the on-screen position at any
 * card size.
 */

export interface KeywordChipProps {
  keyword: Keyword;
  /** Visual scale. 'card' is the in-frame chip; 'picker' is the larger Forge
   *  selection chip, which also carries a selected state. */
  variant?: 'card' | 'picker';
  /** Picker only: whether this keyword is currently chosen. */
  selected?: boolean;
  /** Picker only: fired on the SELECT affordance, not the describe one. */
  onToggle?: () => void;
}

export default function KeywordChip({
  keyword,
  variant = 'card',
  selected = false,
  onToggle,
}: KeywordChipProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // On the WRAPPER, not the chip button. In the picker the describe control is
  // the sibling `?` button, so a ref on the chip alone would treat a click on
  // `?` as an outside click and close the popover the same click just opened.
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Two controls in the picker (select + describe), one on a card (describe).
  const isPicker = onToggle !== undefined;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    // Any click that is not on this chip dismisses it. Capture phase so it
    // runs before a card's own handler can act on the same click.
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick, true);
    // The card fan scrolls and the board reflows; a stale fixed popover would
    // detach from its chip, so close rather than chase it.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  function describe(e: ReactMouseEvent<HTMLButtonElement>) {
    // A board creature is clickable for attack targeting and a hand card is
    // clickable to play. Describing a keyword must do neither.
    e.stopPropagation();
    e.preventDefault();
    const next = !open;
    if (next) setRect(e.currentTarget.getBoundingClientRect());
    setOpen(next);
  }

  function toggle(e: ReactMouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    onToggle?.();
  }

  const classes = [
    'kwchip',
    `kwchip--${variant}`,
    selected ? 'kwchip--selected' : '',
    open ? 'kwchip--open' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className="kwchip-wrap" ref={wrapRef}>
      {/* In the picker the chip has TWO jobs — choose the keyword, and explain
          it — so they get two separate controls. On a card there is only one.

          The two jobs need different semantics, not just different handlers.
          In the picker this button is a toggle, so it announces `aria-pressed`;
          `aria-expanded` there would claim it controls the popover, which the
          sibling `?` owns. On a card the button IS the describe control, so it
          announces `aria-expanded` and says so in its label. */}
      <button
        type="button"
        className={classes}
        {...(isPicker
          ? { 'aria-pressed': selected, 'aria-label': keyword }
          : { 'aria-expanded': open, 'aria-label': `${keyword} — what does this do?` })}
        onClick={isPicker ? toggle : describe}
      >
        {keyword}
      </button>
      {isPicker && (
        <button
          type="button"
          className="kwchip__help"
          aria-expanded={open}
          aria-label={`What does ${keyword} do?`}
          onClick={describe}
        >
          ?
        </button>
      )}
      {open && rect && createPortal(
        <div
          className="kwpop"
          role="dialog"
          aria-label={keyword}
          style={{ top: rect.bottom + 6, left: rect.left + rect.width / 2 }}
        >
          <span className="kwpop__name">{keyword}</span>
          <span className="kwpop__text">{KEYWORD_TEXT[keyword]}</span>
        </div>,
        document.body,
      )}
    </span>
  );
}
