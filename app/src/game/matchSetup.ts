// Match entry builder (Task 31): turns a completed deck pick (App's pending
// state) into a real MatchScreenSetup + core MatchSetup. Pure module (no
// React) so the deck→setup mapping is unit-testable. Bot mode: the human is
// player 0 and the opponent is a random-curated-deck bot. Hotseat: both
// picks are players (v1 wires player 0; Task 32 adds the pass flow).
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck } from '@ashen/core';
import type { ArchetypeId, HeroSpec, MatchSetup } from '@ashen/core';
import type { BotLevel, MatchScreenSetup } from '../types.js';
import { createLocalDriver } from './drivers.js';
import { deckKey, loadCustomCards, loadDecks } from '../storage.js';

// Custom-deck slugs flowing through DeckPick → buildMatchEntry are already
// namespaced ('custom:<slug>', audit 05 I4), so a custom deck can never
// resolve to a curated archetype even when its display slug collides.
const CUSTOM_DECK_PREFIX = 'custom:';

export interface MatchPick {
  slug: string;
  name: string;
}

export interface MatchEntryRequest {
  mode: 'bot' | 'hotseat';
  difficulty?: BotLevel;
  decks: MatchPick[]; // pick order: player 0 first
}

/** The built match entry: the driver/setup the Match screen consumes plus
 *  the core MatchSetup the driver resets on rematch. */
export interface MatchEntry {
  setup: MatchScreenSetup;
  core: MatchSetup;
}

const CURATED_ORDER = Object.keys(DECK_DEFS) as ArchetypeId[];

export function freshSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** Deck card ids for a picked slug: curated archetype → its definition,
 *  otherwise a saved custom-deck overlay (deck builder storage). Custom
 *  overlays are namespaced ('custom:<slug>') so the DECK_DEFS-first lookup
 *  can never shadow a custom deck named like a curated archetype (I4). */
export function deckCardIds(slug: string): string[] {
  if ((DECK_DEFS as Record<string, unknown>)[slug]) return expandDeck(DECK_DEFS[slug as ArchetypeId]);
  if (slug.startsWith(CUSTOM_DECK_PREFIX)) return loadDecks()[slug] ?? [];
  // Belt-and-braces for non-namespaced callers: resolve via the namespaced key.
  return loadDecks()[deckKey(slug)] ?? [];
}

/** Hero for a picked slug: the archetype's hero; custom decks default to the
 *  first curated hero (custom decks carry no hero, v1 fallback). */
export function heroFor(slug: string): HeroSpec {
  const idx = CURATED_ORDER.indexOf(slug as ArchetypeId);
  return idx >= 0 ? HEROES[idx]! : HEROES[0]!;
}

/** Bot opponent deck: a random curated archetype. */
export function randomBotPick(): MatchPick {
  const slug = CURATED_ORDER[Math.floor(Math.random() * CURATED_ORDER.length)]!;
  return { slug, name: 'Bot deck' };
}

export function buildMatchEntry(pending: MatchEntryRequest): MatchEntry {
  const registry = new CardRegistry([...buildPool(), ...loadCustomCards()]);
  const p0 = pending.decks[0]!;
  const p1 = pending.mode === 'bot' ? randomBotPick() : pending.decks[1]!;
  const core: MatchSetup = {
    decks: [deckCardIds(p0.slug), deckCardIds(p1.slug)],
    heroes: [heroFor(p0.slug), heroFor(p1.slug)],
    seed: freshSeed(),
  };
  const driver = createLocalDriver(new Game(core, registry));
  const setup: MatchScreenSetup = {
    driver,
    myPlayer: 0,
    mode: pending.mode,
    ...(pending.mode === 'bot' ? { bot: { level: pending.difficulty ?? 'recruit' } } : {}),
  };
  return { setup, core };
}

/** Rematch setup: same decks/heroes, fresh seed (deterministic shuffle → new game). */
export function rematchSetup(entry: MatchEntry): MatchSetup {
  return { ...entry.core, seed: freshSeed() };
}
