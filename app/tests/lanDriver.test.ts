// LAN mirroring tests (Task 34 fix round). The wire protocol now broadcasts
// every ACCEPTED intent ({type:'intent'}) in addition to the events tree, and
// the LAN driver applies echoed intents to its shadow via applyIntent — the
// single application point (no local pre-apply, no event reconstruction).
//
// These tests prove FULL mirroring against the REAL server (startServer on an
// ephemeral port, two LanClient instances): a scripted match driven through
// one side only keeps both client shadows byte-identical to each other AND to
// a deterministic oracle Game that replayed the same intent script, and a
// mid-game reconnect replays the server's intent log so a fresh shadow catches
// up to the live state.
import { describe, expect, it, vi } from 'vitest';
import { CardRegistry, DECK_DEFS, Game, HEROES, buildPool, expandDeck } from '@ashen/core';
import type { Intent } from '@ashen/core';
import type { ClientMessage, ServerMessage } from '@ashen/server/protocol';
import type { AddressInfo } from 'ws';
import { startServer } from '../../server/src/index.js';
import type { LanServer } from '../../server/src/index.js';
import type { LanClient } from '../src/game/lanClient.js';
import { LanClient as RealLanClient } from '../src/game/lanClient.js';
import { createLanDriver, heroNameForDeck } from '../src/game/lanDriver.js';
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

describe('createLanDriver intent policy', () => {
  it('submit sends without applying; the echoed intent applies the shadow exactly once', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    const driver = createLanDriver(client as unknown as LanClient, game);
    const mulligan: Intent = { kind: 'mulligan', keep: [] };

    driver.submit(mulligan);
    // Sent to the server AND NOT applied locally (no pre-apply).
    expect(client.sent).toEqual([{ type: 'intent', intent: mulligan }]);
    expect(game.state.phase).toBe('mulligan');
    expect(game.state.mulligansDone[0]).toBe(false);

    // The hook applies the echoed intent (single application point) and gets
    // the resolution tree back for animation. Deterministic oracle: identical.
    const tree = driver.applyIntent(mulligan);
    expect(tree.some(e => e.type === 'cardDrawn')).toBe(true);
    const mirror = makeShadow();
    mirror.submit(mulligan);
    expect(game.serialize()).toBe(mirror.serialize());
    expect(game.state.mulligansDone[0]).toBe(true);

    // Applying it a second time is NOT a double-application of the same
    // intent: the engine's mulligansDone order routes it to player 1 (the
    // server broadcasts each accepted intent exactly once, so this can only
    // happen if the server replayed the log — which is the reconnect case).
    const tree2 = driver.applyIntent(mulligan);
    expect(tree2.some(e => e.type === 'turnStart')).toBe(true); // completes the phase
    mirror.submit(mulligan);
    expect(game.serialize()).toBe(mirror.serialize());
  });

  it('flags resyncRequested and warns when an echoed intent cannot apply', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    let resyncKind: string | null = null;
    const driver = createLanDriver(
      client as unknown as LanClient,
      game,
      undefined,
      (kind) => { resyncKind = kind; },
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Advance the shadow past mulligan so a mulligan echo is illegal.
    game.submit({ kind: 'mulligan', keep: [] });
    game.submit({ kind: 'mulligan', keep: [] });
    expect(game.state.phase).toBe('main');

    const tree = driver.applyIntent({ kind: 'mulligan', keep: [] });
    expect(tree).toEqual([]);
    expect(driver.resyncRequested).toBe(true);
    expect(resyncKind).toBe('mulligan');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('surfaces server error replies via onError (states stay aligned — no pre-apply)', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    let err: string | null = null;
    createLanDriver(client as unknown as LanClient, game, (m) => { err = m; });
    client.receive({ type: 'error', message: 'Bad hand index' });
    expect(err).toBe('Bad hand index');
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

/** Wire a shadow + driver to a harness: echoes apply exactly once, like the hook. */
function wire(harness: LanHarness, game: Game): LanMatchDriver {
  const driver = createLanDriver(harness.client, game);
  harness.client.addMessageHandler(m => {
    if (m.type === 'intent') driver.applyIntent(m.intent);
  });
  return driver;
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
 * Drive one intent through the HOST client only. Waits for the echoed intent
 * on BOTH clients (each applies it exactly once), then advances the
 * deterministic oracle and asserts all three states are byte-identical.
 */
async function drive(
  host: LanHarness, guest: LanHarness, mirror: Game,
  hostDriver: LanMatchDriver, hostGame: Game, guestGame: Game,
  intent: Intent,
): Promise<void> {
  const hostEcho = host.waitFor(intentEq(intent));
  const guestEcho = guest.waitFor(intentEq(intent));
  hostDriver.submit(intent); // send-only
  await hostEcho;
  await guestEcho;
  mirror.submit(intent); // oracle replay — same engine, same seed
  expect(hostGame.serialize()).toBe(guestGame.serialize());
  expect(hostGame.serialize()).toBe(mirror.serialize());
}

describe('LAN full mirroring (real server)', () => {
  it('keeps both shadows identical to the server across a scripted match', async () => {
    const { srv, url } = await makeServer();
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const hostGame = makeShadow();
    const guestGame = makeShadow();
    const mirror = makeShadow();
    const hostDriver = wire(host, hostGame);
    wire(guest, guestGame);
    try {
      await startRoom(host, guest);
      // No intents yet: all three states are identical fresh games.
      expect(hostGame.serialize()).toBe(guestGame.serialize());
      expect(hostGame.serialize()).toBe(mirror.serialize());

      // Mulligan phase: keep [] for p0 then p1 (the engine's mulligansDone
      // order — both mulligans are driven through the host's socket).
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'mulligan', keep: [] });
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'mulligan', keep: [] });
      expect(mirror.state.phase).toBe('main');

      // p0 turn 0: play the 1-cost creature (seed-2 deterministic hand).
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, p0play!);
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'endTurn' });

      // p1 turn 1: hero power (Pyra, 2-cost dealDamage; p1 has 2 mana).
      const hp = mirror.legalIntents(1).find(i => i.kind === 'heroPower');
      expect(hp).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, hp!);
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'endTurn' });

      // p0 turn 2: the boar is ready → attack the p1 hero.
      const atk = mirror.legalIntents(0).find(i => i.kind === 'attack');
      expect(atk).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, atk!);
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'endTurn' });

      // p1 turn 2: play another creature.
      const p1play = mirror.legalIntents(1).find(i => i.kind === 'playCard');
      expect(p1play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, p1play!);

      // The match actually advanced: three turns played, damage dealt.
      // (p0's boar is still on the board; p1's turn-2 play was a spell, so
      // p1's board stays empty — the mirror equality above is the point.)
      expect(mirror.state.turn).toBe(3);
      expect(mirror.state.players[0].hero.hp).toBe(29); // boar dealt 1 (hero power cost 2 hit p0)
      expect(mirror.state.players[1].hero.hp).toBe(28); // hero power dealt 2
      expect(hostGame.state.players[0].board.length).toBe(1); // the boar
    } finally {
      host.client.close();
      guest.client.close();
      await srv.close();
    }
  }, 20000);

  it('replays the intent log to a reconnecting guest so a fresh shadow catches up', async () => {
    const { srv, url } = await makeServer();
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const hostGame = makeShadow();
    const guestGame = makeShadow();
    const mirror = makeShadow();
    const hostDriver = wire(host, hostGame);
    wire(guest, guestGame);
    let code: string;
    let re: LanHarness | null = null;
    try {
      code = await startRoom(host, guest);
      // Play a scripted prefix through the host client only; both shadows
      // mirror the live state exactly.
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'mulligan', keep: [] });
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'mulligan', keep: [] });
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, p0play!);
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'endTurn' });
      const hp = mirror.legalIntents(1).find(i => i.kind === 'heroPower');
      expect(hp).toBeDefined();
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, hp!);
      await drive(host, guest, mirror, hostDriver, hostGame, guestGame, { kind: 'endTurn' });

      // Mid-game: drop the guest socket. The host learns about it once the
      // server processes the disconnect (guarantees the guest slot is free).
      guest.client.close();
      await host.waitFor(m => m.type === 'playerLeft');

      // Rejoin by code with a FRESH client. The server sends joined → the
      // full intent log → gameStart in one burst, so the fresh shadow must be
      // built and wired SYNCHRONOUSLY inside the 'joined' dispatch — exactly
      // like useLanMatch's reconnect path (hero resolved via heroNameForDeck)
      // — before the first replayed intent message is delivered.
      re = new LanHarness(url);
      const rebuilt: { game: Game | null; joined: Extract<ServerMessage, { type: 'joined' }> | null } = {
        game: null,
        joined: null,
      };
      const joinedP = re.waitFor(m => m.type === 'joined');
      const startP = re.waitFor(m => m.type === 'gameStart');
      re.client.addMessageHandler((m) => {
        if (m.type !== 'joined') return;
        rebuilt.joined = m;
        const heroName = heroNameForDeck(m.deckIds);
        const hero = HEROES.find(h => h.name === heroName) ?? HEROES[0]!;
        rebuilt.game = Game.create(
          { decks: [m.deckIds, m.deckIds], heroes: [hero, hero], seed: m.seed },
          new CardRegistry([...buildPool(), ...m.cards]),
        );
        const rd = createLanDriver(re!.client, rebuilt.game);
        re!.client.addMessageHandler((i) => {
          if (i.type === 'intent') rd.applyIntent(i.intent);
        });
      });
      re.send({ type: 'joinRoom', code });
      await joinedP;
      await startP; // arrives after the full intent-log replay
      if (!rebuilt.joined || !rebuilt.game) throw new Error('joined never arrived');
      expect(rebuilt.joined.seed).toBe(SEED);
      expect(rebuilt.joined.deckIds).toEqual(DECK);
      expect(rebuilt.joined.cards.length).toBeGreaterThan(0);

      // The replayed log brought the fresh shadow to the live state.
      expect(rebuilt.game.serialize()).toBe(hostGame.serialize());
      expect(rebuilt.game.serialize()).toBe(mirror.serialize());
    } finally {
      host.client.close();
      guest.client.close();
      re?.client.close();
      await srv.close();
    }
  }, 20000);
});
