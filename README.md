# Ashen Court

A dark-fantasy trading card game played in the browser. Build a deck from
twelve curated archetypes, face off against a bot (three difficulties) or a
friend on the same device, or host a LAN match against someone on the same
network — then use the **Forge** to create your own cards and the **Deck
Builder** to assemble custom 60-card decks.

This is a monorepo (npm workspaces) with three packages:

| Package      | Path     | What it is                                                        |
| ------------ | -------- | ----------------------------------------------------------------- |
| `@ashen/core`   | `core/`  | The game engine, card data, rules text, and AI bots (pure TS, no UI) |
| `@ashen/server` | `server/`| The LAN room server (WebSocket) for cross-machine matches          |
| `@ashen/app`    | `app/`   | The React UI: menu, match screen, Forge, Deck Builder             |

---

## Running the game

```bash
npm install
```

Start the app (Vite dev server, http://localhost:5173):

```bash
npm run dev
```

Start the LAN server (WebSocket, port 8080) if you want to play on two
machines:

```bash
npm run start -w server
```

(`npm run server` is a shorthand alias for the same command.)

> For LAN play the *host* machine runs both the app **and** the LAN server;
> the *joiner* only needs the app (plus network access to the host's port
> 8080).

### LAN play

1. Host: open the app, pick **LAN Host**, choose a deck, and share the
   generated 4-letter room code.
2. Joiner: open the app on a second machine on the same network, pick
   **LAN Join**, and enter the code.
3. The match starts when both players are in the room. If a player
   disconnects, the server holds the room for five minutes — rejoin with the
   same code to continue where the match left off.

### Match modes

- **Play vs Bot** — pick a difficulty: *Recruit* (random legal moves),
  *Veteran* (greedy heuristic), or *Grandmaster* (bounded lookahead search).
- **Hotseat** — two players on one screen; the device passes between turns
  and hands stay hidden until the incoming player takes it.
- **LAN** — cross-machine play through the LAN server (above).

### In-match shortcuts

- `E` — end turn
- `M` — confirm mulligan
- `Space` — skip the current animation batch
- `F` — toggle fast mode on the fly

Fast mode (also a checkbox on the main menu) halves every animation and skips
the win cinematic.

## The Forge

Create custom cards: name, type (creature / spell / artifact), cost, stats,
keywords, trigger, and effect rows chosen from presets (deal damage, heal,
draw, buff, summon, and more). A live preview renders the card as you edit,
and an **Issues** panel lists validation problems — cards with errors can't be
saved. You can also pick an art preset, palette, and glyph, or upload your own
image. Custom cards are stored locally and join the card pool immediately.
The Forge toolbar exports/imports your card collection as JSON
(`ashen-custom-cards.json`), so cards round-trip between browsers.

## Deck Builder

Assemble a deck from the full curated pool plus your Forge cards, with search
and archetype/type/cost filters. A deck must be exactly **60 cards** with no
validation errors before it can be saved; saved decks appear in the deck
picker (bot, hotseat, and LAN host). The toolbar exports/imports a deck as
`ashen-deck.json`.

## The 12 archetypes

Each archetype is a 60-card deck with its own hero and 20+ signature cards:

| Archetype         | Hero                    | Style                |
| ----------------- | ----------------------- | -------------------- |
| The Ember Court   | Pyra Emberveil          | Burn / aggro         |
| The Hollow Choir  | Vespera Dawnlight       | Control              |
| The Vermin Swarm  | Rat King Moulder        | Zoo                  |
| The Dragonflight  | Seraphina Skywing       | Midrange tribal      |
| The Elder Roots   | Oldroot                 | Ramp                 |
| The Shadow Dancers| Nyx Nightshade          | Combo                |
| The Bone Horde    | Baron Von Bone          | Token swarm          |
| The Grave Pact    | Morticia Gravefall      | Self-damage / life-swap |
| The Night Coven   | Morwenna Hex            | Debuff control       |
| The Starforged    | Archon Stellara         | Big-mana cheat       |
| The Eternal Vigil | Ser Aldric the Vigilant | Sustain grind        |
| The Stormwrought  | Zephyra Stormveil       | Tempo spells         |

## Architecture

- **`core/`** — the authoritative game engine. `Game` owns state and resolves
  intents (mulligan, play, attack, hero power, end turn); effects, keywords,
  and triggers run through an event queue; the RNG is seeded for
  deterministic games and replays. `core/src/data` holds all card definitions
  (12 decks + neutrals + tokens), `core/src/bot` holds the three bot
  policies, and `core/src/cardtext.ts` generates card rules text from the
  machine-readable effect specs.
- **`server/`** — a WebSocket server managing 4-letter-code rooms. It owns
  the authoritative game per room, gates intents by socket (a player can only
  act on their own turn), broadcasts accepted intents and event trees, and
  supports rematch and mid-game reconnect (intent log replay).
- **`app/`** — the React UI. Local matches wrap the core engine in a driver;
  LAN matches use a mirrored "shadow" game driven by the server's intent
  echo. The match screen renders board, hand, animations, and the victory
  screen with rematch / change-deck / menu actions.

## Tests

```bash
npm test
```

Runs the full Vitest suite across all three packages (engine rules, card
data, bots, server rooms, and app UI logic) — 262 tests. There are also
seeded bot "soak" scripts that play many full games to shake out engine bugs.

## Requirements

- Node.js 18+ (npm workspaces)
- Two LAN players: both machines on the same network, host's port 8080 reachable
