// @ashen/core public surface — matches package.json "main": "src/index.ts".
// Storage/forge-facing exports; bot internals intentionally not re-exported.

export type * from './types.js';

export { validateCard, validateDeck, type ValidationIssue } from './validate.js';

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
export { Game, type MatchSetup } from './engine/game.js';
export { serializeState, deserializeState } from './engine/serialize.js';
