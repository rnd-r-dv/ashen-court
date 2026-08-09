import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { buildPool } from '@ashen/core';
import Card from '../src/components/Card.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Pretend exactly one card has generated art.
vi.mock('../src/art/resolveArt.js', () => ({
  resolveCardArt: (id: string) => (id === 'HAS_ART' ? '/assets/has-art-abc123.jpg' : null),
  resolveHeroArt: () => null,
  heroSlug: (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));

function render(card: Parameters<typeof Card>[0]['card']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(createElement(Card, { card, size: 'hand' })); });
  return { host, cleanup: () => act(() => root.unmount()) };
}

const pool = buildPool();
const legendary = pool.find((c) => c.rarity === 'legendary')!;
const common = pool.find((c) => c.rarity === 'common')!;

describe('generated art wiring', () => {
  it('renders an <img> for a card that has generated art', () => {
    const { host, cleanup } = render({ ...common, id: 'HAS_ART' });
    const img = host.querySelector('.card__art img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/has-art-abc123.jpg');
    cleanup();
  });

  it('falls back to the procedural SVG when there is no generated art', () => {
    const { host, cleanup } = render(common);
    expect(host.querySelector('.card__art img')).toBeNull();
    expect(host.querySelector('.card__art svg')).not.toBeNull();
    cleanup();
  });

  it('never overrides a Forge upload with generated art', () => {
    // Custom cards own their imageUrl; generated art must not clobber it.
    const uploaded = {
      ...common, id: 'HAS_ART',
      art: { ...common.art, imageUrl: 'data:image/png;base64,UPLOADED' },
    };
    const { host, cleanup } = render(uploaded);
    expect(host.querySelector('.card__art img')!.getAttribute('src'))
      .toBe('data:image/png;base64,UPLOADED');
    cleanup();
  });

  it('applies full-bleed to a legendary that has art', () => {
    const { host, cleanup } = render({ ...legendary, id: 'HAS_ART' });
    expect(host.querySelector('.card--bleed')).not.toBeNull();
    cleanup();
  });

  it('keeps a legendary banded when it has no art', () => {
    const { host, cleanup } = render(legendary);
    expect(host.querySelector('.card--bleed')).toBeNull();
    cleanup();
  });

  it('keeps a common banded even with art', () => {
    const { host, cleanup } = render({ ...common, id: 'HAS_ART' });
    expect(host.querySelector('.card--bleed')).toBeNull();
    cleanup();
  });

  it('renders the same spec as flat solids — no SVG gradient elements', () => {
    // Armorial direction (Task 5): the procedural composition is preserved
    // (same seeded layers from the same recipe) but drawn in flat tinctures.
    // Any reintroduced <linearGradient>/<radialGradient> definition or
    // url(#...) fill reference is a direction regression.
    const { host, cleanup } = render(common);
    const svg = host.querySelector('.card__art svg')!;
    expect(svg).not.toBeNull();
    // Comma selector: jsdom's nwsapi throws on the bare SVG tag name
    // ('linearGradient') but resolves the comma form correctly.
    expect(svg.querySelectorAll('linearGradient, radialGradient').length).toBe(0);
    expect(svg.querySelectorAll('defs').length).toBe(0);
    // The composition still renders its layers from the same spec: sky rect,
    // silhouette paths, runic glyph, and ember specks.
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg.querySelector('text')).not.toBeNull();
    expect(svg.querySelectorAll('circle').length).toBeGreaterThan(0);
    // Every fill is a solid color, never a url(#gradient) reference.
    const gradientRefs = [...svg.querySelectorAll('[fill]')].filter((el) =>
      (el.getAttribute('fill') ?? '').startsWith('url('),
    );
    expect(gradientRefs).toEqual([]);
    cleanup();
  });
});
