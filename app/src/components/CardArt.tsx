import type { CSSProperties } from 'react';
import type { ArtRecipe } from '@ashen/core';
import { ARCANE_PRESET, PRESETS, type ArtPreset } from './artPresets.js';
import { mulberry32, shapePaths, type Size } from './artShapes.js';

/**
 * Procedural card art v2 (Task 38).
 *
 * Renders a card's ArtRecipe as a 250×350 layered SVG, every layer derived
 * from a pure seeded PRNG (mulberry32 over recipe.seed) so the same recipe
 * always produces the identical image — no Math.random, no state:
 *
 *   1. sky — linear gradient (recipe.palette override, else preset gradient)
 *   2. midground — silhouette shape paths from artShapes.ts (per-shape rng)
 *   3. runic glyph — recipe.glyph (or preset glyph) with a seeded tilt
 *   4. embers — seeded particle specks drifting through the scene
 *   5. vignette — radial darkening around the edges
 *
 * Rarity glow is intentionally absent: ArtRecipe carries no rarity (that
 * belongs to CardFrame / Task 37). When the recipe carries an imageUrl
 * (custom uploads) the whole composition short-circuits to an `<img>` cover.
 *
 * Pure render component: no state, no side effects, props stay
 * `{ recipe, imageUrl?, className? }`.
 */

export interface CardArtProps {
  recipe: ArtRecipe;
  imageUrl?: string;
  className?: string;
}

const WIDTH = 250;
const HEIGHT = 350;
const SIZE: Size = { w: WIDTH, h: HEIGHT };

const frameStyle: CSSProperties = {
  width: WIDTH,
  height: HEIGHT,
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 12,
  flexShrink: 0,
  background: '#101014',
};

const imgCoverStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const svgStyle: CSSProperties = { display: 'block', borderRadius: 12, flexShrink: 0 };

/** Per-recipe gradient id — hashes preset + seed + palette so sibling SVGs never collide. */
function gradientId(recipe: ArtRecipe): string {
  let h = 0;
  const src = `${recipe.preset}|${recipe.seed}|${recipe.palette.join(',')}`;
  for (let i = 0; i < src.length; i++) h = (Math.imul(h, 31) + src.charCodeAt(i)) | 0;
  return `cardart-g${(h >>> 0).toString(36)}`;
}

/** Recipe palette overrides the preset gradient when it carries two stops. */
function gradientOf(preset: ArtPreset, palette: string[]): [string, string] {
  if (palette.length >= 2 && palette[0] && palette[1]) return [palette[0], palette[1]];
  return preset.gradient;
}

/** Deterministic per-layer rng streams — layers never perturb each other. */
function layerRng(seed: number, salt: number) {
  return mulberry32(seed ^ salt);
}

export default function CardArt({ recipe, imageUrl, className }: CardArtProps) {
  const src = recipe.imageUrl ?? imageUrl;

  if (src) {
    return (
      <div className={className} style={frameStyle}>
        <img src={src} alt="" style={imgCoverStyle} />
      </div>
    );
  }

  const preset: ArtPreset = PRESETS[recipe.preset] ?? ARCANE_PRESET;
  const gradient = gradientOf(preset, recipe.palette);
  const gid = gradientId(recipe);
  const glyph = recipe.glyph || preset.glyph;

  // Layers each draw from their own derived stream: same seed → same art.
  const shapeRng = layerRng(recipe.seed, 0x9e3779b9);
  const glyphRng = layerRng(recipe.seed, 0x85ebca6b);
  const emberRng = layerRng(recipe.seed, 0xc2b2ae35);

  const shapes = shapePaths(preset.shape, shapeRng, SIZE);
  const tilt = (glyphRng() * 8 - 4); // seeded −4..+4 degrees
  const glyphY = 312;

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
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`${preset.shape} art`}
      style={svgStyle}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gradient[0]} />
          <stop offset="100%" stopColor={gradient[1]} />
        </linearGradient>
        <radialGradient id={`${gid}-vig`} cx="50%" cy="40%" r="80%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </radialGradient>
      </defs>

      {/* 1. sky */}
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="12" fill={`url(#${gid})`} />

      {/* 2. midground silhouette */}
      <g fill={preset.accent} fillRule="evenodd" opacity="0.32">
        {shapes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* 3. runic glyph */}
      <text
        x={WIDTH / 2}
        y={glyphY}
        textAnchor="middle"
        fill={preset.accent}
        fontSize="92"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="8"
        opacity="0.95"
        transform={`rotate(${tilt.toFixed(1)} ${WIDTH / 2} ${glyphY})`}
      >
        {glyph}
      </text>

      {/* 4. ember / particle specks */}
      {embers.map((e, i) => (
        <circle key={i} cx={e.x.toFixed(1)} cy={e.y.toFixed(1)} r={e.r.toFixed(1)} fill={preset.accent} opacity={e.o.toFixed(3)} />
      ))}

      {/* 5. vignette */}
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="12" fill={`url(#${gid}-vig)`} />
    </svg>
  );
}
