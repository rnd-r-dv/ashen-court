# Ashen Court — UI overhaul: generated art, full-bleed cards, readable match screen

**Date:** 2026-08-08
**Status:** design approved, ready for planning
**Supersedes:** `docs/openrouter-flux-image-gen.md` (that doc scoped Forge custom-card
generation only, at runtime through a server proxy; it stays valid for the Forge path
and is folded in as sub-project 4 below)

---

## 1. Problem

Two screenshots of the running game (mulligan screen, turn 1 board) exposed three
distinct classes of problem.

**Cards are visually interchangeable.** `Smite`, `Seraph of Lament` and
`Cleansing Light` render near-identical images. All three are Hollow Choir, so all
three resolve to the `frost` preset in `app/src/components/artPresets.ts`, and the
per-card seeded jitter in `artShapes.ts` is too subtle to separate them at card size.
The art system is doing exactly what it was designed to do; the design is the problem.

**The card frame has a defect and a void.** The 2026-08-07 pass fixed card-size
variance by moving to a fixed 240×336 box with the art in a 158px landscape band. Two
consequences:

- Stat pips are positioned `bottom: -13px` on the art wrapper, which assumed nothing
  sat directly beneath the art. The type ribbon does. On every creature the pips
  collide with the ribbon's crossed-swords icon and its rarity label.
- Cards whose rules text is short — and creatures, which often have none at all, only
  a keyword chip — leave up to ~90px of empty well. The fixed box solved
  *inconsistency* and exposed *emptiness*.

**The match screen does not communicate state.** The middle two-thirds is void.
Specifically:

| Element | Current state | Why it matters |
|---|---|---|
| Mana | one 11px diamond, 12px `1/1` readout, floating above the hand's left edge (`manatray.css`) | the core resource is the least visible thing on screen |
| Empty board rows | a bare `—` (`Board.tsx:208,216`) | reads as "nothing here", not "your side, room for N" |
| Hero identity | one hardcoded `SIGIL = '✦'` for all 12 heroes (`HeroPortrait.tsx:39`) | both portraits are identical every match |
| HP | green→amber→red bar (`heroportrait.css:95-97`) | generic game-UI, clashes with the gold-on-purple theme |
| Enemy hand | four near-black rectangles | reads as empty boxes |
| Deck / discard | not shown anywhere | fatigue and card advantage are invisible |

---

## 2. Non-goals

- **Engine behaviour.** `ArtRecipe` is presentation only and never reaches `Game`.
  Nothing in this spec can affect engine determinism, LAN mirroring, or replay. Any
  change that would is out of scope by definition.
- **The fixed-card-box invariant.** Cards are a fixed 240×336 regardless of type,
  keyword count or text length. That was won on 2026-08-07 and is not reopened.
- **Removing procedural art.** It stays as the fallback for cards without generated
  art and for all Forge custom cards.
- **Unrelated refactoring.** No touching the engine, the LAN protocol, or storage.

---

## 3. Sub-project 1 — art generation pipeline

### 3.1 Shape

An **offline script**, run by hand with the author's API key, writing image files that
are reviewed and committed. Not a runtime feature: no server route, no key in the app
bundle, no per-player cost, works offline for every player.

### 3.2 New files

```
scripts/art/styles.ts      13 style blocks (12 archetypes + 1 neutral)
scripts/art/overrides.ts   sparse per-card subject overrides
scripts/art/prompt.ts      pure prompt builder — no network, no fs
scripts/art/generate.ts    CLI: fetch, decode, downscale, write, ledger
```

`prompt.ts` being pure is deliberate: prompt composition is the part most likely to
need iteration, and it must be unit-testable with zero network calls and zero spend.

### 3.3 Prompt composition

Three layers:

1. **Archetype style block** — hand-written once per archetype, seeded from the
   existing locked identities in `app/src/components/artPresets.ts` (each archetype
   already has a gradient, accent colour and mood). Example for `choir`/`frost`:
   `"pale cathedral light, cold blue and bone-white, drifting incense and frost, a
   ruined gothic sanctuary"`.

2. **Per-card subject** — assembled from card data, not hand-written:
   `` `${card.name}. ${card.flavor}` ``. Every curated card already carries flavor
   text and it already reads as a scene description, e.g.
   `"Seraph of Lament. She weeps for the wounded, and every wound she deals she
   carries home like a hymn."`

3. **Global suffix** — fixed, enforces house style and stops the model drawing card
   furniture: `"dark fantasy illustration, painterly, dramatic chiaroscuro, single
   centred subject, no text, no lettering, no border, no frame"`.

**Neutral cards get their own block, not an archetype's.** Neutrals and tokens
currently share the `arcane` preset, which is why `Bulwark Knight` reads as though it
belongs to some other deck. The neutral block is deliberately lower-chroma and
unplaced — stone, iron, muted earth — so a neutral card looks at home in any of the 12
decks instead of importing a rival archetype's palette. The 7 token cards ride the
neutral block too: they are summoned onto the board and are seen in play, so they need
art, but they belong to no deck.

Verified pool composition (`buildPool()`, 2026-08-08):

```
285 cards total  ·  12 heroes
  12 archetypes × 21 = 252     archetype key e.g. 'choir', 'ember'
  neutral            =  26     archetype key 'neutral'
  token              =   7     archetype key 'token'
285 of 285 carry flavor text   ← no gaps in the layer-2 prompt source
```

Every card having flavor is what makes the automatic subject line viable; there is no
fallback path to design for.

`overrides.ts` maps `cardId → subject string`, replacing layer 2 for cards whose
flavor text produces a bad image. Expected to stay small; it is the repair path, used
together with `--force`.

### 3.4 API contract

Per `https://openrouter.ai/black-forest-labs/flux.2-klein-4b/llms.txt`:

- `POST https://openrouter.ai/api/v1/images`, `Authorization: Bearer $OPENROUTER_API_KEY`
- Accepted request fields are **exactly** `model`, `prompt`, `aspect_ratio`,
  `output_format`, `n`, `input_references`, `seed`, plus `provider` routing.
  **There is no width/height/size field, and an unlisted value is rejected with 400.**
  Output resolution is therefore provider-chosen and cannot be requested; stating
  dimensions in the prompt does not work either, and risks the model rendering those
  characters into the image.
- `aspect_ratio: "3:4"` — the listed value closest to the card's 5:7 (0.75 vs 0.714).
  Full-bleed art fills the whole portrait card, so this is portrait, not landscape.
- `output_format: "jpeg"`, `n: 1`
- Response: `data[0].b64_json` + `media_type`; `usage.cost` is the USD charge
- Errors are `{error: {code, message}}` — 400 malformed/moderation, 401 key, 402
  credits, 403 spend limit, 404 no provider, 413 too large, 429 rate limit (retry with
  backoff), 502 upstream failure (**not billed**)

### 3.5 Cost, and why the smoke batch is a gate

Pricing is **$0.014/megapixel**. Since resolution cannot be requested, per-image cost
cannot be computed in advance — only measured. The published example returns
`usage.cost: 0.04` for one 16:9 image, which back-solves to ≈2.86 MP (~2256×1269). If
3:4 lands at a comparable megapixel count, a full pass over 285 cards + 12 heroes is
**≈$11.90**.

**Stage 0 is a hard gate.** `--limit 3` against three deliberately unlike cards (a
Hollow Choir spell, an Ember Court creature, a neutral). It writes the images and
reports, per call: `usage.cost`, output resolution, serving provider, and the
extrapolated full-pool total. **Then it stops.** Nothing further runs until a human has
looked at the three images and approved the number.

Coverage is deliberately undecided until after Stage 0 — the script supports every
mode, so deferring costs nothing:

| Mode | Cards | Est. |
|---|---|---|
| Full pool | 285 + 12 heroes | ~$12 |
| Rares and up | ~100 | ~$4 |
| Single archetype pilot | ~24 | ~$1 |

If per-image cost comes back high, the levers in order are: (1) pin a cheaper
`provider` if one serves smaller output at the same aspect ratio — which is why the
serving provider is logged per call; (2) reduce coverage, noting that commons keeping
procedural art would give rarity a visual meaning it does not currently have;
(3) accept it as a one-time cost for a permanent asset.

### 3.6 Output, storage and resolution

Generated images land in:

```
app/src/assets/art/cards/<cardId>.jpg
app/src/assets/art/heroes/<heroSlug>.jpg
```

Under `src/`, **not** `public/`, so Vite's `import.meta.glob` enumerates them at build
time with content hashing. This gives a build-time answer to "does this card have art"
rather than probing for 404s at runtime.

The script **downscales before writing**: the card never renders larger than 240×336
CSS px, so 480×672 covers 2× DPR. Re-encoded at JPEG q80 that is ~45KB per image,
~13MB for the full pool — versus ~45MB if raw ~2.9MP output were committed.
Downscaling does not reduce spend, only repo size.

This requires **`sharp` as a devDependency**, used only by the script and never
reachable from the app bundle. Called out explicitly as a dependency addition; the
alternative is committing ~45MB of oversized JPEGs.

### 3.7 CLI

| Flag | Effect |
|---|---|
| `--dry-run` | print composed prompts, spend nothing |
| `--limit N` | stop after N images (Stage 0 uses `--limit 3`) |
| `--only <archetype>` | restrict to one archetype, or `neutral` |
| `--force <cardId>` | regenerate one card that already has a file |

Default behaviour **skips any card whose output file already exists**, so a crashed run
resumes for free and a re-run costs $0. A running cost ledger prints after each call.
`OPENROUTER_API_KEY` comes from the environment and is never committed. Retry with
backoff on 429 and 502.

### 3.8 Resolution at render time

A single resolver module maps `cardId → image URL | null` from the `import.meta.glob`
map. Miss → the existing `CardArt` procedural SVG renders unchanged. The resolver is a
pure function over the glob map and is unit-testable by injecting a fake map.

This is what allows incremental generation: a half-generated pool renders correctly,
with painted cards and procedural cards side by side.

---

## 4. Sub-project 2 — full-bleed card frame

### 4.1 Layout

Art fills the entire 240×336 box. Two scrims float over it:

- **Top scrim** — cost gem, name plate
- **Bottom scrim** — type/rarity line, keyword chips, rules text

Stat pips become bottom-corner ornaments over the bottom scrim. **This is also the
collision fix**: the bottom scrim reserves horizontal inset for the pips, so the type
line can no longer run underneath them.

Board minis render art + cost + name only, no bottom scrim — at 0.5 zoom the rules
copy is ~6px and is noise.

### 4.2 Legibility is a hard requirement

Today's rules text sits on a flat `#1a1a21` panel. Over illustration it must stay
readable against the **brightest** generated art, not the dark procedural SVG. The
scrim is an opaque-enough gradient plus text-shadow, and it is verified against real
generated output — not against placeholder art, which would pass trivially.

### 4.3 Sequencing risk

Full-bleed means bad art is unavoidable, where the current banded layout quarantines it
to a panel. Sub-project 1 ships first and real cards get reviewed before full-bleed is
committed everywhere.

---

## 5. Sub-project 3 — match screen

- **Board surface per side.** A defined play area with slot outlines showing capacity,
  replacing the bare `—`. Empty reads as "your side, room for N". Also gives summons
  somewhere to land and makes taunt/attack geometry legible.
- **Mana.** Promoted from an 11px diamond to a crystal rail in the bottom bar with a
  legible `3/5` readout, in three states (filled / spent / locked).
- **Hero portraits.** Generated portrait per hero from the same script; the `✦` sigil
  is demoted to a fallback for heroes without art.
- **HP.** A carved gauge in the gold/purple vocabulary, preserving the existing
  ok/hurt/critical thresholds.
- **Enemy hand.** A real card-back design and a tighter row, so it reads as "cards in
  hand" at a glance.
- **Deck and discard counts.** New. Both are currently invisible.

---

## 6. Sub-project 4 — Forge "Generate art" (deferred, unchanged)

The runtime path described in `docs/openrouter-flux-image-gen.md` remains valid and
out of scope for this round: a server-side `POST /api/generate` proxy so the key never
enters the browser, feeding the existing `art.imageUrl` pipeline. It is listed here so
the two efforts are not designed in conflict — sub-project 1's prompt builder should be
written so the Forge path can reuse it rather than growing a second prompt composer.

---

## 7. Testing

| Area | Approach |
|---|---|
| `prompt.ts` | unit tests over composition, overrides, and the neutral/archetype split — pure, no network |
| Art resolver | unit tests with an injected fake glob map: hit → URL, miss → null |
| CLI | `--dry-run` covered by a test asserting no fetch is issued |
| Card frame | jsdom cannot lay out CSS, so assertions target structure and class wiring, as `handLayout.test.ts` does for spacing |
| Match screen | existing `board.test.ts` / `match.test.ts` patterns |
| Legibility | manual review against real generated art — explicitly not automatable |

Existing suite is 402 tests across 50 files and must stay green throughout.

---

## 8. Sequencing

1. **Sub-project 1, Stage 0** — script + prompt builder + 3-image smoke batch. **Stop
   for human review of images and cost.**
2. Coverage decision, then bulk generation and a review pass over the contact sheet.
3. **Sub-project 2** — full-bleed frame, validated against real art.
4. **Sub-project 3** — match screen.

Sub-project 3 is independent of 1 and 2 apart from hero portraits, so it can run in
parallel if desired.
