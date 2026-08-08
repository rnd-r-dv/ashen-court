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
});
