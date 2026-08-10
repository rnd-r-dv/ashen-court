import type { CardRegistry } from '../cards.js';
import type { Card, CreatureState, EffectSpec, EffectTarget, GameEvent, Keyword, PlayerIndex, TargetRef } from '../types.js';
import { runQueue } from './events.js';
import type { Resolver } from './events.js';

/**
 * Effect-resolution library.
 *
 * Every EffectKind (dealDamage, draw, heal, buff, summon, gainMana,
 * refillMana, freeze, destroy, copyCard, giveKeyword, discountMostExpensive,
 * discountNextSpell) applies its state mutation and dispatches concrete
 * events through the resolver's queue so runQueue applies them.
 *
 * Event policy (Task 6): effects mutate state inline and push the events the
 * brief specifies for the log. The pushed event types whose real resolution
 * belongs to later tasks (death/removal, onDamage, trigger wiring — Task 8+,
 * spell casting — Task 9) are accepted by no-op dispatch handlers in Game;
 * the mutations are already applied inline here so tests observe final state
 * immediately after applyEffect returns.
 */

export interface EffectCtx {
  player: PlayerIndex;
  cardId: string;
  /** Source creature id (lifesteal source, e.g. an attacking creature). */
  creatureId?: string;
}

export const BOARD_CAP = 7;
/** Tokens fill their own row. Same size as the creature cap so a full board
 *  of both reads symmetrically on screen. */
export const TOKEN_CAP = 7;
const MAX_MANA = 15;

/** Targets that resolve to one ref (caller supplies an explicit ref via the
 *  legal-intent enumeration; fallback = resolveTargets()[0]). Exported so
 *  play-card validation/resolution (intents.ts, game.ts) share the set.
 *  Task 9. */
export const SINGLE_TARGET_TARGETS: ReadonlySet<EffectTarget> = new Set([
  'any', 'hero', 'self', 'anyCreature', 'enemyCreature', 'friendlyCreature', 'friendlyDragon',
]);
/**
 * True for the single-target kinds that take a PLAYER-CHOSEN ref: the
 * single-target set minus hero/self, which auto-resolve to the caster's own
 * hero (Task 6 ruling) and therefore must never receive the chosen ref.
 *
 * Every place that decides "does this spec get the intent's target?" routes
 * through here — spell resolution, hero powers, battlecry/trigger firing
 * (game.ts), validation and legal-intent enumeration (intents.ts). The three
 * resolution paths each carried their own copy of this predicate and drifted:
 * fireTriggers had none at all, so it passed the chosen ref to EVERY spec in a
 * trigger group and a mixed battlecry like pact-morticia's
 * dmg(3,'self')+dmg(3,'allEnemies') aimed its self-damage at the enemy hero
 * (audit 02). One predicate, one behaviour.
 */
export function isChoiceTarget(target: EffectTarget | undefined): boolean {
  return target !== undefined && SINGLE_TARGET_TARGETS.has(target) && target !== 'hero' && target !== 'self';
}

/** The explicit ref one spec should receive from a chosen intent target:
 *  the ref for choice kinds, undefined for everything that resolves itself. */
export function specTargetRef(spec: EffectSpec, chosen: TargetRef | undefined): TargetRef | undefined {
  return isChoiceTarget(spec.target) ? chosen : undefined;
}

/** Targets that resolve to all legal refs (or a seeded pick for random kinds)
 *  and are therefore resolved internally by the effect. */
const MULTI_TARGET_TARGETS: ReadonlySet<EffectTarget> = new Set([
  'allEnemies', 'allEnemyCreatures', 'allFriendlyCreatures', 'randomEnemy', 'randomEnemyCreature',
]);

/**
 * Apply one effect. Single-target kinds with a single-target `spec.target`
 * and no explicit ref resolve via resolveTargets and pick [0] (legal-intent
 * enumeration always supplies explicit refs for single-target effects);
 * multi-target kinds resolve internally. Drains the resolver queue before
 * returning so mana events land.
 *
 * Session policy (Task 11): when called OUTSIDE a resolution session (direct
 * effects-library calls, e.g. unit tests), the call runs as a mini-session so
 * the deferred win check still fires. When called inside a submit/applyEvent
 * session the outer session owns the check — a per-effect check would break
 * simultaneous-death draws (the first death would end the game early).
 */
export function applyEffect(game: Resolver, ctx: EffectCtx, spec: EffectSpec, explicitRef?: TargetRef): void {
  if (!game.draining) {
    game.applied = [];
    game.draining = true;
    try {
      applyEffectInner(game, ctx, spec, explicitRef);
      game.checkWin();
      runQueue(game);
    } finally {
      game.draining = false;
    }
    return;
  }
  applyEffectInner(game, ctx, spec, explicitRef);
}

function applyEffectInner(game: Resolver, ctx: EffectCtx, spec: EffectSpec, explicitRef?: TargetRef): void {
  const refs = resolveRefs(game, ctx.player, spec, explicitRef);
  switch (spec.kind) {
    case 'dealDamage': {
      const bonus = ctx.creatureId ? 0 : spellPowerOf(game, ctx.player);
      const amount = (spec.value ?? 0) + bonus;
      if (amount > 0) {
        let dealt = 0;
        for (const ref of refs) dealt += damageTarget(game, ctx, ref, amount);
        // lifesteal: source creature heals the controller for damage dealt
        if (dealt > 0 && hasLifesteal(game, ctx)) healHero(game, ctx.player, dealt);
      }
      break;
    }
    case 'draw': {
      const p = game.state.players[ctx.player];
      const n = spec.value ?? 0;
      for (let i = 0; i < n; i++) {
        if (p.deck.length === 0) break;   // empty deck: nothing drawn, no fatigue yet
        const cardId = p.deck.pop()!;
        p.hand.push(cardId);
        push(game, { type: 'cardDrawnExtra', player: ctx.player, cardId });
      }
      break;
    }
    case 'heal': {
      const amount = spec.value ?? 0;
      for (const ref of refs) healRef(game, ref, amount);
      break;
    }
    case 'buff': {
      const atk = spec.value ?? 0;
      const hp = spec.value2 ?? atk;
      const refl = spec.value3 ?? 0;
      for (const ref of refs) buffRef(game, ref, atk, hp, refl);
      break;
    }
    case 'summon':
      summonTokens(game, ctx, spec);
      break;
    // The two mana kinds are DISTINCT and are deliberately not folded into one
    // case (audit 02: they shared a `maxMana + v` line, so refillMana handed
    // out permanent crystals as well as the mana — a 4-crystal ramp on
    // pact-bargain, and a permanent head start on the Coin). cardtext.ts is the
    // spec here, and it is the side that was right:
    //   gainMana   → "Gain N empty mana crystals." — maxMana grows, mana unchanged
    //   refillMana → "Gain N Mana."                — mana grows, maxMana unchanged
    // manaChanged is a real dispatch handler; it applies both values, so each
    // branch must restate the field it is NOT changing.
    case 'gainMana': {
      const p = game.state.players[ctx.player];
      const maxMana = Math.min(MAX_MANA, p.maxMana + (spec.value ?? 0));
      push(game, { type: 'manaChanged', player: ctx.player, mana: p.mana, maxMana });
      break;
    }
    case 'refillMana': {
      const p = game.state.players[ctx.player];
      // Capped at MAX_MANA, NOT at maxMana: a refill may leave the player above
      // their crystal count for the rest of the turn. That surplus is the whole
      // point of the Coin (MANA_SURGE) — a player is always at full mana on
      // their own turn, so a maxMana-capped refill would be a guaranteed no-op.
      // beginTurn re-sets mana = maxMana, so the surplus expires with the turn.
      const mana = Math.min(MAX_MANA, p.mana + (spec.value ?? 0));
      push(game, { type: 'manaChanged', player: ctx.player, mana, maxMana: p.maxMana });
      break;
    }
    case 'freeze': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        c.frozen = true;
        push(game, { type: 'frozen', creatureId: c.id });
      }
      break;
    }
    case 'destroy': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        // Removal + deathrattle resolve in dispatch(creatureDied) (Task 8):
        // the creature stays on the board until then so the deathrattle fires
        // before removal, matching the attack/damage path.
        push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
      break;
    }
    case 'consume': {
      const p = game.state.players[ctx.player];
      // Oldest tokens first, so a player's most recent summons survive — the
      // board reads left-to-right and eating the newest looks like a bug.
      const eligible = p.board.filter(c => c.token).slice(0, spec.value ?? 1);
      for (const c of eligible) {
        // A real death: deathrattles on tokens still fire.
        push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
      break;
    }
    case 'silence': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        // Keywords live on the creature (an array we can empty); triggers live
        // on the CARD DEF, shared by every copy, so they must never be mutated
        // — the flag is what Game.fireTriggers checks instead. The mirrored
        // state fields (shields, warded, attacksLeft) must be stripped too:
        // the engine reads those FIELDS, not the keyword array.
        c.keywords.length = 0;
        c.silenced = true;
        // Keywords are mirrored into state fields at creation (shields, warded,
        // attacksLeft) and the engine reads those FIELDS, not the array — so
        // emptying the array alone left a silenced shield/ward minion protected.
        c.shields = 0;
        c.warded = false;
        // Clamp, never set: attacksLeft 1 would refund a swing to a windfury
        // minion that already swung twice (attacksLeft 0). beginTurn recomputes
        // attacksLeft from keywords every turn, so this only governs the turn
        // silence was cast on.
        c.attacksLeft = Math.min(c.attacksLeft, 1);
      }
      break;
    }
    case 'returnToHand': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (!c) continue;
        // NOT a death: no creatureDied, so no deathrattle. Bounce is removal
        // that deliberately leaves the card playable again.
        push(game, { type: 'creatureReturned', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
      break;
    }
    case 'copyCard': {
      const p = game.state.players[ctx.player];
      const id = spec.cardId ?? randomEnemyCreatureCardId(game, ctx.player);
      if (id) p.hand.push(id);
      break;
    }
    case 'giveKeyword': {
      for (const ref of refs) {
        if (ref.type !== 'creature' || !spec.keyword) continue;
        const c = findCreature(game, ref.id);
        if (!c || c.keywords.includes(spec.keyword)) continue;
        c.keywords.push(spec.keyword);
        // Mirrored fields must follow the keyword — the engine reads the fields
        // (shield absorb, ward fizzle, windfury swings), not the array.
        if (spec.keyword === 'shield') c.shields += 1;
        if (spec.keyword === 'ward') c.warded = true;
        if (spec.keyword === 'windfury') c.attacksLeft += 1;  // this turn; beginTurn recomputes
      }
      break;
    }
    case 'discountMostExpensive':
      game.state.players[ctx.player].hero.discountMostExpensive += spec.value ?? 0;
      break;
    case 'discountNextSpell':
      game.state.players[ctx.player].hero.discountNextSpell += spec.value ?? 0;
      break;
    case 'spellPower': {
      for (const ref of refs) {
        if (ref.type !== 'creature') continue;
        const c = findCreature(game, ref.id);
        if (c) c.spellPower += spec.value ?? 0;
      }
      break;
    }
    case 'overload':
      game.state.players[ctx.player].overload += spec.value ?? 0;
      break;
    case 'discover': {
      // Deterministic candidate generation (Task 1): every eligible card in
      // the registry is offered EXCEPT tokens (summoned-only archetype) and
      // the Coin (mana-surge, a setup fixture). Three candidates are selected
      // by removing one seeded pickRandom draw at a time, so the chosen set
      // and the RNG continuation are both byte-identical under the same seed.
      // The eligibility check runs BEFORE any RNG is consumed — a registry
      // too small to offer three cards must fail without advancing the stream.
      const eligible = [...registryOf(game).pool().values()]
        .filter(card => card.archetype !== 'token' && card.id !== 'mana-surge');
      if (eligible.length < 3) throw new Error('Not enough eligible cards to Discover');
      const bag = [...eligible];
      const cardIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const pick = game.pickRandom(bag);
        cardIds.push(pick.id);
        bag.splice(bag.indexOf(pick), 1);
      }
      push(game, { type: 'discoverOffered', choice: { kind: 'discover', player: ctx.player, cardIds } });
      break;
    }
  }
  push(game, { type: 'effectResolved', player: ctx.player, sourceCardId: ctx.cardId, kind: spec.kind });
  runQueue(game);
}

/** Total spell power on a player's board. Applied only when the damage source
 *  is a SPELL — an EffectCtx with no creatureId. A creature's own battlecry
 *  carries creatureId, so a board full of mages never inflates battlecries. */
function spellPowerOf(game: Resolver, player: PlayerIndex): number {
  return game.state.players[player].board.reduce((s, c) => s + c.spellPower, 0);
}

/**
 * Resolve an EffectTarget to concrete refs. Empty = no legal target.
 * Rulings: `hero` and `self` both resolve to the CASTER's own hero; to
 * damage the enemy hero use `allEnemies` (empty enemy board → hero-only).
 */
export function resolveTargets(game: Resolver, player: PlayerIndex, target: EffectTarget): TargetRef[] {
  const enemy = (1 - player) as PlayerIndex;
  const friendly = game.state.players[player].board;
  // The enemy board is pre-filtered by visibleToEnemy so EVERY enemy-facing
  // case (any/anyCreature/enemyCreature/allEnemies/allEnemyCreatures/
  // randomEnemy/randomEnemyCreature) excludes stealthed creatures uniformly —
  // the friendly board is untouched, so buffs/heals still reach them (Task 8).
  const hostile = game.state.players[enemy].board.filter(visibleToEnemy);
  const creatureRefs = (board: readonly CreatureState[]): TargetRef[] =>
    board.map(c => ({ type: 'creature' as const, id: c.id }));

  switch (target) {
    case 'hero':
    case 'self':
      return [{ type: 'hero' as const, player }];
    case 'any':
      return [
        { type: 'hero' as const, player: 0 as PlayerIndex },
        { type: 'hero' as const, player: 1 as PlayerIndex },
        ...creatureRefs(friendly),
        ...creatureRefs(hostile),
      ];
    case 'anyCreature':
      return [...creatureRefs(friendly), ...creatureRefs(hostile)];
    case 'friendlyCreature':
      return creatureRefs(friendly);
    case 'enemyCreature':
      return creatureRefs(hostile);
    case 'friendlyDragon':
      return creatureRefs(friendly.filter(c => isDragon(game, c)));
    case 'allEnemies':
      return [{ type: 'hero' as const, player: enemy }, ...creatureRefs(hostile)];
    case 'allEnemyCreatures':
      return creatureRefs(hostile);
    case 'allFriendlyCreatures':
      return creatureRefs(friendly);
    case 'randomEnemy': {
      const all = [{ type: 'hero' as const, player: enemy }, ...creatureRefs(hostile)];
      return all.length > 0 ? [game.pickRandom(all)] : [];
    }
    case 'randomEnemyCreature': {
      const refs = creatureRefs(hostile);
      return refs.length > 0 ? [game.pickRandom(refs)] : [];
    }
  }
}

/**
 * Apply `amount` damage to one resolved target (used by dealDamage and the
 * Task 7 attack path). Shield absorbs first (shields > 0 → decrement, no
 * damage). Pushes damageDealt; lethal creature damage pushes creatureDied.
 * Hero death is NOT decided here — the win check is deferred to the end of
 * the resolution session (Game.checkWin) so simultaneous deaths produce a
 * draw instead of a first-death-wins race (Task 11).
 * Returns the actual damage dealt (post-shield).
 */
export function damageTarget(game: Resolver, ctx: EffectCtx, ref: TargetRef, amount: number): number {
  if (amount <= 0) return 0;
  if (ref.type === 'creature') {
    const c = findCreature(game, ref.id);
    if (!c) return 0;
    let dmg = amount;
    if (c.shields > 0) { c.shields -= 1; dmg = 0; }
    c.health -= dmg;
    push(game, { type: 'damageDealt', target: ref, amount: dmg, sourceCardId: ctx.cardId });
    if (c.health <= 0) {
      push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
    } else if (dmg > 0 && ctx.creatureId) {
      // venom: a source creature that dealt real damage destroys what it hit,
      // regardless of size. Gated on dmg > 0 so a shield absorb (which emits a
      // 0-amount damageDealt) never kills, matching the onDamage trigger rule.
      const source = findCreature(game, ctx.creatureId);
      if (source && source.keywords.includes('venom')) {
        push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
      }
    }
    return dmg;
  }
  const hero = game.state.players[ref.player].hero;
  let dmg = amount;
  if (hero.shields > 0) { hero.shields -= 1; dmg = 0; }
  hero.hp -= dmg;
  push(game, { type: 'damageDealt', target: ref, amount: dmg, sourceCardId: ctx.cardId });
  // audit 01 I1: hero damage also emits heroDamaged (the declared event the
  // engine never produced — summarize/app read it for stats + hero flash).
  // Mirror heroHealed: emit only when damage actually landed (shields absorb).
  if (dmg > 0) push(game, { type: 'heroDamaged', player: ref.player, amount: dmg, hp: hero.hp });
  return dmg;
}

// --- internal helpers ---

function resolveRefs(game: Resolver, player: PlayerIndex, spec: EffectSpec, explicitRef?: TargetRef): TargetRef[] {
  if (explicitRef) return [explicitRef];
  const t = spec.target;
  if (!t) return [];
  if (MULTI_TARGET_TARGETS.has(t)) return resolveTargets(game, player, t);
  const refs = resolveTargets(game, player, t);
  return refs.length > 0 ? [refs[0]!] : [];
}

/** Resolver exposes the registry on Game; effects need it for summon stats and dragon checks. */
function registryOf(game: Resolver): CardRegistry {
  const reg = (game as Resolver & { registry?: CardRegistry }).registry;
  if (!reg) throw new Error('applyEffect requires a resolver exposing a card registry (Game does)');
  return reg;
}

/** True when the creature's card def archetype is 'dragon' (unknown cards are not). Exported for friendlyDragon target validation (Task 9). */
export function isDragon(game: Resolver, c: CreatureState): boolean {
  try {
    return registryOf(game).get(c.cardId).archetype === 'dragon';
  } catch {
    return false;   // unknown/synthetic card — not a dragon
  }
}

/** Enemy-facing target filter: a stealthed creature is not selectable by the
 *  opponent. It stays fully selectable by its OWN controller (friendly buffs
 *  and heals still reach it), so the filter is applied only where the refs
 *  belong to the enemy. */
function visibleToEnemy(c: CreatureState): boolean {
  return !c.keywords.includes('stealth');
}

/** Find a creature by id across both boards. Exported for Game's dispatch handlers (Task 8). */
export function findCreature(game: Resolver, id: string): CreatureState | undefined {
  for (const p of game.state.players) {
    const c = p.board.find(x => x.id === id);
    if (c) return c;
  }
  return undefined;
}

/** Remove a creature from its owner's board (no-op when already gone). */
export function removeCreature(game: Resolver, c: CreatureState): void {
  const p = game.state.players[c.owner];
  const i = p.board.findIndex(x => x.id === c.id);
  if (i >= 0) p.board.splice(i, 1);
}

function hasLifesteal(game: Resolver, ctx: EffectCtx): boolean {
  if (!ctx.creatureId) return false;
  return findCreature(game, ctx.creatureId)?.keywords.includes('lifesteal') ?? false;
}

/** Heal a hero (capped at maxHp); emits heroHealed when anything was healed. */
function healHero(game: Resolver, player: PlayerIndex, amount: number): void {
  if (amount <= 0) return;
  const hero = game.state.players[player].hero;
  const healed = Math.min(hero.maxHp - hero.hp, amount);
  hero.hp += healed;
  if (healed > 0) push(game, { type: 'heroHealed', player, amount: healed, hp: hero.hp });
}

function healRef(game: Resolver, ref: TargetRef, amount: number): void {
  if (amount <= 0) return;
  if (ref.type === 'creature') {
    const c = findCreature(game, ref.id);
    if (!c) return;
    c.health = Math.min(c.maxHealth, c.health + amount);
  } else {
    healHero(game, ref.player, amount);
  }
}

/** Buff adds attack, health/maxHealth, and reflect; negative values shrink
 *  (0-health death uses the normal death path). value/value2/value3 = the
 *  Attack/Health/Reflect deltas (Task 1). */
function buffRef(game: Resolver, ref: TargetRef, atk: number, hp: number, refl: number): void {
  if (ref.type !== 'creature') return;   // heroes have no attack
  const c = findCreature(game, ref.id);
  if (!c) return;
  c.attack += atk;
  c.health += hp;
  c.maxHealth += hp;
  c.reflect += refl;
  push(game, { type: 'buffApplied', creatureId: c.id, attack: c.attack, health: c.health });
  if (c.health <= 0) {
    push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
  }
}

function summonTokens(game: Resolver, ctx: EffectCtx, spec: EffectSpec): void {
  if (!spec.cardId) return;
  const card = registryOf(game).get(spec.cardId);
  const p = game.state.players[ctx.player];
  // Task 3: tokens occupy their own row — count against TOKEN_CAP using only
  // the same-kind creatures, so a swarm card (Endless Swarm 9) is not silently
  // truncated by the creature cap (old behavior: BOARD_CAP - board.length = 0).
  const isToken = card.archetype === 'token';
  const cap = isToken ? TOKEN_CAP : BOARD_CAP;
  const used = p.board.filter(c => c.token === isToken).length;
  const count = Math.min(spec.value ?? 1, cap - used);
  for (let i = 0; i < count; i++) {
    const creature = makeCreature(game, card, ctx.player);
    p.board.push(creature);
    push(game, { type: 'tokenSummoned', player: ctx.player, cardId: card.id, creatureId: creature.id });
    push(game, { type: 'creatureSummoned', player: ctx.player, creatureId: creature.id, cardId: card.id });
  }
}

/** Build a CreatureState from a card def (exhausted = !(rush||charge), attacksLeft = windfury?2:1,
 *  shields/warded from keywords, token = archetype 'token' — Task 3 token row). Exported so hand
 *  plays (game.ts) summon through the same path as effect summons (Task 9). */
export function makeCreature(game: Resolver, card: Card, owner: PlayerIndex): CreatureState {
  const keywords: Keyword[] = [...card.keywords];
  return {
    id: nextCreatureId(game, card.id),
    cardId: card.id,
    owner,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    // Task 1: creation copies the card def's Reflect. validateCard guarantees
    // the field on every creature, so the non-null assertion mirrors the
    // existing attack/health contract. A legacy def without it would surface
    // as undefined here — combat treats undefined as 0 (see submit/attack).
    reflect: card.reflect!,
    keywords,
    exhausted: !(keywords.includes('rush') || keywords.includes('charge')),
    attacksLeft: keywords.includes('windfury') ? 2 : 1,
    shields: keywords.includes('shield') ? 1 : 0,
    warded: keywords.includes('ward'),
    frozen: false,
    silenced: false,
    token: card.archetype === 'token',
    spellPower: 0,
  };
}

/** Deterministic per-cardId counter across both boards — two identical states produce identical ids. */
function nextCreatureId(game: Resolver, cardId: string): string {
  // MAX-based, not count-based: a count-based scheme releases a number when a
  // creature dies, so a later summon can reuse it and collide with a still-
  // live creature on the other board (findCreature then resolves intents to
  // the wrong owner). max + 1 is monotonic per cardId, so ids are unique
  // among live creatures, and it is derived purely from board state (two
  // identical states produce identical ids; survives serialize/deserialize).
  let max = 0;
  for (const p of game.state.players) {
    for (const c of p.board) {
      if (c.cardId !== cardId) continue;
      const n = Number(c.id.slice(cardId.length + 1));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${cardId}-${max + 1}`;
}

function randomEnemyCreatureCardId(game: Resolver, player: PlayerIndex): string | undefined {
  const enemy = (1 - player) as PlayerIndex;
  const board = game.state.players[enemy].board;
  if (board.length === 0) return undefined;
  return game.pickRandom(board).cardId;   // seeded pick (counting wrapper)
}

/** Enqueue one event: recorded in the log AND pending on the queue for runQueue. */
function push(game: Resolver, evt: GameEvent): void {
  game.state.log.push(evt);
  game.queue.push(evt);
}
