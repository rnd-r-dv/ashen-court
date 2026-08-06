/**
 * Procedural art presets (Task 26).
 *
 * Each preset pairs a curated archetype identity (ember court, hollow choir,
 * …) with a dark-fantasy gradient, an accent color, a runic glyph and a
 * silhouette shape. `CardArt` renders the preset procedurally as an SVG when
 * a card has no uploaded image.
 *
 * The 12 keys are locked (amendment 8) — every curated card in `buildPool`
 * references one of them (neutrals/tokens use 'arcane'), which
 * app/tests/artPresets.test.ts enforces. Gradient pairs must stay pairwise
 * distinct (test 2) so each archetype reads as its own hue.
 */

export type ArtShape =
  | 'flame' | 'ice' | 'skull' | 'leaf' | 'star' | 'storm'
  | 'gem' | 'bone' | 'moon' | 'eye' | 'shield' | 'sword';

export interface ArtPreset {
  /** [light, dark] gradient stops — used as the SVG background (top-left → bottom-right). */
  gradient: [string, string];
  /** Line/glow color for the accent shape and glyph. */
  accent: string;
  /** Runic glyph drawn beneath the accent shape. */
  glyph: string;
  /** Which silhouette path CardArt draws. */
  shape: ArtShape;
}

export const ARCANE_PRESET: ArtPreset = {
  gradient: ['#4a2d6b', '#14102a'],
  accent: '#7b5cff',
  glyph: 'ᚨ', // ansuz — wisdom, the arcane
  shape: 'gem',
};

export const PRESETS: Record<string, ArtPreset> = {
  ember: {
    gradient: ['#7a1f1f', '#2b0d0d'],
    accent: '#ff6b35',
    glyph: 'ᚲ', // kenaz — torch
    shape: 'flame',
  },
  frost: {
    gradient: ['#3a5f8a', '#101c2e'],
    accent: '#7fd4ff',
    glyph: 'ᛁ', // isa — ice
    shape: 'ice',
  },
  nature: {
    gradient: ['#2c5a34', '#0c1f10'],
    accent: '#8fd14f',
    glyph: 'ᛒ', // berkano — birch, growth
    shape: 'leaf',
  },
  dragon: {
    gradient: ['#3c3a72', '#111028'],
    accent: '#c9a227',
    glyph: 'ᛞ', // dagaz — dragon
    shape: 'eye',
  },
  shadow: {
    gradient: ['#3a2a52', '#150d24'],
    accent: '#c084fc',
    glyph: 'ᛗ', // mannaz — mortal dancers
    shape: 'sword',
  },
  bone: {
    gradient: ['#4a3a26', '#181008'],
    accent: '#e6c98f',
    glyph: 'ᚦ', // thurisaz — thorn
    shape: 'skull',
  },
  void: {
    gradient: ['#2f1a44', '#0c0614'],
    accent: '#a06bff',
    glyph: 'ᛇ', // eihwaz — yew, the grave
    shape: 'bone',
  },
  curse: {
    gradient: ['#4a4018', '#141005'],
    accent: '#d9c94f',
    glyph: 'ᛚ', // laguz — water, moon
    shape: 'moon',
  },
  star: {
    gradient: ['#3a3a5c', '#12121f'],
    accent: '#ffe9a8',
    glyph: 'ᛊ', // sowilo — the sun-star
    shape: 'star',
  },
  vigil: {
    gradient: ['#4a3f33', '#1a1510'],
    accent: '#f2e6c9',
    glyph: 'ᛏ', // tiwaz — Tyr, the warder
    shape: 'shield',
  },
  storm: {
    gradient: ['#2f4a55', '#0e1a1e'],
    accent: '#7fb2e5',
    glyph: 'ᚺ', // hagalaz — hail
    shape: 'storm',
  },
  arcane: ARCANE_PRESET,
};

