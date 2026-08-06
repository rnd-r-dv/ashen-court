// LAN mirroring tests (Task 34 fix rounds). The wire protocol broadcasts every
// ACCEPTED intent ({type:'intent'}) in addition to the events tree, and the LAN
// driver OWNS echo application (fix round 2): createLanDriver registers its own
// message handler on the client at construction, applies each echoed intent to
// the shadow itself, and forwards the returned resolution tree to onEvents
// subscribers (the Match screen's useMatch pipeline) — so the match screen
// updates even after the LAN screens unmount at match entry.
//
// These tests prove FULL mirroring against the REAL server (startServer on an
// ephemeral port, two LanClient instances): a scripted match driven through
// one side only keeps both client shadows byte-identical to each other AND to
// a deterministic oracle Game that replayed the same intent script, and a
// mid-game reconnect rebuilds the shadow from the server's 'joined' payload
// and replays the intent log so it catches up to the live state.
import { describe, expect, it, vi } from 'vitest';
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck } from '@ashen/core';
import type { Intent, PlayerIndex } from '@ashen/core';
import type { ClientMessage, ServerMessage } from '@ashen/server/protocol';
import type { AddressInfo } from 'ws';
import { startServer } from '../../server/src/index.js';
import type { LanServer } from '../../server/src/index.js';
import type { LanClient } from '../src/game/lanClient.js';
import { LanClient as RealLanClient } from '../src/game/lanClient.js';
import { createLanDriver } from '../src/game/lanDriver.js';
import type { LanMatchDriver } from '../src/game/lanDriver.js';

// Deterministic 60-card ember deck + Pyra (HEROES[0]). Seed 2 is verified:
// after both keep-[] mulligans, player 0's hand is
// [ember-hellhound, neutral-boar, ember-firestorm, ember-igniter] — a legal
// 1-cost creature at index 1, and the script below exercises playCard,
// heroPower, attack and endTurn (see task-34-report Fix round 1).
const DECK = expandDeck(DECK_DEFS.ember);
const HERO = HEROES[0]!;
const SEED = 2;

function makeShadow(): Game {
  return Game.create(
    { decks: [DECK, DECK], heroes: [HERO, HERO], seed: SEED },
    new CardRegistry([...buildPool()]),
  );
}

// ---------------------------------------------------------------------------
// Unit tests: the driver policy in isolation (fake client, no server).
// Echoes are driven through the driver's OWN client handler — the single
// application point — exactly as they arrive over the wire.
// ---------------------------------------------------------------------------

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

describe('createLanDriver owns echo application', () => {
  it('submit sends without applying; the driver applies the echoed intent exactly once and notifies onEvents', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    const driver = createLanDriver(client as unknown as LanClient, game);
    const received: Game['state']['log'] = [];
    let forwarded = 0;
    driver.onEvents((tree) => {
      forwarded += 1;
      received.push(...tree);
    });
    const mulligan: Intent = { kind: 'mulligan', keep: [] };

    driver.submit(mulligan);
    // Sent to the server AND NOT applied locally (no pre-apply).
    expect(client.sent).toEqual([{ type: 'intent', intent: mulligan }]);
    expect(game.state.phase).toBe('mulligan');
    expect(game.state.mulligansDone[0]).toBe(false);

    // The echoed intent arrives: the DRIVER's own handler applies it (the
    // single application point) and forwards the resolution tree to
    // subscribers — the Match screen's useMatch consumes exactly this.
    client.receive({ type: 'intent', intent: mulligan });
    expect(game.state.mulligansDone[0]).toBe(true);
    expect(forwarded).toBe(1);
    expect(received.some(e => e.type === 'cardDrawn')).toBe(true);
    const mirror = makeShadow();
    mirror.submit(mulligan);
    expect(game.serialize()).toBe(mirror.serialize());

    // A second echo (the reconnect log replay: the same keep-[] mulligan
    // routes to player 1 by the engine's mulligansDone order) applies once and
    // forwards its tree too — no double-application of the same message.
    client.receive({ type: 'intent', intent: mulligan });
    expect(forwarded).toBe(2);
    expect(game.state.phase).toBe('main');
    expect(received.some(e => e.type === 'turnStart')).toBe(true);
    mirror.submit(mulligan);
    expect(game.serialize()).toBe(mirror.serialize());
  });

  it('flags resyncRequested and warns when an echoed intent cannot apply', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    let resyncKind: string | null = null;
    let forwarded = 0;
    const driver = createLanDriver(
      client as unknown as LanClient,
      game,
      undefined,
      (kind) => { resyncKind = kind; },
    );
    driver.onEvents(() => { forwarded += 1; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Advance the shadow past mulligan so a mulligan echo is illegal.
    game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'mulligan', keep: [] });
    expect(game.state.phase).toBe('main');

    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
    expect(forwarded).toBe(0); // no tree on divergence
    expect(driver.resyncRequested).toBe(true);
    expect(resyncKind).toBe('mulligan');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('surfaces server error replies and rebuilds the shadow on a reconnect joined', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    let err: string | null = null;
    const driver = createLanDriver(client as unknown as LanClient, game, (m) => { err = m; });

    // Server-side rejection (sent only to the sender). The shadow never
    // applied this intent locally, so the states stay aligned.
    client.receive({ type: 'error', message: 'Bad hand index' });
    expect(err).toBe('Bad hand index');

    // Mid-game reconnect: the server re-sends the setup (joined) and will
    // replay the intent log. The driver rebuilds the shadow fresh from the
    // payload — different deck/seed than the original shadow — so the replay
    // applies cleanly.
    const choir = expandDeck(DECK_DEFS.choir);
    client.receive({
      type: 'joined',
      player: 1,
      seed: SEED + 1,
      opponentName: 'Hosty',
      deckIds: choir,
      cards: [],
    });
    const rebuilt = driver.game();
    expect(rebuilt.state.seed).toBe(SEED + 1);
    expect(rebuilt.state.players[0].hero.name).toBe(HEROES[1]!.name); // choir → index 1
    // The rebuilt shadow equals an oracle built fresh from the joined payload
    // (the deterministic-mirror contract: same seed/deck/hero/registry).
    const oracle = Game.create(
      { decks: [choir, choir], heroes: [HEROES[1]!, HEROES[1]!], seed: SEED + 1 },
      new CardRegistry([...buildPool()]),
    );
    expect(rebuilt.serialize()).toBe(oracle.serialize());

    // The replayed log applies to the rebuilt shadow.
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
    expect(rebuilt.state.mulligansDone[0]).toBe(true);
    expect(driver.resyncRequested).toBe(false); // rebuild cleared the flag
  });
});

// ---------------------------------------------------------------------------
// Integration tests: real server, two LanClients, full shadow mirroring.
// ---------------------------------------------------------------------------

/** Queue-backed wrapper over LanClient: no message is ever missed. */
class LanHarness {
  readonly client: RealLanClient;
  private readonly queue: ServerMessage[] = [];
  private readonly pendings: {
    predicate: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  constructor(url: string) {
    this.client = new RealLanClient(url, (m) => {
      const idx = this.pendings.findIndex(p => p.predicate(m));
      if (idx >= 0) {
        const [p] = this.pendings.splice(idx, 1);
        clearTimeout(p!.timer);
        p!.resolve(m);
        return;
      }
      this.queue.push(m);
    });
  }

  send(m: ClientMessage): void {
    this.client.send(m);
  }

  waitFor(predicate: (m: ServerMessage) => boolean, timeoutMs = 8000): Promise<ServerMessage> {
    const idx = this.queue.findIndex(predicate);
    if (idx >= 0) return Promise.resolve(this.queue.splice(idx, 1)[0]!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.pendings.findIndex(p => p.timer === timer);
        if (i >= 0) this.pendings.splice(i, 1);
        reject(new Error('Timed out waiting for a matching message'));
      }, timeoutMs);
      this.pendings.push({ predicate, resolve, reject, timer });
    });
  }
}

async function makeServer(): Promise<{ srv: LanServer; url: string }> {
  const srv = startServer(0);
  await new Promise<void>((resolve, reject) => {
    srv.wss.once('listening', () => resolve());
    srv.wss.once('error', reject);
  });
  const addr = srv.wss.address() as AddressInfo;
  return { srv, url: `ws://127.0.0.1:${addr.port}` };
}

/** Content-exact intent predicate (deterministic wire contract). */
function intentEq(intent: Intent): (m: ServerMessage) => boolean {
  return m => m.type === 'intent' && JSON.stringify(m.intent) === JSON.stringify(intent);
}

/**
 * Wire a shadow + driver to a harness. The driver registers its own client
 * handler at construction and OWNS echo application — nothing external applies
 * intents anymore. Returns the driver; read the shadow via driver.game().
 */
function wire(harness: LanHarness, game: Game): LanMatchDriver {
  return createLanDriver(harness.client, game);
}

/** createRoom + joinRoom + gameStart for both harnesses; returns the room code. */
async function startRoom(host: LanHarness, guest: LanHarness): Promise<string> {
  host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO.name, seed: SEED });
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
  return created.code;
}

/**
 * Drive one intent through the acting player's OWN socket only (server turn
 * gating, fix round 3: the server rejects intents from the non-acting socket
 * with 'Not your turn'). The acting player is the mulligan actor during
 * mulligan (mulligansDone order) and currentPlayer() in main phase. Waits for
 * the echoed intent on BOTH clients (each driver applies it via its own
 * handler), then advances the deterministic oracle and asserts all three
 * states are byte-identical.
 */
async function drive(
  host: LanHarness, guest: LanHarness, mirror: Game,
  hostDriver: LanMatchDriver, guestDriver: LanMatchDriver,
  intent: Intent,
): Promise<void> {
  const hostEcho = host.waitFor(intentEq(intent));
  const guestEcho = guest.waitFor(intentEq(intent));
  const actor: PlayerIndex =
    mirror.state.phase === 'mulligan'
      ? ((mirror.state.mulligansDone[0] ? 1 : 0) as PlayerIndex)
      : mirror.currentPlayer();
  const driver = actor === 0 ? hostDriver : guestDriver;
  driver.submit(intent); // send-only
  await hostEcho;
  await guestEcho;
  mirror.submit(intent); // oracle replay — same engine, same seed
  expect(hostDriver.game().serialize()).toBe(guestDriver.game().serialize());
  expect(hostDriver.game().serialize()).toBe(mirror.serialize());
}

describe('LAN full mirroring (real server)', () => {
  it('keeps both shadows identical to the server across a scripted match', async () => {
    const { srv, url } = await makeServer();
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const mirror = makeShadow();
    const hostDriver = wire(host, makeShadow());
    const guestDriver = wire(guest, makeShadow());
    try {
      await startRoom(host, guest);
      // C1 regression: the Match screen runs on useMatch, which consumes the
      // driver's onEvents pipeline. Count forwarded trees end-to-end — if
      // onEvents were a no-op (round 1), this would stay 0 and the match
      // screen would freeze.
      let hostBatches = 0;
      hostDriver.onEvents(() => { hostBatches += 1; });
      // No intents yet: all three states are identical fresh games (the guest
      // driver rebuilt from its initial 'joined' payload — same params).
      expect(hostDriver.game().serialize()).toBe(guestDriver.game().serialize());
      expect(hostDriver.game().serialize()).toBe(mirror.serialize());

      // Mulligan phase: keep [] for p0 then p1 (the engine's mulligansDone
      // order — each mulligan is driven through its actor's own socket).
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      expect(mirror.state.phase).toBe('main');

      // p0 turn 0: play the 1-cost creature (seed-2 deterministic hand).
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p0play!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });

      // p1 turn 1: hero power (Pyra, 2-cost dealDamage; p1 has 2 mana).
      const hp = mirror.legalIntents(1).find(i => i.kind === 'heroPower');
      expect(hp).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, hp!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });

      // p0 turn 2: the boar is ready → attack the p1 hero.
      const atk = mirror.legalIntents(0).find(i => i.kind === 'attack');
      expect(atk).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, atk!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });

      // p1 turn 2: play another creature.
      const p1play = mirror.legalIntents(1).find(i => i.kind === 'playCard');
      expect(p1play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p1play!);

      // The match actually advanced: three turns played, damage dealt.
      // (p0's boar is still on the board; p1's turn-2 play was a spell, so
      // p1's board stays empty — the mirror equality above is the point.)
      expect(mirror.state.turn).toBe(3);
      expect(mirror.state.players[0].hero.hp).toBe(29); // boar dealt 1 (hero power cost 2 hit p0)
      expect(mirror.state.players[1].hero.hp).toBe(28); // hero power dealt 2
      expect(hostDriver.game().state.players[0].board.length).toBe(1); // the boar
      expect(hostBatches).toBe(9); // one forwarded tree per driven intent (C1)
    } finally {
      host.client.close();
      guest.client.close();
      await srv.close();
    }
  }, 20000);

  it('rebuilds the shadow on reconnect and replays the intent log to catch up', async () => {
    const { srv, url } = await makeServer();
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const mirror = makeShadow();
    const hostDriver = wire(host, makeShadow());
    const guestDriver = wire(guest, makeShadow());
    let code: string;
    let re: LanHarness | null = null;
    try {
      code = await startRoom(host, guest);
      // Play a scripted prefix, each intent through its actor's own socket;
      // both shadows mirror the live state exactly.
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p0play!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });
      const hp = mirror.legalIntents(1).find(i => i.kind === 'heroPower');
      expect(hp).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, hp!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });

      // Mid-game: drop the guest socket. The host learns about it once the
      // server processes the disconnect (guarantees the guest slot is free).
      guest.client.close();
      await host.waitFor(m => m.type === 'playerLeft');

      // Rejoin by code with a FRESH client. The driver is created BEFORE the
      // joinRoom so its own handler is registered when the server's reply
      // burst arrives (joined → full intent log → gameStart): it rebuilds the
      // shadow fresh from the 'joined' payload, then the replayed log applies
      // to the rebuilt shadow — the same path useLanMatch's match phase uses.
      re = new LanHarness(url);
      const rd = wire(re, makeShadow());
      const joinedP = re.waitFor(m => m.type === 'joined');
      const startP = re.waitFor(m => m.type === 'gameStart');
      re.send({ type: 'joinRoom', code });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.seed).toBe(SEED);
      expect(joined.deckIds).toEqual(DECK);
      expect(joined.cards.length).toBeGreaterThan(0);
      await startP; // arrives after the full intent-log replay

      // The rebuilt shadow + replayed log reached the live state.
      expect(rd.game().serialize()).toBe(hostDriver.game().serialize());
      expect(rd.game().serialize()).toBe(mirror.serialize());
    } finally {
      host.client.close();
      guest.client.close();
      re?.client.close();
      await srv.close();
    }
  }, 20000);

  it('auto-reconnect re-attaches the room by code and replays the log (I1)', async () => {
    const { srv, url } = await makeServer();
    // Capture server-side sockets in connection order: [0] = host, [1] = guest.
    const conns: import('ws').WebSocket[] = [];
    srv.wss.on('connection', (ws) => conns.push(ws));
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const mirror = makeShadow();
    const hostDriver = wire(host, makeShadow());
    const guestDriver = wire(guest, makeShadow());
    try {
      const code = await startRoom(host, guest);
      // The screen remembers the room code for reconnect re-attach.
      host.client.setRoomCode(code);

      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p0play!);

      // Drop the HOST's socket from the server side. The host's LanClient
      // (still alive — the session outlives the screens) auto-reconnects with
      // backoff; on the re-opened socket it re-sends joinRoom (the remembered
      // code), the server re-attaches it and replays joined + intent log +
      // gameStart, and the driver's rebuild + replay catch the shadow up.
      const hostRejoined = host.waitFor(m => m.type === 'joined');
      const hostRestart = host.waitFor(m => m.type === 'gameStart');
      conns[0]?.terminate();
      await hostRejoined;
      await hostRestart;

      // The re-attached host shadow reached the live state again.
      expect(hostDriver.game().serialize()).toBe(guestDriver.game().serialize());
      expect(hostDriver.game().serialize()).toBe(mirror.serialize());
    } finally {
      host.client.close();
      guest.client.close();
      await srv.close();
    }
  }, 20000);
});
