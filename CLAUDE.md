# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Ashen Court** — a browser TCG. npm-workspaces monorepo: `core/` (`@ashen/core`, pure-TS engine), `server/` (`@ashen/server`, LAN WebSocket room server), `app/` (`@ashen/app`, React + Vite UI). See `README.md` for gameplay/archetype detail.

## Commands

```bash
npm install
npm run dev              # Vite dev server for app/ on :5173
npm run server           # LAN WebSocket server on :8080 (alias of `npm run start -w server`)
npm test                 # full Vitest workspace (core + server + app) — 391 tests
npm run test:watch
npm run build            # tsc --noEmit on core, then on server, then vite build on app

npx vitest run core/tests/game.test.ts        # single file
npx vitest run -t "taunt"                     # single test by name
npm test -w core                              # one workspace
```

There is no linter and no separate typecheck script: `npm run build -w core` and `-w server` are `tsc --noEmit`; the app is type-checked only via editor/`tsc`, since Vite/esbuild strips types. Each workspace's `tsconfig.json` covers `src/**` only — the `tests/` directories are never type-checked.

## Architecture

### Engine (`core/`) — the single source of truth

`Game` (`core/src/engine/game.ts`) is deterministic and synchronous. Every consumer (local play, bot, LAN server, LAN client shadow) runs the *same* class; nothing else may mutate `GameState`.

Two invariants drive nearly every design decision here:

1. **Events are the only mutation path.** `submit(intent)` validates and resolves an intent, but all state changes flow through `emit()` → `runQueue()` → `dispatch(evt)` (`core/src/engine/events.ts`). Adding a new `GameEvent` requires a `dispatch` case — the `default` branch throws on purpose.
2. **Determinism.** RNG is a seeded counter-wrapped closure; `serialize()` stores `{seed, calls}` and `deserialize()` re-draws that many times to restore position. Same seed + same intent sequence ⇒ byte-identical state. This is what makes LAN mirroring and replay work.

Resolution sessions: `submit`/`applyEvent` open a top-level "session" (`draining` flag + shared `applied` collector), so nested drains inside `applyEffect` still report into one flat resolution tree. The win check is **deferred to the end of a session** so simultaneous hero deaths produce a draw. `MAX_TURNS` (200) is checked in `checkWin` for the same reason — one hook covers every path.

Layout:
- `engine/effects.ts` — `applyEffect` + target resolution (`SINGLE_TARGET_TARGETS`, `resolveTargets`), creature creation/removal.
- `engine/intents.ts` — legality: `legalIntents`, `validatePlayCard`, `validateEffectTargets`, `playEffectiveCost` (discounts).
- `engine/keywords.ts`, `engine/triggers` (via `Game.fireTriggers`) — taunt/rush/charge/windfury/lifesteal/ward/shield; battlecry/deathrattle/startOfTurn/endOfTurn/onDamage.
- `data/` — 12 archetype files + `neutrals`/`tokens`/`test-pool`; `data/index.ts` exports `buildPool()`, `DECK_DEFS`, `HEROES`, `expandDeck`. **`HEROES` is positionally zipped with `Object.keys(DECK_DEFS)`** — app and server both rely on that ordering. Archetype files share `data/builders.ts` (`hashId`, `archetypeCards(preset, palette, archetype)`, common `EffectSpec` shorthands); it is deliberately *not* re-exported through `data/index.ts`. `tokens.ts` keeps a private `hashId` copy that must stay identical — card art seeds depend on it.
- `bot/policies.ts` — Recruit (random legal), Veteran (greedy heuristic), Grandmaster (bounded depth-2 search over cloned games).
- `cardtext.ts` — rules text is *generated* from `EffectSpec[]`, never hand-written.
- `validate.ts` — `statBudget`/`KEYWORD_COST`/`RARITY_COPY_LIMIT`; used by both Forge card validation and 60-card deck validation.

`core/src/index.ts` is the deliberate public surface. Engine internals (`effects`/`events`/`intents`/`keywords`) are **not** exported — app and server consume only what's re-exported there.

### Cards are data

A `Card` is machine-readable: `effects: EffectSpec[]` (spells) and `triggers: TriggerSpec[]` (creatures/artifacts), where `EffectSpec = {kind, value?, target?, keyword?, cardId?}`. Adding a mechanic means adding an `EffectKind`/`EffectTarget` and handling it in `effects.ts` **and** `cardtext.ts` **and** the Forge preset list — user-created Forge cards go through the identical path as curated ones. `CardRegistry` is the id→Card map; `get()` throws on unknown ids by design.

### App (`app/`)

No router — `App.tsx` holds a `Screen` discriminated union in `useState` and renders a switch, with a small `NavContext`.

The key abstraction is **`MatchDriver`** (declared once in `app/src/types.ts`):

- `createLocalDriver` (`game/drivers.ts`) — wraps a synchronous `Game`; `submit` runs it and pushes the returned tree to `onEvents`.
- `createLanDriver` (`game/lanDriver.ts`) — owns a local *shadow* `Game`; `submit` only sends over the wire, and the driver's own client message handler applies the server's echoed intent and forwards the resulting tree to `onEvents`.

Both feed `useMatch` (`game/useMatch.ts`), which mirrors state, queues events for animation, and auto-plays the bot opponent. The driver — not the hook or screen — owns LAN echo application, because the LAN screens unmount at match entry.

Other pure, testable modules deliberately kept out of components: `game/matchSetup.ts` (deck pick → `MatchSetup`), `game/playerVisibility.ts` (hotseat hand hiding), `deckBuild.ts` (filters/copy limits), `forge/formState.ts`, `storage.ts` (localStorage keys `tcg.customCards`, `tcg.decks`, `tcg.settings`), `components/animations.ts` (Framer Motion variant *factories* taking a duration scale + `useAnimationQueue`).

### Server (`server/`) and the LAN contract

`server/src/protocol.ts` is the shared wire type — imported by the app as `@ashen/server/protocol`, so protocol changes are type-checked on both sides.

The server is authoritative: it holds the real `Game` per 4-letter room, gates intents by **socket identity** (`playerIndex(room, socket)` vs the engine's acting player — the engine alone cannot tell who submitted), and on acceptance broadcasts **both** `{type:'events'}` (drives animation) and `{type:'intent'}` (drives each client's deterministic shadow replay). Clients apply the intent echo exactly once — no optimistic local apply.

Reconnect (5-minute grace, `RECONNECT_GRACE_MS`) sends `joined` → the full append-only intent log → `gameStart`; the client rebuilds a fresh shadow from the seed and replays. There is no deep state transfer anywhere — determinism replaces it. Rematch: both players must request, then `seed += 1`, fresh game, intent log cleared.

`heroId` on the wire is the hero **name** (`HeroSpec` has no id field); both sides resolve it against `HEROES` with a `HEROES[0]` fallback.

## Conventions

- ESM throughout: relative imports carry the `.js` extension even in `.ts` source. `type: module` in every workspace package.
- `strict` + `noUncheckedIndexedAccess` — the `!` assertions on indexed access are intentional, not sloppiness.
- Comments in this codebase carry rules rationale and reference the plan's task numbers (`Task 34 fix round 2`, …). When changing engine or LAN behavior, update the explanatory comment — those comments are the spec for edge cases (taunt, ward fizzle, mulligan ordering, deferred win check).
- Tests live in each workspace's `tests/`; `core` and `server` run in `node`, `app` in `jsdom` (`app/tests/setup.ts`). `core/tests/helpers.ts` + `data/test-pool.ts` provide synthetic cards for engine tests.
- Design spec and phased implementation plan: `docs/superpowers/specs/2026-08-06-tcg-design.md` and `docs/superpowers/plans/2026-08-06-tcg.md`; per-task briefs/reports/review diffs in `.superpowers/sdd/2026-08-06-tcg/`.
