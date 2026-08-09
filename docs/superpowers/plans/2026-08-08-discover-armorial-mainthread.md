# Discover, the Armorial Rework, and the Animation Overhaul — Main-Thread Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` in the main thread. Do not delegate implementation tasks. Task 10 alone uses fresh `general-purpose` reviewers because the named Impeccable reviewer agents are unavailable in this harness.

**Goal:** Ship deterministic FIFO Discover across `core`, `server`, and `app`; replace the app's visual world with the Armorial; and rebuild motion so it communicates the rules accurately.

**Architecture:** Discover is the engine's first interrupting intent state. Candidate generation and state mutation remain event-driven; `pendingChoice` exposes the active choice while `pendingChoiceQueue` serializes overlapping choices in deterministic FIFO order. LAN authorization follows the pending owner, and the app treats that owner—not the current turn—as the temporary actor. The Armorial is staged through canonical tokens plus temporary compatibility aliases, then every consumer migrates before the aliases are deleted. Animation keeps Framer Motion and the existing one-event queue, with one `combatStarted` event carrying both sides of a simultaneous exchange.

**Tech Stack:** TypeScript, Vitest, React 18, Vite, WebSocket, Framer Motion 11, plain CSS custom properties, self-hosted Cardo 400/400 italic/700 woff2, inline SVG. No new package dependency.

## Baseline and workspace

- Execute in `/Users/lucas/.pi/worktrees/tcg/discover-armorial` on branch `feature/discover-armorial`.
- Base commit: `1e56fe76f96a2a495a5d161def7b5eb21ae546e6`.
- Clean committed baseline: **581 tests across 79 files**, all passing.
- `core/tests/__def.test.ts` in the original checkout was disposable investigation output for the already-shipped MTG-style simultaneous-defense decision. Do not copy or commit it.
- Leave the original dirty `main` checkout untouched.

## Global Constraints

- Desktop and laptop only (`app/PRODUCT.md`). No mobile or tablet layout work.
- All 278 non-token card IDs are immutable; card art is seeded from `hashId(card.id)`.
- Generated card art and the 5:7 card proportion are binding brand commitments.
- **Gules `#A81E22` is reserved exclusively for damage.**
- **Or `#B8913C` is reserved for legendary rarity and the active turn.**
- No bevels, gradients, glows, depth drop shadows, faux-metal textures, or 3D/WebGL.
- Every new animation honors `prefers-reduced-motion: reduce`.
- Do not add `line-clamp` anywhere in `card.css`, do not set `.card--bleed .card__body` to `flex: 0 0`, and do not unhide `.card--board .card__body`.
- App behavior that matters must have runtime tests; Vite strips types. Final verification additionally runs app `tsc --noEmit` explicitly.
- The direction contract in Task 4 is the first child of `app/index.html`'s `<body>` and must survive `vite build`.

---

### Task 0: Render live board state before visual work

**Files:**
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/Card.tsx`
- Modify: `app/src/components/CardFrame.tsx`
- Create: `app/tests/boardKeywords.test.ts`

**Interfaces:**
- Produces: optional `keywords?: readonly Keyword[]` and `silenced?: boolean` props threaded `CardView → Card → CardFrame`.
- Rule: hand cards omit both props and continue rendering immutable card-definition text; board creatures pass `CreatureState.keywords` and `CreatureState.silenced`.

- [ ] **Step 1: Add failing runtime coverage.** Render a board creature whose definition has `taunt` and a deathrattle, but whose live state has `keywords: ['stealth']` and `silenced: true`. Assert that the DOM contains a Stealth chip, contains no Taunt chip, and contains no generated deathrattle text. Add the inverse case for a runtime-added keyword.

```ts
expect(screen.getByText('Stealth')).toBeTruthy();
expect(screen.queryByText('Taunt')).toBeNull();
expect(screen.queryByText(/Deathrattle:/)).toBeNull();
```

- [ ] **Step 2: Prove the test fails.**

Run: `npx vitest run app/tests/boardKeywords.test.ts`
Expected: the board still renders definition keywords/text.

- [ ] **Step 3: Thread the live overrides.** In `Card`, compute:

```ts
const shownKeywords = keywords ?? card.keywords;
const shownText = silenced ? '' : cardText(card);
```

Pass those values to `CardFrame`; `Board.tsx` passes `c.keywords` and `c.silenced`.

- [ ] **Step 4: Verify and commit separately.**

```bash
npx vitest run app/tests/boardKeywords.test.ts app/tests/cardTextWell.test.ts
npm test
npx tsc --noEmit -p app/tsconfig.json
git add app/src/components/Board.tsx app/src/components/CardView.tsx app/src/components/Card.tsx app/src/components/CardFrame.tsx app/tests/boardKeywords.test.ts
git commit -m "fix(app): render live board keywords and silence"
```

---

### Task 1: Discover engine, FIFO choices, bots, and curated cards

**Files:**
- Modify: `core/src/types.ts`
- Modify: `core/src/engine/game.ts`
- Modify: `core/src/engine/intents.ts`
- Modify: `core/src/engine/effects.ts`
- Modify: `core/src/cardtext.ts`
- Modify: `core/src/bot/policies.ts`
- Modify: `core/src/data/neutrals.ts`
- Modify: `core/src/data/starforged.ts`
- Modify: `core/src/data/hollow-choir.ts`
- Create: `core/tests/discover.test.ts`
- Modify: `core/tests/cardtext.test.ts`
- Modify: `core/tests/bot/integration.test.ts`
- Modify: `core/tests/data.test.ts`

**Interfaces:**

```ts
export interface PendingChoice {
  kind: 'discover';
  player: PlayerIndex;
  cardIds: string[];
}
```

Add these fields to the existing `GameState` interface:

```ts
pendingChoice: PendingChoice | null;
pendingChoiceQueue: PendingChoice[];
```

Add these members to the existing unions:

```ts
// EffectKind
| 'discover'

// Intent
| { kind: 'discover'; choice: number }

// GameEvent
| { type: 'discoverOffered'; choice: PendingChoice }
| { type: 'discoverResolved'; player: PlayerIndex; cardId: string }
```

The core build must keep the `applyEffect`, `effectText`, and `dispatch` switches exhaustive. `pendingChoice` is the only choice exposed to legality/UI; `pendingChoiceQueue` holds later offers. Both serialize as ordinary `GameState` and clone with the search state.

- [ ] **Step 1: Write failing engine tests.** Cover all of these cases in `core/tests/discover.test.ts`:
  1. Three distinct candidates are produced through the seeded RNG.
  2. Tokens and `mana-surge` are absent.
  3. Only the pending owner receives three legal Discover intents; every other player receives none.
  4. The pending owner can resolve while they are **not** `currentPlayer()`.
  5. Every non-Discover intent and every out-of-range choice is rejected without mutation.
  6. Resolution adds the selected card to the pending owner's hand through `discoverResolved`.
  7. Two offers queue FIFO; resolving the first exposes the second, then clears both fields.
  8. `gameOver` clears active and queued choices.
  9. A true serialize/deserialize round trip preserves candidates, owner, queue, RNG position, and byte-identical continuation.
  10. `clone()` preserves active/queued choices while retaining its existing empty-log contract.

Use a real round trip, not two fresh games:

```ts
const restored = Game.deserialize(game.serialize(), game.registry);
expect(restored.state.pendingChoice).toEqual(game.state.pendingChoice);
expect(restored.state.pendingChoiceQueue).toEqual(game.state.pendingChoiceQueue);

game.submit({ kind: 'discover', choice: 1 });
restored.submit({ kind: 'discover', choice: 1 });
expect(restored.serialize()).toBe(game.serialize());
```

- [ ] **Step 2: Prove runtime failure and type failure separately.** Vitest transpiles without type-checking.

```bash
npx vitest run core/tests/discover.test.ts
npm run build -w core
```

Expected: runtime assertions fail because Discover is absent; `tsc --noEmit` fails on the new type members.

- [ ] **Step 3: Add the state and event model.** Initialize `pendingChoice: null` and `pendingChoiceQueue: []` in the constructor. Add explicit `dispatch` cases:

```ts
case 'discoverOffered':
  if (this.state.pendingChoice === null) this.state.pendingChoice = evt.choice;
  else this.state.pendingChoiceQueue.push(evt.choice);
  break;
case 'discoverResolved':
  this.state.players[evt.player].hand.push(evt.cardId);
  this.state.pendingChoice = this.state.pendingChoiceQueue.shift() ?? null;
  break;
case 'gameOver':
  this.state.phase = 'gameOver';
  this.state.pendingChoice = null;
  this.state.pendingChoiceQueue = [];
  break;
```

Do not mutate these fields directly from `applyEffect`; events remain the mutation path.

- [ ] **Step 4: Generate candidates deterministically.** In the `'discover'` effect branch, build `const eligible = [...registryOf(game).pool().values()]`, exclude `card.archetype === 'token'` and `card.id === 'mana-surge'`, then select and remove one item at a time with `game.pickRandom` until three remain. Push `discoverOffered`, then the existing `effectResolved` marker. Throw before consuming RNG if the registry has fewer than three eligible cards.

- [ ] **Step 5: Resolve the temporary actor before normal turn logic.** `Game.submit` must check `state.pendingChoice` first:

```ts
const pending = this.state.pendingChoice;
let me: PlayerIndex;
if (pending !== null) {
  if (intent.kind !== 'discover') throw new Error('Resolve Discover first');
  me = pending.player;
} else {
  if (intent.kind === 'discover') throw new Error('No Discover choice pending');
  me = this.currentPlayer();
}
// Continue through the existing top-level session below: resolveIntent,
// deferred checkWin, and the shared runQueue collector must still run.
```

In `resolveIntent`, validate the index against the active choice and emit `discoverResolved`. Do **not** require `pending.player === currentPlayer()` and do not require `phase === 'main'`; start/end-turn triggers can create a valid out-of-turn choice.

- [ ] **Step 6: Suspend legality.** Put this at the top of `legalIntents`:

```ts
const pending = game.state.pendingChoice;
if (pending !== null) {
  return pending.player === player
    ? pending.cardIds.map((_, choice) => ({ kind: 'discover' as const, choice }))
    : [];
}
```

- [ ] **Step 7: Make every bot tier and Grandmaster simulation choice-aware.** Recruit already picks from legal intents. Veteran/Grandmaster may score the three resulting hands normally. Update `scoreAfterEnemyTurn` so a pending choice is resolved by `pendingChoice.player` even when that player differs from the simulated current player; only exit when no choice is pending and the simulated enemy turn has ended. Add a deterministic integration test in which a pending Discover appears during Grandmaster's depth-2 enemy-turn simulation.

- [ ] **Step 8: Add player-facing text and curated reachability without changing IDs.** Add `case 'discover': return 'Discover a card.';` and replace exactly these effects:
  - `neutral-scroll` / **Scroll of Lore**: `draw(1)` → `{ kind: 'discover' }`.
  - `star-meditate` / **Meditate**: `draw(1), gainMana(1)` → `{ kind: 'discover' }, gainMana(1)`.
  - `choir-candle` / **Candlelight**: `draw(1), heal(2)` → `{ kind: 'discover' }, heal(2)`.

Do not rename these IDs; art seeds must remain stable. Assert the three definitions contain Discover and still pass pool/deck validation.

- [ ] **Step 9: Verify and commit narrowly.**

```bash
npx vitest run core/tests/discover.test.ts core/tests/cardtext.test.ts core/tests/bot/integration.test.ts core/tests/data.test.ts
npm run build -w core
npm test -w core
npm test
git add core/src/types.ts core/src/engine/game.ts core/src/engine/intents.ts core/src/engine/effects.ts core/src/cardtext.ts core/src/bot/policies.ts core/src/data/neutrals.ts core/src/data/starforged.ts core/src/data/hollow-choir.ts core/tests/discover.test.ts core/tests/cardtext.test.ts core/tests/bot/integration.test.ts core/tests/data.test.ts
git commit -m "feat(core): add deterministic FIFO discover"
```

---

### Task 2: Discover LAN authorization and replay

**Files:**
- Modify: `server/src/rooms.ts`
- Modify: `server/tests/rooms.test.ts`

**Interfaces:**
- Consumes: Task 1's `pendingChoice.player` and Discover intent.
- Produces: no protocol declaration change; `server/src/protocol.ts` already imports `Intent` from `@ashen/core`.

- [ ] **Step 1: Add failing room tests using the existing WebSocket harness.** Cover two paths:
  - **Authorization path:** after room startup, obtain the room from `RoomRegistry.roomOf(hostSocket)` and call `room.game!.applyEvent({ type: 'discoverOffered', choice: { kind: 'discover', player: 1, cardIds: ['neutral-militia', 'neutral-scroll', 'neutral-boar'] } })`. Assert guest Discover is accepted, host Discover is rejected only to host, and `endTurn` from either socket is rejected while pending.
  - **Replay path:** use a deterministic-seed helper to start a valid deck with curated `neutral-scroll` in the current player's opening hand, complete both mulligans, play it through the socket so both `playCard` and `discover` enter `room.intents`, then reconnect and assert the replay reconstructs the same final shadow state. Never inject pending state for the replay case, because injected events are not part of the append-only intent log.

- [ ] **Step 2: Prove the owner test fails.**

Run: `npx vitest run server/tests/rooms.test.ts -t "Discover"`
Expected: the current gate authorizes `currentPlayer()` rather than the pending owner.

- [ ] **Step 3: Put pending authorization before mulligan/main authorization.** In `RoomRegistry.handleIntent`:

```ts
const acting: PlayerIndex = g.state.pendingChoice?.player
  ?? (g.state.phase === 'mulligan'
    ? ((g.state.mulligansDone[0] ? 1 : 0) as PlayerIndex)
    : g.currentPlayer());
```

Keep the socket identity check. The engine deliberately cannot identify a socket; the server must enforce that only the owner submits the otherwise-valid pending intent.

- [ ] **Step 4: Verify and commit.**

```bash
npx vitest run server/tests/rooms.test.ts -t "Discover"
npm run build -w server
npm test -w server
npm test
git add server/src/rooms.ts server/tests/rooms.test.ts
git commit -m "fix(server): authorize discover choice owners"
```

---

### Task 3: Discover overlay, hotseat transfer, bot drive, and Forge preset

**Files:**
- Create: `app/src/components/DiscoverOverlay.tsx`
- Create: `app/src/components/discover.css`
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/game/useMatch.ts`
- Modify: `app/src/forge/formState.ts`
- Create: `app/tests/discoverOverlay.test.tsx`
- Create: `app/tests/useMatchDiscover.test.tsx`
- Modify: `app/tests/hotseat.test.ts`
- Modify: `app/tests/forgeKeywords.test.ts`

**Interfaces:**

```ts
interface DiscoverOverlayProps {
  choice: PendingChoice;
  viewer: PlayerIndex;
  getCard(id: string): Card | undefined;
  onChoose(choice: number): void;
}
```

- [ ] **Step 1: Write failing overlay tests.** Assert that the owner sees three full `CardView size="preview"` plates; a non-owner sees only `Opponent is choosing a card…`; click and `1`/`2`/`3` submit the correct index; ArrowLeft/ArrowRight move focus; Tab/Shift+Tab wrap among the three buttons; Escape cannot dismiss an unresolved choice.

- [ ] **Step 2: Implement the modal contract.** Use `role="dialog"`, `aria-modal="true"`, an explicit heading, three button refs, initial focus on the first card, and a component-scoped keydown handler. The board may be visually dimmed with a flat translucent ground color, never a gradient or glow.

- [ ] **Step 3: Make pending ownership the app actor.** In `Match.tsx`, derive:

```ts
const actor: PlayerIndex = state.pendingChoice?.player
  ?? (state.phase === 'mulligan'
    ? ((state.mulligansDone[0] ? 1 : 0) as PlayerIndex)
    : currentPlayer);
const hideHands = setup.mode === 'hotseat' && viewer !== actor;
```

Replace the old `playerVisibility`-derived hotseat gate with this single actor gate for mulligan, main-turn, and pending-choice states. Render Discover independently of `myTurn`. If `viewer !== pendingChoice.player`, show `PassDevice` and no candidate names; only reveal candidates after `setViewer(actor)`. After resolution, actor returns to the turn owner and naturally requires a second pass. LAN shows the waiting copy to the non-owner without a pass-device prompt.

- [ ] **Step 4: Drive bot-owned choices.** In `useMatch.stepRef`, add `isBotsChoice = g.state.pendingChoice?.player === botPlayer`. Schedule the bot when mulligan, main-turn, **or pending-choice** ownership belongs to it. In `humanLegal`, return `g.legalIntents(myPlayer)` when a pending choice belongs to the human even if it is not their turn.

- [ ] **Step 5: Add Forge reachability.** Add this preset to `EFFECT_PRESETS`:

```ts
{ label: 'Discover a card', spec: { kind: 'discover' } }
```

Add `'discover'` to the exhaustive runtime list in `forgeKeywords.test.ts` and assert `draftToCard` preserves the preset in both spell effects and trigger effects.

- [ ] **Step 6: Verify local, bot, hotseat, and LAN-visible behavior.**

```bash
npx vitest run app/tests/discoverOverlay.test.tsx app/tests/useMatchDiscover.test.tsx app/tests/hotseat.test.ts app/tests/forgeKeywords.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm test
```

In the browser, play a curated Scroll of Lore/Meditate/Candlelight; verify owner-only candidates, the waiting state, keyboard selection, hotseat pass-before-reveal, and bot resolution.

- [ ] **Step 7: Commit.**

```bash
git add app/src/components/DiscoverOverlay.tsx app/src/components/discover.css app/src/screens/Match.tsx app/src/game/useMatch.ts app/src/forge/formState.ts app/tests/discoverOverlay.test.tsx app/tests/useMatchDiscover.test.tsx app/tests/hotseat.test.ts app/tests/forgeKeywords.test.ts
git commit -m "feat(app): add accessible discover flow"
```

---

### Task 4: Armorial foundation, offline type, and migration aliases

**Files:**
- Create: `app/public/fonts/cardo-v21-latin-400.woff2`
- Create: `app/public/fonts/cardo-v21-latin-400-italic.woff2`
- Create: `app/public/fonts/cardo-v21-latin-700.woff2`
- Create: `app/public/fonts/CARDO-OFL.txt`
- Create: `app/src/fonts.css`
- Modify: `app/src/theme.css`
- Modify: `app/src/index.css`
- Modify: `app/index.html`
- Create: `app/tests/armorialContract.test.ts`

**Direction contract — paste verbatim as the first child of `<body>`:**

```html
<!--
THESIS: Twelve archetypes are twelve houses; heraldry is already a strict grammar for
  encoding identity in a fixed vocabulary, which is what "cards are data" means here.
  Refuses the torch-lit tavern the category always ships, and its flat-gray opposite.
OWN-WORLD: A roll of arms. Flat heraldic tinctures in a woodcut register on an iron-gall
  ground, cream engraved hairlines, charges drawn as flat SVG. No bevels, gradients,
  glows, or faux metal. Cardo throughout.
STORY: A player reads the field as a page of arms: whose house holds what, what each
  figure is, and what every number means.
FIRST VIEWPORT: The board as a ruled page. Two banded registers divided by an engraved
  rule, each under its house banner in the margin; the token row a subordinate sub-band.
FORM: Blazon x codex (armorial), grounded candidate 5 of 7, user-pinned toward archaic.
  Seed key b730d38a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
  review, the verdict, and DESIGN.md.
-->
```

- [ ] **Step 1: Add contract tests.** Read `app/index.html`, `fonts.css`, and `theme.css` as text. Assert the direction comment precedes `<div id="root">`, every font URL begins `/fonts/`, no `http` appears in `fonts.css`, and the canonical tincture values match the contract.

- [ ] **Step 2: Download official Cardo Latin assets and license.** Use exactly these commands; stop and report if any request or checksum fails.

```bash
mkdir -p app/public/fonts
curl -fsSL https://fonts.gstatic.com/s/cardo/v21/wlp_gwjKBV1pqhv43IE7225P.woff2 -o app/public/fonts/cardo-v21-latin-400.woff2
curl -fsSL https://fonts.gstatic.com/s/cardo/v21/wlpxgwjKBV1pqhv97IMx3ExNYCg.woff2 -o app/public/fonts/cardo-v21-latin-400-italic.woff2
curl -fsSL https://fonts.gstatic.com/s/cardo/v21/wlpygwjKBV1pqhND-ZQW-WNlaiBW.woff2 -o app/public/fonts/cardo-v21-latin-700.woff2
curl -fsSL https://raw.githubusercontent.com/google/fonts/main/ofl/cardo/OFL.txt -o app/public/fonts/CARDO-OFL.txt
shasum -a 256 app/public/fonts/*
```

Expected hashes:

```text
8e28b778b6e1a7ff9ca72f4dee2d53120aa2856dc1bfd0be44307e365b0e45bb  CARDO-OFL.txt
bc802f41dcc8a73610b107af50373231bdc8dee8c0106a46be8efda44ea336b2  cardo-v21-latin-400-italic.woff2
c0a8e24244241209f450c50f86a0dfcb5a891806184095b31abdbb136e9b38cc  cardo-v21-latin-400.woff2
6985e79e5078958897e276228b9838c3bd5bb7bbaad662cb3f742e87c39e6e4c  cardo-v21-latin-700.woff2
```

- [ ] **Step 3: Define local fonts.** Create three `@font-face` blocks for Cardo 400 normal, 400 italic, and 700 normal with `font-display: swap`. Small caps use `font-variant-caps: small-caps`; there is no separate Cardo small-caps file.

- [ ] **Step 4: Establish canonical tokens and temporary aliases.** Keep the spacing scale, set `--radius-lg: 6px`, and define the exact contract values:

```css
--ground: #14120F;
--ground-deep: #0C0B09;
--ground-rise: #1D1A15;
--line: #E8E0CE;
--line-dim: rgba(232, 224, 206, 0.38);
--text: #E8E0CE;
--text-dim: #A79E8A;
--gules: #A81E22;
--or: #B8913C;
--house-ember: #B4341C;
--house-choir: #C9BFA4;
--house-vermin: #6B7A3A;
--house-dragon: #8C5A1E;
--house-roots: #3C6B44;
--house-dance: #4A2F63;
--house-bone: #8A8578;
--house-pact: #6B1F2E;
--house-coven: #2F3E6B;
--house-star: #3E5C7A;
--house-vigil: #A88C3E;
--house-storm: #4A6B75;
--beat: 140ms;
--beat-long: 320ms;
```

To prevent undefined variables during Tasks 5–9, retain temporary aliases mapped to non-reserved Armorial colors:

```css
--bg-0: var(--ground);
--bg-1: var(--ground-rise);
--bg-2: var(--ground-deep);
--border: var(--line-dim);
--text-faint: var(--text-dim);
--gold: var(--line);
--gold-dim: var(--line-dim);
--ember: var(--line);
--ember-dim: var(--line-dim);
--accent: var(--house-star);
```

Never map old decorative tokens to `--gules` or `--or`. Task 9 deletes every alias after consumers migrate.

- [ ] **Step 5: Remove glow recipes immediately.** Delete `--glow-gold`, `--glow-ember`, and every consumer. Replace the body gradient and selection/focus glow in `index.css` with flat ground and hairline focus treatment.

- [ ] **Step 6: Verify offline font behavior and production comment.** Build, grep the emitted HTML for `THESIS:`, launch the app, load once with browser networking disabled, and confirm computed `font-family` is Cardo with no failed font requests.

```bash
npx vitest run app/tests/armorialContract.test.ts
npm run build -w app
grep -q "THESIS: Twelve archetypes" app/dist/index.html
```

- [ ] **Step 7: Commit.**

```bash
git add app/public/fonts app/src/fonts.css app/src/theme.css app/src/index.css app/index.html app/tests/armorialContract.test.ts
git commit -m "style(app): establish the Armorial foundation"
```

---

### Task 5: Armorial card plate

**Files:**
- Modify: `app/src/components/CardView.tsx`
- Modify: `app/src/components/Card.tsx`
- Modify: `app/src/components/CardFrame.tsx`
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/cardTreatment.ts`
- Modify: `app/src/components/keywordchip.css`
- Modify: `app/src/components/CardArt.tsx`
- Modify: `app/tests/cardArtWiring.test.ts`
- Modify: `app/tests/boardSurface.test.ts`
- Modify: `app/tests/cardTextWell.test.ts`

- [ ] **Step 1: Add failing runtime assertions.** Render hand and board sizes. Assert the hand plate has a cost marker, the board plate does not, and both attack/health values have accessible labels rather than bare numbers.

- [ ] **Step 2: Thread `showCost`.** Add `showCost?: boolean` through `CardView → Card → CardFrame`, default true, and pass false for `size="board"`. Keep the rationale comment: this prevents the cost gem from reading as a third defense stat.

- [ ] **Step 3: Key stats, house tinctures, and flat generated art.** Label Attack and Health in Cardo small caps. Map `data-archetype` to one `--house-*` field while the procedural art sits on an untinted neutral mount. Preserve the deterministic card-ID seed, scene composition, and generated-art component, but replace SVG `<linearGradient>`/`<radialGradient>` definitions and vignette fills with solid palette fields. Extend `cardArtWiring.test.ts` to prove card art still renders from the same spec without any SVG gradient element.

- [ ] **Step 4: Flatten only the frame regions.** Remove gradients, inset shadows, bevels, decorative gold/ember, and every `filter: drop-shadow` recipe from `card.css`, including the `card-playable-glow` keyframes; replace playable state with a flat engraved-line affordance. Rarity is hairline weight; legendary alone uses `--or`. Preserve the text-well declarations guarded by `cardTextWell.test.ts`, and keep `.card--board .card__body { display: none }`.

- [ ] **Step 5: Restyle shared keyword chips.** Preserve separate picker select/describe buttons and verify both in-card and Forge-picker variants.

- [ ] **Step 6: Verify visually at 1440×900.** Capture one hand card and one board card together, with `coven-queen` and `ember-phoenix`; verify 5:7 proportion, untinted art, no ellipsis, no bare stat, and no board cost.

```bash
npx vitest run app/tests/boardSurface.test.ts app/tests/cardTextWell.test.ts app/tests/keywordChip.test.ts app/tests/cardArtWiring.test.ts
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 7: Commit.**

```bash
npm test
npx tsc --noEmit -p app/tsconfig.json
git add app/src/components/CardView.tsx app/src/components/Card.tsx app/src/components/CardFrame.tsx app/src/components/CardArt.tsx app/src/components/card.css app/src/components/cardTreatment.ts app/src/components/keywordchip.css app/tests/boardSurface.test.ts app/tests/cardTextWell.test.ts app/tests/cardArtWiring.test.ts
git commit -m "style(app): rebuild the Armorial card plate"
```

---

### Task 6: Board as a ruled page and mana ledger

**Files:**
- Modify: `core/src/types.ts`
- Modify: `core/src/engine/game.ts`
- Modify: `core/tests/overload.test.ts`
- Create: `app/src/game/house.ts`
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/board.css`
- Modify: `app/src/components/ManaTray.tsx`
- Modify: `app/src/components/manatray.css`
- Modify: `app/src/components/DeckCount.tsx`
- Modify: `app/src/components/deckcount.css`
- Create: `app/tests/house.test.ts`
- Modify: `app/tests/board.test.ts`
- Modify: `app/tests/manaTray.test.ts`

- [ ] **Step 1: Add failing structure/state tests.** Given normal creatures and tokens on both sides, assert separate creature registers and token sub-bands. In core, assert overload is spent into `lockedMana` at `beginTurn`, remains known after mana is spent, serializes, and clears on `turnEnd`. In app, assert `lockedMana={2}` produces exactly two `aria-label="Locked mana"` pips without changing `pipStates(mana,maxMana)`.

- [ ] **Step 2: Preserve spent overload for presentation.** Add `lockedMana: number` to `PlayerState`, initialize it to zero, assign the computed lock at `beginTurn`, and clear it in the existing `turnEnd` dispatch case. `overload` remains the amount waiting for the next turn; `lockedMana` is the amount visibly locked during the current turn. Plain JSON serialization carries both.

- [ ] **Step 3: Split rows by `creature.token`.** Keep creature order stable within each partition. Tokens use the same CardView language at a smaller scale; do not count them against the normal row.

- [ ] **Step 4: Derive house identity from the existing positional contract.** Create `houseOfHeroName(name)` in `app/src/game/house.ts` using `HEROES` zipped with `Object.keys(DECK_DEFS)` and the same first-entry fallback used elsewhere. Test all twelve hero names and the fallback. Each margin renders that house's name and a hand-authored flat inline-SVG charge.

- [ ] **Step 5: Replace panel chrome with engraved rules.** Use `--line-dim` hairlines between registers. No container panels or depth shadows.

- [ ] **Step 6: Convert mana to a pip ledger.** Preserve `pipStates(mana,maxMana)` for filled/unfilled state and add `lockedMana` as a separate prop. Locked pips remain struck through after ordinary mana spending and are accessibly labeled; update all six existing mana tests.

- [ ] **Step 7: Verify at 1280×900 and 1440×900.** Capture full normal/token rows on both sides; confirm no horizontal overflow and exact locked-pip count.

```bash
npx vitest run core/tests/overload.test.ts app/tests/house.test.ts app/tests/board.test.ts app/tests/manaTray.test.ts
npm run build -w core
npx tsc --noEmit -p app/tsconfig.json
npm test
git add core/src/types.ts core/src/engine/game.ts core/tests/overload.test.ts app/src/game/house.ts app/src/components/Board.tsx app/src/components/board.css app/src/components/ManaTray.tsx app/src/components/manatray.css app/src/components/DeckCount.tsx app/src/components/deckcount.css app/tests/house.test.ts app/tests/board.test.ts app/tests/manaTray.test.ts
git commit -m "feat(app): render Armorial board and locked mana"
```
---

### Task 7: Live card inspect and permanent hero-power blazons

**Files:**
- Create: `app/src/components/InspectPanel.tsx`
- Create: `app/src/components/inspect.css`
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/HeroPortrait.tsx`
- Modify: `app/src/components/heroportrait.css`
- Modify: `app/src/screens/Match.tsx`
- Create: `app/tests/inspectPanel.test.tsx`
- Modify: `app/tests/board.test.ts`

**Consumes:** Task 0's live keyword/silence props and the existing `KeywordChip` popover.

- [ ] **Step 1: Add failing interaction tests.** Assert normal click inspects either side when idle; normal click targets rather than inspects while targeting; right-click always inspects and prevents the context menu; Escape closes; Tab wraps within the panel.

- [ ] **Step 2: Render a full live plate.** Pass the selected `CreatureState` plus definition to `InspectPanel`. Show live attack, health, keywords, statuses, and silence-suppressed generated text. Render `<KeywordChip keyword={k}/>` for every live keyword. Never unhide the board mini text well.

- [ ] **Step 3: Add permanent hero-power blazons for both heroes.** Show power name, cost, and `heroPowerText(power)` in each margin. Remove the hover-only `title` attribute from `HeroPortrait`.

- [ ] **Step 4: Verify reports and accessibility.** Read an enemy creature without targeting, inspect while targeting via right-click, read both hero powers without hover, and traverse both dialogs/popovers by keyboard.

```bash
npx vitest run app/tests/inspectPanel.test.tsx app/tests/board.test.ts app/tests/keywordChip.test.ts
npx tsc --noEmit -p app/tsconfig.json
```

- [ ] **Step 5: Commit.**

```bash
npm test
npx tsc --noEmit -p app/tsconfig.json
git add app/src/components/InspectPanel.tsx app/src/components/inspect.css app/src/components/Board.tsx app/src/components/HeroPortrait.tsx app/src/components/heroportrait.css app/src/screens/Match.tsx app/tests/inspectPanel.test.tsx app/tests/board.test.ts
git commit -m "feat(app): add live card inspection and hero blazons"
```

---

### Task 8: Rule-accurate Armorial animation

**Files:**
- Modify: `core/src/types.ts`
- Modify: `core/src/engine/game.ts`
- Modify: `core/tests/combat-simultaneous.test.ts`
- Modify: `app/src/components/animations.ts`
- Modify: `app/src/screens/animations.css`
- Modify: `app/src/screens/Match.tsx`
- Modify: `app/src/components/Board.tsx`
- Modify: `app/src/components/Projectile.tsx`
- Modify: `app/src/components/projectile.css`
- Modify: `app/src/components/DamagePopup.tsx`
- Modify: `app/src/components/TurnBanner.tsx`
- Modify: `app/src/components/turnbanner.css`
- Modify: `app/src/components/ManaTray.tsx`
- Modify: `app/tests/animations.test.ts`
- Modify: `app/tests/matchFx.test.ts`

- [ ] **Step 1: Add one explicit combat cue.** Add this `GameEvent` member and a log-only dispatch case:

```ts
| { type: 'combatStarted'; attackerId: string; defenderId: string }
```

In creature combat, emit it after legality/attack-count updates but before either `dealDamage` call. This event carries both identities in one record, so triggers, deaths, and other events resolving between the two damage events cannot split the visual strike. Assert event order and IDs in `combat-simultaneous.test.ts`.

- [ ] **Step 2: Establish one motion grammar.** Use only 140ms/`var(--beat)` and 320ms/`var(--beat-long)`, linear or CSS `steps()` easing, hard cuts, and short holds. Remove springs, glow, bounce, and depth fades.

- [ ] **Step 3: Render combat simultaneously.** When `useAnimationQueue` delivers `combatStarted`, resolve both IDs through the existing persistent `slotPointRef` last-known positions and set one overlay state containing both endpoints. Draw both reciprocal strike cuts in the same React update; living plates may make the same 140ms inward nudge, while a creature already absent from the final state still gets its strike from the retained point. Keep subsequent `damageDealt` events for numerals and state-specific FX.

- [ ] **Step 4: Replace each legacy motif.** Damage numerals strike in using gules, hold, and drop; death gets a gules strike-through then removal; turn change shifts registers like a page and marks only the active banner with or; draw slides from the deck edge; play lands in one hard step; Discover candidates deal sequentially one beat apart.

- [ ] **Step 5: Add reduced-motion and skip tests.** Under `matchMedia('(prefers-reduced-motion: reduce)')`, every new transition reaches final state immediately. With fake timers, enqueue two batches, skip midway, and assert no later cosmetic handler fires while the authoritative driver state remains at the newest state. Keep the existing one-event queue API; `combatStarted` removes the need for fragile event grouping.

- [ ] **Step 6: Verify and commit.**

```bash
npx vitest run core/tests/combat-simultaneous.test.ts app/tests/animations.test.ts app/tests/matchFx.test.ts
npm run build -w core
npx tsc --noEmit -p app/tsconfig.json
npm test
git add core/src/types.ts core/src/engine/game.ts core/tests/combat-simultaneous.test.ts app/src/components/animations.ts app/src/screens/animations.css app/src/screens/Match.tsx app/src/components/Board.tsx app/src/components/Projectile.tsx app/src/components/projectile.css app/src/components/DamagePopup.tsx app/src/components/TurnBanner.tsx app/src/components/turnbanner.css app/src/components/ManaTray.tsx app/tests/animations.test.ts app/tests/matchFx.test.ts
git commit -m "feat(app): rebuild rule-accurate Armorial motion"
```

Capture normal and reduced-motion combat, damage, death, turn, draw/play, Discover, and skip outcomes before committing.
---

### Task 9: Complete the Armorial migration across every surface

**Files:**
- Modify: `app/src/theme.css`
- Modify: `app/src/index.css`
- Modify: `app/src/screens/match.css`
- Modify: `app/src/screens/lan.css`
- Modify: `app/src/screens/forge.css`
- Modify: `app/src/screens/deckbuilder.css`
- Modify: `app/src/screens/DeckBuilder.tsx` only if semantic ruled-group markup is required
- Modify: `app/src/screens/Forge.tsx`
- Modify: `app/src/components/Background.tsx`
- Modify: `app/src/components/background.css`
- Modify: `app/src/components/board.css`
- Modify: `app/src/components/card.css`
- Modify: `app/src/components/cardview.css`
- Modify: `app/src/components/deckcount.css`
- Modify: `app/src/components/hand.css`
- Modify: `app/src/components/heroportrait.css`
- Modify: `app/src/components/keywordchip.css`
- Modify: `app/src/components/manatray.css`
- Modify: `app/src/components/passdevice.css`
- Modify: `app/src/components/projectile.css`
- Modify: `app/src/components/turnbanner.css`
- Modify: `app/src/screens/animations.css`
- Create: `app/tests/armorialMigration.test.ts`

- [ ] **Step 1: Add a whole-tree migration guard.** Scan `app/src/**/*.{css,tsx}`. Fail on legacy tokens `--bg-0`, `--bg-1`, `--bg-2`, `--ember`, `--gold`, `--accent`, `--border`, `--gold-dim`, `--ember-dim`, `--text-faint`, `--glow-gold`, `--glow-ember`; CSS `linear-gradient(`/`radial-gradient(`; SVG `<linearGradient>`/`<radialGradient>`; any `box-shadow` or `text-shadow` value other than `none`; or any `filter: drop-shadow(` recipe, explicitly including `cardview-target-glow`. Replace Forge's inline palette gradient with two adjacent flat swatch fields and update stale gradient/glow comments in TSX. Also assert raw `#A81E22`/`#B8913C` occur only in `theme.css`, and keep explicit selector/file allowlists so `var(--gules)` appears only in damage/death FX while `var(--or)` appears only in legendary and active-turn treatments.

- [ ] **Step 2: Migrate every remaining consumer.** Menu, Mode Select, Deck Pick, Victory, LAN Host/Join, match shell, hand, deck count, pass overlay, Forge, and Deck Builder use canonical ground/line/text/house tokens, Cardo, ruled groups, and flat focus states. Forge's picker keeps separate select and describe controls.

- [ ] **Step 3: Delete every compatibility alias from Task 4.** Run the literal grep below and require zero matches outside the migration test's own string list:

```bash
rg --glob '*.css' -- '--(bg-[012]|ember(-dim)?|gold(-dim)?|accent|border|text-faint|glow-(gold|ember))' app/src
```

- [ ] **Step 4: Verify all desktop surfaces.** At 1440×900 capture menu, mode select, deck pick, Victory, LAN Host, LAN Join, Forge with Discover and keyword chips, Deck Builder with 60 cards, and the match shell. At 1280×900 confirm no horizontal overflow.

```bash
npx vitest run app/tests/armorialMigration.test.ts app/tests/forgeKeywords.test.ts
npx tsc --noEmit -p app/tsconfig.json
npm run build -w app
```

- [ ] **Step 5: Commit.**

```bash
npm test
npm run build
npx tsc --noEmit -p app/tsconfig.json
git add app/src/theme.css app/src/index.css app/src/screens/match.css app/src/screens/lan.css app/src/screens/forge.css app/src/screens/deckbuilder.css app/src/screens/DeckBuilder.tsx app/src/screens/Forge.tsx app/src/screens/animations.css app/src/components/Background.tsx app/src/components/background.css app/src/components/board.css app/src/components/card.css app/src/components/cardview.css app/src/components/deckcount.css app/src/components/hand.css app/src/components/heroportrait.css app/src/components/keywordchip.css app/src/components/manatray.css app/src/components/passdevice.css app/src/components/projectile.css app/src/components/turnbanner.css app/tests/armorialMigration.test.ts
git commit -m "style(app): complete the Armorial migration"
```

---

### Task 10: Finish review, verification, and DESIGN.md

**Files:**
- Create: `DESIGN.md`
- Modify: only files required by material review findings

- [ ] **Step 1: Run fresh automated verification before screenshots.**

```bash
npm test
npm run build
npx tsc --noEmit -p app/tsconfig.json
```

Run `lens_diagnostics` with `mode=all`; resolve every blocking error in edited files.

- [ ] **Step 2: Initialize browser evidence and capture proof screenshots.** Create one atomic browser-evidence requirement for each surface/state: menu; mode select; deck pick; Victory; LAN Host/Join; empty match; full normal/token board; targeting; owner Discover; opponent waiting; hotseat pass-before-Discover; inspect panel; both hero powers; Forge; Deck Builder; 1280px overflow; reduced motion; offline Cardo. Prove each only from a visible current frame and audit the checklist before review.

- [ ] **Step 3: Run the mechanical detector exactly once.** The external feature worktree does not contain `.pi`, so invoke the original checkout's script by absolute path, pass every changed UI target, and do not run it again after reviewer fixes:

```bash
node "/Users/lucas/Local Storage/PROJECTS/tcg/.pi/skills/impeccable/scripts/detect.mjs" --json app/index.html app/src
```

Fix mechanical findings before the subjective review.

- [ ] **Step 4: Run a fresh finish review with the available agent type.** Spawn a `general-purpose` agent using `deepseek-v4-flash-0731`, `thinking: xhigh`, no inherited history. Require it to read `/Users/lucas/Local Storage/PROJECTS/tcg/.pi/skills/impeccable/reference/degraded/finish-reviewer.md` and `/Users/lucas/Local Storage/PROJECTS/tcg/.pi/skills/impeccable/reference/craft-floor.md`; provide the request, approved decisions, artifact paths, screenshots, direction contract, detector JSON, and craft-floor reference. It reports findings only; main thread applies fixes.

- [ ] **Step 5: Apply one material-fix batch and request the verdict.** Rebuild, recapture affected proof, then resume the same reviewer for a disposition and verdict table. Two reviewer rounds total is the ceiling. Report its disposition and open items verbatim.

- [ ] **Step 6: Create `DESIGN.md` through a fresh documentation review.** Spawn another `general-purpose` agent with the same model/effort, no inherited history, requiring `/Users/lucas/Local Storage/PROJECTS/tcg/.pi/skills/impeccable/reference/degraded/documenter.md`. It drafts `DESIGN.md` from the built and reviewed world; main thread verifies the actual file.

- [ ] **Step 7: Re-run final verification after reviewer/documentation edits.** Do **not** rerun the detector.

```bash
npm test
npm run build
npx tsc --noEmit -p app/tsconfig.json
git diff --check
```

Run `lens_diagnostics mode=all`, audit browser evidence, and inspect `git status --short` before committing.

- [ ] **Step 8: Commit.**

```bash
git add DESIGN.md app core server
git commit -m "docs(app): finish and document the Armorial"
```

---

## Self-Review

**Spec coverage:** Discover engine/FIFO/serialization/bots/curated cards → Task 1; LAN owner/reconnect → Task 2; owner/waiting/hotseat/keyboard/Forge → Task 3; direction contract/offline type/tokens → Task 4; card plate → Task 5; token rows/mana → Task 6; inspect/hero powers → Task 7; rule-accurate motion/reduced motion/skip → Task 8; every remaining surface and zero legacy tokens → Task 9; browser evidence/review/verdict/DESIGN.md → Task 10.

**Worker dependencies:** `CreatureState.token`, `PlayerState.overload`, `KEYWORD_TEXT`, simultaneous combat, `silence`, `stealth`, repaired `giveKeyword`, `Game.pickRandom`, and `CardRegistry.pool()` are all present in base `1e56fe7`. The worker plan must not be rerun.

**Ordering:** Task 0 lands before any Armorial edit. Tasks 1→2→3 are the Discover chain. Tasks 4→9 are visually sequential. Task 8 consumes Discover and simultaneous combat. Task 10 starts only after all implementation tests/builds pass.

**Type consistency:** `PendingChoice.cardIds` and `pendingChoiceQueue: PendingChoice[]` are defined once in Task 1 and consumed unchanged. The intent uses a numeric `choice` index everywhere. `discoverOffered` creates/queues; `discoverResolved` adds to hand/rotates. Task 6's `overload` is future debt while `lockedMana` is the current visible lock. Task 8's single `combatStarted` event carries both creature IDs and leaves `damageDealt` unchanged.

**Plan hygiene:** The red-flag scan is clean. Every test step names exact behavior and every verification step names an executable command.

**Known visual boundary:** Subjective craft cannot be proven by unit tests. Tasks 4–9 require visible browser checks, and Task 10 requires evidence-linked screenshots plus a maximum-two-round independent finish review before completion.
