// LanClient tests (Task 34). jsdom has no WebSocket, so a fake class replaces
// globalThis.WebSocket: each connection attempt constructs one instance, and
// tests drive open/receive/drop through it. Fake timers drive the reconnect
// backoff (delay doubles 1s → 2s → … capped at 8s inside the 5-minute grace).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAN_PORT, LanClient, RECONNECT_GRACE_MS, connectLan, lanUrl } from '../src/game/lanClient.js';
import { formatJoinCode, parseJoinCode } from '@ashen/server/lanCode';
import type { ServerMessage } from '@ashen/server/protocol';

type MessageEventLike = { data: string };

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEventLike) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // ---- test helpers ----
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(data: string) {
    this.onmessage?.({ data });
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  globalThis.WebSocket = OriginalWebSocket;
  vi.useRealTimers();
});

function latest(): FakeWebSocket {
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  if (!ws) throw new Error('no websocket created');
  return ws;
}

describe('LanClient', () => {
  it('send() serializes the message as JSON once the socket is open', () => {
    const client = new LanClient('ws://test:8080', () => {});
    latest().open();
    client.send({ type: 'joinRoom', code: 'ABCD', deckIds: ['ember-hellhound'], customCards: [], heroId: 'Pyra Emberveil' });
    expect(latest().sent).toEqual(['{"type":"joinRoom","code":"ABCD","deckIds":["ember-hellhound"],"customCards":[],"heroId":"Pyra Emberveil"}']);
  });

  it('dispatches parsed ServerMessages to the onMessage handler', () => {
    const received: ServerMessage[] = [];
    const client = new LanClient('ws://test:8080', (m) => received.push(m));
    latest().open();
    latest().receive('{"type":"roomCreated","code":"ABCD","player":0}');
    latest().receive('not json');
    expect(received).toEqual([{ type: 'roomCreated', code: 'ABCD', player: 0 }]);
  });

  it('buffers sends made before the socket opens and flushes them on open', () => {
    const client = new LanClient('ws://test:8080', () => {});
    client.send({ type: 'createRoom', name: 'You', deckIds: [], customCards: [], heroId: 'H', seed: 1 });
    expect(latest().sent).toEqual([]); // still CONNECTING
    latest().open();
    expect(latest().sent).toHaveLength(1);
    expect(JSON.parse(latest().sent[0]!)).toMatchObject({ type: 'createRoom', name: 'You' });
  });

  it('close() closes the socket and stops reconnecting', () => {
    const client = new LanClient('ws://test:8080', () => {});
    const ws = latest();
    ws.open();
    client.close();
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
    ws.drop(); // a late close event must not schedule anything
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('re-sends the FULL joinRoom payload on the reconnect re-open so the server re-attaches the room (I1, Task 45)', () => {
    const client = new LanClient('ws://test:8080', () => {});
    const payload = { code: 'ABCD', deckIds: ['ember-hellhound'], customCards: [], heroId: 'Pyra Emberveil' };
    client.setJoinPayload(payload);
    latest().open();
    client.send({ type: 'joinRoom', ...payload }); // original session join
    expect(latest().sent).toEqual([JSON.stringify({ type: 'joinRoom', ...payload })]);

    latest().drop(); // unexpected close → reconnect backoff
    vi.advanceTimersByTime(1001);
    const ws2 = latest();
    ws2.open(); // reconnect re-open → re-sends the full joinRoom so the slot re-attaches
    expect(ws2.sent).toEqual([JSON.stringify({ type: 'joinRoom', ...payload })]);
    client.close();

    // Without a remembered payload (the host never sends joinRoom) the
    // reconnect re-open sends nothing extra.
    const noPayload = new LanClient('ws://test:8080', () => {});
    latest().open();
    noPayload.send({ type: 'createRoom', name: 'You', deckIds: [], customCards: [], heroId: 'H', seed: 1 });
    latest().drop();
    vi.advanceTimersByTime(1001);
    const ws3 = latest();
    ws3.open();
    expect(ws3.sent).toEqual([]);
    noPayload.close();
  });

  it('reconnects with exponential backoff after an unexpected close', () => {
    const statuses: string[] = [];
    const client = new LanClient('ws://test:8080', () => {}, (s) => statuses.push(s));
    latest().open();
    latest().drop(); // attempt 1 fails → retry in 1s
    expect(statuses.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1); // not yet
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2); // attempt 2 (backoff 1s)

    latest().drop(); // attempt 2 fails → backoff doubles to 2s
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3); // attempt 3 (backoff 2s)

    latest().open(); // success resets the backoff
    expect(statuses.at(-1)).toBe('open');
    latest().drop();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(4); // back to 1s, not 4s

    client.close();
    vi.advanceTimersByTime(600_000);
    expect(FakeWebSocket.instances).toHaveLength(4); // no more attempts after close
  });

  it('I1: re-anchors the reconnect grace at the drop — a long session still reconnects', () => {
    const statuses: string[] = [];
    const client = new LanClient('ws://test:8080', () => {}, (s) => statuses.push(s));
    latest().open();
    // 6 minutes of session lifetime — well past the OLD constructor anchor — …
    vi.advanceTimersByTime(6 * 60 * 1000);
    // …then the drop: the grace window restarts AT the drop, so a reconnect
    // attempt is still scheduled (the old code gave up with zero retries —
    // Date.now() >= the construction-time deadline).
    latest().drop();
    expect(statuses.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(1001);
    expect(FakeWebSocket.instances).toHaveLength(2); // backoff attempt scheduled
    client.close();
  });

  it('M2: on the final give-up close, handlers are dropped and send() no-ops without buffering', () => {
    const statuses: string[] = [];
    const received: ServerMessage[] = [];
    const client = new LanClient('ws://test:8080', (m) => received.push(m), (s) => statuses.push(s));
    const extra = vi.fn();
    client.addMessageHandler(extra);
    latest().open();
    latest().receive('{"type":"gameStart"}');
    expect(extra).toHaveBeenCalledTimes(1);
    // Drop; the +1s backoff attempt opens a socket that never resolves.
    latest().drop();
    vi.advanceTimersByTime(RECONNECT_GRACE_MS + 1000);
    const attempt = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;
    expect(attempt.readyState).toBe(FakeWebSocket.CONNECTING);
    // The attempt fails at the end of the grace window → the client gives up
    // (final 'closed'; the server will have dropped the room).
    attempt.drop();
    expect(statuses.at(-1)).toBe('closed');
    // send() after the final close no-ops: nothing buffered, no new socket.
    expect(() => client.send({ type: 'rematch' })).not.toThrow();
    vi.advanceTimersByTime(600_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    // Handlers are dropped: a message arriving on the last known socket (its
    // onmessage still routes to the client) reaches nobody — the old code
    // kept the handlers alive and buffered sends forever (the leak). Only the
    // pre-give-up message got through.
    FakeWebSocket.instances[0]!.receive('{"type":"gameStart"}');
    expect(extra).toHaveBeenCalledTimes(1);
    expect(received).toEqual([{ type: 'gameStart' }]);
  });

  it('I3: session-level handlers (addMessageHandler) receive error and playerLeft messages', () => {
    const client = new LanClient('ws://test:8080', () => {});
    const errors: string[] = [];
    const left: string[] = [];
    // App registers its own session-level handlers on the client (surviving
    // the LAN screens' unmount at match entry). The client must fire them for
    // ALL messages — including the in-match error/playerLeft feedback that
    // previously terminated at the unmounted hook's setState (audit 06 I3).
    client.addMessageHandler((m) => { if (m.type === 'error') errors.push(m.message); });
    client.addMessageHandler((m) => { if (m.type === 'playerLeft') left.push(m.reason); });
    latest().open();
    latest().receive('{"type":"error","message":"Not your turn"}');
    latest().receive('{"type":"playerLeft","reason":"Opponent disconnected"}');
    latest().receive('{"type":"events","events":[]}'); // non-matching messages pass through
    expect(errors).toEqual(['Not your turn']);
    expect(left).toEqual(['Opponent disconnected']);
  });
});

// lanUrl: the guest must be able to address the HOST's machine. The old
// connectLan hard-coded ws://<location.hostname>:8080, which assumed the
// guest's page was served by the host — it is not, since each player runs
// their own instance. A guest with no local server then spun forever, and a
// guest WITH one got 'Room not found' from its own empty room registry.
describe('lanUrl', () => {
  it('falls back to this machine when no host is given — the host\'s own path, unchanged', () => {
    // Pins the pre-existing behaviour LanHost still relies on: it calls
    // connectLan with no host because its server IS on this machine.
    expect(lanUrl()).toBe(`ws://${location.hostname}:${LAN_PORT}`);
    expect(lanUrl('')).toBe(`ws://${location.hostname}:${LAN_PORT}`);
    expect(lanUrl('   ')).toBe(`ws://${location.hostname}:${LAN_PORT}`);
    expect(lanUrl(null)).toBe(`ws://${location.hostname}:${LAN_PORT}`);
  });

  it('targets a bare host at the LAN port', () => {
    expect(lanUrl('10.42.0.116')).toBe('ws://10.42.0.116:8080');
    expect(lanUrl('  10.42.0.116  ')).toBe('ws://10.42.0.116:8080');
    expect(lanUrl('lucas-macbook.local')).toBe('ws://lucas-macbook.local:8080');
  });

  it('honours a bare explicit port', () => {
    expect(lanUrl('10.42.0.116:9000')).toBe('ws://10.42.0.116:9000');
  });

  it('ignores the port of a pasted browser URL', () => {
    // The realistic paste is the Vite dev URL. Its port is the app's, never
    // the WebSocket server's — honouring it would dial the dev server and
    // hang, which is the failure this whole fix exists to remove.
    expect(lanUrl('http://10.42.0.116:5173/')).toBe('ws://10.42.0.116:8080');
    expect(lanUrl('http://10.42.0.116:5173')).toBe('ws://10.42.0.116:8080');
    expect(lanUrl('ws://10.42.0.116:8080')).toBe('ws://10.42.0.116:8080');
  });

  it('keeps IPv6 literals bracketed', () => {
    expect(lanUrl('[fe80::1]')).toBe('ws://[fe80::1]:8080');
    expect(lanUrl('[fe80::1]:9000')).toBe('ws://[fe80::1]:9000');
    expect(lanUrl('fe80::1')).toBe('ws://[fe80::1]:8080');
  });

  it('connectLan builds its socket from the host override', () => {
    connectLan(() => {}, undefined, '10.42.0.116');
    expect(latest().url).toBe('ws://10.42.0.116:8080');
  });
});

// Task 46: the join code carries the host, so the whole guest path is
// code → parseJoinCode → lanUrl → socket. These pin the seam between the
// server's codec and this client, which is where a guest ends up dialling
// their OWN machine if it ever breaks.
describe('join code → socket URL', () => {
  it('dials the machine named by the code, not the one serving the page', () => {
    const code = formatJoinCode('MKBW', '10.42.0.23');
    const parsed = parseJoinCode(code);
    expect(parsed).not.toBeNull();
    expect(lanUrl(parsed!.host)).toBe(`ws://10.42.0.23:${LAN_PORT}`);
    // The regression this exists to catch: location.hostname is the GUEST's
    // own machine, so resolving to it is never a valid join.
    expect(lanUrl(parsed!.host)).not.toBe(`ws://${location.hostname}:${LAN_PORT}`);
  });

  it('falls back to this machine for a bare room code', () => {
    const parsed = parseJoinCode('MKBW');
    expect(parsed).toEqual({ roomId: 'MKBW', host: null });
    expect(lanUrl(parsed!.host)).toBe(`ws://${location.hostname}:${LAN_PORT}`);
  });

  it('survives the presentation a player actually types', () => {
    const expected = `ws://192.168.1.20:${LAN_PORT}`;
    // 'MKBW-SXYFJMN' is formatJoinCode('MKBW', '192.168.1.20') — written out
    // literally so a change to the encoding fails here loudly rather than
    // re-deriving itself and passing.
    for (const typed of ['MKBW-SXYFJMN', 'mkbw-sxyfjmn', 'MKBWSXYFJMN', ' MKBW SXYFJMN ']) {
      const parsed = parseJoinCode(typed);
      expect(parsed?.roomId).toBe('MKBW');
      expect(lanUrl(parsed?.host)).toBe(expected);
    }
  });

  it('round-trips every private range a LAN uses', () => {
    for (const ip of ['10.42.0.23', '192.168.1.20', '172.20.10.3']) {
      const parsed = parseJoinCode(formatJoinCode('QRST', ip));
      expect(lanUrl(parsed!.host)).toBe(`ws://${ip}:${LAN_PORT}`);
    }
  });
});
