// LAN server entry (Task 33). WebSocketServer on PORT (default 8080); JSON
// parse/send wired to the RoomRegistry. Importable for tests (startServer with
// PORT=0) and directly runnable via `npm run start -w server` (tsx).
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { RoomRegistry } from './rooms.js';

export interface LanServer {
  wss: WebSocketServer;
  registry: RoomRegistry;
  close(): Promise<void>;
}

export function startServer(port: number): LanServer {
  const wss = new WebSocketServer({ port });
  const registry = new RoomRegistry();

  wss.on('connection', (socket: WebSocket) => {
    console.log('[lan] client connected');
    socket.on('message', (raw: RawData) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(toText(raw)) as ClientMessage;
      } catch {
        send(socket, { type: 'error', message: 'Invalid JSON' });
        return;
      }
      handle(registry, socket, msg);
    });
    socket.on('close', () => {
      console.log('[lan] client disconnected');
      registry.onDisconnect(socket);
    });
  });

  return {
    wss,
    registry,
    close: () => new Promise<void>(resolve => wss.close(() => resolve())),
  };
}

function toText(raw: RawData): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  return Buffer.from(raw as ArrayBuffer).toString('utf8');
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function handle(registry: RoomRegistry, socket: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case 'createRoom':
      registry.create(socket, msg);
      break;
    case 'joinRoom':
      registry.join(msg, socket);
      break;
    case 'intent': {
      const room = registry.roomOf(socket);
      if (!room) { send(socket, { type: 'error', message: 'Not in a room' }); break; }
      registry.handleIntent(room, socket, msg.intent);
      break;
    }
    case 'rematch': {
      const room = registry.roomOf(socket);
      if (!room) { send(socket, { type: 'error', message: 'Not in a room' }); break; }
      registry.handleRematch(room, socket);
      break;
    }
  }
}

// Direct execution (`npm run start -w server` → tsx src/index.ts).
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  const server = startServer(port);
  server.wss.on('listening', () => {
    const addr = server.wss.address();
    const where = typeof addr === 'object' && addr ? `:${addr.port}` : '';
    console.log(`[lan] listening on ${where}`);
  });
}
