import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import type { Intent } from '../src/types.js';
import { makeTestSetup } from './helpers.js';

describe('serialization', () => {
  it('clone() produces an equal state', () => {
    const a = Game.create(makeTestSetup()); a.state.phase = 'main';
    const b = a.clone();
    expect(b.serialize()).toBe(a.serialize());
  });
  it('applying identical intents to two games from the same seed diverges identically (replay)', () => {
    const a = Game.create(makeTestSetup()); const b = Game.create(makeTestSetup());
    a.submit({ kind: 'mulligan', keep: [] }); a.submit({ kind: 'mulligan', keep: [] });
    b.submit({ kind: 'mulligan', keep: [] }); b.submit({ kind: 'mulligan', keep: [] });
    // legalIntents-driven deterministic script: same seed → same states → same
    // picks. legalIntents returns fully-formed intents (targets where required).
    for (let step = 0; step < 8; step++) {
      if (a.state.phase === 'gameOver') break;
      const me = a.currentPlayer();
      const legal = a.legalIntents(me);
      const play = legal.find(i => i.kind === 'playCard' || i.kind === 'attack' || i.kind === 'heroPower');
      const intent = play ?? legal[0]!;   // endTurn fallback (main phase always has it)
      const ea = a.submit(intent); const eb = b.submit(intent);
      expect(ea).toEqual(eb);
    }
    expect(a.serialize()).toBe(b.serialize());
  });
  it('serialize/deserialize round-trips identical after a script of intents', () => {
    const a = Game.create(makeTestSetup());
    const script: Intent[] = [
      { kind: 'mulligan', keep: [] }, { kind: 'mulligan', keep: [] },
      { kind: 'endTurn' },
    ];
    for (const i of script) a.submit(i);
    const b = Game.deserialize(a.serialize(), a.registry);
    expect(b.serialize()).toBe(a.serialize());
  });
  it('applyEvent-driven game matches submit-driven game (dispatch-driven flows only)', () => {
    const a = Game.create(makeTestSetup()); const b = Game.create(makeTestSetup());
    // Dispatch-driven flows (turn transitions + beginTurn emissions) are fully
    // event-captured, so replaying the events via applyEvent reconstructs state.
    // playCard/attack/heroPower resolve INLINE in submit (mana payment, hand
    // removal, summon, damage are direct mutations; their events are the
    // broadcast/animation stream) — NOT event-reconstructable by design.
    // NOTE: mulligan DISCARDS are inline too, so both games run their own
    // mulligan submits; only the endTurn resolution is replayed as events.
    a.submit({ kind: 'mulligan', keep: [] }); a.submit({ kind: 'mulligan', keep: [] });
    b.submit({ kind: 'mulligan', keep: [] }); b.submit({ kind: 'mulligan', keep: [] });
    const events = a.submit({ kind: 'endTurn' });
    // submit returns the FULL resolution tree (Task 9 session-wrap) — the
    // beginTurn follow-ups in `events` are the RESULT of dispatching turnEnd,
    // which regenerates them. Only the direct event is replayable input;
    // re-applying the follow-ups would double-draw/duplicate the log.
    for (const evt of events) if (evt.type === 'turnEnd') b.applyEvent(evt);
    // Full serialization equality is valid: setup shuffle consumes the seeded RNG
    // identically in both games and mulligan/endTurn consume none, so rngState
    // matches after the replay.
    expect(b.serialize()).toBe(a.serialize());
  });
  it('serialize mid-mulligan preserves mulligan progress', () => {
    const a = Game.create(makeTestSetup());
    a.submit({ kind: 'mulligan', keep: [] });
    const b = Game.deserialize(a.serialize(), a.registry);
    expect(a.state.phase).toBe('mulligan');
    b.submit({ kind: 'mulligan', keep: [] });   // must be player 1, not player 0 again
    expect(b.state.phase).toBe('main');
  });
});
