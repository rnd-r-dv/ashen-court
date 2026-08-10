export type PlayerIndex = 0 | 1;

/** The Coin: player 1's one-shot 0-cost "Gain 1 Mana" spell, dealt to hand at
 *  setup and gated to a single use by PlayerState.surged (see Game). */
export const MANA_SURGE = 'mana-surge';

/** Hard turn limit (Task 22, Phase 3 amendment): a match still running at
 *  MAX_TURNS ends in a gameOver draw ('turn limit'). checkWin (engine/game.ts)
 *  emits the draw once state.turn reaches this bound, so every submission
 *  path (submit/applyEvent) is covered and bot mirrors can never stall.
 *  Placed here (types.ts) alongside the other game-rule constants so tests
 *  and the app import it without engine internals. */
export const MAX_TURNS = 200;
export type CardType = 'creature' | 'spell' | 'artifact';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Keyword = 'taunt' | 'rush' | 'charge' | 'windfury' | 'lifesteal' | 'ward' | 'shield' | 'venom' | 'stealth';
export type Trigger = 'battlecry' | 'deathrattle' | 'startOfTurn' | 'endOfTurn' | 'onDamage';
export type EffectKind = 'dealDamage' | 'draw' | 'heal' | 'buff' | 'summon' | 'gainMana' | 'refillMana' | 'freeze' | 'destroy' | 'consume' | 'silence' | 'returnToHand' | 'copyCard' | 'giveKeyword' | 'discountMostExpensive' | 'discountNextSpell' | 'spellPower' | 'overload' | 'discover';
export type EffectTarget = 'any' | 'hero' | 'anyCreature' | 'enemyCreature' | 'friendlyCreature' | 'friendlyDragon' | 'allEnemies' | 'allEnemyCreatures' | 'allFriendlyCreatures' | 'randomEnemy' | 'randomEnemyCreature' | 'self';

export interface EffectSpec { kind: EffectKind; value?: number; value2?: number; value3?: number; target?: EffectTarget; keyword?: Keyword; cardId?: string; }
// value optional: summon (default 1 token) / giveKeyword / copyCard / discount kinds carry no value.
// For `buff` the three numeric slots are the independent stat deltas (Task 1): value = Attack,
// value2 = Health (retained as-is for serialized compatibility), value3 = Reflect. Each defaults
// to 0 unless noted; value2 historically defaults to value (see cardtext/effects).

export interface ArtRecipe { preset: string; palette: string[]; glyph?: string; seed: number; imageUrl?: string; }
// imageUrl (custom uploads) overrides the procedural layers; it rides along in Card serialization
// so it persists through localStorage (Task 23) and LAN custom-card sync (Task 33) for free.

export interface TriggerSpec { when: Trigger; effects: EffectSpec[]; }

export interface Card {
  id: string; name: string; type: CardType; cost: number;
  attack?: number; health?: number; reflect?: number;
  keywords: Keyword[]; triggers?: TriggerSpec[]; effects: EffectSpec[];  // effects = spells-only; triggers = creatures/artifacts
  rarity: Rarity; archetype: string; art: ArtRecipe; flavor?: string;
  author: 'curated' | 'custom'; version: number;
  /** Reflect-schema stamp (Task 1): 2 = authored with the Reflect contract
   *  (creature carry `reflect`). Deliberately DISTINCT from `version`, which
   *  Forge writes as a Date.now() card revision value. Absent/1 = legacy
   *  schema; custom-card migration lives in Task 3. */
  schemaVersion?: 1 | 2;
}

export interface HeroSpec { name: string; power: HeroPower; }
export interface HeroPower { name: string; cost: number; effects: EffectSpec[]; }

export interface CreatureState {
  id: string; cardId: string; owner: PlayerIndex;
  attack: number; health: number; maxHealth: number;
  /** Defensive counter-damage stat (Task 1): the damage this creature deals
   *  back when attacked, captured simultaneously with the attacker's Attack.
   *  Mirrors attack/health as a live, buffable number. Legacy states saved
   *  before this field existed deserialize with it undefined; combat treats
   *  that as 0 (never undefined counter-damage). */
  reflect: number;
  keywords: Keyword[]; exhausted: boolean; attacksLeft: number;
  shields: number; warded: boolean; frozen: boolean;
  /** Set by the `silence` effect. Keywords are emptied on application; this
   *  flag additionally suppresses the card def's triggers, which live on the
   *  CARD not the creature and so cannot be removed by clearing an array. */
  silenced: boolean;
  /** True for creatures summoned by an effect from a `token` archetype card.
   *  Tokens occupy a SEPARATE row with its own cap (TOKEN_CAP) so a big
   *  swarm card is not silently truncated by the creature cap. Serialization
   *  is a plain JSON round-trip, so a state saved before this field existed
   *  deserializes with `token` undefined, which is correctly falsy. */
  token: boolean;
  /** Added to the controller's SPELL damage while this creature is on board. */
  spellPower: number;
}
export interface ArtifactState { id: string; cardId: string; owner: PlayerIndex; }
export interface HeroState {
  name: string; hp: number; maxHp: number; shields: number;
  power: HeroPower; usedPower: boolean;
  discountMostExpensive: number; discountNextSpell: number;
}
export interface PlayerState {
  hero: HeroState; deck: string[]; hand: string[]; board: CreatureState[]; artifacts: ArtifactState[];
  mana: number; maxMana: number; surged: boolean;
  /** Mana locked at the start of this player's NEXT turn, then cleared. */
  overload: number;
  /** Mana visibly locked THIS turn (Task 6): assigned at beginTurn from the
   *  player's overload, kept after mana is spent, cleared at turnEnd. The
   *  overload amount is "waiting for next turn"; lockedMana is the same
   *  amount once it has been spent — presentation state the tray ledger
   *  reads. Plain JSON serialization carries both. */
  lockedMana: number;
}
export type Phase = 'mulligan' | 'main' | 'gameOver';

/** An interrupting decision pending on a player (Task 1): the first intent
 *  state that is not owned by the current turn. `cardIds` are the seeded
 *  candidates; the owner resolves by index through the `discover` intent.
 *  `pendingChoice` exposes the ACTIVE choice to legality/UI; overlapping
 *  offers queue FIFO in `pendingChoiceQueue` and rotate on resolution. */
export interface PendingChoice {
  kind: 'discover';
  player: PlayerIndex;
  cardIds: string[];
}

export interface MatchStats { turns: number; damageDealt: [number, number]; cardsPlayed: [number, number]; }
// MatchStats lives here (types.ts) so app/src/types.ts (Task 28) can import it; Task 35's stats.ts only implements summarize().
export interface GameState {
  players: [PlayerState, PlayerState];
  turn: number;                 // 0-based; current player = turn % 2
  phase: Phase; seed: number;
  mulligansDone: boolean[];     // per-player mulligan progress (survives serialize/deserialize, Task 12)
  rngState: { seed: number; calls: number };   // deterministic RNG position (serialization/replay)
  log: GameEvent[];
  /** Active interrupting choice (only state legality/UI reads; serialized as
   *  ordinary GameState and cloned with the search state). */
  pendingChoice: PendingChoice | null;
  /** Later offers waiting in deterministic FIFO order behind pendingChoice. */
  pendingChoiceQueue: PendingChoice[];
}

export type TargetRef = { type: 'hero'; player: PlayerIndex } | { type: 'creature'; id: string };
export type Intent =
  | { kind: 'mulligan'; keep: number[] }
  | { kind: 'playCard'; handIndex: number; target?: TargetRef }
  | { kind: 'attack'; attackerId: string; target: TargetRef }
  | { kind: 'heroPower'; target?: TargetRef }
  | { kind: 'endTurn' }
  | { kind: 'discover'; choice: number };

export type GameEvent =
  | { type: 'turnStart'; player: PlayerIndex; mana: number }
  | { type: 'cardDrawn'; player: PlayerIndex; cardId: string }
  | { type: 'manaChanged'; player: PlayerIndex; mana: number; maxMana: number }
  | { type: 'cardPlayed'; player: PlayerIndex; cardId: string; creatureId?: string; target?: TargetRef }
  | { type: 'combatStarted'; attackerId: string; defenderId: string }
  | { type: 'creatureSummoned'; player: PlayerIndex; creatureId: string; cardId: string }
  | { type: 'damageDealt'; target: TargetRef; amount: number; sourceCardId: string }
  | { type: 'creatureDied'; player: PlayerIndex; creatureId: string; cardId: string }
  | { type: 'creatureReturned'; player: PlayerIndex; creatureId: string; cardId: string }
  | { type: 'heroDamaged'; player: PlayerIndex; amount: number; hp: number }
  | { type: 'heroHealed'; player: PlayerIndex; amount: number; hp: number }
  | { type: 'buffApplied'; creatureId: string; attack: number; health: number }
  | { type: 'cardDrawnExtra'; player: PlayerIndex; cardId: string }   // effect draws (visual distinction)
  | { type: 'tokenSummoned'; player: PlayerIndex; cardId: string; creatureId: string }
  | { type: 'effectResolved'; player: PlayerIndex; sourceCardId: string; kind: EffectKind }
  | { type: 'discoverOffered'; choice: PendingChoice }
  | { type: 'discoverResolved'; player: PlayerIndex; cardId: string }
  | { type: 'spellFizzled'; player: PlayerIndex; cardId: string; creatureId?: string } // ward
  | { type: 'heroPowerUsed'; player: PlayerIndex }
  | { type: 'frozen'; creatureId: string }
  | { type: 'thawed'; creatureId: string }
  | { type: 'turnEnd'; player: PlayerIndex }
  | { type: 'gameOver'; winner: PlayerIndex | 'draw'; reason: string };
