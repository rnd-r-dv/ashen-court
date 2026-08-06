import { CardRegistry } from '../cards.js';
import { createTestPool } from '../data/test-pool.js';
import { createRng, shuffle } from '../rng.js';
import type { Rng } from '../rng.js';
import type { GameEvent, GameState, HeroSpec, Intent, PlayerIndex, PlayerState } from '../types.js';
import { validateDeck } from '../validate.js';
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
export class Game {
  state: GameState;
  registry: CardRegistry;

  private rng: Rng;
  private rngCalls = 0;
  private mulligansDone = new Set<PlayerIndex>();
  private pending: GameEvent[] = [];

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
      while (p.hand.length < STARTING_HAND && p.deck.length > 0) {
        const cardId = p.deck.pop()!;
        p.hand.push(cardId);
        this.emit({ type: 'cardDrawn', player: mp, cardId });
      }
      this.mulligansDone.add(mp);
      if (this.mulligansDone.size === 2) this.startMain();
      return this.drain();
    }
    if (intent.kind === 'endTurn') {
      return this.endTurn(me);
    }
    throw new Error('Intent not implemented yet');   // replaced in Tasks 9-11
  }

  /** Dispatch only (LAN rendering / replay); state mutation lands in Task 12+. */
  applyEvent(evt: GameEvent): void {
    void evt;
    // TODO(Task 12+): apply event to state for LAN rendering / replay.
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
    g.pending = [];
    // Re-seed from the saved position; advancing `calls` draws through the
    // counting wrapper restores both the raw rng position and rngCalls.
    const raw = createRng(state.rngState.seed);
    g.rng = () => { g.rngCalls++; return raw(); };
    for (let i = 0; i < state.rngState.calls; i++) g.rng();
    return g;
  }

  private emit(evt: GameEvent): void {
    this.state.log.push(evt);
    this.pending.push(evt);
  }

  private drain(): GameEvent[] {
    const evts = this.pending;
    this.pending = [];
    return evts;
  }

  private startMain(): void {
    this.state.phase = 'main';
    this.mulligansDone = new Set();
    this.beginTurn(0);
  }

  private beginTurn(me: PlayerIndex): void {
    const p = this.state.players[me];
    p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    p.hero.usedPower = false;
    p.hero.discountCheapest = 0;
    p.hero.discountNextSpell = 0;
    // thaw frozen creatures, restore attacks (keep `exhausted` for creatures
    // that can't attack yet; rush/charge clear exhausted on summon)
    for (const c of p.board) {
      if (c.frozen) {
        c.frozen = false;
        this.emit({ type: 'thawed', creatureId: c.id });
      }
      c.attacksLeft = c.keywords.includes('windfury') ? 2 : 1;
    }
    this.emit({ type: 'turnStart', player: me, mana: p.mana });
    this.emit({ type: 'manaChanged', player: me, mana: p.mana, maxMana: p.maxMana });
    // draw 1 (empty deck: no cardDrawn event, fatigue arrives in a later task)
    if (p.deck.length > 0) {
      const cardId = p.deck.pop()!;
      p.hand.push(cardId);
      this.emit({ type: 'cardDrawn', player: me, cardId });
    }
  }

  private endTurn(me: PlayerIndex): GameEvent[] {
    this.emit({ type: 'turnEnd', player: me });
    this.state.turn += 1;
    this.beginTurn(this.currentPlayer());
    return this.drain();
  }
}
