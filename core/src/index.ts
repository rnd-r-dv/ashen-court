// @ashen/core public surface — matches package.json "main": "src/index.ts".
// Storage/forge-facing exports plus the bot surface (Task 30: the app's match
// flow needs createBot/mulliganPolicy to auto-play bot opponents). Engine
// internals (effects/events/intents/keywords) stay module-private.

export type * from './types.js';

// KEYWORD_COST is exported because the Forge implements the same card-authoring
// contract validate.ts enforces: it needs the keyword SET as data rather than
// as a hand-copied literal, and a keyword's cost is part of that contract.
export { validateCard, validateDeck, RARITY_COPY_LIMIT, KEYWORD_COST, type ValidationIssue } from './validate.js';

export { cardText, heroPowerText, effectText, KEYWORD_TEXT } from './cardtext.js';

export {
  buildPool,
  DECK_DEFS,
  HEROES,
  expandDeck,
  TOKEN_CARDS,
  MANA_SURGE_CARD,
  type ArchetypeId,
  type DeckDef,
} from './data/index.js';

export { CardRegistry } from './cards.js';

/** Board capacity (engine/effects.ts). Exported because the UI draws exactly
 *  this many creature slots — hardcoding 7 in the app would let the outline
 *  and the rule drift apart. TOKEN_CAP is the separate token row's capacity
 *  (Task 3); the app's Board rendering reads `creature.token` to pick a row.
 *  No other engine internal is exported. */
export { BOARD_CAP, TOKEN_CAP } from './engine/effects.js';
export { createBot, mulliganPolicy, type BotPolicy, type BotLevel } from './bot/index.js';
export { Game, type MatchSetup } from './engine/game.js';
export { summarize } from './engine/stats.js';
export { serializeState, deserializeState } from './engine/serialize.js';
