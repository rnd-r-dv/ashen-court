# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

TCG-literate friends playing casually — the author and a small circle who
already understand attack/health combat, mana curves, and deck archetypes.
Sessions are short and played on a laptop, either two people passing one
device (hotseat), two machines on the same network (LAN), or one player
against a bot.

Because every player already knows the genre, the interface does not need to
teach TCG fundamentals. It does need to state *this* game's specific rules
clearly — its combat rules differ from Hearthstone and Magic in ways players
have measurably misread (see Capabilities and Constraints).

## Product Purpose

A complete browser TCG that is genuinely fun to play in a short session with
someone you know. Success is a match that stays legible turn to turn: the
player always knows what a card does, what a number means, and why damage
landed the way it did.

## Positioning

The engine is the product's real mechanism. `Game` (`core/src/engine/game.ts`)
is deterministic and synchronous, and every consumer — local play, bot, LAN
server, and each LAN client's shadow — runs the same class. Determinism
replaces state transfer entirely: LAN mirroring, reconnect, and replay all work
by re-running the same seeded intent sequence. No neighboring hobby TCG can
truthfully claim that without building the same invariant first.

Cards are data, not code. A card is `effects: EffectSpec[]` plus
`triggers: TriggerSpec[]`, and its rules text is *generated* from those specs
by `core/src/cardtext.ts` — so displayed text can never drift from engine
behavior. Player-created Forge cards run the identical path as curated ones.

## Operating Context

- Play modes: local hotseat, bot (Recruit / Veteran / Grandmaster), and LAN.
- LAN requires each player to run their own app and server; the room code
  `RRRR-AAAAAAA` carries the host's IPv4 so a guest types one string.
- Players build decks in the Deck Builder (60 cards) and author cards in the
  Forge. Both persist to localStorage (`tcg.customCards`, `tcg.decks`,
  `tcg.settings`).
- Twelve curated archetypes, each with a hero and a signature 21-card core
  plus 12 neutrals.

## Capabilities and Constraints

- **Desktop and laptop only.** Mobile and tablet are explicitly out of scope;
  layouts may assume a wide viewport, a mouse, and hover.
- **Board:** 7 creature slots per side, plus a separate token row with its own
  cap (added by the rebalance work).
- **Combat is attack-versus-health with mutual damage.** There is no defense,
  armor, or block stat. A defender deals damage back equal to its *attack*.
  This has been misread in play: the mana-cost gem stays rendered on board
  creatures, where it is meaningless, and was mistaken for a defense stat. Any
  rework must make the numbers on a board creature unambiguous.
- **Rules text is generated, never authored.** New mechanics require changes in
  `effects.ts`, `cardtext.ts`, and the Forge preset list together.
- Card art is seeded from `hashId(card.id)`, so card ids are effectively
  permanent — renaming a card repaints it.
- No router; `App.tsx` holds a `Screen` union and renders a switch.
- No linter. `npm test` runs the full Vitest workspace.

## Brand Commitments

- Name: **Ashen Court**.
- Generated card art and its pipeline are binding and must be preserved.
- Cards keep the 5:7 TCG proportion.
- Palette, typography, chrome, and overall visual mood are *not* binding and
  are open to replacement.

## Evidence on Hand

- Real generated card art for epic/legendary cards and hero portraits,
  committed (`618835c`), consumed via `cardTreatment.ts`.
- 285 real cards with generated rules text; a full inventory lives at
  `graphify-out/CARDS.md`.
- No user research, testimonials, telemetry, or play metrics exist. Future
  work must not fabricate them.

## Product Principles

1. **The engine is the single source of truth.** Nothing outside `Game` mutates
   state, and no UI may imply a rule the engine does not enforce.
2. **Every number on screen must be unambiguous.** A player should never have
   to guess which stat a number represents.
3. **Legibility outranks decoration.** This is an Operate surface during a
   match: a player mid-turn is completing a task, not admiring a page.
4. **Short sessions.** Nothing may add ceremony to starting, taking, or
   finishing a turn.
5. **Generated, not authored.** Card text, art, and validation all derive from
   card data, so the pool can grow without hand-maintenance.

## Accessibility & Inclusion

No product-specific standard was established. Desktop-only, mouse-driven.
Hover-only affordances are a known existing weakness (the hero power's rules
text is reachable only via a native `title` tooltip) and should not be extended.
