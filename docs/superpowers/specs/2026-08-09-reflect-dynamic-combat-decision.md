# Reflect combat rendering decision

**Status:** Approved by the user on 2026-08-10
**Plan:** `docs/superpowers/plans/2026-08-09-reflect-dynamic-combat.md` — Task 0

## Decision

Production combat uses **CSS-rendered DOM cards**. Do not ship the experimental WebGL particle/shockwave layer. CSS and Hybrid WebGL shared the same card motion, produced no meaningful gameplay-legibility difference, and both met the performance threshold; the additional renderer therefore does not justify its lifecycle, fallback, and maintenance cost.

Source geometry, phase transitions, computed transforms, tests, and runtime measurements are the primary evidence for this decision. Screenshots are corroborating evidence only.

## Choreography: the crossing

A creature exchange is one simultaneous crossing rather than a staged attacker strike followed by a separate defender counter:

1. **Windup:** both cards draw away from contact, rise, and lean in opposing directions.
2. **Clash:** both accelerate toward the midpoint between their resting centers. The attacker arcs upward; the target is driven downward, producing an X-shaped crossing rather than an unreadable flat overlap.
3. **Impact:** both cards hold the shared contact pose for one short hitstop. One impact mark communicates one simultaneous engine exchange.
4. **Through:** both continue in the same direction and finish slightly beyond the other card’s resting slot. The attacker passes in front; neither card recoils toward its origin before crossing.
5. **Settle:** both return to their authoritative board positions. This is the only backwards travel in the sequence.

This supersedes the plan’s earlier attacker-first/defender-second presentation and Task 7’s separate Reflect-strike wording. It does **not** change engine semantics: Attack and Reflect damage still resolve simultaneously from the captured combat snapshot.

## Geometry contract

Production must derive travel from stable attacker and selected-target bounds, not from the width of the defender formation:

```ts
const attackerCentre = attacker.left + attacker.width / 2;
const targetCentre = target.left + target.width / 2;
const clashX = (targetCentre - attackerCentre) / 2;
const crossX = (target.left - attacker.left) * 1.06;
```

- Attacker through pose: `translateX(crossX)`.
- Target through pose: `translateX(-crossX)`.
- Clash poses use equal opposing half-center distances.
- The impact mark is centered at the midpoint between resting card centers.
- Only the selected target leaves the defender formation; sibling defenders retain their formation positions except for bounded impact shake.
- Motion uses transform-only overlay/facsimile plates so board layout never reflows and document scroll never changes.
- Replay, skip, navigation, and cancellation must synchronously clear phases, timers, impact classes, overlays, and transforms.

## Rotation and layering

Use restrained perspective rotation to explain direction and overlap; never spin or flip a card:

- attacker windup: approximately `rotateZ(-3deg) rotateY(9deg) scale(1.03)`;
- attacker clash: approximately `rotateZ(6deg) rotateY(-12deg) scale(1.10)`;
- attacker through: approximately `rotateZ(2deg) rotateY(-4deg) scale(1.02)`;
- target uses the mirrored signs, with a smaller through scale near `1.01`;
- attacker z-index is above the target from clash through follow-through;
- rest and settled transforms are identity transforms with crisp card text and art.

These values are production starting constants. Preserve the crossing and restrained rotation relationship if final board geometry requires small numerical adjustment.

## Approved timing

The user selected the spike’s **slow 0.75× playback**. Effective production timings are:

| Phase | Effective duration |
|---|---:|
| Windup | 120ms |
| Clash | 226.667ms |
| Impact hitstop | 80ms |
| Through | 226.667ms |
| Settle | 373.333ms |
| **Total** | **1026.667ms (displayed as 1027ms)** |

Implement these effective timings directly or derive them from the reviewed base values `90/170/60/170/280 ÷ 0.75`; do not expose a production speed picker.

The crossing accelerates into clash, holds during impact, decelerates through the far-side pose, then settles firmly without spring or bounce. CSS and the animation-queue driver must consume one timing source rather than duplicating unsynchronized literals.

## Impact treatment

- One contact-local impact mark only.
- Use canonical **gules** for damage shards/debris and cream for the engraved ring/first hard flash.
- Do not use an archetype house tincture for damage.
- No gradients, glow, blur, drop shadow, depth shadow, bevel, or faux metal.
- Whole-lane shake may reach **7px**, an explicitly approved exception to the earlier 4px board-shake cap.
- Per-card/local jolt remains capped at **4px**.
- Impact effects may outlive the 80ms hitstop briefly through follow-through, but must be gone before rest.
- Gules still remains exclusive to damage/death; or remains exclusive to Legendary rarity and active turn.

## Reduced motion

When `prefers-reduced-motion` or the game’s reduced-motion setting is active:

1. show a cream source outline on the attacker;
2. at **140ms**, hard-cut to one target-centered gules/cream damage frame;
3. clear the frame at **320ms** total;
4. do not travel, rotate, scale, shake, emit debris, run WebGL, or repeatedly animate either card.

## Performance and fallback

The reviewed implementation was exercised at 1280×900 and 1440×900 with 1, 2, and 7 defenders in both comparison modes. All 12 normal replays recorded zero `PerformanceObserver` long tasks above 50ms, and no replay introduced horizontal document overflow.

Production has no WebGL branch. If advanced CSS features are unavailable, the fallback is the same reduced source-outline/target-frame cut; combat state and animation-queue completion must never depend on visual effects succeeding.

## Production acceptance requirements

Task 7 production combat is not complete until tests and runtime checks prove:

- measured pass-through geometry for 1/2/7 formations at 1280×900 and 1440×900;
- sibling defenders and underlying board layout do not reflow;
- one simultaneous impact event and no separate counter implication;
- approved phase timings come from one source;
- 7px lane shake and 4px local-jolt bounds;
- gules/cream impact semantics and all Armorial material bans;
- reduced-motion 140ms/320ms cut with no travelling cards;
- replay/skip/rematch/navigation cleanup;
- no long task above 50ms on the verification machine.
