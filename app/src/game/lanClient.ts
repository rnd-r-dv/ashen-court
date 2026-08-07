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
  private readonly graceUntil = Date.now() + RECONNECT_GRACE_MS;
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

  /** Intentional close: no reconnect, buffered sends dropped. */
  close(): void {
    this.closed = true;
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
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    if (Date.now() >= this.graceUntil) {
      // Reconnect window expired: the server will have dropped the room.
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

/**
 * Connect to the LAN server on this machine (the server listens on the same
 * host the page was served from, port 8080 — see server/src/index.ts).
 */
export function connectLan(
  onMessage: (m: ServerMessage) => void,
  onStatus?: (s: LanStatus) => void,
): LanClient {
  const url = `ws://${location.hostname}:8080`;
  return new LanClient(url, onMessage, onStatus);
}
