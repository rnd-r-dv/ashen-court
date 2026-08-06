import type { GameEvent, GameState } from '../types.js';

/**
 * Event resolution queue.
 *
 * Game implements Resolver: dispatch() applies one event to `state` and may
 * enqueue follow-up events (e.g. turnEnd advances the turn and emits
 * beginTurn's turnStart/manaChanged/cardDrawn follow-ups). runQueue drains the
 * queue, applying every event in FIFO order and returning the applied events.
 * Events are the ONLY mutation path (single-writer rule) — every deck/hand/
 * mana/phase change flows through dispatch.
 */
export interface Resolver {
  state: GameState;
  random(): number;
  pickRandom<T>(arr: readonly T[]): T;
  /** Apply one event: mutate state, may enqueue follow-ups onto `queue`. */
  dispatch(evt: GameEvent): void;
  /** Pending resolution queue (FIFO). */
  queue: GameEvent[];
  /** Every applied event of the current top-level drain (see runQueue). */
  applied: GameEvent[];
  /** True while a drain is active on this resolver (nested-drain detection). */
  draining: boolean;
}

/**
 * Drain the resolver's queue, applying each event via dispatch() and
 * collecting every applied event in order. dispatch may push follow-ups, which
 * are picked up by the same loop. The iteration guard (1000 per submission)
 * prevents infinite trigger loops from ever hanging the engine.
 *
 * Nested drains (applyEffect drains internally via runQueue) share the
 * collector: the TOP-LEVEL call returns every event applied across the whole
 * resolution tree in order, so applyEvent/submit keep the documented contract
 * "returns every event applied, including follow-ups" (LAN rendering / replay
 * need the trigger follow-ups too).
 */
export function runQueue(resolver: Resolver): GameEvent[] {
  const top = !resolver.draining;
  if (top) resolver.applied = [];
  resolver.draining = true;
  try {
    let iterations = 0;
    while (resolver.queue.length > 0) {
      if (++iterations > 1000) throw new Error('Event loop exceeded');
      const evt = resolver.queue.shift()!;
      resolver.dispatch(evt);
      resolver.applied.push(evt);
    }
    return resolver.applied;
  } finally {
    resolver.draining = false;
  }
}
