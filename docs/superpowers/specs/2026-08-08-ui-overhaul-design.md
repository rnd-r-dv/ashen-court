# Ashen Court — UI overhaul: generated art, card frame proportions, readable match screen

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
   centred subject, wide landscape composition, no text, no lettering, no watermark,
   no border, no frame"`.

**Never put pixel dimensions in the prompt.** Output size comes from the sampler's
latent grid, which the API derives from `aspect_ratio`; prompt text cannot change it.
FLUX.2 renders legible text unusually well — that is the headline capability in the
model's own example prompt — so a string like `"480x320"` in the prompt is a live risk
of being painted into the illustration. This is also why the `no text, no lettering,
no watermark` clause is load-bearing on this model rather than boilerplate.

*Composition* language is different and does help: `"wide landscape composition"`,
`"subject centred with headroom"` steer how the model fills a frame it has already
been given. Worth A/B-ing in the smoke batch.

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
- **`aspect_ratio` is chosen per asset, from the treatment that asset will receive
  (§4.1).** This is not one global constant:

  | Asset | Treatment | `aspect_ratio` | Why |
  |---|---|---|---|
  | Card, rarity ≥ `epic` | full-bleed | **`"3:4"`** | art fills the portrait 240×336 box |
  | Card, rarity < `epic` | banded | **`"3:2"`** | art fills the landscape panel at the top |
  | Hero | circular portrait | **`"1:1"`** | 92px circle mask (`heroportrait.css:15`) |

  The script derives this from `card.rarity`; it must never be a flag the operator
  sets, or the two will drift.

- **Crop is zero, by construction.** For banded cards the art panel's height is a CSS
  variable set to exactly 3:2 of its own width — the panel is fitted to the art, not
  the art to the panel. For full-bleed the 3:4 source covers the 5:7 box with a 4.8%
  trim off the sides, which lands on background rather than on the subject. Do not
  pick a ratio and then crop to fit; derive `--card-art-h` from the ratio.
- `output_format: "jpeg"`, `n: 1`
- Response: `data[0].b64_json` + `media_type`; `usage.cost` is the USD charge
- Errors are `{error: {code, message}}` — 400 malformed/moderation, 401 key, 402
  credits, 403 spend limit, 404 no provider, 413 too large, 429 rate limit (retry with
  backoff), 502 upstream failure (**not billed**)

### 3.5 Cost, and why the smoke batch is a gate

Pricing is **$0.014/megapixel**. Since resolution cannot be requested, per-image cost
cannot be computed in advance — only measured. The published example returns
`usage.cost: 0.04` for one 16:9 image, which back-solves to ≈2.86 MP (~2256×1269). If
3:2 lands at a comparable megapixel count, a full pass over 285 cards + 12 heroes is
**≈$11.90**. Aspect ratio is probably not a cost lever — providers generally target a
megapixel budget and vary dimensions to hit the requested ratio — but that is an
assumption Stage 0 should confirm, not a fact to plan around.

**Stage 0 is a hard gate.** `--limit 3` against three deliberately unlike cards (a
Hollow Choir spell, an Ember Court creature, a neutral). It writes the images and
reports, per call: `usage.cost`, output resolution, serving provider, and the
extrapolated full-pool total. **Then it stops.** Nothing further runs until a human has
looked at the three images and approved the number.

Coverage is deliberately undecided until after Stage 0 — the script supports every
mode, so deferring costs nothing. Verified counts (`buildPool()`, 2026-08-08:
common=151, rare=68, epic=40, legendary=26):

| Mode | Images (incl. 12 heroes) | Est. @ $0.04 | `--coverage` value |
|---|---|---|---|
| Full pool | 297 | ~$11.90 | `all` |
| Rare and up | 146 | ~$5.80 | `rare+` |
| **Epic and up** | **78** | **~$3.10** | `epic+` |
| Single archetype pilot | ~21 + heroes | ~$1 | `--only <archetype>` |

**`epic+` is the designated fallback if Stage 0 reports a cost that makes the full pool
unattractive.** At 78 images it is roughly a quarter of the full spend, and epics and
legendaries are the cards a player actually stops to look at. Commons and rares keep
procedural art, which as a side effect gives rarity a visual weight it does not
currently carry.

`--coverage` must be implemented as a first-class flag taking `all` | `rare+` |
`epic+`, not left as something the operator filters by hand.

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

The script **downscales before writing**. Target sizes come from what the UI actually
renders at 2× DPR:

| Asset | Rendered size | Written size | Ratio | ~JPEG q80 |
|---|---|---|---|---|
| Banded card art (< epic) | 220×147 CSS | **480×320** | 3:2 | ~30KB |
| Full-bleed card art (epic+) | 240×336 CSS | **528×704** | 3:4 | ~70KB |
| Hero portrait | 92×92 CSS | **256×256** | 1:1 | ~20KB |

Full pool ≈ **11MB** committed (219 banded + 66 full-bleed + 12 heroes), versus ~45MB
if raw ~2.9MP output were stored. Downscaling does not reduce spend, only repo size.

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

## 4. Sub-project 2 — card frame

### 4.1 Two treatments, selected by rarity

The card has **two layouts**, and which one a card gets is derived, never authored:

| Treatment | Applies to | Layout |
|---|---|---|
| **Banded** (default) | everything else | portrait card, landscape art panel on top, text below |
| **Full-bleed** | rarity ≥ `epic` **and** generated art exists | art fills the box, text on scrims |

**Both conditions are required for full-bleed.** A legendary whose art has not been
generated falls back to banded. Without that rule, scrim text would float over a
two-stop procedural SVG gradient and read as broken rather than premium — full-bleed
must never gamble on art it does not have.

This coupling is deliberate. It gives rarity visual weight it currently lacks beyond a
border colour, and it lines up exactly with the `epic+` coverage fallback in §3.5: the
66 cards that get the full-bleed treatment are the same 66 that get generated art first
if cost forces a cut.

The card box stays 240×336 under both treatments — the fixed-box invariant (§2) is not
type- or rarity-dependent and is not reopened here.

### 4.2 The height budget

Card box stays 240×336. Inner height after 8px padding and 2px border is **316px**:

```
 240 x 336 card
+----------------------------+
| (6) [ Seraph of Lament   ] |   38px   cost gem + name plate  (32 + 6 margin)
+----------------------------+
|                            |
|      LANDSCAPE ART         |  147px   art panel, exactly 3:2 of its 220px width
|            3:2             |
|  (4)                  (6)  |          stat pips, INSIDE the panel's lower corners
+----------------------------+
| * CREATURE          RARE   |   27px   type ribbon           (21 + 6 margin)
+----------------------------+
|        [ lifesteal ]       |
|  Rules text, up to 4 lines |  104px   text well, flex: 1
|  and room for one flavor   |
|  line underneath it.       |
+----------------------------+
```

Inner width is 220px (240 − 16 padding − 4 border), so a 3:2 panel is
220 / 1.5 = **146.67 ≈ 147px**. Fixed chrome is 38 + 27 = 65px, leaving 251px for art
and text; art takes 147, the well takes the remaining **104px**.

Today's well is 93px. The extra 11px plus tighter line spacing is what restores a line
of flavor text to hand cards, which currently hide it.

### 4.3 Full-bleed layout (epic and legendary, with art)

Art covers the whole 240×336 box. Two gradient scrims float over it:

```
 240 x 336 card, rarity >= epic, generated art present
+----------------------------+
| (9) [ Ashen Sovereign    ] |  <- top scrim: dark gradient, 0.85 -> 0
|                            |
|                            |
|        FULL-BLEED ART      |
|             3:4            |
|                            |
|  ........................  |  <- bottom scrim starts, 0 -> 0.9
| * LEGENDARY       [ taunt ]|
|  Rules text over the art,  |
|  shadowed for legibility.  |
| (7)                   (9)  |  <- pips over the scrim, inset reserved
+----------------------------+
```

The scrims are gradients, not panels: art at the top and bottom is dimmed, still
visible. The bottom scrim is the denser of the two because it carries rules text.

**Legibility is a hard acceptance criterion, not a nice-to-have.** Rules text must
remain readable against the *brightest* image in the generated set — verify against
real output, never against procedural SVG, which would pass trivially because it is
uniformly dark. Scrim opacity plus `text-shadow` are the levers. If a generated image
defeats the scrim, the fix is to regenerate that card via `overrides.ts` + `--force`,
not to darken the scrim until the art is invisible everywhere.

The composition instruction in the prompt suffix (`subject centred with headroom`)
exists partly to serve this: it keeps faces out of the lower third where the text sits.

### 4.4 The pip collision fix

Current bug: `.card__stats` is `bottom: -13px` on the art wrapper, which assumed
nothing sat beneath the art. The type ribbon does, so on every creature the pips
overlap the ribbon's crossed-swords icon and its rarity label.

**Fix: in the banded layout the pips move fully inside the art panel's lower corners.**
No overlap with the ribbon is possible, so no conditional padding or per-type
special-casing is needed. In the full-bleed layout they sit over the bottom scrim,
which reserves horizontal inset for them.

Do **not** implement the banded fix as "keep the pips straddling the edge and add
horizontal padding to the ribbon on creature cards" — that reintroduces a
type-dependent layout, which is the class of bug the fixed-box work eliminated.

### 4.5 Zero crop

For banded cards, `--card-art-h` is derived from the art ratio (`width / 1.5`), not
chosen independently. Because the generated art is also 3:2, panel and image agree
exactly and nothing is cropped. If the art ratio ever changes, `--card-art-h` changes
with it — these two numbers are one decision, and a comment in `card.css` must say so.

### 4.6 Board minis

Minis follow the same treatment split as full cards, because the alternative is worse:
forcing an epic's 3:4 portrait art through a 3:2 landscape panel would crop ~50% of its
height.

- **Banded minis** (common/rare, or any card without art): unchanged from today — art +
  cost gem + name, ribbon and text well hidden, card height reduced accordingly. At 0.5
  zoom the rules copy is ~6px and is noise. The reduced height must be recomputed from
  the new panel height (38 + 147 + 20 chrome).
- **Full-bleed minis** (epic+ with art): art fills the mini, scrims carry cost and name
  only. No rules text, same as banded minis.

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
- **Deck count.** New. Card advantage and fatigue are currently invisible.
- **Discard count — cut during planning, and it is not coming back cheaply.**
  `PlayerState` is `{hero, deck, hand, board, artifacts, mana, maxMana, surged}`
  (`core/src/types.ts:53`). There is no discard pile, graveyard or played-card list
  anywhere in the engine — a resolved spell simply ceases to exist. Adding one means a
  new `PlayerState` field, new `dispatch` handling and a serialization change, all of
  which §2 rules out. If a discard pile is wanted, it is a gameplay feature with its own
  spec, not a UI task.

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
2. Coverage decision (`all` / `rare+` / `epic+`), then bulk generation and a review
   pass over the contact sheet.
3. **Sub-project 2** — card frame proportions, pip fix, art wiring.
4. **Sub-project 3** — match screen.

Sub-project 2 does **not** block on art existing: the panel resize, the pip fix and the
flavor restoration are all valid against procedural art, and the resolver falls back
cleanly. It can start as soon as the 3:2 ratio is locked, which it now is.

Sub-project 3 is independent of 1 and 2 apart from hero portraits, so it can run in
parallel if desired.
