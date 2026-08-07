// scripts/art/coverage.ts
import type { Rarity } from '@ashen/core';

/**
 * How much of the pool gets generated art. 'epic+' is the designated fallback
 * if the smoke batch reports a per-image cost that makes the full pool
 * unattractive: 78 images against 297, and epics and legendaries are the cards
 * a player stops to look at.
 */
export type Coverage = 'all' | 'rare+' | 'epic+';

export const COVERAGES: readonly Coverage[] = ['all', 'rare+', 'epic+'];

/** Ascending rarity order — index comparison drives the threshold. */
const ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const FLOOR: Record<Coverage, Rarity> = {
  'all': 'common',
  'rare+': 'rare',
  'epic+': 'epic',
};

export function inCoverage(rarity: Rarity, coverage: Coverage): boolean {
  return ORDER.indexOf(rarity) >= ORDER.indexOf(FLOOR[coverage]);
}

/** Throws on anything unrecognised. Defaulting a typo to 'all' would spend
 *  roughly $12 by accident, so this fails loudly by design. */
export function parseCoverage(raw: string): Coverage {
  if ((COVERAGES as readonly string[]).includes(raw)) return raw as Coverage;
  throw new Error(`Unknown --coverage "${raw}". Expected one of: ${COVERAGES.join(', ')}`);
}
