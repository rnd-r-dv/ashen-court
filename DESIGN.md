---
name: Ashen Court — Armorial
description: A roll of arms — flat heraldic tinctures on iron-gall ground, cream engraved hairlines, Cardo throughout.
colors:
  ground: "#14120F"
  ground-deep: "#0C0B09"
  ground-rise: "#1D1A15"
  line: "#E8E0CE"
  line-dim: "rgba(232, 224, 206, 0.38)"
  text: "#E8E0CE"
  text-dim: "#A79E8A"
  gules: "#A81E22"
  or: "#B8913C"
  house-ember: "#B4341C"
  house-choir: "#C9BFA4"
  house-vermin: "#6B7A3A"
  house-dragon: "#8C5A1E"
  house-roots: "#3C6B44"
  house-dance: "#4A2F63"
  house-bone: "#8A8578"
  house-pact: "#6B1F2E"
  house-coven: "#2F3E6B"
  house-star: "#3E5C7A"
  house-vigil: "#A88C3E"
  house-storm: "#4A6B75"
typography:
  display:
    fontFamily: "'Cardo', Georgia, 'Times New Roman', serif"
    fontSize: "2.4rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.04em"
  title:
    fontFamily: "'Cardo', Georgia, 'Times New Roman', serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.03em"
  body:
    fontFamily: "'Cardo', Georgia, 'Times New Roman', serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "'Cardo', Georgia, 'Times New Roman', serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "1rem"
  space-4: "1.5rem"
  space-5: "2.5rem"
  space-6: "4rem"
components:
  button-gothic:
    backgroundColor: "{colors.ground-rise}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0.7rem 1.6rem"
  button-gothic-primary:
    backgroundColor: "{colors.ground-rise}"
    textColor: "{colors.line}"
    rounded: "{rounded.md}"
    padding: "0.7rem 1.6rem"
  button-inked:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ground-deep}"
    rounded: "6px"
    padding: "10px 12px"
  field:
    backgroundColor: "{colors.ground-deep}"
    textColor: "{colors.text}"
    rounded: "6px"
    padding: "8px 10px"
  keyword-chip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text-dim}"
    rounded: "2px"
    padding: "1px 6px"
  card-plate:
    backgroundColor: "{colors.ground-rise}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    height: "336px"
    width: "240px"
  hero-blazon:
    backgroundColor: "{colors.ground-deep}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  mana-pip:
    backgroundColor: "{colors.line}"
    rounded: "2px"
    height: "20px"
    width: "20px"
---

# Design System: Ashen Court — Armorial

## Overview

**Creative North Star: "A Roll of Arms"**

Ashen Court reads as a book of heraldry brought to the screen: twelve archetypes are twelve houses, and every surface is drawn in the flat grammar of a roll of arms. The ground is iron-gall ink on parchment, hairlines are engraved cream rules, and charges are flat SVG — no bevels, gradients, glows, or faux metal exist anywhere in the world. Depth is not light but layering: a raised surface is a tone lighter on the ink ground, set off by a ruled line. This refuses both the torch-lit tavern the genre normally ships and its flat-gray opposite.

Density is that of a ledger, not a dashboard. The match surface is a ruled page — two banded registers divided by an engraved rule, each under its house banner in the margin, with the token row a subordinate sub-band. Every number on screen carries its own label (a stat pip reads "ATTACK 5", never a bare 5), and rarity is told by the weight and color of a hairline rather than by glow or chrome. Cardo — a single self-hosted renaissance serif — sets both display and body, so the whole interface speaks in one voice, from a house name in the margin to the rules text on a plate.

Motion is engraved, not animated in the modern sense: everything runs on two beats — 140ms and 320ms — with linear or stepped easing, hard cuts, and short holds. A combat strike is a flat gules line cutting across a plate; a creature landing is a hairline ring expanding in four hard steps. Under reduced motion every duration zeroes and all effects land at their final pose immediately. This is a desktop/laptop system: it assumes a wide viewport and a mouse, and it owns that assumption rather than papering over it.

**Key Characteristics:**
- Flat heraldic tinctures on an iron-gall ground; cream engraved hairlines; charges as flat SVG.
- Two reserved tinctures with hard meanings: gules for damage and death only, or for legendary rarity and the active turn only.
- Twelve house tinctures used strictly as identity fields — a card's top band, its ribbon mark, a margin banner.
- Depth by tonal ground layers and hairline rules; no gradient, glow, shadow, bevel, faux metal, or 3D anywhere.
- One typeface (Cardo, self-hosted, 400/italic/700) for display, body, and label; small caps from the 400 weight.
- One fixed card box (240×336, 5:7) with generated art; epic and legendary cards with art run full-bleed on flat ink plates.
- Motion on two beats (140ms / 320ms), linear or stepped, scaled by a single `--anim-scale` and zeroed under reduced motion.
- Desktop/laptop only: layouts assume a wide viewport, a mouse, and hover.

## Colors

The palette is a flat page: cream ink and hairlines on three iron-gall grounds, with two semantically reserved tinctures and twelve house identity fields. Nothing is tinted by light — every color sits flat, and its role is fixed.

### Primary
- **Gules — the damage tincture** (#A81E22): Damage and death only — combat strikes, death strikes, and damage washes. It is the world's one red and it means hurt. Never decorates pips, borders, or buttons.
- **Or — the honor tincture** (#B8913C): Legendary rarity (the 2px legendary frame hairline and its rarity mark) and the active turn (the active side's margin rule and register rule) only. It is the one gold and it means distinction.

### Secondary
The twelve houses, one field per archetype — ember #B4341C, choir #C9BFA4, vermin #6B7A3A, dragon #8C5A1E, roots #3C6B44, dance #4A2F63, bone #8A8578, pact #6B1F2E, coven #2F3E6B, star #3E5C7A, vigil #A88C3E, storm #4A6B75. A house tincture marks identity: the card's 2px top band, the ribbon's house lozenge and icon, and the house banner in the board margin. It never tints the art mount, and it never borrows gules' or or's meaning.

### Neutral
- **Iron-gall grounds**: ground #14120F is the page; ground-deep #0C0B09 is the deepest ink — the shadow register that underlays wells, dialogs, and veils; ground-rise #1D1A15 is the raised register — the field behind buttons, cards, and the hand row.
- **Cream ink and hairlines**: line #E8E0CE is the full engraved hairline and the strongest ink; line-dim rgba(232, 224, 206, 0.38) is the subordinate hairline — borders at rest, section rules, dividers. text #E8E0CE is the primary ink; text-dim #A79E8A is muted blazon grey for flavor, secondary copy, and inactive states.

### Named Rules
**The Reserved Tincture Rule.** Gules appears only for damage and death; or only for legendary rarity and the active turn. A third use of either is a violation — the migration guard fails the build if a gradient, glow, shadow, or alias reappears, and the contract test pins the exact token values.
**The One House, One Field Rule.** A house tincture is identity only — top band, ribbon mark, margin banner. It never tints the art mount, and it never crosses into the reserved pair's meanings.

## Typography

**Display Font:** Cardo (self-hosted woff2, Georgia / Times New Roman serif fallbacks)
**Body Font:** Cardo
**Label Font:** Cardo — small caps come from `font-variant-caps: small-caps` on the 400 weight, never a synthetic face

**Character:** One face, one voice. Cardo is a renaissance humanist serif, set small and tracked wide where it must act as inscription; because the same face carries display, body, and label, nothing on screen ever changes register. Offline play is part of the deal: all three weights (400, italic, 700) are downloaded with the app and served from `/fonts/` — a page load never touches a CDN.

### Hierarchy
- **Display** (400, 2.4rem–3rem, ~1.1 line-height, 0.02–0.06em tracking): shell titles, victory and LAN titles, the turn banner text (small-caps, 40px), hero names, inspect titles. The larger the display, the wider the tracking.
- **Title** (700, 15–18px, ~0.03em tracking): card nameplates (15px), inspect titles and mana readouts (18px), banner labels. Numerals set `font-variant-numeric: tabular-nums` so a readout never jitters.
- **Body** (400, 12–14px, ~1.3 line-height): rules text (12.5px, never clamped — it is what the card does), controls (13–14px), panel copy. Card rules text is centered on the plate.
- **Label** (700, 10–12px, small-caps, 0.5px–0.22em tracking): type ribbons, keyword chips, house banner names (vertical, 0.22em), field legends, and toggle text. Labels read as engraved inscriptions, not UI chrome.

### Named Rules
**The Cardo Rule.** Cardo is the only typeface — display, body, and label alike — and it is self-hosted. No second face, no CDN, and small caps only via `font-variant-caps` on the 400 weight; a synthetic small-caps face is forbidden.

## Layout

The board is the page. The match surface is a full-height column — a thin top bar (turn banner, hint, skip), the battlefield, and the hand row on a raised register — where two banded registers are divided by an engraved rule, each under its house banner in the left margin, and the token row sits beneath the friendly register as a dashed subordinate sub-band. The active side's margin rule and register rule are the only or on the board.

Shell surfaces (menu, mode select, deck pick, LAN) center a max-width 900px column; content groups are "ruled groups" — a section title on its own hairline rule. Spacing follows one scale: 0.25rem / 0.5rem / 1rem / 1.5rem / 2.5rem / 4rem (`--space-1`…`--space-6`), with board and match gaps preferring the scale and `clamp()` where a gap must track the viewport.

This is a desktop/laptop system — there is no mobile layout and no breakpoint system for one. The match surface fits itself to wide and short windows instead: hand and board sizes use `clamp()` against viewport units, hand cards step down by `zoom` at 1200px / 900px / 700px widths, and short windows (max-height 850px / 800px / 760px) compress portraits, rows, and the hand area. Below the 700px floor the layout is not designed to seat itself.

## Elevation & Depth

There is no shadow vocabulary. The world is explicitly flat: no box-shadow, text-shadow, drop-shadow, glow, gradient, bevel, backdrop blur, or faux metal exists in the built CSS, and the migration guard fails the build if any reappears. Depth is conveyed by two flat devices:

- **Tonal ground layers** — ground-deep → ground → ground-rise. A surface that sits above the page is a tone lighter; a well or overlay that sits behind content is a tone darker. The darkest layer doubles as the "shadow register": dialogs, wells, and the veil under overlays are ground-deep.
- **Hairline rules** — cream and dim hairlines separate registers, mark emphasis, and carry state. A selected deck is a full cream hairline on the deepest ink; an active hero is a cream outline ring; a playable card wears a 1px engraved ring inset from the plate edge.

Overlays dim the page with a flat translucent ground-deep wash (72% via `color-mix`), never a blur and never a gradient. Motion contributes no depth either: effects are hard steps and cuts, not fades through darkness.

### Named Rules
**The Flat-By-Default Rule.** No gradient, glow, shadow, bevel, faux metal, or 3D anywhere in the app. Depth is tonal grounds plus hairlines, and emphasis is line and ink changes, never light. When a state must call attention, it steps in flat (a veil, a ring, an ink shift) — it never glows.

## Shapes

The form language is engraved plate work: flat rectangles with modest, strictly increasing corners, hairline borders, and one recurring signature frame. The radius scale is 4px / 8px / 10px (`--radius-sm` / `--radius-md` / `--radius-lg`), pinned strictly increasing by the contract test. The card plate — the world's largest surface — is the 10px end; buttons, dialogs, and fields sit at 8px; small plates (mulligan toggles, alerts, the hero blazon) at 4px. Micro corners (2–3px) mark chip text and stat pips, and the 6px field/inked-button corner is a component literal, not part of the scale.

The signature frame is the **gothic frame**: a 2px double hairline border with two 10px corner brackets drawn in the full cream, used by shell buttons and modal dialogs. Circles are reserved for gems and seals — cost gems and hero power gems are cream discs on deep ink, the hero portrait is a flat ground-rise disc, help markers are small outlined dots. Rotated diamonds read as blazon marks — mana cells in the ledger tray, the house lozenge on a card ribbon. A dashed hairline marks subordinate structure: the token sub-band, empty board slots, the enemy hand boundary.

### Named Rules
**The Corner Scale Rule.** Radii are 4px, 8px, 10px and strictly increasing; nothing joins the token scale between them. Micro corners (2–3px) and the 6px field corner are literals confined to their components.

## Components

### Buttons
- **Shape:** The gothic frame — 2px double hairline (`line-dim` at rest), corner brackets in full cream, 8px radius.
- **Primary:** ground-rise field, cream ink (gothic-primary). Hover is a line-and-ink change only: border and text step to full cream. A primary action is distinguished by the cream hairline, never by color fill.
- **Inked:** a cream field with ground-deep ink (save, confirm) — the inverse, used where the action is the plate. Destructive actions are a hairline field with house-ember ink. Hover on both is the border stepping to full cream; disabled is 0.45 opacity.

### Chips
- **Style:** Keyword chips are flat plates — ground field, 1px dim hairline, 2px corner, Cardo small-caps at 11px with 0.5px tracking.
- **State:** Hover and open step border and ink to full cream; selected sits on ground-deep with a cream hairline. The non-interactive variant (discover choice plates) holds its dim state under hover. The popover that explains a keyword is a ground-deep plate with a cream hairline and a small-caps name line.

### Cards
- **Corner Style:** 10px frame corner; the art panel inside is 6px; stat pips 3px.
- **Box:** Fixed 240×336 (5:7) for every card — type, keyword count, and flavor length never change the box; variable copy absorbs into one clipped well and flavor yields first.
- **Background:** ground-rise plate; common = 1px dim hairline, rare = 1px cream, epic = 2px cream, legendary = 2px or. Face-down cards are ground-deep with a faint cream sigil, art grayscaled.
- **House identity:** a 2px tincture band across the top edge plus a lozenge and icon on the type ribbon; the art mount is never tinted.
- **Content:** a nameplate and cost gem on deep ink, a 3:2 banded art panel (full-bleed for epic+ cards with generated art — art fills the box and text rides flat ground-deep plates), a small-caps type ribbon, and stat pips that read WORD over NUMERAL ("ATTACK" / "5") so no number is ambiguous.
- **States:** hand hover lifts 12px; board minis (zoom 0.5, text well hidden — keywords reached via the inspect panel) lift 5px; selected wears a 2px outline in the rarity color; a playable card wears a 1px engraved ring inset 3px.

### Inputs / Fields
- **Style:** ground-deep field, 1px dim hairline, 6px corner, 14px body text, 8px 10px padding.
- **Focus:** the hairline steps to full cream (no outline, no glow). The LAN code field is the display variant: Cardo, uppercase, 0.18em tracking, 2px double hairline, 8px corner, and a 2px cream outline plus border step on focus.

### Hero Blazon
- **Style:** The permanent hero-power plate in each house margin — 108px wide, ground-deep, 1px dim hairline, 4px corner, small-caps name with its flat cream cost gem, and the power's generated rules text below. The read is permanent: there is no hover-only tooltip.

### Board
- **Style:** Two banded registers divided by an engraved rule; house banners in the left margin (vertical small-caps names at 0.22em tracking over a 22px flat SVG charge, all in the house tincture); the active side's margin and register rules are or. The token row is a dashed sub-band of smaller cards. The mana tray is a ledger line of rotated diamonds — inked for available, hairline for spent, struck through for locked.

### Named Rules
**The Card Box Rule.** Every card is exactly 240×336 — the 5:7 TCG proportion — regardless of type, keyword count, or flavor length; full-bleed keeps the same box, and one derived geometry serves every context via `zoom`.
**The Rarity-By-Line Rule.** Rarity is told by the frame hairline — common dim, rare cream, epic heavier cream, legendary 2px or — never by fill, chrome, or light.
**The Number-Over-Word Rule.** A stat is never a bare numeral: each pip reads WORD over NUMERAL in Cardo small caps, so no number on the board is ever ambiguous.

## Do's and Don'ts

### Do:
- **Do** set every surface on the three iron-gall grounds and separate them with cream hairlines — depth is tonal layers plus rules, nothing else.
- **Do** reserve gules for damage/death and or for legendary and the active turn; let a house tincture carry identity instead.
- **Do** express state as hairline and ink changes, flat translucent washes, and hard steps — a border, a color, a veil, a ring.
- **Do** animate on the two beats (140ms / 320ms) with linear or stepped easing, and scale every duration by `--anim-scale`; under reduced motion, land at the final pose instantly.
- **Do** set labels in Cardo small caps with wide tracking, and set every numeral in `tabular-nums` where it is a readout.
- **Do** keep the card box at 240×336 and the radius scale at 4 / 8 / 10, strictly increasing.
- **Do** favor a permanent read over hover: rules text, keywords, and stats are on the surface or in an inspect panel, never behind a tooltip.

### Don't:
- **Don't** use gradients, glows, box/text shadows, bevels, faux metal, backdrop blur, or any 3D effect anywhere in the app.
- **Don't** add a second typeface, or load fonts from the network — Cardo is self-hosted and offline play depends on it.
- **Don't** put gules or or anywhere outside their reserved meanings, and don't tint a card's art mount with its house tincture.
- **Don't** clamp or hide a line of rules text — let flavor yield first.
- **Don't** design for mobile: this is a desktop/laptop system, and the 700px floor is the edge of what it will seat itself into.
