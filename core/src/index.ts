// @ashen/core public surface — matches package.json "main": "src/index.ts".
// Storage/forge-facing exports plus the bot surface (Task 30: the app's match
// flow needs createBot/mulliganPolicy to auto-play bot opponents). Engine
// internals (effects/events/intents/keywords) stay module-private.

export type * from './types.js';

export { validateCard, validateDeck, RARITY_COPY_LIMIT, type ValidationIssue } from './validate.js';

export { cardText, heroPowerText, effectText } from './cardtext.js';

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
export { createBot, mulliganPolicy, type BotPolicy, type BotLevel } from './bot/index.js';
export { Game, type MatchSetup } from './engine/game.js';
export { summarize } from './engine/stats.js';
export { serializeState, deserializeState } from './engine/serialize.js';
