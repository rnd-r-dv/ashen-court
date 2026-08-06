import type { CSSProperties } from 'react';
import type { ArtRecipe } from '@ashen/core';
import { ARCANE_PRESET, PRESETS, type ArtPreset, type ArtShape } from './artPresets.js';

/**
 * Procedural card art (Task 26).
 *
 * Renders a card's ArtRecipe as a 250×350 SVG: linear-gradient background
 * (recipe.palette override, else the preset gradient), a large accent
 * silhouette path per shape, a runic glyph and a vignette overlay. When the
 * recipe carries an imageUrl (custom uploads), it short-circuits to an
 * `<img>` cover instead.
 *
 * Pure render component: no state, no Math.random. The only per-recipe
 * variation is a deterministic glyph tilt derived from the seed.
 */

export interface CardArtProps {
  recipe: ArtRecipe;
  imageUrl?: string;
  className?: string;
}

const WIDTH = 250;
const HEIGHT = 350;

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

/** Silhouette outline paths, hand-drawn in the 250×350 viewBox (center x=125). */
const SHAPE_PATHS: Record<ArtShape, string> = {
  flame:
    'M125 65 C 152 108, 176 128, 166 172 C 158 212, 142 234, 125 252 ' +
    'C 108 234, 92 212, 84 172 C 74 128, 98 108, 125 65 Z',
  ice:
    'M125 60 L 148 130 L 138 210 L 112 210 L 102 130 Z ' +
    'M88 110 L 100 160 L 90 205 L 74 190 Z ' +
    'M162 110 L 176 190 L 160 205 L 150 160 Z',
  skull:
    'M125 97 A 38 38 0 1 1 125 173 A 38 38 0 1 1 125 97 Z ' +
    'M112 128 A 7 7 0 1 1 112 142 A 7 7 0 1 1 112 128 Z ' +
    'M138 128 A 7 7 0 1 1 138 142 A 7 7 0 1 1 138 128 Z ' +
    'M125 150 L 131 160 L 119 160 Z ' +
    'M108 168 L 142 168 L 139 200 C 137 214, 113 214, 111 200 Z',
  leaf: 'M125 55 C 172 100, 178 165, 125 285 C 72 165, 78 100, 125 55 Z M125 55 L 125 285',
  star:
    'M125 70 L 148.5 137.6 L 220.1 139.1 L 163 182.4 L 183.8 250.9 ' +
    'L 125 210 L 66.2 250.9 L 87 182.4 L 29.9 139.1 L 101.5 137.6 Z',
  storm: 'M143 60 L 92 175 L 122 175 L 98 250 L 168 135 L 135 135 Z',
  gem: 'M125 60 L 180 135 L 125 270 L 70 135 Z M125 60 L 125 270 M70 135 L 180 135',
  bone: 'M85 100 L 165 240 M165 100 L 85 240',
  moon: 'M125 55 C 190 90, 190 250, 125 280 C 95 235, 95 105, 125 55 Z',
  eye:
    'M55 170 C 90 120, 160 120, 195 170 C 160 220, 90 220, 55 170 Z ' +
    'M107 170 A 18 18 0 1 1 143 170 A 18 18 0 1 1 107 170 Z ' +
    'M118 170 A 7 7 0 1 1 132 170 A 7 7 0 1 1 118 170 Z',
  shield: 'M125 65 L 178 88 L 172 185 C 166 238, 146 262, 125 278 C 104 262, 84 238, 78 185 L 72 88 Z M80 160 L 170 160',
  sword:
    'M116 60 L 134 60 L 130 190 L 120 190 Z ' +
    'M95 195 L 155 195 ' +
    'M121 200 L 121 232 L 129 232 L 129 200 Z ' +
    'M111 244 A 9 9 0 1 1 129 244 A 9 9 0 1 1 111 244 Z',
};

/** Stroke width per shape (crossbones need a fat round stroke to read). */
const SHAPE_STROKE: Record<ArtShape, number> = {
  flame: 8, ice: 8, skull: 7, leaf: 8, star: 8, storm: 9,
  gem: 8, bone: 15, moon: 8, eye: 8, shield: 8, sword: 8,
};

/**
 * Deterministic per-recipe gradient id so multiple SVGs on one page never
 * share an id (SVG url(#…) resolves document-wide). Hash of preset, seed and
 * palette — same recipe always yields the same id, no state, no randomness.
 */
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
  const tilt = (recipe.seed % 7) - 3; // deterministic −3..+3 degrees
  const glyphY = 312;

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

      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="12" fill={`url(#${gid})`} />

      <path
        d={SHAPE_PATHS[preset.shape]}
        fill="none"
        stroke={preset.accent}
        strokeWidth={SHAPE_STROKE[preset.shape]}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      <text
        x={WIDTH / 2}
        y={glyphY}
        textAnchor="middle"
        fill={preset.accent}
        fontSize="92"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="8"
        opacity="0.95"
        transform={`rotate(${tilt} ${WIDTH / 2} ${glyphY})`}
      >
        {glyph}
      </text>

      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="12" fill={`url(#${gid}-vig)`} />
    </svg>
  );
}
