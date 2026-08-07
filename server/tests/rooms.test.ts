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
import type { Card, GameEvent, HeroSpec, Intent } from '@ashen/core';
import { startServer } from '../src/index.js';
import type { LanServer } from '../src/index.js';
import type { ClientMessage, ServerMessage } from '../src/protocol.js';

// Deterministic 60-card ember deck + hero for every test.
const DECK = expandDeck(DECK_DEFS.ember);
const CHOIR_DECK = expandDeck(DECK_DEFS.choir);
const HERO_NAME = HEROES[0]!.name;
const HERO = HEROES[0]!;
const CHOIR_HERO = HEROES[1]!;
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

/**
 * Join `code` on a FRESH client, retrying while the server still answers
 * 'Room is full'.
 *
 * A socket close is observed by the server ASYNCHRONOUSLY: ws delivers the
 * 'close' event, and only then does RoomRegistry.onDisconnect null the slot.
 * A rejoin issued immediately after close() can therefore legitimately race
 * ahead of that observation and be told the room is full — which made the
 * both-players-away test flaky (~2 of 3 under a -t filtered run, where the
 * lighter event loop lets the rejoin win the race more often).
 *
 * Retrying inside a bounded window waits for the observation without weakening
 * what the test asserts: a slot that never frees still fails the test, on
 * timeout, and any error OTHER than 'Room is full' fails immediately.
 */
async function joinWhenSlotFree(
  srv: LanServer,
  code: string,
  timeoutMs = 3000,
): Promise<{ client: TestClient; joined: Extract<ServerMessage, { type: 'joined' }> }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const client = new TestClient(await connect(urlOf(srv)));
    const settled = client.waitFor(m => m.type === 'joined' || m.type === 'error', 1000);
    client.send({ type: 'joinRoom', code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
    let msg: ServerMessage;
    try {
      msg = await settled;
    } catch (err) {
      client.close();
      if (Date.now() >= deadline) throw err;
      continue;
    }
    if (msg.type === 'joined') return { client, joined: msg };
    client.close();
    // Only the full-room race is retryable; anything else is a real failure.
    if (msg.type !== 'error' || !/room is full/i.test(msg.message)) {
      throw new Error(`joinRoom rejected: ${msg.type === 'error' ? msg.message : msg.type}`);
    }
    if (Date.now() >= deadline) throw new Error('room never freed a slot within the timeout');
    await new Promise(r => setTimeout(r, 10));
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
  guest.send({ type: 'joinRoom', code: created.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
  await joinedP;
  await oppP;
  await hostStartP;
  await guestStartP;
  return { host, guest, code: created.code };
}

/** Mirror of the server-side game for the deterministic LAN-mirroring contract.
 *  Task 45: both decks are explicit ([host, guest]); heroes default to the
 *  ember hero for both players, pass the real pair when a test needs them. */
function mirrorGame(
  decks: [string[], string[]],
  seed: number,
  customCards: Card[] = [],
  heroes: [HeroSpec, HeroSpec] = [HERO, HERO],
): Game {
  return Game.create({ decks, heroes, seed }, new CardRegistry([...buildPool(), ...customCards]));
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
      guest.send({ type: 'joinRoom', code: created.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.player).toBe(1);
      expect(joined.seed).toBe(SEED);
      expect(joined.opponentName).toBe('Hosty');
      expect(joined.decks[0]).toEqual(DECK);  // host deck
      expect(joined.decks[1]).toEqual(DECK);  // guest deck
      expect(joined.heroes).toEqual([HERO_NAME, HERO_NAME]);
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
      const mirror = mirrorGame([DECK, DECK], SEED);
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
      const mirror = mirrorGame([DECK, DECK], SEED);
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
      const mirror = mirrorGame([DECK, DECK], SEED);
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
      guest.send({ type: 'joinRoom', code: created.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
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
      const mirror = mirrorGame([DECK, DECK], SEED);
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
      guest.send({ type: 'joinRoom', code: created.code, deckIds: BAD_DECK, customCards: [], heroId: HERO_NAME });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/Deck 0 invalid/i);
      await hostSilenceP;
      // The room was left joinable (no half-installed seat): a retry gets the
      // same deck error, NOT "Room is full".
      const retryP = guest.waitFor(m => m.type === 'error');
      guest.send({ type: 'joinRoom', code: created.code, deckIds: BAD_DECK, customCards: [], heroId: HERO_NAME });
      const retry = await retryP;
      if (retry.type !== 'error') throw new Error('error never arrived');
      expect(retry.message).toMatch(/Deck 0 invalid/i);
      // The server process is still alive: a follow-up create + join works.
      ({ host: host2, guest: guest2 } = await makeClients(srv));
      host2.send({ type: 'createRoom', name: 'GoodHost', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created2 = await host2.waitFor(m => m.type === 'roomCreated');
      if (created2.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const joinedP = guest2.waitFor(m => m.type === 'joined');
      guest2.send({ type: 'joinRoom', code: created2.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
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

  it('guest joins with a DIFFERENT deck — the authoritative game uses it (Task 45)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      // The guest joins with the CHOIR deck + its hero: no more mirror match.
      const joinedP = guest.waitFor(m => m.type === 'joined');
      guest.send({ type: 'joinRoom', code: created.code, deckIds: CHOIR_DECK, customCards: [], heroId: CHOIR_HERO.name });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      // The wire carries BOTH decks/heroes, resolved server-side ([0]=host, [1]=guest).
      expect(joined.decks[0]).toEqual(DECK);
      expect(joined.decks[1]).toEqual(CHOIR_DECK);
      expect(joined.heroes[0]).toBe(HERO_NAME);
      expect(joined.heroes[1]).toBe(CHOIR_HERO.name);
      // Scripted match (host mulligan → guest mulligan → host passes → guest
      // plays its own hand card) matches a mirror built with [DECK, CHOIR_DECK]
      // and [HERO, CHOIR_HERO] — proving the authoritative game uses the
      // guest's deck, byte-for-byte.
      const mirror = mirrorGame([DECK, CHOIR_DECK], SEED, [], [HERO, CHOIR_HERO]);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
      const m2 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m2P = guest.waitFor(eventsEq(m2));
      guest.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m2P).type).toBe('events');
      // The guest's redraws came from the CHOIR deck: its hand holds a
      // choir-only card (impossible with the host's ember deck).
      expect(mirror.state.players[1].hand).toContain('choir-banish');
      // Host passes; the guest plays a card only ITS deck could have supplied.
      // The index is derived from the mirror hand rather than hard-coded:
      // audit 02 removed player 1's setup mana head start, so the guest now has
      // 1 crystal (not 2) on turn 1 and the old fixed index 0 (neutral-scroll,
      // cost 2) is no longer affordable. choir-acolyte is a 1-cost choir-only
      // card, so the play itself re-proves the authoritative game used the
      // guest's deck — and the wire still carries a concrete handIndex, so the
      // echoed event tree is compared byte-for-byte against the oracle exactly
      // as before.
      const pass = mirror.submit({ kind: 'endTurn' });
      const passP = host.waitFor(eventsEq(pass));
      host.send({ type: 'intent', intent: { kind: 'endTurn' } });
      expect((await passP).type).toBe('events');
      const handIndex = mirror.state.players[1].hand.indexOf('choir-acolyte');
      expect(handIndex).toBeGreaterThanOrEqual(0);
      const play = mirror.submit({ kind: 'playCard', handIndex });
      expect(play.some(e => e.type === 'cardPlayed')).toBe(true);
      const playP = guest.waitFor(eventsEq(play));
      guest.send({ type: 'intent', intent: { kind: 'playCard', handIndex } });
      expect((await playP).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('invalid guest deck errors to the joiner and leaves the room joinable (Task 45)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      // Host creates with a valid deck; the guest brings a deck that fails
      // Game-constructor validation (3 cards instead of 60).
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const BAD_DECK = DECK.slice(0, 3);
      // Joining must NOT crash the server or half-install the guest seat: the
      // joiner gets an error reply ONLY (nothing broadcast to the host).
      const errP = guest.waitFor(m => m.type === 'error');
      const hostSilenceP = host.expectNoMessage();
      guest.send({ type: 'joinRoom', code: created.code, deckIds: BAD_DECK, customCards: [], heroId: HERO_NAME });
      const err = await errP;
      if (err.type !== 'error') throw new Error('error never arrived');
      expect(err.message).toMatch(/Deck 1 invalid/i);
      await hostSilenceP;
      // The room was left joinable (guestDeckIds reset): a retry with a VALID
      // deck seats normally and starts the game — NOT "Room is full".
      const joinedP = guest.waitFor(m => m.type === 'joined');
      const oppP = host.waitFor(m => m.type === 'opponentJoined');
      const hostStartP = host.waitFor(m => m.type === 'gameStart');
      const guestStartP = guest.waitFor(m => m.type === 'gameStart');
      guest.send({ type: 'joinRoom', code: created.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.player).toBe(1);
      expect(joined.decks[1]).toEqual(DECK);
      expect((await oppP).type).toBe('opponentJoined');
      expect((await hostStartP).type).toBe('gameStart');
      expect((await guestStartP).type).toBe('gameStart');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('guest custom cards register into the merged registry (Task 45)', async () => {
    expect(validateCard(CUSTOM_CARD).filter(i => i.severity === 'error')).toEqual([]);
    // Guest deck: ember deck with one card swapped for the guest's custom card.
    const deck = [...DECK];
    deck[deck.length - 1] = CUSTOM_CARD.id;
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const joinedP = guest.waitFor(m => m.type === 'joined');
      const hostStartP = host.waitFor(m => m.type === 'gameStart');
      const guestStartP = guest.waitFor(m => m.type === 'gameStart');
      // The guest's deck references the custom card, so the server must
      // register the guest's customCards BEFORE the Game constructor runs.
      guest.send({ type: 'joinRoom', code: created.code, deckIds: deck, customCards: [CUSTOM_CARD], heroId: HERO_NAME });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      // 'joined' carries the merged registry incl. the guest's custom def.
      const custom = joined.cards.find(c => c.id === CUSTOM_CARD.id);
      expect(custom).toBeDefined();
      expect(custom?.name).toBe('Custom One');
      expect((await hostStartP).type).toBe('gameStart');
      expect((await guestStartP).type).toBe('gameStart');
      // The game built with the guest's custom deck: a mulligan broadcast
      // matches a mirror whose registry includes the guest's custom card.
      const mirror = mirrorGame([DECK, deck], SEED, [CUSTOM_CARD]);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });

  it('host receives opponentJoined carrying the guest deck/hero (Task 45)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await makeClients(srv));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      const oppP = host.waitFor(m => m.type === 'opponentJoined');
      guest.send({ type: 'joinRoom', code: created.code, deckIds: CHOIR_DECK, customCards: [], heroId: CHOIR_HERO.name });
      const opp = await oppP;
      if (opp.type !== 'opponentJoined') throw new Error('opponentJoined never arrived');
      expect(opp.opponentName).toBe('You');
      expect(opp.decks).toEqual([DECK, CHOIR_DECK]);
      expect(opp.heroes).toEqual([HERO_NAME, CHOIR_HERO.name]);
      expect(opp.seed).toBe(SEED);
      expect(opp.cards.length).toBeGreaterThan(0);
    } finally {
      host?.close();
      guest?.close();
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
      // M5: the message carries the NEW seed (the server's post-increment) so
      // the client never derives it locally (implicit seed+1 coupling).
      const hostP = host.waitFor(m => m.type === 'rematchStart');
      const guestP = guest.waitFor(m => m.type === 'rematchStart');
      guest.send({ type: 'rematch' });
      expect(await hostP).toMatchObject({ type: 'rematchStart', seed: SEED + 1 });
      expect(await guestP).toMatchObject({ type: 'rematchStart', seed: SEED + 1 });
      // The new game is fresh (mulligan phase) and seeded old + 1: a mulligan
      // intent's broadcast must match a mirror game with seed SEED + 1.
      const mirror = mirrorGame([DECK, DECK], SEED + 1);
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

  it('Bug 6: a reconnect notifies the still-connected peer (opponentReconnected)', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    let re: TestClient | undefined;
    let code = '';
    try {
      ({ host, guest, code } = await startRoom(srv));
      // Play one intent so the reconnect burst carries a non-empty log.
      const mirror = mirrorGame([DECK, DECK], SEED);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');

      // The guest drops: the host gets 'Opponent disconnected' (playerLeft).
      const leftP = host.waitFor(m => m.type === 'playerLeft');
      guest.close();
      expect((await leftP).type).toBe('playerLeft');

      // The guest reconnects. The STILL-CONNECTED host must be told, or its
      // "Opponent disconnected" banner never clears (App.tsx only clears on
      // its OWN joined). It must NOT be an opponentJoined: the LAN driver
      // rebuilds its shadow from that payload, and the host — unlike the
      // reconnecting client — gets no intent-log replay to catch back up.
      re = new TestClient(await connect(urlOf(srv)));
      const backP = host.waitFor(m => m.type === 'opponentReconnected');
      const oppSilence = host.waitFor(m => m.type === 'opponentJoined', 500).then(
        () => { throw new Error('host must not receive opponentJoined on a peer reconnect'); },
        () => undefined,
      );
      re.send({ type: 'joinRoom', code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      expect((await backP).type).toBe('opponentReconnected');
      await oppSilence;
    } finally {
      host?.close();
      guest?.close();
      re?.close();
      await srv.close();
    }
  });

  it('Bug 8: replayed intents on reconnect are flagged, live ones are not', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    let re: TestClient | undefined;
    let code = '';
    try {
      ({ host, guest, code } = await startRoom(srv));
      const mirror = mirrorGame([DECK, DECK], SEED);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const live = host.waitFor(m => m.type === 'intent');
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      const liveMsg = await live;
      if (liveMsg.type !== 'intent') throw new Error('intent echo never arrived');
      // A LIVE broadcast is unflagged — the client animates it.
      expect(liveMsg.replay).toBeUndefined();
      expect(m1.length).toBeGreaterThan(0);

      const leftP = host.waitFor(m => m.type === 'playerLeft');
      guest.close();
      await leftP;

      // The reconnect burst's intents are CATCH-UP, not live: they must be
      // marked on the wire so the client applies them (determinism) without
      // re-animating the whole match (Bug 8).
      re = new TestClient(await connect(urlOf(srv)));
      const replayP = re.waitFor(m => m.type === 'intent');
      const startP = re.waitFor(m => m.type === 'gameStart');
      re.send({ type: 'joinRoom', code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      const replayMsg = await replayP;
      if (replayMsg.type !== 'intent') throw new Error('replayed intent never arrived');
      expect(replayMsg.replay).toBe(true);
      expect((await startP).type).toBe('gameStart');
    } finally {
      host?.close();
      guest?.close();
      re?.close();
      await srv.close();
    }
  });

  it('Bug 7: a disconnect drops the departing player pending rematch request', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    let re: TestClient | undefined;
    let code = '';
    try {
      ({ host, guest, code } = await startRoom(srv));
      // Host requests a rematch, then drops. Its request must NOT survive:
      // otherwise a single click from the guest starts a rematch the host
      // never re-requested (and may be mid-reconnect for).
      host.send({ type: 'rematch' });
      const leftP = guest.waitFor(m => m.type === 'playerLeft');
      host.close();
      expect((await leftP).type).toBe('playerLeft');

      const guestSilence = guest.waitFor(m => m.type === 'rematchStart', 500).then(
        () => { throw new Error('a stale rematch request from the departed player started a rematch'); },
        () => undefined,
      );
      guest.send({ type: 'rematch' });
      await guestSilence;

      // The room still works: the reconnected host requesting a rematch now
      // completes the pair (the guest's own request is still pending).
      re = new TestClient(await connect(urlOf(srv)));
      const rejoinedP = re.waitFor(m => m.type === 'joined');
      re.send({ type: 'joinRoom', code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      expect((await rejoinedP).type).toBe('joined');
      const reP = re.waitFor(m => m.type === 'rematchStart');
      const guestP = guest.waitFor(m => m.type === 'rematchStart');
      re.send({ type: 'rematch' });
      expect(await reP).toMatchObject({ type: 'rematchStart', seed: SEED + 1 });
      expect(await guestP).toMatchObject({ type: 'rematchStart', seed: SEED + 1 });
    } finally {
      host?.close();
      guest?.close();
      re?.close();
      await srv.close();
    }
  });

  it('C1: non-object message bodies get an error reply, not a crash', async () => {
    const srv = await makeServer();
    let raw: TestClient | undefined;
    try {
      raw = new TestClient(await connect(urlOf(srv)));
      // JSON.parse output was cast straight to ClientMessage and msg.type
      // dereferenced with no shape check — a body of null/true/42 threw a
      // TypeError inside the ws listener and killed the whole Node process
      // (every active room). Each body must get an error reply and the
      // server must survive.
      for (const body of ['null', '42', 'true', '"hi"', '[]']) {
        raw.ws.send(body);
        const err = await raw.waitFor(m => m.type === 'error' && m.message === 'Invalid message');
        if (err.type !== 'error') throw new Error('error never arrived');
        expect(err.message).toBe('Invalid message');
      }
      // The server process is still alive: a follow-up createRoom works.
      const createdP = raw.waitFor(m => m.type === 'roomCreated');
      raw.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await createdP;
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      expect(created.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    } finally {
      raw?.close();
      await srv.close();
    }
  });

  it('M1: a socket already in a room cannot create or join a second one', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let other: TestClient | undefined;
    let joiner: TestClient | undefined;
    try {
      // Three explicit clients (no discarded extras — every connection must be
      // closed again or srv.close() waits on it forever).
      host = new TestClient(await connect(urlOf(srv)));
      other = new TestClient(await connect(urlOf(srv)));
      joiner = new TestClient(await connect(urlOf(srv)));
      host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created = await host.waitFor(m => m.type === 'roomCreated');
      if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      other.send({ type: 'createRoom', name: 'Other', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const created2 = await other.waitFor(m => m.type === 'roomCreated');
      if (created2.type !== 'roomCreated') throw new Error('roomCreated never arrived');
      // The seated host tries to create a SECOND room → rejected.
      const errCreateP = host.waitFor(m => m.type === 'error');
      host.send({ type: 'createRoom', name: 'Again', deckIds: DECK, customCards: [], heroId: HERO_NAME, seed: SEED });
      const errCreate = await errCreateP;
      if (errCreate.type !== 'error') throw new Error('error never arrived');
      expect(errCreate.message).toMatch(/already in a room/i);
      // …and tries to JOIN a second room → rejected (the old code silently
      // returned; the second room's broadcasts then reached the socket and
      // onDisconnect broke after the first room, leaving a zombie room).
      const errJoinP = host.waitFor(m => m.type === 'error');
      host.send({ type: 'joinRoom', code: created2.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      const errJoin = await errJoinP;
      if (errJoin.type !== 'error') throw new Error('error never arrived');
      expect(errJoin.message).toMatch(/already in a room/i);
      // The rejected join left the second room intact: a third client joins
      // it normally.
      const joinedP = joiner.waitFor(m => m.type === 'joined');
      joiner.send({ type: 'joinRoom', code: created2.code, deckIds: DECK, customCards: [], heroId: HERO_NAME });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.player).toBe(1);
    } finally {
      host?.close();
      other?.close();
      joiner?.close();
      await srv.close();
    }
  });

  it('I2: both players away — first rejoin reclaims the host slot, second the guest', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    let re1: TestClient | undefined;
    let re2: TestClient | undefined;
    let code: string = '';
    try {
      ({ host, guest, code } = await startRoom(srv));
      // Both sockets drop (network hiccup): both slots free up.
      host.close();
      guest.close();
      // Two fresh clients rejoin by code, ONE AT A TIME (join ordering must be
      // deterministic). join() seats the first rejoin into the free host slot
      // (player 0) and the second into the guest slot (player 1) — the
      // documented v1 seat-swap contract. The 'joined' payload carries the
      // seat, so clients must remap from it (audit 06 I2).
      // joinWhenSlotFree retries past the close-observation race (see its doc):
      // the slots free asynchronously, so a rejoin fired straight after close()
      // could be told 'Room is full'. The seat assertions below are unchanged.
      const first = await joinWhenSlotFree(srv, code);
      re1 = first.client;
      expect(first.joined.player).toBe(0); // first rejoin → host slot
      expect(first.joined.seed).toBe(SEED); // the same game persists across the drop
      const second = await joinWhenSlotFree(srv, code);
      re2 = second.client;
      expect(second.joined.player).toBe(1); // second rejoin → guest slot
      // The re-attached game is alive: a mulligan through the re-attached
      // host socket resolves exactly as the mirror expects (reconnect replay).
      const mirror = mirrorGame([DECK, DECK], SEED);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = re1.waitFor(eventsEq(m1));
      re1.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
    } finally {
      host?.close();
      guest?.close();
      re1?.close();
      re2?.close();
      await srv.close();
    }
  });

  it('I3: a mid-game disconnect broadcasts playerLeft to the remaining player', async () => {
    const srv = await makeServer();
    let host: TestClient | undefined;
    let guest: TestClient | undefined;
    try {
      ({ host, guest } = await startRoom(srv));
      // Play one mulligan so we are genuinely mid-game (in-match feedback
      // path the audit flags as dead client-side — the broadcast exists).
      const mirror = mirrorGame([DECK, DECK], SEED);
      const m1 = mirror.submit({ kind: 'mulligan', keep: [] });
      const m1P = host.waitFor(eventsEq(m1));
      host.send({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
      expect((await m1P).type).toBe('events');
      // The guest drops mid-game → the host is notified.
      const leftP = host.waitFor(m => m.type === 'playerLeft');
      guest.close();
      const left = await leftP;
      if (left.type !== 'playerLeft') throw new Error('playerLeft never arrived');
      expect(left.reason).toMatch(/disconnected/i);
    } finally {
      host?.close();
      guest?.close();
      await srv.close();
    }
  });
});
