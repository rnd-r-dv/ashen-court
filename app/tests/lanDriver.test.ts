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
import type { GameEvent, HeroSpec, Intent, PlayerIndex } from '@ashen/core';
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
const CHOIR = expandDeck(DECK_DEFS.choir);
const HERO = HEROES[0]!;
const CHOIR_HERO = HEROES[1]!;
const SEED = 2;

function makeShadow(): Game {
  return Game.create(
    { decks: [DECK, DECK], heroes: [HERO, HERO], seed: SEED },
    new CardRegistry([...buildPool()]),
  );
}

/** Oracle mirror for an arbitrary setup (Task 45: guests pick their own deck). */
function mirrorFor(decks: [string[], string[]], heroes: [HeroSpec, HeroSpec] = [HERO, HERO], seed: number = SEED): Game {
  return Game.create({ decks, heroes, seed }, new CardRegistry([...buildPool()]));
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

  it('I2: exposes the wire seat and remaps it on a reconnect joined (seat swap)', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    // The hook passes its known seat at construction (host: 0, guest: 1).
    const driver = createLanDriver(client as unknown as LanClient, game, undefined, undefined, 0);
    expect(driver.seat).toBe(0);
    // A mid-game reconnect 'joined' remaps the seat: both players were away
    // and this client rejoined into the guest slot (v1: the first rejoin
    // takes the host slot). The UI reads the seat live so it never submits
    // the wrong seat's intents after a swap.
    client.receive({
      type: 'joined',
      player: 1,
      seed: SEED,
      opponentName: 'Hosty',
      decks: [DECK, DECK],
      heroes: [HERO.name, HERO.name],
      cards: [],
    });
    expect(driver.seat).toBe(1);
    // Without a known seat at creation the driver starts null until a
    // 'joined' arrives.
    const fresh = createLanDriver(client as unknown as LanClient, game);
    expect(fresh.seat).toBeNull();
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
    // payload — different decks/seed than the original shadow — so the replay
    // applies cleanly. Task 45: the payload carries BOTH decks + hero names.
    const choir = expandDeck(DECK_DEFS.choir);
    client.receive({
      type: 'joined',
      player: 1,
      seed: SEED + 1,
      opponentName: 'Hosty',
      decks: [DECK, choir],
      heroes: [HERO.name, HEROES[1]!.name],
      cards: [],
    });
    const rebuilt = driver.game();
    expect(rebuilt.state.seed).toBe(SEED + 1);
    expect(rebuilt.state.players[0].hero.name).toBe(HERO.name);
    expect(rebuilt.state.players[1].hero.name).toBe(HEROES[1]!.name); // choir → index 1
    // The rebuilt shadow equals an oracle built fresh from the joined payload
    // (the deterministic-mirror contract: same seed/decks/heroes/registry).
    const oracle = Game.create(
      { decks: [DECK, choir], heroes: [HEROES[0]!, HEROES[1]!], seed: SEED + 1 },
      new CardRegistry([...buildPool()]),
    );
    expect(rebuilt.serialize()).toBe(oracle.serialize());

    // The replayed log applies to the rebuilt shadow.
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
    expect(rebuilt.state.mulligansDone[0]).toBe(true);
    expect(driver.resyncRequested).toBe(false); // rebuild cleared the flag
  });

  it('Bug 8: catch-up replay applies to the shadow but forwards no animation trees', () => {
    const client = new FakeLanClient();
    const driver = createLanDriver(client as unknown as LanClient, makeShadow());
    const batches: GameEvent[][] = [];
    driver.onEvents(t => batches.push(t));

    // Live play forwards its resolution tree (animation).
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
    expect(batches.length).toBe(1);
    expect(batches[0]!.length).toBeGreaterThan(0);

    // Reconnect burst: joined (rebuild) → N flagged intents (catch-up) →
    // gameStart (live). The flagged intents MUST still be applied — the
    // shadow's determinism depends on every intent landing — but must NOT be
    // forwarded, or the player watches the whole match replay in animation.
    client.receive({
      type: 'joined', player: 0, seed: SEED, opponentName: 'Hosty',
      decks: [DECK, DECK], heroes: [HERO.name, HERO.name], cards: [],
    });
    batches.length = 0;
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] }, replay: true });
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] }, replay: true });
    expect(driver.game().state.phase).toBe('main'); // applied
    expect(batches).toEqual([]);                    // but never animated
    expect(driver.resyncRequested).toBe(false);

    // gameStart closes the catch-up with ONE empty batch: no animation, but
    // useMatch's step() refreshes its state mirror from the caught-up shadow,
    // so the UI lands on the current board.
    client.receive({ type: 'gameStart' });
    expect(batches).toEqual([[]]);

    // Live play afterwards forwards trees again.
    client.receive({ type: 'intent', intent: { kind: 'endTurn' } });
    expect(batches.length).toBe(2);
    expect(batches[1]!.length).toBeGreaterThan(0);
  });

  it('Bug 6: opponentReconnected never rebuilds the still-connected shadow', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    const driver = createLanDriver(client as unknown as LanClient, game);
    client.receive({ type: 'intent', intent: { kind: 'mulligan', keep: [] } });
    const before = driver.game().serialize();

    // The peer-reconnect notice is informational ONLY. Reusing opponentJoined
    // here would rebuild this (still-connected) client's shadow from a fresh
    // seed — wiping a mid-match game that, unlike the reconnecting client,
    // receives NO intent-log replay to catch back up.
    client.receive({ type: 'opponentReconnected' });
    expect(driver.game()).toBe(game);
    expect(driver.game().serialize()).toBe(before);
  });

  it('rebuilds the shadow on an opponentJoined payload (host path, Task 45)', () => {
    const client = new FakeLanClient();
    const game = makeShadow();
    const driver = createLanDriver(client as unknown as LanClient, game);

    // The host built its shadow from its OWN createRoom params (a [DECK, DECK]
    // placeholder); when the guest joins, the server sends opponentJoined with
    // the RESOLVED setup — the host driver rebuilds with the guest's real
    // deck + hero, the same path the guest's joined rebuild uses.
    client.receive({
      type: 'opponentJoined',
      opponentName: 'Guesty',
      decks: [DECK, CHOIR],
      heroes: [HERO.name, CHOIR_HERO.name],
      seed: SEED,
      cards: [],
    });
    const rebuilt = driver.game();
    expect(rebuilt.state.seed).toBe(SEED);
    expect(rebuilt.state.players[0].hero.name).toBe(HERO.name);
    expect(rebuilt.state.players[1].hero.name).toBe(CHOIR_HERO.name);
    const oracle = mirrorFor([DECK, CHOIR], [HERO, CHOIR_HERO]);
    expect(rebuilt.serialize()).toBe(oracle.serialize());
    expect(driver.resyncRequested).toBe(false);
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

/** createRoom + joinRoom + gameStart for both harnesses; returns the room code.
 *  Task 45: the guest sends its OWN deck/hero in joinRoom (defaults: the same
 *  DECK/HERO, so existing mirror scripts stay byte-identical). */
async function startRoom(host: LanHarness, guest: LanHarness, guestDeck: string[] = DECK, guestHero: HeroSpec = HERO): Promise<string> {
  host.send({ type: 'createRoom', name: 'Hosty', deckIds: DECK, customCards: [], heroId: HERO.name, seed: SEED });
  const created = await host.waitFor(m => m.type === 'roomCreated');
  if (created.type !== 'roomCreated') throw new Error('roomCreated never arrived');
  const joinedP = guest.waitFor(m => m.type === 'joined');
  const oppP = host.waitFor(m => m.type === 'opponentJoined');
  const hostStartP = host.waitFor(m => m.type === 'gameStart');
  const guestStartP = guest.waitFor(m => m.type === 'gameStart');
  guest.send({ type: 'joinRoom', code: created.code, deckIds: guestDeck, customCards: [], heroId: guestHero.name });
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

      // Mulligan phase: p0 keeps nothing, p1 keeps the Coin (the engine's
      // mulligansDone order — each mulligan is driven through its actor's own
      // socket). audit 02 removed p1's setup mana head start, so p1 now opens
      // turn 1 on 1 crystal like p0 and must SPEND the Coin to reach the
      // 2-mana hero power below. Keeping it also stops the keep-[] mulligan
      // from discarding it (mulliganed cards leave the game entirely).
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      const coinKeep = mirror.state.players[1].hand.indexOf('mana-surge');
      expect(coinKeep).toBeGreaterThanOrEqual(0);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [coinKeep] });
      expect(mirror.state.phase).toBe('main');

      // p0 turn 0: play the 1-cost creature (seed-2 deterministic hand).
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p0play!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });

      // p1 turn 1: spend the Coin (0-cost, +1 mana for this turn only), which
      // pays for the 2-cost hero power (Pyra, dealDamage 1). This also puts the
      // newly-playable Coin on the wire — it mirrors like any other intent.
      const coinIndex = mirror.state.players[1].hand.indexOf('mana-surge');
      expect(coinIndex).toBeGreaterThanOrEqual(0);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'playCard', handIndex: coinIndex });
      expect(mirror.state.players[1].mana).toBe(2);
      expect(mirror.state.players[1].maxMana).toBe(1);   // temporary crystal only
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
      expect(hostBatches).toBe(10); // one forwarded tree per driven intent (C1) — 10 since the Coin joined the script
    } finally {
      host.client.close();
      guest.client.close();
      await srv.close();
    }
  }, 20000);

  it('guest joins with its OWN deck — both shadows mirror the real setup (Task 45)', async () => {
    const { srv, url } = await makeServer();
    const host = new LanHarness(url);
    const guest = new LanHarness(url);
    const mirror = mirrorFor([DECK, CHOIR], [HERO, CHOIR_HERO]);
    const hostDriver = wire(host, makeShadow());
    const guestDriver = wire(guest, makeShadow());
    try {
      // The guest picks the choir deck + hero; the server builds the game with
      // [host, guest] and sends the resolved setup to both sides. Each driver
      // rebuilds its shadow (guest on joined, host on opponentJoined).
      await startRoom(host, guest, CHOIR, CHOIR_HERO);
      expect(hostDriver.game().serialize()).toBe(guestDriver.game().serialize());
      expect(hostDriver.game().serialize()).toBe(mirror.serialize());
      // A scripted mulligan (through the host socket) keeps all three in sync.
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [] });
      expect(hostDriver.game().serialize()).toBe(mirror.serialize());
      expect(guestDriver.game().serialize()).toBe(mirror.serialize());
      // The guest's shadow uses the choir hero (proving the per-player hero).
      expect(guestDriver.game().state.players[1].hero.name).toBe(CHOIR_HERO.name);
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
      // p1 keeps the Coin and spends it on turn 1 to afford the 2-cost hero
      // power — p1 no longer starts a crystal ahead (audit 02), so the old
      // keep-[] + straight-to-hero-power prefix is not legal any more.
      const coinKeep = mirror.state.players[1].hand.indexOf('mana-surge');
      expect(coinKeep).toBeGreaterThanOrEqual(0);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'mulligan', keep: [coinKeep] });
      const p0play = mirror.legalIntents(0).find(i => i.kind === 'playCard');
      expect(p0play).toBeDefined();
      await drive(host, guest, mirror, hostDriver, guestDriver, p0play!);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'endTurn' });
      const coinIndex = mirror.state.players[1].hand.indexOf('mana-surge');
      expect(coinIndex).toBeGreaterThanOrEqual(0);
      await drive(host, guest, mirror, hostDriver, guestDriver, { kind: 'playCard', handIndex: coinIndex });
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
      // Bug 8 (end-to-end): the catch-up must not animate. Every historical
      // resolution tree used to be forwarded into useMatch → useAnimationQueue,
      // so the player watched the whole match replay before reaching the live
      // board. Only the single empty state-sync batch may be forwarded.
      const reBatches: GameEvent[][] = [];
      rd.onEvents(t => reBatches.push(t));
      const joinedP = re.waitFor(m => m.type === 'joined');
      const startP = re.waitFor(m => m.type === 'gameStart');
      re.send({ type: 'joinRoom', code, deckIds: DECK, customCards: [], heroId: HERO.name });
      const joined = await joinedP;
      if (joined.type !== 'joined') throw new Error('joined never arrived');
      expect(joined.seed).toBe(SEED);
      expect(joined.decks).toEqual([DECK, DECK]);
      expect(joined.heroes).toEqual([HERO.name, HERO.name]);
      expect(joined.cards.length).toBeGreaterThan(0);
      await startP; // arrives after the full intent-log replay

      // The rebuilt shadow + replayed log reached the live state.
      expect(rd.game().serialize()).toBe(hostDriver.game().serialize());
      expect(rd.game().serialize()).toBe(mirror.serialize());
      // …without animating a single historical batch (Bug 8): the seven
      // replayed intents produced no forwarded trees, only the one empty state
      // sync.
      expect(reBatches).toEqual([[]]);
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
      // The screen remembers the full joinRoom payload for reconnect re-attach.
      host.client.setJoinPayload({ code, deckIds: DECK, customCards: [], heroId: HERO.name });

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
