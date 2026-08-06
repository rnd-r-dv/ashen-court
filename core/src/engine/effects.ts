import type { CardRegistry } from '../cards.js';
import type { Card, CreatureState, EffectSpec, EffectTarget, GameEvent, Keyword, PlayerIndex, TargetRef } from '../types.js';
import { runQueue } from './events.js';
import type { Resolver } from './events.js';

/**
 * Effect-resolution library.
 *
 * Every EffectKind (dealDamage, draw, heal, buff, summon, gainMana,
 * refillMana, freeze, destroy, copyCard, giveKeyword, discountCheapest,
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

const BOARD_CAP = 7;
const MAX_MANA = 15;

/** Targets that resolve to one ref (caller supplies an explicit ref via the
 *  legal-intent enumeration; fallback = resolveTargets()[0]). Exported so
 *  play-card validation/resolution (intents.ts, game.ts) share the set.
 *  Task 9. */
export const SINGLE_TARGET_TARGETS: ReadonlySet<EffectTarget> = new Set([
  'any', 'hero', 'self', 'anyCreature', 'enemyCreature', 'friendlyCreature', 'friendlyDragon',
]);
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
      const amount = spec.value ?? 0;
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
      for (const ref of refs) buffRef(game, ref, atk, hp);
      break;
    }
    case 'summon':
      summonTokens(game, ctx, spec);
      break;
    case 'gainMana':
    case 'refillMana': {
      const p = game.state.players[ctx.player];
      const v = spec.value ?? 0;
      const maxMana = Math.min(MAX_MANA, p.maxMana + v);
      const mana = Math.min(maxMana, p.mana + (spec.kind === 'refillMana' ? v : 0));
      // manaChanged is a real dispatch handler; it applies these values.
      push(game, { type: 'manaChanged', player: ctx.player, mana, maxMana });
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
      }
      break;
    }
    case 'discountCheapest':
      game.state.players[ctx.player].hero.discountCheapest += spec.value ?? 0;
      break;
    case 'discountNextSpell':
      game.state.players[ctx.player].hero.discountNextSpell += spec.value ?? 0;
      break;
  }
  push(game, { type: 'effectResolved', player: ctx.player, sourceCardId: ctx.cardId, kind: spec.kind });
  runQueue(game);
}

/**
 * Resolve an EffectTarget to concrete refs. Empty = no legal target.
 * Rulings: `hero` and `self` both resolve to the CASTER's own hero; to
 * damage the enemy hero use `allEnemies` (empty enemy board → hero-only).
 */
export function resolveTargets(game: Resolver, player: PlayerIndex, target: EffectTarget): TargetRef[] {
  const enemy = (1 - player) as PlayerIndex;
  const friendly = game.state.players[player].board;
  const hostile = game.state.players[enemy].board;
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
    }
    return dmg;
  }
  const hero = game.state.players[ref.player].hero;
  let dmg = amount;
  if (hero.shields > 0) { hero.shields -= 1; dmg = 0; }
  hero.hp -= dmg;
  push(game, { type: 'damageDealt', target: ref, amount: dmg, sourceCardId: ctx.cardId });
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

/** Buff adds attack and health/maxHealth; negative values shrink (0-health death uses the normal death path). */
function buffRef(game: Resolver, ref: TargetRef, atk: number, hp: number): void {
  if (ref.type !== 'creature') return;   // heroes have no attack
  const c = findCreature(game, ref.id);
  if (!c) return;
  c.attack += atk;
  c.health += hp;
  c.maxHealth += hp;
  push(game, { type: 'buffApplied', creatureId: c.id, attack: c.attack, health: c.health });
  if (c.health <= 0) {
    push(game, { type: 'creatureDied', player: c.owner, creatureId: c.id, cardId: c.cardId });
  }
}

function summonTokens(game: Resolver, ctx: EffectCtx, spec: EffectSpec): void {
  if (!spec.cardId) return;
  const card = registryOf(game).get(spec.cardId);
  const p = game.state.players[ctx.player];
  const count = Math.min(spec.value ?? 1, BOARD_CAP - p.board.length);
  for (let i = 0; i < count; i++) {
    const creature = makeCreature(game, card, ctx.player);
    p.board.push(creature);
    push(game, { type: 'tokenSummoned', player: ctx.player, cardId: card.id, creatureId: creature.id });
    push(game, { type: 'creatureSummoned', player: ctx.player, creatureId: creature.id, cardId: card.id });
  }
}

/** Build a CreatureState from a card def (exhausted = !(rush||charge), attacksLeft = windfury?2:1,
 *  shields/warded from keywords). Exported so hand plays (game.ts) summon through the same
 *  path as effect summons (Task 9). */
export function makeCreature(game: Resolver, card: Card, owner: PlayerIndex): CreatureState {
  const keywords: Keyword[] = [...card.keywords];
  return {
    id: nextCreatureId(game, card.id),
    cardId: card.id,
    owner,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    keywords,
    exhausted: !(keywords.includes('rush') || keywords.includes('charge')),
    attacksLeft: keywords.includes('windfury') ? 2 : 1,
    shields: keywords.includes('shield') ? 1 : 0,
    warded: keywords.includes('ward'),
    frozen: false,
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
