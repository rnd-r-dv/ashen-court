import { describe, it, expect } from 'vitest';
import { buildPool, TOKEN_CARDS, DECK_DEFS, expandDeck, HEROES } from '../src/data/index.js';
import type { DeckDef } from '../src/data/index.js';
import { validateCard, validateDeck } from '../src/validate.js';
import { CardRegistry } from '../src/cards.js';
import type { Card } from '../src/types.js';

describe('pool', () => {
  it('every curated card passes validateCard with no errors', () => {
    const pool = buildPool();
    for (const c of pool) {
      const issues = validateCard(c);
      expect(issues.filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
  });
  it('ids are unique', () => {
    const ids = buildPool().map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('includes mana-surge and tokens', () => {
    const pool = buildPool();
    expect(pool.some(c => c.id === 'mana-surge')).toBe(true);
    expect(TOKEN_CARDS.length).toBeGreaterThanOrEqual(6);
  });

  // --- Task 2: approved buff Reflect deltas (ledger §5) ---
  //
  // Every curated combat-stat buff and both buffing hero powers carry an
  // explicit, approved value3 (Reflect delta). The engine applies `value3 ?? 0`
  // at runtime, so a missing value3 would silently default — this exact map is
  // the guard: 31 sources, no extras, no silent defaults.
  const buffPairsOf = (c: Card): Array<[number, number, number | undefined]> =>
    [
      ...(c.effects ?? []),
      ...(c.triggers ?? []).flatMap(t => t.effects),
    ].filter(e => e.kind === 'buff').map(e => [
      e.value ?? 0,
      e.value2 ?? e.value ?? 0,
      e.value3,
    ]);
  const APPROVED_BUFF_VALUE3: Record<string, Array<[number, number, number]>> = {
    'bone-frenzy': [[1, 1, 1]],
    'neutral-drums': [[1, 1, 1]],
    'neutral-banner': [[2, 2, 1]],
    'dragon-wingmen': [[2, 2, 1]],
    'dragon-drakeling': [[1, 1, 1]],
    'dragon-matriarch': [[1, 1, 1]],
    'dragon-prince': [[2, 2, 1]],
    'dragon-council': [[1, 1, 1]],
    'dragon-celestial': [[1, 1, 1]],
    'hero:dragon': [[1, 1, 1]],
    'vermin-swarmlord': [[1, 1, 1]],
    'vermin-frenzy': [[2, 0, 1]],
    'vermin-alpha': [[1, 2, 1]],
    'vermin-endless': [[1, 1, 1]],
    'roots-worldmother': [[2, 2, 1]],
    'pact-bond': [[3, 3, 1]],
    'storm-charge': [[2, 2, 1]],
    'coven-hex': [[-1, -1, -1]],
    'coven-curse': [[-1, -1, -1]],
    'coven-wither': [[-2, -2, -1]],
    'coven-nightmare': [[-3, -3, -2]],
    'coven-raven': [[-1, -1, -1]],
    'coven-decay': [[-2, -2, -1]],
    'coven-transfix': [[-1, -1, -1]],
    'coven-mirrorhex': [[-4, -4, -2]],
    'coven-apathy': [[-3, -3, -2]],
    'coven-glare': [[-1, -1, -1]],
    'coven-abyss': [[-2, -2, -1]],
    'coven-queen': [[-2, -2, -1]],
    'coven-eternal': [[-1, -1, -1]],
    'hero:coven': [[-1, -1, -1]],
  };
  describe('buff reflect deltas (approved ledger §5)', () => {
    it('every curated buff and both buffing hero powers carry the exact approved value3', () => {
      const pool = buildPool();
      const actual: Record<string, Array<[number, number, number | undefined]>> = {};
      for (const c of pool) {
        const pairs = buffPairsOf(c);
        if (pairs.length) actual[c.id] = pairs;
      }
      for (const [i, hero] of HEROES.entries()) {
        const pairs = hero.power.effects
          .filter(e => e.kind === 'buff')
          .map(e => [e.value ?? 0, e.value2 ?? e.value ?? 0, e.value3] as [number, number, number | undefined]);
        if (pairs.length) {
          const key = hero.name === 'Seraphina Skywing' ? 'hero:dragon'
            : hero.name === 'Morwenna Hex' ? 'hero:coven'
            : `hero:${i}`;
          actual[key] = pairs;
        }
      }
      expect(actual).toEqual(APPROVED_BUFF_VALUE3);
    });
  });
  it('tokens cannot be used in decks', () => {
    const reg = new CardRegistry(buildPool());
    const issues = validateDeck(['token-rat'], reg.pool());
    expect(issues.some(i => i.severity === 'error')).toBe(true);
  });
  it('discover cards keep their immutable ids, contain Discover, and stay deck-legal (Task 1)', () => {
    // Art seeds are derived from card IDs, so the three curated Discover cards
    // must keep their exact ids forever. Reachability: star-meditate and
    // choir-candle sit in their archetype sigs; neutral-scroll rides in the
    // star and choir neutrals.
    const pool = buildPool();
    const byId = new Map(pool.map(c => [c.id, c]));
    const scroll = byId.get('neutral-scroll')!;
    const meditate = byId.get('star-meditate')!;
    const candle = byId.get('choir-candle')!;
    expect(scroll.effects).toEqual([{ kind: 'discover' }]);
    expect(meditate.effects).toEqual([{ kind: 'discover' }, { kind: 'gainMana', value: 1 }]);
    expect(candle.effects).toEqual([{ kind: 'discover' }, { kind: 'heal', value: 2, target: 'hero' }]);
    // still pass pool validation and their decks' 60-card validation
    const reg = new CardRegistry(pool);
    for (const c of [scroll, meditate, candle]) {
      expect(validateCard(c).filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
    const decks: DeckDef[] = [DECK_DEFS.star!, DECK_DEFS.choir!];
    for (const def of decks) {
      expect(def.neutrals).toContain('neutral-scroll');
      expect(validateDeck(expandDeck(def), reg.pool()).filter(i => i.severity === 'error')).toEqual([]);
    }
    expect(expandDeck(DECK_DEFS.star!)).toContain('star-meditate');
    expect(expandDeck(DECK_DEFS.choir!)).toContain('choir-candle');
  });
});
