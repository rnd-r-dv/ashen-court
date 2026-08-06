import { CardRegistry } from '../cards.js';
import { createTestPool } from '../data/test-pool.js';
import { createRng, shuffle } from '../rng.js';
import type { Rng } from '../rng.js';
import type { Card, CreatureState, GameEvent, GameState, HeroSpec, Intent, PlayerIndex, PlayerState, Trigger, TriggerSpec } from '../types.js';
import { MANA_SURGE } from '../types.js';
import { validateDeck } from '../validate.js';
import { applyEffect, findCreature, makeCreature, removeCreature, SINGLE_TARGET_TARGETS } from './effects.js';
import type { EffectCtx } from './effects.js';
import { runQueue } from './events.js';
import type { Resolver } from './events.js';
import { isMostExpensiveCreatureInHand, playEffectiveCost, validatePlayCard } from './intents.js';
import { canAttack, effectiveKeywords, tauntPresent } from './keywords.js';
import { deserializeState, serializeState } from './serialize.js';

export interface MatchSetup {
  decks: [string[], string[]];            // card ids, player 0 first
  heroes: [HeroSpec, HeroSpec];
  seed: number;
}

const MAX_MANA = 15;
const STARTING_HAND = 3;

/**
 * Core engine entry point: game setup/deal, mulligan, turn flow, and mana.
 * Later tasks extend submit() with playCard/attack/heroPower resolution
 * (Tasks 9-11), effects/keywords (Tasks 5-7), and LAN/replay (Tasks 12+).
 */
export class Game implements Resolver {
  state: GameState;
  registry: CardRegistry;
  /** Pending resolution queue (Resolver): drained by runQueue. */
  queue: GameEvent[] = [];
  /** Applied-event collector (Resolver): filled by runQueue during a top-level drain. */
  applied: GameEvent[] = [];
  /** Nested-drain marker (Resolver): set while runQueue is draining this game. */
  draining = false;

  private rng: Rng;
  private rngCalls = 0;
  private mulligansDone = new Set<PlayerIndex>();

  constructor(setup: MatchSetup, registry: CardRegistry) {
    if (!setup.heroes || setup.heroes.length !== 2) throw new Error('Two heroes required');
    // validate both decks against the registry
    for (const [i, deck] of setup.decks.entries()) {
      const issues = validateDeck(deck, registry.pool());
      if (issues.some(iss => iss.severity === 'error')) {
        throw new Error(`Deck ${i} invalid: ${issues.map(iss => iss.message).join('; ')}`);
      }
    }
    this.registry = registry;
    // Every rng consumption goes through the counting wrapper so the call
    // count is exact (serialization/replay determinism, see Task 12).
    const raw = createRng(setup.seed);
    this.rng = () => { this.rngCalls++; return raw(); };
    const players: [PlayerState, PlayerState] = [
      this.makePlayer(0, setup),
      this.makePlayer(1, setup),
    ];
    // deal starting hands
    for (const p of players) for (let i = 0; i < STARTING_HAND; i++) p.hand.push(p.deck.pop()!);
    // player 1 gets Mana Surge (+1 maxMana/+1 mana head start, surge card in
    // hand). The turn-flow test requires players[1].maxMana === 2 on turn 1,
    // so the surge bonus must grant +1 maxMana at setup (see task-4-report).
    players[1].hand.push(MANA_SURGE);
    players[1].surged = true;
    players[1].maxMana = 1;
    players[1].mana = 1;
    this.state = {
      players, turn: 0, phase: 'mulligan', seed: setup.seed,
      rngState: { seed: setup.seed, calls: 0 }, log: [],
    };
  }

  static create(setup: MatchSetup, registry?: CardRegistry): Game {
    // registry omitted → test convenience pool; production always passes one
    return new Game(setup, registry ?? new CardRegistry(createTestPool()));
  }

  private makePlayer(i: PlayerIndex, setup: MatchSetup): PlayerState {
    const heroSpec = setup.heroes[i];
    const deck = shuffle(this.rng, setup.decks[i]);
    return {
      hero: {
        name: heroSpec.name, hp: 30, maxHp: 30, shields: 0,
        power: heroSpec.power, usedPower: false,
        discountCheapest: 0, discountNextSpell: 0,
      },
      deck, hand: [], board: [], artifacts: [],
      mana: 0, maxMana: 0, surged: false,
    };
  }

  currentPlayer(): PlayerIndex {
    return (this.state.turn % 2) as PlayerIndex;
  }

  submit(intent: Intent): GameEvent[] {
    const me = this.currentPlayer();
    if (intent.kind === 'mulligan') {
      if (this.state.phase !== 'mulligan') throw new Error('Not in mulligan');
      // mulligan order: player 0, then player 1 (turn stays 0 during mulligan)
      const mp = (this.mulligansDone.size % 2) as PlayerIndex;
      const p = this.state.players[mp];
      // keep set must be valid indices
      const kept = [...intent.keep].sort((a, b) => b - a);
      for (const idx of kept) { if (idx < 0 || idx >= p.hand.length) throw new Error('Bad keep index'); }
      const keptCards = intent.keep.map(i => p.hand[i]!);
      for (const idx of kept) p.hand.splice(idx, 1);
      p.hand = [...keptCards];
      // Redraws are events: pre-view the top card(s), enqueue cardDrawn, and
      // let dispatch pop+push. Hand/deck only change when dispatch runs, so
      // the redraw count is computed up front (no live loop condition).
      const needed = Math.min(STARTING_HAND - p.hand.length, p.deck.length);
      for (let i = 0; i < needed; i++) {
        const cardId = p.deck[p.deck.length - 1 - i]!;
        this.emit({ type: 'cardDrawn', player: mp, cardId });
      }
      this.mulligansDone.add(mp);
      if (this.mulligansDone.size === 2) this.startMain();
      return runQueue(this);
    }
    if (intent.kind === 'endTurn') {
      return this.endTurn(me);
    }
    if (intent.kind === 'attack') {
      const target = intent.target;   // local alias: discriminant narrowing propagates into find() callbacks
      const attacker = this.state.players[me].board.find(c => c.id === intent.attackerId);
      if (!attacker) throw new Error('Attacker not found');
      if (!canAttack(attacker, this)) throw new Error('Cannot attack with that creature');
      // taunt check: while the defender has a taunt, hero AND non-taunt-creature targets are illegal
      const enemy = (1 - me) as PlayerIndex;
      const enemyBoard = this.state.players[enemy].board;
      if (tauntPresent(enemyBoard)) {
        if (target.type === 'hero' || target.type !== 'creature' ||
            !effectiveKeywords(enemyBoard.find(c => c.id === target.id)!).has('taunt')) {
          throw new Error('Taunt creature in the way');
        }
      }
      // resolve
      attacker.exhausted = true; attacker.attacksLeft -= 1;
      if (target.type === 'creature') {
        const defender = enemyBoard.find(c => c.id === target.id);
        if (!defender) throw new Error('Defender not found');
        this.dealDamage(attacker, defender, attacker.attack);       // uses effects internals
        if (defender.health > 0) this.dealDamage(defender, attacker, defender.attack);  // retaliation (source = defender)
      } else {
        this.dealDamageToHero(attacker, enemy, attacker.attack);
      }
      return runQueue(this);
    }
    if (intent.kind === 'playCard') {
      const err = validatePlayCard(this, intent, me);
      if (err) throw new Error(err);
      const p = this.state.players[me];
      const card = this.registry.get(p.hand[intent.handIndex]!);
      // pay effective cost (discounts already applied in playEffectiveCost),
      // then consume the discounts on use — even when the effective cost is 0.
      p.mana -= playEffectiveCost(this, card, me);
      if (card.type === 'spell') p.hero.discountNextSpell = 0;
      if (card.type === 'creature' && isMostExpensiveCreatureInHand(this, me, card)) p.hero.discountCheapest = 0;
      if (card.id === MANA_SURGE) p.surged = true;   // surge consumed after its one use
      p.hand.splice(intent.handIndex, 1);            // the card leaves the hand for every type
      switch (card.type) {
        case 'creature': {
          // summon BEFORE the cardPlayed event dispatches so self-targeting
          // battlecries (fired by dispatch(cardPlayed)) can see the creature.
          const creature = makeCreature(this, card, me);
          p.board.push(creature);
          this.emit({ type: 'cardPlayed', player: me, cardId: card.id, creatureId: creature.id });
          this.emit({ type: 'creatureSummoned', player: me, creatureId: creature.id, cardId: card.id });
          break;
        }
        case 'spell': {
          this.emit({ type: 'cardPlayed', player: me, cardId: card.id });
          // Apply each effect in order. Single-target effects pass the resolved
          // intent.target as the explicit ref; AoE/random kinds resolve internally.
          for (const spec of card.effects) {
            const ref = spec.target !== undefined && SINGLE_TARGET_TARGETS.has(spec.target) ? intent.target : undefined;
            // Ward: a single-target creature ref on a warded creature consumes
            // the ward, fizzles the whole spell (effects skipped) — but the
            // spell is still paid and already removed from hand above.
            if (ref && ref.type === 'creature') {
              const warded = findCreature(this, ref.id);
              if (warded && warded.warded) {
                warded.warded = false;
                this.emit({ type: 'spellFizzled', player: me, cardId: card.id, creatureId: warded.id });
                break;
              }
            }
            applyEffect(this, { player: me, cardId: card.id }, spec, ref);
          }
          break;
        }
        case 'artifact': {
          this.emit({ type: 'cardPlayed', player: me, cardId: card.id });
          p.artifacts.push({ id: this.nextArtifactId(card.id), cardId: card.id, owner: me });
          break;
        }
      }
      return runQueue(this);
    }
    throw new Error('Intent not implemented yet');   // replaced in Tasks 10-11
  }

  /**
   * Public event entry point: enqueue one event and drain the resolution
   * queue. Returns every event applied, including follow-ups. Used by LAN
   * rendering / replay (Task 12+) and the test surface.
   */
  applyEvent(evt: GameEvent): GameEvent[] {
    this.emit(evt);
    return runQueue(this);
  }

  /**
   * Resolver.dispatch: apply one event to state. May enqueue follow-ups
   * (turnEnd advances the turn and emits beginTurn's own events, which
   * runQueue picks up from the queue in the same loop). Every event type not
   * handled here throws — later tasks add handlers explicitly.
   */
  dispatch(evt: GameEvent): void {
    switch (evt.type) {
      case 'cardDrawn': {
        const p = this.state.players[evt.player];
        if (p.deck.length === 0) break;   // empty deck: no-op, no fatigue yet
        const cardId = p.deck.pop()!;
        p.hand.push(cardId);
        break;
      }
      case 'manaChanged': {
        const p = this.state.players[evt.player];
        p.mana = evt.mana;
        p.maxMana = evt.maxMana;
        break;
      }
      case 'turnStart':
        // startOfTurn triggers of the active player's artifacts + board creatures
        this.fireTurnTriggers(evt.player, 'startOfTurn');
        break;
      case 'gameOver':
        this.state.phase = 'gameOver';
        break;
      case 'turnEnd':
        // endOfTurn triggers fire for the player ending their turn, BEFORE the
        // turn advances (they belong to the turn that is ending).
        this.fireTurnTriggers(evt.player, 'endOfTurn');
        this.state.turn += 1;
        this.beginTurn(this.currentPlayer());
        break;
      // Task 8 trigger wiring: dispatch-level hooks that fire a card's trigger
      // groups and resolve death/removal. Trigger effects apply via applyEffect
      // (effects library), enqueuing their own follow-up events that runQueue
      // drains depth-first (deterministic).
      case 'cardPlayed': {
        // battlecry of the played creature (spells/artifacts have no battlecry);
        // the played creature's id rides in the event so self-targeting
        // battlecries resolve against the summoned creature (Task 9).
        const card = this.safeCard(evt.cardId);
        if (card && card.type === 'creature') this.fireTriggers('battlecry', evt.player, evt.cardId, evt.creatureId);
        break;
      }
      case 'damageDealt': {
        // onDamage fires ONCE per damage event for the damaged creature.
        // Skip amount <= 0 (shield absorbs emit a 0-amount damageDealt —
        // shields must not fire damage triggers) and non-creature targets.
        if (evt.amount > 0 && evt.target.type === 'creature') {
          const c = findCreature(this, evt.target.id);
          if (c) this.fireTriggers('onDamage', c.owner, c.cardId, c.id);
        }
        break;
      }
      case 'creatureDied': {
        // deathrattle resolves FIRST (effects apply via the card def), then the
        // creature is removed from the board. Removal lives here, not in
        // dealDamage — retaliation is gated on the defender's health, so a dead
        // creature never retaliates (see submit/attack).
        this.fireTriggers('deathrattle', evt.player, evt.cardId, evt.creatureId);
        const dead = findCreature(this, evt.creatureId);
        if (dead) removeCreature(this, dead);
        break;
      }
      case 'spellFizzled':
      case 'heroHealed':
      case 'buffApplied':
      case 'cardDrawnExtra':
      case 'tokenSummoned':
      case 'creatureSummoned':
      case 'frozen':
      case 'effectResolved':
        break;
      default:
        throw new Error('Unhandled event: ' + evt.type);
    }
  }

  /** Card def lookup that tolerates unknown ids (synthetic cards without defs). */
  private safeCard(cardId: string): Card | undefined {
    try { return this.registry.get(cardId); } catch { return undefined; }
  }

  /** Trigger groups of `cardId` for `when` (empty for unknown cards / no group). */
  private triggerGroups(cardId: string, when: Trigger): TriggerSpec[] {
    return (this.safeCard(cardId)?.triggers ?? []).filter(t => t.when === when);
  }

  /**
   * Apply every effect of every `when` trigger group of `cardId`, in group
   * then effect order, with the trigger context (player = owner/player, and
   * creatureId = the dying/damaged/played creature's id where available).
   */
  private fireTriggers(when: Trigger, player: PlayerIndex, cardId: string, creatureId?: string): void {
    for (const group of this.triggerGroups(cardId, when)) {
      for (const spec of group.effects) {
        applyEffect(this, { player, cardId, creatureId }, spec);
      }
    }
  }

  /** startOfTurn/endOfTurn fire for the player's artifacts AND board creatures. */
  private fireTurnTriggers(player: PlayerIndex, when: 'startOfTurn' | 'endOfTurn'): void {
    const p = this.state.players[player];
    for (const a of p.artifacts) this.fireTriggers(when, player, a.cardId);
    for (const c of p.board) this.fireTriggers(when, player, c.cardId, c.id);
  }

  /** Legal intents for a player; playCard/attack/heroPower arrive in Tasks 9-11. */
  legalIntents(player: PlayerIndex): Intent[] {
    if (this.state.phase === 'mulligan') {
      if ((this.mulligansDone.size % 2) !== player) return [];
      const n = this.state.players[player].hand.length;
      const out: Intent[] = [];
      for (let mask = 0; mask < 1 << n; mask++) {
        const keep: number[] = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) keep.push(i);
        out.push({ kind: 'mulligan', keep });
      }
      return out;
    }
    if (this.state.phase === 'main' && this.currentPlayer() === player) {
      return [{ kind: 'endTurn' }];
    }
    return [];
  }

  random(): number {
    return this.rng();
  }

  pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)] as T;
  }

  clone(): Game {
    return Game.deserialize(this.serialize(), this.registry);
  }

  serialize(): string {
    this.state.rngState = { seed: this.state.seed, calls: this.rngCalls };
    return serializeState(this.state);
  }

  static deserialize(json: string, registry: CardRegistry): Game {
    const state = deserializeState(json);
    const g = Object.create(Game.prototype) as Game;
    g.state = state;
    g.registry = registry;
    g.rngCalls = 0;
    g.mulligansDone = new Set();
    g.queue = [];
    g.applied = [];
    g.draining = false;
    // Re-seed from the saved position; advancing `calls` draws through the
    // counting wrapper restores both the raw rng position and rngCalls.
    const raw = createRng(state.rngState.seed);
    g.rng = () => { g.rngCalls++; return raw(); };
    for (let i = 0; i < state.rngState.calls; i++) g.rng();
    return g;
  }

  private emit(evt: GameEvent): void {
    this.state.log.push(evt);
    this.queue.push(evt);
  }

  /** Deterministic per-cardId artifact id (mirrors the creature id scheme; survives serialization). */
  private nextArtifactId(cardId: string): string {
    let n = 0;
    for (const p of this.state.players) for (const a of p.artifacts) if (a.cardId === cardId) n++;
    return `${cardId}-${n + 1}`;
  }

  private startMain(): void {
    this.state.phase = 'main';
    this.mulligansDone = new Set();
    this.beginTurn(0);
  }

  private beginTurn(me: PlayerIndex): void {
    const p = this.state.players[me];
    // mana/draw are events (dispatch applies them); resets stay inline
    // (state maintenance, not events).
    const maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    p.hero.usedPower = false;
    p.hero.discountCheapest = 0;
    p.hero.discountNextSpell = 0;
    // thaw frozen creatures, restore attacks (keep `exhausted` for creatures
    // that can't attack yet; rush/charge clear exhausted on summon)
    for (const c of p.board) {
      if (c.frozen) c.frozen = false;
      c.attacksLeft = c.keywords.includes('windfury') ? 2 : 1;
    }
    this.emit({ type: 'turnStart', player: me, mana: maxMana });
    this.emit({ type: 'manaChanged', player: me, mana: maxMana, maxMana });
    // draw 1 (empty deck: no cardDrawn event, fatigue arrives in a later task)
    if (p.deck.length > 0) {
      const cardId = p.deck[p.deck.length - 1]!;   // pre-view; dispatch pops
      this.emit({ type: 'cardDrawn', player: me, cardId });
    }
  }

  /**
   * Attack damage routed through the effects library: builds an EffectCtx from
   * the SOURCE creature (controller = source.owner, so retaliation lifesteal
   * heals the defender's controller) and applies dealDamage to the target.
   */
  private dealDamage(source: CreatureState, target: CreatureState, amount: number): void {
    const ctx: EffectCtx = { player: source.owner, cardId: source.cardId, creatureId: source.id };
    applyEffect(this, ctx, { kind: 'dealDamage', value: amount, target: 'anyCreature' }, { type: 'creature', id: target.id });
  }

  /** Hero-target attack damage; same source-derived controller ruling as dealDamage. */
  private dealDamageToHero(source: CreatureState, targetPlayer: PlayerIndex, amount: number): void {
    const ctx: EffectCtx = { player: source.owner, cardId: source.cardId, creatureId: source.id };
    applyEffect(this, ctx, { kind: 'dealDamage', value: amount, target: 'hero' }, { type: 'hero', player: targetPlayer });
  }

  private endTurn(me: PlayerIndex): GameEvent[] {
    this.emit({ type: 'turnEnd', player: me });
    // dispatch(turnEnd) advances the turn and calls beginTurn(next); beginTurn
    // emits its own follow-up events, applied by runQueue in the same loop.
    return runQueue(this);
  }
}
