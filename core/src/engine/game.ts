import { CardRegistry } from '../cards.js';
import { createTestPool } from '../data/test-pool.js';
import { createRng, shuffle } from '../rng.js';
import type { Rng } from '../rng.js';
import type { GameEvent, GameState, HeroSpec, Intent, PlayerIndex, PlayerState } from '../types.js';
import { validateDeck } from '../validate.js';
import { runQueue } from './events.js';
import type { Resolver } from './events.js';
import { deserializeState, serializeState } from './serialize.js';

export interface MatchSetup {
  decks: [string[], string[]];            // card ids, player 0 first
  heroes: [HeroSpec, HeroSpec];
  seed: number;
}

export const MANA_SURGE = 'mana-surge';
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
    throw new Error('Intent not implemented yet');   // replaced in Tasks 9-11
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
        break;   // no-op marker: mana/draw payloads ride in separate events
      case 'gameOver':
        this.state.phase = 'gameOver';
        break;
      case 'turnEnd':
        this.state.turn += 1;
        this.beginTurn(this.currentPlayer());
        break;
      // Task 6 effects-library events: effects apply their state mutations
      // inline (per the effects brief); these handlers exist so runQueue
      // accepts the events. Real resolution (death/removal, onDamage,
      // trigger wiring) lands in Task 8+.
      case 'damageDealt':
      case 'creatureDied':
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

  private endTurn(me: PlayerIndex): GameEvent[] {
    this.emit({ type: 'turnEnd', player: me });
    // dispatch(turnEnd) advances the turn and calls beginTurn(next); beginTurn
    // emits its own follow-up events, applied by runQueue in the same loop.
    return runQueue(this);
  }
}
