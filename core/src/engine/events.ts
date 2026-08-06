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
}

/**
 * Drain the resolver's queue, applying each event via dispatch() and
 * collecting every applied event in order. dispatch may push follow-ups, which
 * are picked up by the same loop. The iteration guard (1000 per submission)
 * prevents infinite trigger loops from ever hanging the engine.
 */
export function runQueue(resolver: Resolver): GameEvent[] {
  const applied: GameEvent[] = [];
  let iterations = 0;
  while (resolver.queue.length > 0) {
    if (++iterations > 1000) throw new Error('Event loop exceeded');
    const evt = resolver.queue.shift()!;
    resolver.dispatch(evt);
    applied.push(evt);
  }
  return applied;
}
