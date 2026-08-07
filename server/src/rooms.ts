// Room registry for the LAN server (Task 33 + Task 34 fix round). One Room
// per 4-letter code: host state (name, deck, custom cards, seed) plus the
// authoritative Game. The server is authoritative: intents are validated by
// game.submit (throw → error reply to the sender only). Every ACCEPTED intent
// is pushed to the room's append-only log and broadcast to both sockets as
// {type:'intent'} alongside the {type:'events'} resolution tree (events drive
// animation; intents drive the clients' deterministic shadow replay).
// Reconnect keeps the room alive for a grace window (5 minutes); a joinRoom
// on the same code re-attaches the socket and re-sends joined + the full
// intent log (each logged intent as {type:'intent'}) + gameStart, so the
// reconnecting client rebuilds its shadow from seed and replays the log to
// reach the live state (no deep state transfer).
import { CardRegistry, Game, HEROES, buildPool } from '@ashen/core';
import type { Card, GameEvent, Intent, PlayerIndex } from '@ashen/core';
import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from './protocol.js';

/** Reconnect grace window: rooms survive this long after a socket closes. */
export const RECONNECT_GRACE_MS = 5 * 60 * 1000;

/** 4-letter codes: A-Z minus O and I (O/1/0 collision avoidance; letters only). */
const CODE_LENGTH = 4;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface Room {
  code: string;
  hostName: string;        // shown to the joiner; 'You' when the host omits a name
  deckIds: string[];       // host's 60-card deck
  customCards: Card[];
  heroId: string;
  guestDeckIds: string[] | null;  // guest's 60-card deck — set on first join (Task 45)
  guestHeroId: string | null;     // guest's hero NAME — set on first join (Task 45)
  seed: number;
  hostSocket: WebSocket | null;   // player 0
  guestSocket: WebSocket | null;  // player 1
  game: Game | null;              // built on first join; persists across reconnect
  registry: CardRegistry;         // merged pool: buildPool() + customCards
  rematchPending: Set<PlayerIndex>;
  /** Append-only log of every accepted intent, in submission order. Replayed
   *  to a reconnecting socket so its fresh shadow catches up (Fix round). */
  intents: Intent[];
  expiry: NodeJS.Timeout | null;
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return code;
}

function send(socket: WebSocket | null, msg: ServerMessage): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMessage): void {
  send(room.hostSocket, msg);
  send(room.guestSocket, msg);
}

/** Player index of `socket` in `room`, or null when it is not a member. */
function playerIndex(room: Room, socket: WebSocket): PlayerIndex | null {
  if (room.hostSocket === socket) return 0;
  if (room.guestSocket === socket) return 1;
  return null;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  roomOf(socket: WebSocket): Room | null {
    for (const room of this.rooms.values()) {
      if (room.hostSocket === socket || room.guestSocket === socket) return room;
    }
    return null;
  }

  create(hostSocket: WebSocket, msg: Extract<ClientMessage, { type: 'createRoom' }>): void {
    let code: string;
    do {
      code = generateCode();
    } while (this.rooms.has(code));   // retry on collision
    const room: Room = {
      code,
      hostName: msg.name || 'You',
      deckIds: msg.deckIds,
      customCards: msg.customCards,
      heroId: msg.heroId,
      guestDeckIds: null,
      guestHeroId: null,
      seed: msg.seed,
      hostSocket,
      guestSocket: null,
      game: null,
      registry: new CardRegistry([...buildPool(), ...msg.customCards]),
      rematchPending: new Set(),
      intents: [],
      expiry: null,
    };
    this.rooms.set(code, room);
    send(hostSocket, { type: 'roomCreated', code, player: 0 });
  }

  join(msg: Extract<ClientMessage, { type: 'joinRoom' }>, socket: WebSocket): void {
    const room = this.rooms.get(msg.code);
    if (!room) {
      send(socket, { type: 'error', message: 'Room not found' });
      return;
    }
    if (room.hostSocket === socket || room.guestSocket === socket) return;  // already in
    if (room.hostSocket && room.guestSocket) {
      send(socket, { type: 'error', message: 'Room is full' });
      return;
    }
    // Reconnect takes the free slot (host first). v1 has no identity tokens, so
    // when both players are away the first rejoin reclaims the host slot.
    const slot: 'host' | 'guest' = room.hostSocket ? 'guest' : 'host';
    const player: PlayerIndex = slot === 'host' ? 0 : 1;
    const firstJoin = room.game === null;
    if (firstJoin) {
      // First join: the guest's deck + hero + custom cards land in the room
      // BEFORE the Game is built — the Game constructor validates deck ids
      // against the registry, so a guest custom deck must resolve first.
      // A client-provided deck that fails validation throws from the
      // constructor; reply to the joiner ONLY and leave the room untouched
      // (reset the guest seat) — a half-installed seat would make a corrected
      // retry hit "Room is full".
      if (slot === 'guest') {
        room.guestDeckIds = msg.deckIds;
        room.guestHeroId = msg.heroId;
        for (const c of msg.customCards) room.registry.register(c);
      }
      try {
        room.game = this.makeGame(room);
      } catch (err) {
        if (slot === 'guest') {
          room.guestDeckIds = null;
          room.guestHeroId = null;
        }
        send(socket, { type: 'error', message: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
    if (slot === 'host') room.hostSocket = socket;
    else room.guestSocket = socket;
    if (room.expiry) {
      clearTimeout(room.expiry);
      room.expiry = null;
    }
    const setup = this.resolveSetup(room);
    const cards: Card[] = [...room.registry.pool().values()];
    if (firstJoin) {
      // First join: joined to whichever socket took the slot, opponentJoined
      // (with the full resolved setup, so the host's shadow can be rebuilt
      // with the guest's deck) only when a player 1 arrived, then gameStart
      // to both sides.
      const opponentName = player === 0 ? 'You' : room.hostName;
      send(socket, { type: 'joined', player, seed: room.seed, opponentName, decks: setup.decks, heroes: setup.heroes, cards });
      if (player === 1) {
        send(room.hostSocket, { type: 'opponentJoined', opponentName: 'You', decks: setup.decks, heroes: setup.heroes, seed: room.seed, cards });  // joiner has no name in v1
      }
      broadcast(room, { type: 'gameStart' });
    } else {
      // Reconnect within the grace window: re-sync the reattached socket with
      // joined + the full intent log + gameStart. The client rebuilds its
      // shadow fresh from the seed/deck/hero/registry in 'joined', then replays
      // each logged intent on the deterministic engine to catch up to the
      // live state. Order matters: joined (builds the shadow) → intents
      // (replay) → gameStart (the UI can start rendering).
      const opponentName = player === 0 ? 'You' : room.hostName;
      send(socket, { type: 'joined', player, seed: room.seed, opponentName, decks: setup.decks, heroes: setup.heroes, cards });
      for (const intent of room.intents) send(socket, { type: 'intent', intent });
      send(socket, { type: 'gameStart' });
    }
  }

  handleIntent(room: Room, socket: WebSocket, intent: Intent): void {
    if (!room.game) {
      send(socket, { type: 'error', message: 'Game not started' });
      return;
    }
    // Server-authority turn gate (fix round 3): game.submit() computes the
    // acting player from engine state internally and cannot know which socket
    // submitted, so in LAN either client could act for the other. Gate by
    // socket identity: the acting player is the mulligan actor during mulligan
    // (turn stays 0 through both mulligans) and currentPlayer() in main phase
    // (playCard/attack/heroPower/endTurn all require it).
    const player = playerIndex(room, socket);
    const g = room.game;
    const acting: PlayerIndex =
      g.state.phase === 'mulligan'
        ? ((g.state.mulligansDone[0] ? 1 : 0) as PlayerIndex)
        : g.currentPlayer();
    if (player !== acting) {
      send(socket, { type: 'error', message: 'Not your turn' });
      return;
    }
    try {
      const events: GameEvent[] = room.game.submit(intent);
      room.intents.push(intent);
      // Two broadcasts: the resolution tree (animation) and the accepted
      // intent itself (shadow replay — the mirroring contract). Both sockets
      // receive both; own echoes included, so clients apply exactly once.
      broadcast(room, { type: 'events', events });
      broadcast(room, { type: 'intent', intent });
    } catch (err) {
      // Illegal intent: reply to the sender only; the game keeps running.
      send(socket, { type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  handleRematch(room: Room, socket: WebSocket): void {
    const player = playerIndex(room, socket);
    if (player === null || !room.game) return;
    room.rematchPending.add(player);
    if (room.rematchPending.size < 2) return;   // waiting for the other player
    room.rematchPending.clear();
    room.seed += 1;                             // deterministic new seed (old + 1)
    room.game = this.makeGame(room);            // same decks/hero, fresh game
    room.intents = [];                          // the old game's log must not replay onto the new one
    broadcast(room, { type: 'rematchStart' });
  }

  onDisconnect(socket: WebSocket): void {
    for (const room of this.rooms.values()) {
      const player = playerIndex(room, socket);
      if (player === null) continue;
      if (player === 0) room.hostSocket = null;
      else room.guestSocket = null;
      const other = player === 0 ? room.guestSocket : room.hostSocket;
      send(other, { type: 'playerLeft', reason: 'Opponent disconnected' });
      // Keep the room for the reconnect window (refreshed on each disconnect).
      if (room.expiry) clearTimeout(room.expiry);
      const timer = setTimeout(() => this.rooms.delete(room.code), RECONNECT_GRACE_MS);
      timer.unref();                            // don't hold the process open in tests
      room.expiry = timer;
      break;
    }
  }

  /** Resolved host+guest setup: deck id lists + hero NAMES for the wire
   *  (v1 convention: heroId is a hero name; clients resolve by name against
   *  HEROES). The `?? room.deckIds` fallback only covers the abandoned-host
   *  edge where a joiner reclaims the host slot; normal play always has both. */
  private resolveSetup(room: Room): { decks: [string[], string[]]; heroes: [string, string] } {
    const hostHero = HEROES.find(h => h.name === room.heroId) ?? HEROES[0]!;
    const guestHero = HEROES.find(h => h.name === (room.guestHeroId ?? room.heroId)) ?? HEROES[0]!;
    return {
      decks: [room.deckIds, room.guestDeckIds ?? room.deckIds],
      heroes: [hostHero.name, guestHero.name],
    };
  }

  private makeGame(room: Room): Game {
    // heroId is the hero NAME in v1 (core HeroSpec has no id field; the client
    // sends the hero name it picked). Player 0 uses the host's deck + hero;
    // player 1 uses the guest's (Task 45 — no more forced mirror match).
    const hostHero = HEROES.find(h => h.name === room.heroId) ?? HEROES[0]!;
    const guestHero = HEROES.find(h => h.name === (room.guestHeroId ?? room.heroId)) ?? HEROES[0]!;
    return new Game(
      { decks: [room.deckIds, room.guestDeckIds ?? room.deckIds], heroes: [hostHero, guestHero], seed: room.seed },
      room.registry,
    );
  }
}
