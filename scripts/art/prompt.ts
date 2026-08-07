// scripts/art/prompt.ts
import type { Rarity } from '@ashen/core';
import { SUBJECT_OVERRIDES } from './overrides.js';
import { GLOBAL_SUFFIX, styleFor } from './styles.js';

/**
 * Three-layer prompt composition (design spec section 3.3):
 *   1. archetype style block   — the deck's look
 *   2. subject                 — `${name}. ${flavor}`, or an override
 *   3. global suffix           — house style + text suppression
 *
 * Pure by design: no fs, no network. Prompt wording is the part most likely to
 * need iteration, and iterating it must cost nothing.
 */

export type AspectRatio = '3:4' | '3:2' | '1:1';

export interface PromptInput {
  id: string;
  name: string;
  flavor?: string;
  archetype: string;
  rarity: Rarity;
}

export interface BuiltPrompt {
  prompt: string;
  aspectRatio: AspectRatio;
}

/**
 * Derived from rarity, never operator-set. Epic and legendary get the
 * full-bleed card treatment, which needs art shaped like the whole portrait
 * card; everything else fills the landscape panel of the banded layout.
 * Letting these two decisions drift apart would crop every affected card.
 */
export function aspectForRarity(rarity: Rarity): AspectRatio {
  return rarity === 'epic' || rarity === 'legendary' ? '3:4' : '3:2';
}

/** Layer 2. All 285 curated cards carry flavor, so the fallback is defensive. */
function subjectFor(card: PromptInput): string {
  const override = SUBJECT_OVERRIDES[card.id];
  if (override) return override;
  return card.flavor ? `${card.name}. ${card.flavor}` : card.name;
}

export function buildCardPrompt(card: PromptInput): BuiltPrompt {
  return {
    prompt: [styleFor(card.archetype), subjectFor(card), GLOBAL_SUFFIX].join('. '),
    aspectRatio: aspectForRarity(card.rarity),
  };
}

/**
 * Heroes render inside a 92px circle (heroportrait.css), so they are always
 * square and always framed as a bust — a full-figure composition would lose
 * its subject to the circular mask.
 */
export function buildHeroPrompt(heroName: string, archetype: string): BuiltPrompt {
  const subject = `${heroName}, portrait bust, head and shoulders, facing the viewer`;
  return {
    prompt: [styleFor(archetype), subject, GLOBAL_SUFFIX].join('. '),
    aspectRatio: '1:1',
  };
}
