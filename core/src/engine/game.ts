import { CardRegistry } from '../cards.js';
import { createTestPool } from '../data/test-pool.js';
import { createRng, shuffle } from '../rng.js';
import type { Rng } from '../rng.js';
import type { Card, CreatureState, GameEvent, GameState, HeroSpec, Intent, PlayerIndex, PlayerState, TargetRef, Trigger, TriggerSpec } from '../types.js';
import { MANA_SURGE, MAX_TURNS } from '../types.js';
import { validateDeck } from '../validate.js';
import { applyEffect, findCreature, isChoiceTarget, makeCreature, removeCreature, specTargetRef } from './effects.js';
import type { EffectCtx } from './effects.js';
import { runQueue } from './events.js';
import type { Resolver } from './events.js';
import { isMostExpensiveCreatureInHand, legalIntents as computeLegalIntents, playEffectiveCost, validateEffectTargets, validatePlayCard } from './intents.js';
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
    // Player 1 receives the Coin (Mana Surge) as a PLAYABLE card in hand — the
    // design spec's "second player receives a 0-cost Mana Surge spell token
    // usable once". Setup grants no mana of its own (audit 02): the old code
    // pre-set surged/maxMana/mana here, which both made the card permanently
    // unplayable (validatePlayCard's `surged` gate) and left player 1 one
    // crystal ahead of player 0 for the WHOLE match, since beginTurn's +1
    // compounds off the head start. Both players now follow the same
    // "start 1 crystal, +1 each turn" curve; `surged` flips only when the card
    // is actually played (see resolveIntent/playCard).
    players[1].hand.push(MANA_SURGE);
    this.state = {
      players, turn: 0, phase: 'mulligan', seed: setup.seed,
      mulligansDone: [false, false],
      rngState: { seed: setup.seed, calls: 0 }, log: [],
      pendingChoice: null, pendingChoiceQueue: [],
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
        discountMostExpensive: 0, discountNextSpell: 0,
      },
      deck, hand: [], board: [], artifacts: [],
      mana: 0, maxMana: 0, surged: false, overload: 0, lockedMana: 0,
    };
  }

  currentPlayer(): PlayerIndex {
    return (this.state.turn % 2) as PlayerIndex;
  }

  submit(intent: Intent): GameEvent[] {
    // Discover is an INTERRUPTING intent state (Task 1): while a choice is
    // pending, only the pending owner may act — every other intent is rejected
    // before any normal turn logic. The owner is the temporary actor even when
    // they are not currentPlayer() (a start/end-of-turn trigger can create a
    // valid out-of-turn choice), and the mulligan/main phase gates below do
    // NOT apply to it. The engine cannot tell who submitted; LAN authorization
    // (server) keys on pendingChoice.player.
    const pending = this.state.pendingChoice;
    let me: PlayerIndex;
    if (pending !== null) {
      if (intent.kind !== 'discover') throw new Error('Resolve Discover first');
      me = pending.player;
    } else {
      if (intent.kind === 'discover') throw new Error('No Discover choice pending');
      me = this.currentPlayer();
    }
    if (!this.draining) {
      // Controlled top-level session: initialize the collector so EVERY event
      // applied during resolution (incl. applyEffect's internal nested drains)
      // is collected; the final runQueue runs as a NESTED drain and returns
      // the shared collector (full resolution tree).
      this.applied = [];
      this.draining = true;
      try {
        this.resolveIntent(intent, me);
        // Deferred win check (Task 11): decide gameOver AFTER the whole
        // resolution so simultaneous hero deaths produce a draw. The final
        // runQueue drains the emitted gameOver into the shared collector.
        this.checkWin();
        return runQueue(this);
      }
      finally { this.draining = false; }
    }
    // Re-entrant submit (no external callers today): don't re-initialize the
    // collector — the outer session owns the check and final drain.
    return this.resolveIntent(intent, me);
  }

  private resolveIntent(intent: Intent, me: PlayerIndex): GameEvent[] {
    if (intent.kind === 'discover') {
      // Resolution is event-driven: validate the index against the ACTIVE
      // choice, then emit discoverResolved; dispatch pushes the card to the
      // pending owner's hand and rotates the FIFO queue. No phase or
      // currentPlayer requirement — an out-of-turn choice is valid.
      const pending = this.state.pendingChoice;
      if (!pending) throw new Error('No Discover choice pending');
      if (!Number.isInteger(intent.choice) || intent.choice < 0 || intent.choice >= pending.cardIds.length) {
        throw new Error('Bad Discover choice');
      }
      this.emit({ type: 'discoverResolved', player: pending.player, cardId: pending.cardIds[intent.choice]! });
      return runQueue(this);
    }
    if (intent.kind === 'mulligan') {
      if (this.state.phase !== 'mulligan') throw new Error('Not in mulligan');
      // mulligan order: player 0, then player 1 (turn stays 0 during mulligan);
      // progress lives in state so serialize/deserialize survives mid-mulligan (Task 12)
      const mp = (this.state.mulligansDone[0] ? 1 : 0) as PlayerIndex;
      const p = this.state.players[mp];
      // keep set must be valid indices; duplicate/oversized lists would
      // corrupt the hand (a duplicated keep silently discards another card —
      // audit 01 I2), so reject them with the same style of error.
      if (new Set(intent.keep).size !== intent.keep.length || intent.keep.length > p.hand.length) {
        throw new Error('Bad keep index');
      }
      // Opening hand size is per-player, NOT the STARTING_HAND constant:
      // player 1 opens on STARTING_HAND + 1 because the Coin occupies a slot
      // (audit 02 — refilling to the constant silently cost player 1 a card
      // whenever they kept 2 or fewer). Reading it off the live hand BEFORE
      // the splice needs no extra state, so it survives a mid-mulligan
      // serialize/deserialize (Task 12) for free.
      const openingHand = p.hand.length;
      const kept = [...intent.keep].sort((a, b) => b - a);
      for (const idx of kept) { if (idx < 0 || idx >= p.hand.length) throw new Error('Bad keep index'); }
      const keptCards = intent.keep.map(i => p.hand[i]!);
      for (const idx of kept) p.hand.splice(idx, 1);
      p.hand = [...keptCards];
      // Redraws are events: pre-view the top card(s), enqueue cardDrawn, and
      // let dispatch pop+push. Hand/deck only change when dispatch runs, so
      // the redraw count is computed up front (no live loop condition).
      const needed = Math.min(openingHand - p.hand.length, p.deck.length);
      for (let i = 0; i < needed; i++) {
        const cardId = p.deck[p.deck.length - 1 - i]!;
        this.emit({ type: 'cardDrawn', player: mp, cardId });
      }
      this.state.mulligansDone[mp] = true;
      if (this.state.mulligansDone[0] && this.state.mulligansDone[1]) this.startMain();
      return runQueue(this);
    }
    if (intent.kind === 'endTurn') {
      if (this.state.phase !== 'main') throw new Error('Not in main phase');
      return this.endTurn(me);
    }
    if (intent.kind === 'attack') {
      if (this.state.phase !== 'main') throw new Error('Not in main phase');
      const target = intent.target;   // local alias: discriminant narrowing propagates into find() callbacks
      const attacker = this.state.players[me].board.find(c => c.id === intent.attackerId);
      if (!attacker) throw new Error('Attacker not found');
      if (!canAttack(attacker, this)) throw new Error('Cannot attack with that creature');
      // taunt check: while the defender has a taunt, hero AND non-taunt-creature targets are illegal
      const enemy = (1 - me) as PlayerIndex;
      const enemyBoard = this.state.players[enemy].board;
      if (tauntPresent(enemyBoard)) {
        if (target.type === 'hero' || target.type !== 'creature') {
          throw new Error('Taunt creature in the way');
        }
        // audit 01 I4: the target may not be on the enemy board (own creature,
        // already-removed creature, stale/garbage id) — reject cleanly before
        // the keyword test instead of crashing on an undefined find.
        const d = enemyBoard.find(c => c.id === target.id);
        if (!d) throw new Error('Defender not found');
        // Stealth still applies inside the taunt gate: a stealthed taunt is
        // untargetable (visibleToEnemy) and must not be reachable through the
        // taunt check either (Task 8).
        if (!effectiveKeywords(d).has('taunt') || d.keywords.includes('stealth')) throw new Error('Taunt creature in the way');
      }
      // Submit-path legality, not just enumeration: legalIntents pre-filters
      // stealthed defenders, but submit is the only legality gate the LAN
      // server trusts (the engine cannot tell who submitted, so the server
      // validates identity only and forwards the intent). A crafted intent
      // must be rejected here too, or enumeration and validation diverge —
      // same invariant as the taunt gate above. Placed BEFORE the swing
      // decrement and the reveal so a rejected attack changes nothing.
      if (target.type === 'creature') {
        const d = enemyBoard.find(c => c.id === target.id);
        if (!d) throw new Error('Defender not found');
        if (effectiveKeywords(d).has('stealth')) throw new Error('Cannot target a stealthed creature');
      }
      // resolve: attacksLeft is the swing counter (windfury 2 / normal 1).
      // exhausted stays summoning-sickness-only (set at summon, cleared in
      // beginTurn) — attacking does NOT exhaust, so a windfury creature can
      // swing twice (audit 01 C1).
      attacker.attacksLeft -= 1;
      // Attacking reveals a stealthed creature (Task 8).
      const stealthIdx = attacker.keywords.indexOf('stealth');
      if (stealthIdx !== -1) attacker.keywords.splice(stealthIdx, 1);
      if (target.type === 'creature') {
        const defender = enemyBoard.find(c => c.id === target.id);
        if (!defender) throw new Error('Defender not found');
        // Damage is SIMULTANEOUS: both values are captured BEFORE either lands,
        // then applied unconditionally. Retaliation used to be gated on
        // `defender.health > 0`, which made a clean kill free and diverged from
        // every mainstream TCG. Capturing first also makes the second call safe:
        // the defender may already be off the board (dispatch(creatureDied)
        // removes it during the first drain), so re-reading defender.attack
        // afterwards would read a removed creature.
        const attackerPower = attacker.attack;
        const defenderPower = defender.attack;
        this.dealDamage(attacker, defender, attackerPower);
        // Source stays the DEFENDER so retaliation lifesteal heals the
        // defender's controller (EffectCtx.player = source.owner).
        this.dealDamage(defender, attacker, defenderPower);
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
      if (card.type === 'creature' && isMostExpensiveCreatureInHand(this, me, card)) p.hero.discountMostExpensive = 0;
      if (card.id === MANA_SURGE) p.surged = true;   // surge consumed after its one use
      p.hand.splice(intent.handIndex, 1);            // the card leaves the hand for every type
      switch (card.type) {
        case 'creature': {
          // summon BEFORE the cardPlayed event dispatches so self-targeting
          // battlecries (fired by dispatch(cardPlayed)) can see the creature.
          const creature = makeCreature(this, card, me);
          p.board.push(creature);
          this.emit({ type: 'cardPlayed', player: me, cardId: card.id, creatureId: creature.id, target: intent.target });
          this.emit({ type: 'creatureSummoned', player: me, creatureId: creature.id, cardId: card.id });
          break;
        }
        case 'spell': {
          this.emit({ type: 'cardPlayed', player: me, cardId: card.id });
          // Ward (audit 01 I3): resolve ONCE before the effect loop. A spell
          // with a single-target ref that resolves to a WARDED ENEMY creature
          // consumes the ward and fizzles the WHOLE spell — effects listed
          // before the warded spec must not land. Multi-target spells
          // (allEnemies etc.) are unaffected. The spell is still paid and
          // already removed from hand above.
          const hasSingleTarget = card.effects.some(spec => isChoiceTarget(spec.target));
          const wardRef = hasSingleTarget ? intent.target : undefined;
          let fizzled = false;
          if (wardRef && wardRef.type === 'creature') {
            const warded = findCreature(this, wardRef.id);
            if (warded && warded.warded && warded.owner === (1 - me) as PlayerIndex) {
              warded.warded = false;
              this.emit({ type: 'spellFizzled', player: me, cardId: card.id, creatureId: warded.id });
              fizzled = true;
            }
          }
          if (!fizzled) {
            for (const spec of card.effects) {
              // Single-target effects pass the resolved intent.target as the
              // explicit ref; hero/self (own-hero auto-resolve, Task 14
              // mixed-card ruling) and AoE/random kinds resolve internally.
              applyEffect(this, { player: me, cardId: card.id }, spec, specTargetRef(spec, intent.target));
            }
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
    if (intent.kind === 'heroPower') {
      if (this.state.phase !== 'main') throw new Error('Not in main phase');
      const p = this.state.players[me];
      if (p.hero.usedPower) throw new Error('Hero power already used this turn');
      if (p.mana < p.hero.power.cost) throw new Error('Not enough mana');
      const err = validateEffectTargets(this, me, p.hero.power.effects, intent.target);
      if (err) throw new Error(err);
      p.mana -= p.hero.power.cost;   // inline payment (Task 9 playCard pattern)
      for (const spec of p.hero.power.effects) {
        // single-target kinds take the chosen ref; hero/self (own-hero
        // auto-resolve) and AoE/random kinds resolve internally (Task 14
        // mixed-card ruling — a supplied ref is ignored for hero/self).
        applyEffect(this, { player: me, cardId: 'hero-power' }, spec, specTargetRef(spec, intent.target));
      }
      p.hero.usedPower = true;
      this.emit({ type: 'heroPowerUsed', player: me });
      return runQueue(this);
    }
    throw new Error('Intent not implemented yet');   // replaced in Tasks 10-11
  }

  /**
   * Public event entry point: enqueue one event and drain the resolution
   * queue. Returns every event applied, including follow-ups. Used by LAN
   * rendering / replay (Task 12+) and the test surface.
   *
   * Same session pattern as submit: the deferred win check (Task 11) runs at
   * the end of the session and the final nested runQueue drains the emitted
   * gameOver into the shared collector.
   */
  applyEvent(evt: GameEvent): GameEvent[] {
    if (!this.draining) {
      this.applied = [];
      this.draining = true;
      try {
        this.emit(evt);
        runQueue(this);
        this.checkWin();
        return runQueue(this);
      } finally { this.draining = false; }
    }
    // Re-entrant applyEvent: the outer session owns the check + final drain.
    this.emit(evt);
    return runQueue(this);
  }

  /**
   * Deferred win check (Task 11): after a resolution session, if exactly one
   * hero is at 0 hp the survivor wins; if both are at 0 it is a draw. The
   * gameOver event is emitted (log + queue) and dispatched by the caller's
   * final runQueue, which sets phase via the existing dispatch handler.
   * No-op while a gameOver is already in effect.
   */
  checkWin(): void {
    if (this.state.phase === 'gameOver') return;
    // Turn-limit draw (Task 22, Phase 3 amendment): a match that reaches
    // MAX_TURNS ends deterministically. Placed at the top of checkWin (after
    // the phase guard) rather than in beginTurn so the rule rides the single
    // end-of-session hook shared by every submit and applyEvent path — no
    // beginTurn early-return needed, and the gameOver event appears in the
    // resolution tree and log exactly like the hero-death draws below.
    if (this.state.turn >= MAX_TURNS) {
      this.emit({ type: 'gameOver', winner: 'draw', reason: 'turn limit' });
      return;
    }
    const h0 = this.state.players[0].hero.hp;
    const h1 = this.state.players[1].hero.hp;
    if (h0 <= 0 && h1 <= 0) {
      this.emit({ type: 'gameOver', winner: 'draw', reason: 'both heroes destroyed' });
    } else if (h0 <= 0) {
      this.emit({ type: 'gameOver', winner: 1, reason: 'hero destroyed' });
    } else if (h1 <= 0) {
      this.emit({ type: 'gameOver', winner: 0, reason: 'hero destroyed' });
    }
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
        // A resolved game clears every interrupting choice (Task 1): nothing
        // may remain pending once the match has ended.
        this.state.pendingChoice = null;
        this.state.pendingChoiceQueue = [];
        break;
      case 'discoverOffered':
        // The first offer becomes the ACTIVE choice; later offers queue FIFO
        // and rotate in when the active one resolves (Task 1).
        if (this.state.pendingChoice === null) this.state.pendingChoice = evt.choice;
        else this.state.pendingChoiceQueue.push(evt.choice);
        break;
      case 'discoverResolved':
        this.state.players[evt.player].hand.push(evt.cardId);
        this.state.pendingChoice = this.state.pendingChoiceQueue.shift() ?? null;
        break;
      case 'turnEnd':
        // endOfTurn triggers fire for the player ending their turn, BEFORE the
        // turn advances (they belong to the turn that is ending).
        this.fireTurnTriggers(evt.player, 'endOfTurn');
        // The lock expires with the turn it locked (Task 6): lockedMana is a
        // same-turn ledger value, so it clears here. The incoming player's
        // beginTurn reassigns it from THEIR overload, so a lock never bleeds
        // into the opponent's turn.
        this.state.players[evt.player].lockedMana = 0;
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
        if (card && card.type === 'creature') this.fireTriggers('battlecry', evt.player, evt.cardId, evt.creatureId, evt.target);
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
        // dealDamage — combat is simultaneous, so a creature that died to an
        // attack still dealt its own damage back first (see submit/attack).
        this.fireTriggers('deathrattle', evt.player, evt.cardId, evt.creatureId);
        const dead = findCreature(this, evt.creatureId);
        if (dead) removeCreature(this, dead);
        break;
      }
      case 'creatureReturned': {
        const p = this.state.players[evt.player];
        const idx = p.board.findIndex(c => c.id === evt.creatureId);
        if (idx === -1) break;
        p.board.splice(idx, 1);
        // A full hand simply loses the card, matching how draw handles overflow.
        p.hand.push(evt.cardId);
        break;
      }
      case 'spellFizzled':
      case 'heroHealed':
      case 'heroDamaged':   // log-only marker (hero hp already applied inline in damageTarget)
      case 'buffApplied':
      case 'cardDrawnExtra':
      case 'tokenSummoned':
      case 'creatureSummoned':
      case 'frozen':
      case 'thawed':
      case 'effectResolved':
      case 'heroPowerUsed':   // log-only marker (state already applied inline)
        break;
      default:
        // The switch is exhaustive today (TS narrows evt to never here); the
        // guard stays for future event types added to the union without a
        // dispatch case.
        throw new Error('Unhandled event: ' + (evt as GameEvent).type);
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
   *
   * `explicitRef` (the playCard target riding on cardPlayed, Task 15 ruling) is
   * filtered PER SPEC by specTargetRef, exactly like the spell and hero-power
   * paths: only choice targets receive it. Passing it to every spec in the
   * group (audit 02) redirected self/AoE specs at the chosen target — a
   * playCard intent on pact-morticia carrying the enemy hero moved its
   * dmg(3,'self') drawback onto the enemy face. Validation cannot catch that,
   * because validateEffectTargets skips self/AoE specs by design.
   */
  private fireTriggers(when: Trigger, player: PlayerIndex, cardId: string, creatureId?: string, explicitRef?: TargetRef): void {
    const creature = creatureId ? findCreature(this, creatureId) : undefined;
    // A silenced creature has no triggers (Task 5).
    if (creature && creature.silenced) return;
    for (const group of this.triggerGroups(cardId, when)) {
      for (const spec of group.effects) {
        applyEffect(this, { player, cardId, creatureId }, spec, specTargetRef(spec, explicitRef));
      }
    }
  }

  /** startOfTurn/endOfTurn fire for the player's artifacts AND board creatures. */
  private fireTurnTriggers(player: PlayerIndex, when: 'startOfTurn' | 'endOfTurn'): void {
    const p = this.state.players[player];
    for (const a of p.artifacts) this.fireTriggers(when, player, a.cardId);
    for (const c of p.board) this.fireTriggers(when, player, c.cardId, c.id);
  }

  /** Legal intents for a player (Task 10): full main-phase enumeration in
   *  intents.ts; mulligan returns [] (bots use a fixed policy, UI its own
   *  keep-selection). */
  legalIntents(player: PlayerIndex): Intent[] {
    return computeLegalIntents(this, player);
  }

  random(): number {
    return this.rng();
  }

  pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)] as T;
  }

  /**
   * Search clone: the same state MINUS the event log (audit 02 bug 16).
   *
   * clone() exists for the bot's lookahead (bot/policies.ts clones per
   * candidate intent, up to MAX_EVAL per decision plus the enemy-turn
   * simulation), and the search only ever reads state.players — evaluate()
   * never consults state.log. But the log is append-only for the whole match,
   * so round-tripping it through JSON made every search node pay for the
   * entire match history: measured 3.1KB/0.027ms per clone at turn 0 vs
   * 19.1KB/0.155ms at turn 40, still climbing.
   *
   * Dropping the log here is safe precisely because it is the SEARCH path;
   * serialize()/deserialize() stay lossless (below), since they are the public
   * replay/persistence surface where the log IS part of the saved state.
   * Determinism is unaffected: rngState (seed + call count) is carried exactly
   * as serialize() carries it, so a clone reproduces byte-identical results for
   * the same intent sequence — the clone simply starts a fresh log of its own.
   */
  clone(): Game {
    this.state.rngState = { seed: this.state.seed, calls: this.rngCalls };
    return Game.deserialize(serializeState({ ...this.state, log: [] }), this.registry);
  }

  /** Lossless full-state snapshot (log included) — replay/persistence/LAN. */
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
    this.state.mulligansDone = [false, false];
    this.beginTurn(0);
  }

  private beginTurn(me: PlayerIndex): void {
    const p = this.state.players[me];
    // mana/draw are events (dispatch applies them); resets stay inline
    // (state maintenance, not events).
    const maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    // overload: the lock applies to THIS turn's pool and is then spent. It
    // subtracts from the emitted mana rather than from maxMana, so the crystal
    // count on screen stays truthful and the lock lasts exactly one turn.
    // lockedMana (Task 6) keeps the spent lock visible for the tray ledger:
    // overload is the amount waiting for the next turn, lockedMana the amount
    // currently struck through. Both are state (inline), never events — the
    // manaChanged event is what the UI animates.
    const locked = Math.min(p.overload, maxMana);
    p.overload = 0;
    p.lockedMana = locked;
    p.hero.usedPower = false;
    p.hero.discountMostExpensive = 0;
    p.hero.discountNextSpell = 0;
    // thaw frozen creatures (emitting thawed — audit 01 M1 symmetry with
    // frozen), ready the active player's creatures (summoning sickness ends
    // at the start of the owner's next turn; rush/charge creatures are
    // already un-exhausted from summon), restore attacks (attacksLeft =
    // windfury ? 2 : 1). Exhausted creatures stay exhausted only within the
    // turn they were summoned.
    for (const c of p.board) {
      if (c.frozen) {
        c.frozen = false;
        this.emit({ type: 'thawed', creatureId: c.id });
      }
      c.exhausted = false;
      c.attacksLeft = c.keywords.includes('windfury') ? 2 : 1;
    }
    // ORDER IS LOAD-BEARING: manaChanged sets the turn's baseline FIRST, then
    // turnStart's dispatch fires startOfTurn triggers on top of it. Emitting
    // turnStart first meant a ramp artifact's gainMana landed during that
    // dispatch and was then overwritten by this manaChanged, which carries the
    // value computed BEFORE the trigger ran — so Sylvan Grove and Idol of
    // Growth granted nothing at all. Any future effect that adjusts mana from
    // a startOfTurn trigger (overload included) depends on this ordering.
    this.emit({ type: 'manaChanged', player: me, mana: maxMana - locked, maxMana });
    this.emit({ type: 'turnStart', player: me, mana: maxMana });
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
