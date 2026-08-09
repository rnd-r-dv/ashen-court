import type { CSSProperties } from 'react';
import type { ArtRecipe } from '@ashen/core';
import { ARCANE_PRESET, PRESETS, type ArtPreset } from './artPresets.js';
import { mulberry32, shapePaths, type Size } from './artShapes.js';

/**
 * Procedural card art v2 (Task 38), flattened to the Armorial register
 * (Task 5).
 *
 * Renders a card's ArtRecipe as a layered SVG composed in a 250×350 space,
 * every layer derived from a pure seeded PRNG (mulberry32 over recipe.seed)
 * so the same recipe always produces the identical image — no Math.random,
 * no state:
 *
 *   1. sky — a flat field (recipe.palette override, else the preset's
 *            light stop), no gradient
 *   2. ground band — a flat register across the bottom (the preset's dark
 *            stop), replacing the old radial vignette
 *   3. midground — silhouette shape paths from artShapes.ts (per-shape rng)
 *   4. runic glyph — recipe.glyph (or preset glyph) with a seeded tilt
 *   5. embers — seeded particle specks drifting through the scene
 *
 * The seed, the layer order, the rng draw sequence, and the composition are
 * unchanged from the gradient era — only the paint is flat. The SVG defines
 * no <linearGradient>/<radialGradient> and every fill is a solid color
 * (cardArtWiring.test.ts guards that).
 *
 * Rarity glow is intentionally absent: ArtRecipe carries no rarity (that
 * belongs to CardFrame / Task 37). When the recipe carries an imageUrl
 * (custom uploads) the whole composition short-circuits to an `<img>` cover.
 *
 * Pure render component: no state, no side effects, props stay
 * `{ recipe, className? }`.
 */

export interface CardArtProps {
  recipe: ArtRecipe;
  className?: string;
}

const WIDTH = 250;
const HEIGHT = 350;
const SIZE: Size = { w: WIDTH, h: HEIGHT };

/**
 * The visible window into the 250×350 composition (UI pass 2026-08-07).
 *
 * Shapes and embers are still generated against the full SIZE, so every seed
 * produces byte-identical geometry to before — only the framing changed. The
 * card frame needs a LANDSCAPE art panel (a 5:7 art inside a 5:7 card leaves
 * no room for rules text, which is what made cards grow to ~600px tall), so
 * the SVG shows the band the silhouettes actually occupy (they are drawn
 * between y≈42 and y≈290) and lets their bases bleed off the bottom edge.
 *
 * VIEW_W/VIEW_H are exported as the panel's aspect ratio: card.css sizes the
 * art slot to match, so `slice` never has to crop in normal layout.
 */
const VIEW_X = 0;
const VIEW_Y = 44;
export const VIEW_W = 250;
export const VIEW_H = 180;

/** Art-panel aspect ratio (width / height) — card.css mirrors this. */
export const ART_ASPECT = VIEW_W / VIEW_H;

/** Height of the flat ground band at the bottom of the panel (~25% of the
 *  view): the silhouettes' bases bleed off the bottom edge, and the band
 *  anchors them the way a vignette used to — flat tincture, not darkening. */
const GROUND_H = 46;

const frameStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  background: '#101014',
};

const imgCoverStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const svgStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/** Recipe palette overrides the preset fields when it carries two stops:
 *  [0] is the sky field, [1] the ground band — both rendered as SOLID fills
 *  (the preset pair stays pairwise-distinct data, see artPresets.test.ts). */
function fieldOf(preset: ArtPreset, palette: string[]): [string, string] {
  if (palette.length >= 2 && palette[0] && palette[1]) return [palette[0], palette[1]];
  return preset.gradient;
}

/** Deterministic per-layer rng streams — layers never perturb each other. */
function layerRng(seed: number, salt: number) {
  return mulberry32(seed ^ salt);
}

export default function CardArt({ recipe, className }: CardArtProps) {
  if (recipe.imageUrl) {
    return (
      <div className={className} style={frameStyle}>
        <img src={recipe.imageUrl} alt="" style={imgCoverStyle} />
      </div>
    );
  }

  const preset: ArtPreset = PRESETS[recipe.preset] ?? ARCANE_PRESET;
  const [sky, ground] = fieldOf(preset, recipe.palette);
  const glyph = recipe.glyph || preset.glyph;

  // Layers each draw from their own derived stream: same seed → same art.
  const shapeRng = layerRng(recipe.seed, 0x9e3779b9);
  const glyphRng = layerRng(recipe.seed, 0x85ebca6b);
  const emberRng = layerRng(recipe.seed, 0xc2b2ae35);

  const shapes = shapePaths(preset.shape, shapeRng, SIZE);
  const tilt = (glyphRng() * 8 - 4); // seeded −4..+4 degrees
  // The glyph used to sit at y=312, below the silhouettes and outside the
  // landscape window. It now reads as a corner sigil watermark inside the
  // window — same seeded tilt, same rng draw order (art stays deterministic).
  const glyphX = VIEW_X + VIEW_W - 22;
  const glyphY = VIEW_Y + VIEW_H - 18;

  const embers: Array<{ x: number; y: number; r: number; o: number }> = [];
  const emberCount = 9 + Math.floor(emberRng() * 6);
  for (let i = 0; i < emberCount; i++) {
    embers.push({
      x: 10 + emberRng() * (WIDTH - 20),
      y: 42 + emberRng() * (HEIGHT - 76),
      r: 1 + emberRng() * 1.9,
      o: 0.2 + emberRng() * 0.6,
    });
  }
  // a few larger, fainter embers read as heat-haze glows
  for (let i = 0; i < 3; i++) {
    embers.push({
      x: 15 + emberRng() * (WIDTH - 30),
      y: 60 + emberRng() * (HEIGHT - 120),
      r: 2.6 + emberRng() * 2.2,
      o: 0.1 + emberRng() * 0.12,
    });
  }

  return (
    <svg
      className={className}
      viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${preset.shape} art`}
      style={svgStyle}
    >
      {/* 1. sky — a flat field; square corners, the art slot supplies
             the rounding */}
      <rect x={VIEW_X} y={VIEW_Y} width={VIEW_W} height={VIEW_H} fill={sky} />

      {/* 2. ground register — the flat dark field across the bottom,
             anchoring the silhouettes' bases (the old vignette is gone) */}
      <rect
        x={VIEW_X}
        y={VIEW_Y + VIEW_H - GROUND_H}
        width={VIEW_W}
        height={GROUND_H}
        fill={ground}
      />

      {/* 3. midground silhouette */}
      <g fill={preset.accent} fillRule="evenodd" opacity="0.32">
        {shapes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* 4. runic glyph */}
      <text
        x={glyphX}
        y={glyphY}
        textAnchor="end"
        fill={preset.accent}
        fontSize="54"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="4"
        opacity="0.6"
        transform={`rotate(${tilt.toFixed(1)} ${glyphX} ${glyphY})`}
      >
        {glyph}
      </text>

      {/* 5. ember / particle specks */}
      {embers.map((e, i) => (
        <circle key={i} cx={e.x.toFixed(1)} cy={e.y.toFixed(1)} r={e.r.toFixed(1)} fill={preset.accent} opacity={e.o.toFixed(3)} />
      ))}
    </svg>
  );
}
