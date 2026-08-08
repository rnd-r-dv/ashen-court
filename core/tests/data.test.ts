import { describe, it, expect } from 'vitest';
import { buildPool, TOKEN_CARDS, DECK_DEFS, expandDeck } from '../src/data/index.js';
import type { DeckDef } from '../src/data/index.js';
import { validateCard, validateDeck } from '../src/validate.js';
import { CardRegistry } from '../src/cards.js';

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
