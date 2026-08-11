import type { ReactElement } from 'react';
import './statmark.css';

/**
 * StatMark (Task 4, reflect plan): one cell of the card's three-cell stat
 * rail — an authored inline `currentColor` SVG glyph beside its numeral, in
 * a horizontal inline-flex row. The card prints no stat words: the glyph is
 * the meaning, and the accessible label on the OUTER mark names it in the
 * accessibility tree ("Attack 4", never a bare 4).
 *
 * The glyph is exposed as role="img" named by aria-label; the numeral inside
 * is presentational (ARIA makes role="img" descendants unexposed), so a
 * screen reader hears "Attack 4" once, never "4" floating next to it.
 *
 * Icon-source contract (asserted in statMark.test.ts): exactly three
 * authored <svg>/<path> pairs, no emoji code points, no icon package, no
 * remote asset, and the returning-arrow mark is deliberately NOT a shield
 * silhouette. Colors come from the plan's muted tokens (theme.css):
 * --stat-attack aliases the canonical damage gules; --stat-reflect and
 * --stat-health are a muted azure and a muted green, distinct from every
 * house field.
 */

export type StatKind = 'attack' | 'reflect' | 'health';

export interface StatMarkProps {
  kind: StatKind;
  value: number;
}

const STAT_LABEL: Record<StatKind, string> = {
  attack: 'Attack',
  reflect: 'Reflect',
  health: 'Health',
};

/**
 * Authored flat charges, drawn as plain currentColor paths in a 24x24 box —
 * three distinct silhouettes so color is never the only cue. Attack and
 * Reflect are open strokes (a blade, a returning arc); Health is a filled
 * heart. No emoji, no glyph codepoints, no icon font.
 */
const STAT_ICON: Record<StatKind, ReactElement> = {
  // A longsword, point up — the attack glyph in muted gules.
  attack: (
    <path
      d="M9.5 17.5 21 6 16 3M3 15 9 21 16 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // A returning arrow — a counter-clockwise sweep with a head, the damage
  // that comes back at the attacker. An OPEN arc, never a closed plate.
  reflect: (
    <path
      d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // A heart silhouette — the health glyph in muted green.
  health: (
    <path
      d="M12 20.5C7.6 16.4 3.5 13.1 3.5 9.1 3.5 6.5 5.5 4.6 7.9 4.6c1.8 0 3.2 1 4.1 2.4.9-1.4 2.3-2.4 4.1-2.4 2.4 0 4.4 1.9 4.4 4.5 0 4-4.1 7.3-8.5 11.4Z"
      fill="currentColor"
    />
  ),
};

export default function StatMark({ kind, value }: StatMarkProps) {
  return (
    <span
      className={`card__stat card__stat--${kind}`}
      role="img"
      aria-label={`${STAT_LABEL[kind]} ${value}`}
    >
      <svg
        className="statmark-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {STAT_ICON[kind]}
      </svg>
      <span className="card__stat-value">{value}</span>
    </span>
  );
}
