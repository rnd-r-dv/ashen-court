import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { HeroState } from '@ashen/core';
import HeroPortrait from '../src/components/HeroPortrait.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../src/art/resolveArt.js', () => ({
  resolveCardArt: () => null,
  resolveHeroArt: (name: string) =>
    name === 'Vespera Dawnlight' ? '/assets/vespera-abc.jpg' : null,
  heroSlug: (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));

/**
 * Every field of HeroState, spelled exactly as core/src/types.ts declares it:
 * the used-power flag is `usedPower`, not `powerUsed`, and the two discount
 * counters are required. Typed rather than cast so a future rename of any of
 * them fails this fixture loudly instead of silently.
 */
function heroState(name: string, hp = 30): HeroState {
  return {
    name,
    hp,
    maxHp: 30,
    shields: 0,
    power: { name: 'Lullaby', cost: 2, effects: [] },
    usedPower: false,
    discountMostExpensive: 0,
    discountNextSpell: 0,
  };
}

function render(heroName: string, hp = 30) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(HeroPortrait, {
      hero: heroState(heroName, hp),
      player: 0,
      isViewer: true,
      active: true,
    }));
  });
  return { host, cleanup: () => act(() => root.unmount()) };
}

describe('HeroPortrait art', () => {
  it('renders the generated portrait when one exists', () => {
    const { host, cleanup } = render('Vespera Dawnlight');
    const img = host.querySelector('.heroportrait-portrait');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/assets/vespera-abc.jpg');
    expect(host.querySelector('.heroportrait-sigil')).toBeNull();
    cleanup();
  });

  it('falls back to the sigil for a hero with no portrait', () => {
    // All 12 heroes shared this one glyph before the art pipeline existed;
    // it stays as the fallback, not the default.
    const { host, cleanup } = render('Rat King Moulder');
    expect(host.querySelector('.heroportrait-portrait')).toBeNull();
    expect(host.querySelector('.heroportrait-sigil')).not.toBeNull();
    cleanup();
  });


  it('expresses health as a transform instead of a layout width', () => {
    const { host, cleanup } = render('Rat King Moulder', 15);
    const fill = host.querySelector<HTMLElement>('.heroportrait-hpfill');
    expect(fill?.style.width).toBe('');
    expect(fill?.style.transform).toBe('scaleX(0.5)');
    cleanup();
  });
});
