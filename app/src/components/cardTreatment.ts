// app/src/components/cardTreatment.ts
import type { Rarity } from '@ashen/core';

/**
 * Which of the card's two layouts a card gets. Derived, never authored.
 *
 *   banded — portrait card, landscape art panel on top, text below (default)
 *   bleed  — art fills the box, text on gradient scrims (epic+ WITH art)
 *
 * Both conditions are required for 'bleed'. Full-bleed puts rules text over
 * illustration, so it must never be applied to a card whose art is the
 * procedural SVG: a two-stop gradient behind scrim text reads as broken
 * rather than premium.
 *
 * This deliberately mirrors the 'epic+' coverage mode in the art pipeline —
 * the cards that get full-bleed are exactly the cards that get generated art
 * first if cost forces the pool to be cut.
 */
export type Treatment = 'banded' | 'bleed';

export function treatmentFor(rarity: Rarity, hasGeneratedArt: boolean): Treatment {
  if (!hasGeneratedArt) return 'banded';
  return rarity === 'epic' || rarity === 'legendary' ? 'bleed' : 'banded';
}
