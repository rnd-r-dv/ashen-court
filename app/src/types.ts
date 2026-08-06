// App shell types (Task 28) — the state-machine router union and the match
// entry types. Declared verbatim from the plan. Core imports use the workspace
// package '@ashen/core' (the plan's '@tcg/core' is a typo).
//
// MatchStats is NOT redeclared here — it lives in core types.ts and Task 35's
// stats.ts implements summarize() against it.
import type { Game, GameEvent, Intent, MatchSetup, MatchStats, PlayerIndex } from '@ashen/core';

export type Screen =
  | { name: 'menu' }
  | { name: 'modeSelect' }
  | { name: 'deckPick'; mode: Mode; difficulty?: BotLevel }
  | { name: 'deckBuilder' }
  | { name: 'forge' }
  | { name: 'match'; setup: MatchScreenSetup }
  | { name: 'victory'; result: MatchResult }
  | { name: 'lanHost' }
  | { name: 'lanJoin' };

export type Mode = 'bot' | 'hotseat' | 'lanHost' | 'lanJoin';

/** Bot difficulty tiers. Core's bot module does not export this yet — declared here. */
export type BotLevel = 'recruit' | 'veteran' | 'grandmaster';

export type MatchResult = { winner: PlayerIndex | 'draw'; stats: MatchStats };

/** MatchDriver abstraction (declared ONCE here; Task 30 implements it via createLocalDriver/createLanDriver). */
export interface MatchDriver {
  submit(intent: Intent): Promise<GameEvent[]>;
  onEvents(cb: (events: GameEvent[]) => void): void;
  game(): Game;
  reset(setup: MatchSetup): void; // rematch (Task 35)
}

export interface MatchScreenSetup {
  driver: MatchDriver;
  myPlayer: PlayerIndex;
}
