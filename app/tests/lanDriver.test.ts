// LAN driver shadow-mirror tests (Task 34). The driver's job is to keep the
// local shadow Game identical to the server's authoritative Game. These tests
// drive a real core Game through a fake LanClient and assert the mirroring
// contract: own intents are replayed locally (their broadcast echoes are
// recognized by content and NOT re-applied), opponent turnEnd broadcasts
// advance the turn (dispatch regenerates the beginTurn follow-ups), and the
// opponent's completing mulligan transitions the shadow out of the mulligan
// phase. Expected event streams come from a fresh mirror Game with the same
// seed (determinism is the Task 33 LAN-mirroring contract).
import { describe, expect, it } from 'vitest';
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck } from '@ashen/core';
import type { GameEvent, Intent } from '@ashen/core';
import type { ClientMessage, ServerMessage } from '@ashen/server/protocol';
import { createLanDriver } from '../src/game/lanDriver.js';
import type { LanClient } from '../src/game/lanClient.js';

const DECK = expandDeck(DECK_DEFS.ember);
const HERO = HEROES[0]!;
const SEED = 2;
const REGISTRY = new CardRegistry([...buildPool()]);

const MULLIGAN: Intent = { kind: 'mulligan', keep: [] };

function makeGame(): Game {
  return Game.create({ decks: [DECK, DECK], heroes: [HERO, HERO], seed: SEED }, REGISTRY);
}

/** Deterministic mirror: identical setup → identical events for identical intents.
 *  Runs the whole script; returns the LAST intent's resolution tree. */
function mirrorEvents(...script: Intent[]): GameEvent[] {
  const mirror = makeGame();
  let out: GameEvent[] = [];
  for (const intent of script) out = mirror.submit(intent);
  return out;
}

/** Minimal LanClient double: captures sends, lets tests push server messages. */
class FakeLanClient {
  sent: ClientMessage[] = [];
  private handlers = new Set<(m: ServerMessage) => void>();
  addMessageHandler(cb: (m: ServerMessage) => void): void {
    this.handlers.add(cb);
  }
  send(m: ClientMessage): void {
    this.sent.push(m);
  }
  receive(m: ServerMessage): void {
    for (const cb of [...this.handlers]) cb(m);
  }
}

describe('createLanDriver shadow mirror', () => {
  it('replays own intents locally, sends them, and skips their echo (no double apply)', () => {
    const client = new FakeLanClient();
    const game = makeGame();
    const driver = createLanDriver(client as unknown as LanClient, game);
    const logBefore = game.state.log.length;

    driver.submit(MULLIGAN);
    // Sent to the server AND applied to the shadow (deterministic mirror).
    expect(client.sent).toEqual([{ type: 'intent', intent: MULLIGAN }]);
    expect(game.state.log.length).toBe(logBefore + 3); // 3 cardDrawn redraws applied
    expect(game.state.mulligansDone[0]).toBe(true);

    // The server's echo is the identical resolution tree (same seed → same
    // events). The driver must recognize it as ours and not re-apply.
    client.receive({ type: 'events', events: mirrorEvents(MULLIGAN) });
    expect(game.state.log.length).toBe(logBefore + 3); // unchanged — no double apply
  });

  it('applies the opponent completing mulligan and turnEnd broadcasts', () => {
    const client = new FakeLanClient();
    const game = makeGame();
    const driver = createLanDriver(client as unknown as LanClient, game);
    const received: GameEvent[][] = [];
    driver.onEvents((batch) => received.push(batch));

    // My (p0) mulligan: replayed locally.
    driver.submit(MULLIGAN);

    // Opponent's (p1) mulligan completes the phase: [3 p1 redraws, turnStart,
    // manaChanged, cardDrawn]. The redraws are not reconstructable (inline
    // discards), but the transition to main + beginTurn(0) emissions are.
    const oppMulligan = mirrorEvents(MULLIGAN, MULLIGAN);
    expect(oppMulligan.some(e => e.type === 'turnStart')).toBe(true);
    client.receive({ type: 'events', events: oppMulligan });
    expect(game.state.phase).toBe('main');
    expect(game.state.turn).toBe(0);
    expect(game.state.players[0].mana).toBe(1);
    expect(game.state.players[0].hand).toHaveLength(4); // 3 redraws + beginTurn draw

    // My endTurn: local replay advances the shadow to p1's turn. The echo must
    // be skipped (content match + turnEnd player no longer current).
    driver.submit({ kind: 'endTurn' });
    expect(game.state.turn).toBe(1);
    const myEndTurn = mirrorEvents(MULLIGAN, MULLIGAN, { kind: 'endTurn' });
    expect(myEndTurn[0]!.type).toBe('turnEnd');
    const logBeforeEcho = game.state.log.length;
    client.receive({ type: 'events', events: myEndTurn });
    expect(game.state.log.length).toBe(logBeforeEcho); // own echo skipped
    expect(game.state.turn).toBe(1); // NOT double-advanced

    // Opponent's endTurn: applied — dispatch regenerates p0's beginTurn.
    const oppEndTurn = mirrorEvents(MULLIGAN, MULLIGAN, { kind: 'endTurn' }, { kind: 'endTurn' });
    expect(oppEndTurn[0]!.type).toBe('turnEnd');
    expect((oppEndTurn[0] as Extract<GameEvent, { type: 'turnEnd' }>).player).toBe(1);
    client.receive({ type: 'events', events: oppEndTurn });
    expect(game.state.turn).toBe(2);
    expect(game.state.players[0].mana).toBe(2); // p0's turn-2 refill regenerated

    // The client's own side is exact: p0's hand matches a full mirror that ran
    // the identical intent script (opponent hand content is the documented v1
    // gap — the protocol broadcasts events, not the opponent's intents).
    const fullMirror = makeGame();
    fullMirror.submit(MULLIGAN);
    fullMirror.submit(MULLIGAN);
    fullMirror.submit({ kind: 'endTurn' });
    fullMirror.submit({ kind: 'endTurn' });
    expect(game.state.players[0].hand).toEqual(fullMirror.state.players[0].hand);

    // Every broadcast (own echoes included) reached the UI listeners.
    expect(received).toHaveLength(3);
  });

  it('applies a gameOver broadcast to the shadow and forwards the batch', () => {
    const client = new FakeLanClient();
    const game = makeGame();
    const driver = createLanDriver(client as unknown as LanClient, game);
    const received: GameEvent[][] = [];
    driver.onEvents((batch) => received.push(batch));

    // Bring the shadow into main at p1's turn (mulligans + my endTurn).
    driver.submit(MULLIGAN);
    client.receive({ type: 'events', events: mirrorEvents(MULLIGAN, MULLIGAN) });
    driver.submit({ kind: 'endTurn' });
    client.receive({ type: 'events', events: mirrorEvents(MULLIGAN, MULLIGAN, { kind: 'endTurn' }) });
    expect(game.state.turn).toBe(1);

    // A mirror forced to MAX_TURNS produces a turn-limit draw resolution tree;
    // the broadcast contains a gameOver event, which the driver applies.
    const mirror = makeGame();
    mirror.submit(MULLIGAN);
    mirror.submit(MULLIGAN);
    mirror.submit({ kind: 'endTurn' });
    mirror.state.turn = 200; // MAX_TURNS → checkWin emits the draw on the next submit
    const events = mirror.submit({ kind: 'endTurn' });
    expect(events.some(e => e.type === 'gameOver')).toBe(true);

    client.receive({ type: 'events', events });
    expect(game.state.phase).toBe('gameOver');
    expect(received.at(-1)).toEqual(events); // the full broadcast reached the UI
  });
});
