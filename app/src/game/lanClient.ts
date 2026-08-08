// LAN WebSocket client (Task 34 + Task 34 fix round + Task 45). Thin
// wrapper over the browser WebSocket: JSON serialization on send, JSON parse +
// dispatch on message, buffered sends while the socket is connecting, and
// auto-reconnect with exponential backoff inside the server's reconnect-grace
// window (5 minutes, RECONNECT_GRACE_MS in server/src/rooms.ts). The server
// keeps a room alive for the grace window after a socket drops, so the client
// keeps trying to re-attach until then and gives up afterwards (status
// 'closed').
//
// Reconnect re-attach (fix round 2 + Task 45): the client remembers the FULL
// joinRoom payload from the original session (setJoinPayload — the screens
// call it once they know the code and their deck choice) and re-sends
// joinRoom on the first re-opened socket after a drop, so the server
// re-attaches the reconnecting socket to the room (join() re-joins the freed
// slot) and replays the intent log. Task 45: the payload now carries the
// guest's deck + hero too, so a guest reconnect re-attaches with a valid
// joinRoom (deckIds/customCards/heroId), not just a bare code.
//
// Wire types come from the server package (NOT duplicated here) — the protocol
// lives in server/src/protocol.ts and is re-exported through the
// "@ashen/server/protocol" subpath (server/package.json "exports"). These are
// type-only imports: they are erased at build time and never enter the browser
// bundle.
import type { Card } from '@ashen/core';
import type { ClientMessage, ServerMessage } from '@ashen/server/protocol';

/** Connection lifecycle status, surfaced via the optional onStatus callback. */
export type LanStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Reconnect grace: mirrors server/src/rooms.ts RECONNECT_GRACE_MS (5 min). */
export const RECONNECT_GRACE_MS = 5 * 60 * 1000;

/** Backoff ceiling: attempts delay 1s, 2s, 4s … capped at 8s. */
const MAX_RECONNECT_DELAY_MS = 8000;

export class LanClient {
  private readonly url: string;
  private readonly handlers = new Set<(m: ServerMessage) => void>();
  private readonly onStatus?: (s: LanStatus) => void;
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectAttempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Full joinRoom payload from the original session — re-sent on reconnect
   *  so the re-attached socket re-joins its room with a valid joinRoom
   *  (Task 45: the guest's deck/hero ride along; fix round 2 added the code). */
  private joinPayload: { code: string; deckIds: string[]; customCards: Card[]; heroId: string } | null = null;
  /** Grace deadline (epoch ms): the server keeps a room alive this long after
   *  a socket drops. Re-anchored at each drop from an ESTABLISHED connection
   *  (I1, audit 06) — NOT at construction — so a drop late in a long session
   *  still gets the full reconnect window. 0 = not yet anchored. */
  private graceUntil = 0;
  /** Sends made before the socket opened (e.g. createRoom right after connect). */
  private pendingSends: ClientMessage[] = [];

  constructor(url: string, onMessage: (m: ServerMessage) => void, onStatus?: (s: LanStatus) => void) {
    this.url = url;
    this.handlers.add(onMessage);
    this.onStatus = onStatus;
    this.connect();
  }

  /** Register an additional message handler (all handlers see every message). */
  addMessageHandler(cb: (m: ServerMessage) => void): void {
    this.handlers.add(cb);
  }

  /** Remove a previously registered message handler (screen unmount cleanup). */
  removeMessageHandler(cb: (m: ServerMessage) => void): void {
    this.handlers.delete(cb);
  }

  /** Remember the full joinRoom payload (code + deck choice); re-sent on
   *  reconnect re-open so the server re-attaches the room (fix round 2 + 45). */
  setJoinPayload(payload: { code: string; deckIds: string[]; customCards: Card[]; heroId: string }): void {
    this.joinPayload = payload;
  }

  /** Send one client message as JSON. Buffered until the socket is open. */
  send(m: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(m));
    } else if (!this.closed) {
      this.pendingSends.push(m);
    }
  }

  /** Terminal close: no reconnect, buffered sends dropped, registered handlers
   *  released (M2, audit 06 — the old code kept pendingSends and handlers alive
   *  after the final give-up, holding the screen/hook closures forever). */
  private finalize(): void {
    this.closed = true;
    this.pendingSends = [];
    this.handlers.clear();
  }

  /** Intentional close: no reconnect, buffered sends and handlers dropped. */
  close(): void {
    this.finalize();
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null; // do not schedule a reconnect for an intentional close
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    }
    this.onStatus?.('closed');
  }

  private connect(): void {
    if (this.closed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.onStatus?.(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return; // closed while connecting
      const reconnecting = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0;
      // Reconnect re-attach: the first re-opened socket after a drop re-sends
      // the full joinRoom payload so the server re-attaches it to the room
      // (the slot is free — it was cleared on disconnect) and replays the
      // intent log. Sent BEFORE the buffered sends so nothing hits the server
      // un-attached.
      if (reconnecting && this.joinPayload) {
        try {
          ws.send(JSON.stringify({ type: 'joinRoom', ...this.joinPayload }));
        } catch {
          /* the socket may have closed again mid-send */
        }
      }
      for (const m of this.pendingSends) {
        try {
          ws.send(JSON.stringify(m));
        } catch {
          /* drop a send that fails mid-flush */
        }
      }
      this.pendingSends = [];
      this.onStatus?.('open');
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return; // not JSON — ignore
      }
      for (const cb of [...this.handlers]) cb(msg);
    };
    ws.onerror = () => {
      /* the browser fires onclose after onerror — reconnect there */
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closed) return;
      // I1 (audit 06): each drop from an ESTABLISHED connection restarts the
      // grace window (reconnectAttempts === 0 means the main connection or a
      // freshly-opened reconnect). Failed CONNECTION attempts
      // (reconnectAttempts > 0) do NOT extend the window — they count against
      // it, so the client gives up once the server's own grace (anchored at
      // the first drop) has passed without a successful re-attach.
      if (this.reconnectAttempts === 0) this.graceUntil = Date.now() + RECONNECT_GRACE_MS;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    if (Date.now() >= this.graceUntil) {
      // Reconnect window expired: the server will have dropped the room. The
      // client is dead — drop buffered sends and registered handlers so
      // nothing is retained (M2, audit 06).
      this.finalize();
      this.onStatus?.('closed');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
    this.onStatus?.('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }
}

/** The port server/src/index.ts listens on by default. */
export const LAN_PORT = 8080;

/**
 * The WebSocket URL for a LAN server, given an optional host override.
 *
 * The old code hard-coded `ws://${location.hostname}:8080`, which silently
 * assumed the guest's page was served BY the host machine. It is not: each
 * player runs their own app instance, so a guest browsing their own
 * localhost:5173 connected to their OWN port 8080 — reaching either nothing
 * (socket never opens, the join screen spins forever) or their own empty
 * server ('Room not found' for a code that only exists on the host). Only the
 * host may omit the override; a guest must say where the host is.
 *
 * Accepted forms, all resolving to a ws:// URL on LAN_PORT:
 *   '' / undefined     → location.hostname (the host's own instance)
 *   '10.0.0.5'         → ws://10.0.0.5:8080
 *   '10.0.0.5:9000'    → ws://10.0.0.5:9000   (explicit port honoured)
 *   'http://10.0.0.5:5173/' → ws://10.0.0.5:8080
 *   '[fe80::1]'        → ws://[fe80::1]:8080
 *
 * A port is honoured ONLY when typed bare. When the string carries a scheme it
 * is a pasted browser URL — that port is the Vite dev port (5173), never the
 * WebSocket port, so using it would connect to the dev server and hang.
 */
export function lanUrl(host?: string | null): string {
  const raw = (host ?? '').trim();
  if (raw === '') return `ws://${location.hostname}:${LAN_PORT}`;
  const scheme = /^(wss?|https?):\/\//i.exec(raw);
  const hadScheme = scheme !== null;
  // Drop the scheme, then any path/query — 'http://h:5173/lan?x' → 'h:5173'.
  const body = (hadScheme ? raw.slice(scheme[0].length) : raw).replace(/[/?#].*$/, '');
  const bracketed = /^(\[[^\]]+\])(?::(\d+))?$/.exec(body);
  if (bracketed) {
    const port = !hadScheme && bracketed[2] ? Number(bracketed[2]) : LAN_PORT;
    return `ws://${bracketed[1]}:${port}`;
  }
  // A bare IPv6 literal has multiple colons and cannot express a port; the URL
  // form requires the brackets back.
  if ((body.match(/:/g) ?? []).length > 1) return `ws://[${body}]:${LAN_PORT}`;
  const parts = body.split(':');
  const name = parts[0] ?? '';
  const typedPort = parts[1] ?? '';
  if (name === '') return `ws://${location.hostname}:${LAN_PORT}`;
  const port = !hadScheme && /^\d+$/.test(typedPort) ? Number(typedPort) : LAN_PORT;
  return `ws://${name}:${port}`;
}

/**
 * Connect to a LAN server. `host` is the host machine's address as typed by a
 * joining player; omit it when this instance IS the host (the server runs on
 * the same machine that served the page).
 */
export function connectLan(
  onMessage: (m: ServerMessage) => void,
  onStatus?: (s: LanStatus) => void,
  host?: string | null,
): LanClient {
  return new LanClient(lanUrl(host), onMessage, onStatus);
}
