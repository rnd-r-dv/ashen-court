import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildPool, DECK_DEFS, expandDeck, EMBER_COURT_HERO } from '../src/data/index.js';
import type { ArchetypeId } from '../src/data/index.js';
import type { Card } from '../src/types.js';
import { validateCard, statBudget, KEYWORD_COST } from '../src/validate.js';

const pool = buildPool();
const byHouse = (house: ArchetypeId) => pool.filter(c => c.archetype === house);
const allSpecs = (c: Card) => [...c.effects, ...(c.triggers ?? []).flatMap(t => t.effects)];
const meanCost = (house: ArchetypeId) => {
  const cards = byHouse(house);
  return cards.reduce((s, c) => s + c.cost, 0) / cards.length;
};
const weightedSpend = (c: Card) =>
  (c.health ?? 0) + ((c.attack ?? 0) + (c.reflect ?? 0)) / 2
  + c.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
const sha256 = (items: string[]) => createHash('sha256').update([...items].sort().join('\n')).digest('hex');
const BASELINE_ID_HASH = '135705962902e62ca7443fb204c28544e0dfb8777715ea61b9605c69f7b29fa7';
const BASELINE_SIG_HASH = {
  ember: 'd1e92556ae82a9e69d23f84d6bc2defa5dd5206c8664d7e5c3e2ec2e60dbf65d',
  bone: '615096ea5c7a8ac057f56baca2c5443e4121267ee5943f54328ded348b495194',
  vermin: '21239b0547f8a347a992241687b1f8c4d408a57081b9724def4e15dbf954544e',
} as const;

describe('pool invariants (identity pilot)', () => {
  it('keeps the exact immutable non-token card-id set', () => {
    const ids = buildPool().filter(c => c.archetype !== 'token').map(c => c.id);
    expect(ids).toHaveLength(278);
    expect(sha256(ids)).toBe(BASELINE_ID_HASH);
  });
  it('every pool card still validates with no errors', () => {
    for (const c of buildPool()) {
      expect(validateCard(c).filter(i => i.severity === 'error'), c.id).toEqual([]);
    }
  });
  it('keeps each 21-card house membership, exact signature counts, and 60-card expansion', () => {
    for (const house of ['ember', 'bone', 'vermin'] as const) {
      const ids = byHouse(house).map(c => c.id);
      expect(ids).toHaveLength(21);
      expect(new Set(DECK_DEFS[house].sig.map(([id]) => id))).toEqual(new Set(ids));
      const sigWithCounts = DECK_DEFS[house].sig.map(([id, n]) => `${id}:${n}`);
      expect(sha256(sigWithCounts)).toBe(BASELINE_SIG_HASH[house]);
      expect(expandDeck(DECK_DEFS[house])).toHaveLength(60);
    }
  });
});

/**
 * Duplicate (kind, value, target) commons within a house, trigger context
 * meaningful: the trigger `when` for trigger effects, 'spell' for top-level
 * spell effects (spec test 1 — a battlecry dmg and a spell dmg are different
 * contexts). The report fails until every duplicate is redesigned or
 * explicitly waived with a recorded strategic reason. The pilot resolves
 * every duplicate by redesign; WAIVERS exists for future houses.
 */
const duplicateCommons = (house: ArchetypeId): string[] => {
  const seen = new Map<string, string[]>();
  for (const c of byHouse(house)) {
    if (c.rarity !== 'common') continue;
    const items = [
      ...c.effects.map(s => ({ when: 'spell' as const, s })),
      ...(c.triggers ?? []).flatMap(t => t.effects.map(s => ({ when: t.when, s }))),
    ];
    for (const { when, s } of items) {
      const key = `${s.kind}|${s.value ?? ''}|${s.target ?? ''}|${when}`;
      const list = seen.get(key) ?? [];
      list.push(c.id);
      seen.set(key, list);
    }
  }
  const report: string[] = [];
  for (const [key, ids] of seen) {
    const unique = [...new Set(ids)];
    if (unique.length > 1) report.push(`${key}: ${unique.join(', ')}`);
  }
  return report;
};

/** Recorded duplicate waivers: card id -> strategic reason. Empty for the
 *  pilot — every duplicate was redesigned. */
const WAIVERS: Record<string, string> = {};

it('duplicate-common report is empty or fully waived (spec test 1)', () => {
  for (const house of ['ember', 'bone', 'vermin'] as const) {
    const report = duplicateCommons(house).filter(line => {
      const ids = line.split(': ')[1]!.split(', ');
      return ids.some(id => !(id in WAIVERS));
    });
    expect(report, `${house}: ${report.join('; ')}`).toEqual([]);
  }
});

/**
 * Approved five-element identity contract (spec 2026-08-10). The prose rows
 * are the reviewable contract; each house's describe below carries the
 * structural assertions that keep its row true.
 */
const MATRIX = [
  { house: 'ember', verbs: 'Direct damage, reach', resource: 'Ash Toll — overload', payoff: 'Burst the enemy hero', weakness: 'No healing or sustained draw; runs out of gas', curve: 'Cheap curve, aggressive power' },
  { house: 'bone', verbs: 'Deathrattle, rebuilding after deaths', resource: 'Death as an engine signal; no Toll', payoff: 'Recursion; the board rebuilds itself', weakness: 'No reach to the enemy hero; must win on board', curve: 'Midrange' },
  { house: 'vermin', verbs: 'Token generation, wide-board conversion', resource: 'Fodder Toll — immediate consume (a1)', payoff: 'Convert expendable tokens into swarm-wide pressure', weakness: 'Individual units are weak; vulnerable to sweepers', curve: 'Cheap curve' },
] as const;

it('the approved matrix maps to three distinct resource mechanics present in pool data', () => {
  const signal = (house: ArchetypeId) => {
    const cards = byHouse(house);
    if (cards.some(c => allSpecs(c).some(s => s.kind === 'overload'))) return 'Ash Toll — overload';
    if (cards.some(c => allSpecs(c).some(s => s.kind === 'consume'))) return 'Fodder Toll — consume';
    if (cards.some(c => (c.triggers ?? []).some(t => t.when === 'deathrattle'))) return 'Death as engine signal';
    return 'missing';
  };
  expect(MATRIX.map(r => [r.house, signal(r.house)])).toEqual([
    ['ember', 'Ash Toll — overload'],
    ['bone', 'Death as engine signal'],
    ['vermin', 'Fodder Toll — consume'],
  ]);
});

describe('ember court identity', () => {
  const house = byHouse('ember');
  it('charges Ash (overload) on at least 4 cards across at least 2 rarities (spec test 2, 4)', () => {
    const tolls = house.filter(c => allSpecs(c).some(s => s.kind === 'overload'));
    expect(tolls.length).toBeGreaterThanOrEqual(4);
    expect(new Set(tolls.map(c => c.rarity)).size).toBeGreaterThanOrEqual(2);
  });
  it('has no healing and no sustained draw anywhere in the house (weakness)', () => {
    const offenders: string[] = [];
    for (const c of house) {
      if (allSpecs(c).some(s => s.kind === 'heal' || s.kind === 'draw')) offenders.push(c.id);
      if (c.keywords.includes('lifesteal')) offenders.push(c.id);
    }
    expect(offenders, offenders.join(', ')).toEqual([]);
    expect(EMBER_COURT_HERO.power.effects.some(s => s.kind === 'heal' || s.kind === 'draw')).toBe(false);
  });
});
