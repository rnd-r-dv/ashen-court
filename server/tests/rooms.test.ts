// LAN server tests (Task 33). Each test runs the REAL server on an ephemeral
// port (PORT=0) and drives it with two 'ws' clients (host = player 0, guest =
// player 1). All tests are hermetic: their own server + sockets, closed after.
//
// Client wrapper: ONE persistent 'message' listener per socket pushes every
// received message into a queue; waitFor consumes matching messages from the
// queue. This is race-free — the server answers a request with a BURST of
// frames (joinRoom → joined + opponentJoined + gameStart), and every client
// receives BOTH players' event broadcasts, so listeners must be able to see
// messages that arrive at any time. Event-broadcast waits use content-exact
// predicates derived from a local mirror Game (LAN-mirroring determinism
// contract) so stale broadcasts never satisfy the wrong wait.
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo, RawData } from 'ws';
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck, validateCard } from '@ashen/core';
import type { Card, GameEvent, Intent } from '@ashen/core';
import { startServer } from '../src/index.js';
import type { LanServer } from '../src/index.js';
import type { ClientMessage, ServerMessage } from '../src/protocol.js';

// Deterministic 60-card ember deck + hero for every test.
const DECK = expandDeck(DECK_DEFS.ember);
const HERO_NAME = HEROES[0]!.name;
const HERO = HEROES[0]!;
// Seed 2 (fixed by test): after both mulligans keep [], player 0's hand is
// [ember-hellhound, neutral-boar, ember-firestorm, ember-igniter] — a legal
// 1-cost creature play exists at hand index 1 (neutral-boar). Verified against
// the deterministic engine (LAN-mirroring contract).
const SEED = 2;
const PLAY_INDEX = 1;
const PLAY_CARD = 'neutral-boar';

/** Simple valid custom card (1-cost 1/1 creature) — passes validateCard. */
const CUSTOM_CARD: Card = {
  id: 'custom-1', name: 'Custom One', type: 'creature', cost: 1, attack: 1, health: 1,
  keywords: [], effects: [], rarity: 'common', archetype: 'neutral',
  art: { preset: 'ember', palette: ['#2b0d0d', '#ff6b35'], seed: 1 },
  author: 'custom', version: 1,
};

async function makeServer(): Promise<LanServer> {
  const srv = startServer(0);
  await new Promise<void>((resolve, reject) => {
    srv.wss.once('listening', resolve);
    srv.wss.once('error', reject);
  });
  return srv;
}

function urlOf(srv: LanServer): string {
  const addr = srv.wss.address() as AddressInfo;
  return `ws://127.0.0.1:${addr.port}`;
}

async function connect(url: string): Promise<WebSocket> {
  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return ws;
}

function parse(raw: RawData): ServerMessage {
  return JSON.parse(raw.toString()) as ServerMessage;
}

interface Pending {
  predicate: (m: ServerMessage) => boolean;
  resolve: (m: ServerMessage) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** ws wrapper: queue-backed, so no message is ever missed or double-consumed. */
class TestClient {
  private readonly queue: ServerMessage[] = [];
  private readonly pendings: Pending[] = [];
  readonly ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw: RawData) => {
      let msg: ServerMessage;
      try { msg = parse(raw); } catch { return; }
      for (let i = 0; i < this.pendings.length; i++) {
        const p = this.pendings[i]!;
        if (p.predicate(msg)) {
          this.pendings.splice(i, 1);
          clearTimeout(p.timer);
          p.resolve(msg);
          return;
        }
      }
      this.queue.push(msg);
    });
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolve with the first queued/arriving message matching `predicate`. */
  waitFor(predicate: (m: ServerMessage) => boolean, timeoutMs = 3000): Promise<ServerMessage> {
    const idx = this.queue.findIndex(predicate);
    if (idx >= 0) return Promise.resolve(this.queue.splice(idx, 1)[0]!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendings.splice(this.pendings.findIndex(p => p.timer === timer), 1);
        reject(new Error('Timed out waiting for a matching message'));
      }, timeoutMs);
      this.pendings.push({ predicate, resolve, reject, timer });
    });
  }

  /** Reject if any NEW message arrives within `ms` (pre-queued messages are fine). */
  expectNoMessage(ms = 250): Promise<void> {
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        predicate: () => true,
        resolve: () => { cleanup(); reject(new Error('Unexpected message received')); },
        reject,
        timer: setTimeout(() => { cleanup(); resolve(); }, ms),
      };
      const cleanup = () => {
        clearTimeout(pending.timer);
        this.pendings.splice(this.pendings.indexOf(pending), 1);
      };
      this.pendings.push(pending);
    });
  }

  close(): void {
    this.ws.close();
  }
}

async function makeClients(srv: LanServer): Promise<{ host: TestClient; guest: TestClient }> {
  const url = urlOf(srv);
  return {
    host: new TestClient(await connect(url)),
    guest: new TestClient(await connect(url)),
  };
}

/** Content-exact events predicate: matches the broadcast whose events equal `expected`. */
function eventsEq(expected: GameEvent[]): (m: ServerMessage) => boolean {
  return m => m.type === 'events' && JSON.stringify(m.events) === JSON.stringify(expected);
}

/** Full create + join + gameStart for both sockets. */
async function startRoom(srv: LanServer): Promise<{ host: TestClient; guest: TestClient; code: string }> {
  const { host, guest } = await makeClients(srv);
  host.send({
    type: 'createRoom', name: 'Hosty',
    deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED,
  });
  const created = await host.waitFor(m => m.type === 'roomCreated');
  if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
  const joinedP = guest.waitFor(m => m.type === 'joined');
  const oppP = host.waitFor(m => m.type === 'opponentJoined');
  const hostStartP = host.waitFor(m => m.type === 'gameStart');
  const guestStartP = guest.waitFor(m => m.type === 'gameStart');
  guest.send({ type: 'joinRoom', code: created.code });
  await joinedP;
  await oppP;
  await hostStartP;
  await guestStartP;
  return { host, guest, code: created.code };
}

/** Mirror of the server-side game for the deterministic LAN-mirroring contract. */
function mirrorGame(deckIds: string[], seed: number, customCards: Card[] = []): Game {
  return Game.create(
    { decks: [deckIds, deckIds], heroes: [HERO, HERO], seed },
    new CardRegistry([...buildPool(), ...customCards]),
  );
}

describe('LAN rooms', () => {
  it('host creates, joiner joins, game starts', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      expect(created.player).toBe(0);
      // 4 letters from A-Z minus O and I
      expect(created.code).toMatch(/^[A-HJ-NP-Z]{4}$/);

      const joinedP = guest.waitFor(m => m.type === 'joined');
      const oppP = host.waitFor(m => m.type === 'opponentJoined');
      const hostStartP = host.waitFor(m => m.type === 'gameStart');
      const guestStartP = guest.waitFor(m => m.type === 'gameStart');
      guest.send({ type: 'joinRoom', code: created.code });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.player).toBe(1);
      expect(joined.seed).toBe(SEED);
      expect(joined.opponentName).toBe('Hosty');
      expect(joined.deckIds).toEqual(DECK);
      expect(joined.cards.length).toBeGreaterThan(0);
      expect((await oppP).type).toBe('opponentJoined');
      expect((await hostStartP).type).toBe('gameStart');
      expect((await guestStartP).type).toBe('gameStart');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('intents flow: host plays a card, both clients receive identical events', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      const mirror = mirrorGame(DECK, SEED);
      // Mulligans (keep nothing) for both players. Each broadcast is matched by
      // content against the local mirror (LAN-mirroring determinism), so stale
      // broadcasts from the other player can never satisfy the wrong wait.
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const hostM1P = host.waitFor(eventsEq(m1));
      const guestM1P = guest.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await hostM1P).type).toBe('events');
      expect((await guestM1P).type).toBe('events');

      const m2 = mirror.submit({ kind: 'mulligan', keep: [] });
      const hostM2P = host.waitFor(eventsEq(m2));
      const guestM2P = guest.waitFor(eventsEq(m2));
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await hostM2P).type).toBe('events');
      expect((await guestM2P).type).toBe('events');

      // Host (player 0, turn 0, 1 mana) plays the 1-cost Wild Boar at hand 1.
      const play = mirror.submit({ kind: 'playCard', handIndex: PLAY_INDEX });
      expect(play.some(e => e.type === 'cardPlayed' && e.cardId === PLAY_CARD)).toBe(true);
      const hostPlayP = host.waitFor(eventsEq(play));
      const guestPlayP = guest.waitFor(eventsEq(play));
      host.send({ type: 'intent', intent: { kind: 'playCard', handIndex: PLAY_INDEX } });
      const hostPlay = await hostPlayP;
      const guestPlay = await guestPlayP;
      if (hostPlay.type !== 'events' || guestPlay.type !== 'events') throw new Error('play events never arrived');
      // Both clients received the identical resolution tree.
      expect(guestPlay.events).toEqual(hostPlay.events);
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('rejects a guest endTurn during the host main turn (server turn gating)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      const mirror = mirrorGame(DECK, SEED);
      // Both mulligans complete (host = player 0 mulligans first, then guest).
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
      const m2 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m2P = guest.waitFor(eventsEq(m2));
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m2P).type).toBe('events');
      // It is now the host's (player 0) main turn. The guest's endTurn must be
      // rejected: error reply to the sender ONLY, nothing broadcast, and the
      // authoritative game untouched.
      const errP = guest.waitFor(m => m.type === 'error');
      const hostSilenceP = host.expectNoMessage();
      guest.send({ type: 'intent', intent: { kind: 'endTurn' } });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/not your turn/i);
      await hostSilenceP;
      // State unchanged: the host's next legal play still resolves exactly as
      // the mirror expects (no ghost endTurn shifted the turn or consumed mana).
      const play = mirror.submit({ kind: 'playCard', handIndex: PLAY_INDEX });
      expect(play.some(e => e.type === 'cardPlayed' && e.cardId === PLAY_CARD)).toBe(true);
      const playP = host.waitFor(eventsEq(play));
      host.send({ type: 'intent', intent: { kind: 'playCard', handIndex: PLAY_INDEX } });
      expect((await playP).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('rejects a guest mulligan while the host is the mulligan actor (server turn gating)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      const mirror = mirrorGame(DECK, SEED);
      // Engine mulligan order is fixed (player 0, then player 1): the guest
      // acting first must get an error reply with nothing broadcast.
      const errP = guest.waitFor(m => m.type === 'error');
      const hostSilenceP = host.expectNoMessage();
      const guestSilenceP = guest.expectNoMessage();
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/not your turn/i);
      await hostSilenceP;
      await guestSilenceP;
      // The authoritative game is untouched: the host's mulligan still
      // resolves as the mirror expects, then the guest's own mulligan too.
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
      const m2 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m2P = guest.waitFor(eventsEq(m2));
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m2P).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('custom cards sync to the joiner', async () => {
    expect(validateCard(CUSTOM_CARD).filter(i => i.severity === 'error')).toEqual([]);
    // Host deck: ember deck with one card swapped for the custom card
    // (still 60 cards, within rarity copy limits).
    const deck = [...DECK];
    deck[deck.length - 1] = CUSTOM_CARD.id;
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: deck, customCards: [CUSTOM_CARD], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const joinedP = guest.waitFor(m => m.type === 'joined');
      const hostStartP = host.waitFor(m => m.type === 'gameStart');
      const guestStartP = guest.waitFor(m => m.type === 'gameStart');
      guest.send({ type: 'joinRoom', code: created.code });
      // The joiner's 'joined' carries the merged registry incl. the custom def.
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      const custom = joined.cards.find(c => c.id === CUSTOM_CARD.id);
      expect(custom).toBeDefined();
      expect(custom?.name).toBe('Custom One');
      expect((await hostStartP).type).toBe('gameStart');
      expect((await guestStartP).type).toBe('gameStart');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('illegal intent gets an error reply, not a crash', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      const mirror = mirrorGame(DECK, SEED);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
      const m2 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m2P = guest.waitFor(eventsEq(m2));
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m2P).type).toBe('events');
      // Bad hand index → submit throws → error reply to the sender only.
      const errP = host.waitFor(m => m.type === 'error');
      const silenceP = guest.expectNoMessage();
      host.send({ type: 'intent', intent: { kind: 'playCard', handIndex: 99 } });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/hand index/i);
      await silenceP;   // no events were broadcast to the opponent
      // The game is still alive: a legal endTurn afterwards broadcasts normally.
      const end = mirror.submit({ kind: 'endTurn' });
      expect(end.some(e => e.type === 'turnEnd')).toBe(true);
      const endP = host.waitFor(eventsEq(end));
      host.send({ type: 'intent', intent: { kind: 'endTurn' } });
      expect((await endP).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('invalid host deck errors to the joiner instead of crashing', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    let host2: TestClient | undefined;
    let guest2: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      // Host creates with a deck that fails Game-constructor validation
      // (3 cards instead of 60): the room is created but no Game is built yet.
      const BAD_DECK = DECK.slice(0, 3);
      host.send({ type: 'createRoom', name: 'BadHost', deckIds: BAD_DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      // Joining must NOT crash the server: the joiner gets an error reply ONLY
      // (nothing is broadcast to the host).
      const errP = guest.waitFor(m => m.type === 'error');
      const hostSilenceP = host.expectNoMessage();
      guest.send({ type: 'joinRoom', code: created.code });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/Deck 0 invalid/i);
      await hostSilenceP;
      // The room was left joinable (no half-installed seat): a retry gets the
      // same deck error, NOT "Room is full".
      const retryP = guest.waitFor(m => m.type === 'error');
      guest.send({ type: 'joinRoom', code: created.code });
      const retry = await retryP;
      if (retry.type !== 'error') throw new Error('error never arrived');
      expect(retry.message).toMatch(/Deck 0 invalid/i);
      // The server process is still alive: a follow-up create + join works.
      ({ host: host2, guest: guest2 } = await makeClients(srv));
      host2.send({ type: 'createRoom', name: 'GoodHost', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created2 = await host2.waitFor(m => m.type === 'roomCreated');
      if (created2.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const joinedP = guest2.waitFor(m => m.type === 'joined');
      guest2.send({ type: 'joinRoom', code: created2.code });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.player).toBe(1);
    } finally {
      host?.close();
      guest?.close();
      host2?.close();
      guest2?.close();
      await srv.close();
    }
  });

  it('disconnect notifies the other player', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      const leftP = host.waitFor(m => m.type === 'playerLeft');
      guest.close();
      const left = await leftP;
      if (left.type !== 'playerLeft') throw new Error('playerLeft never arrived');
      expect(left.reason).toMatch(/disconnected/i);
    } finally {
      host?.close();
      await srv.close();
    }
  });

  it('rematch requires both players and starts a new game', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      // One rematch alone must not start anything.
      const hostSilenceP = host.expectNoMessage();
      const guestSilenceP = guest.expectNoMessage();
      host.send({ type: 'rematch' });
      await hostSilenceP;
      await guestSilenceP;
      // Both players rematch → rematchStart to both, new game with seed + 1.
      const hostP = host.waitFor(m => m.type === 'rematchStart');
      const guestP = guest.waitFor(m => m.type === 'rematchStart');
      guest.send({ type: 'rematch' });
      expect((await hostP).type).toBe('rematchStart');
      expect((await guestP).type).toBe('rematchStart');
      // The new game is fresh (mulligan phase) and seeded old + 1: a mulligan
      // intent's broadcast must match a mirror game with seed SEED + 1.
      const mirror = mirrorGame(DECK, SEED + 1);
      const m = mirror.submit({ kind: 'mulligan', keep: [] });
      const mullP = host.waitFor(eventsEq(m));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await mullP).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });
});
