import type {
  ArtRecipe,
  Card,
  CardType,
  EffectSpec,
  Keyword,
  Rarity,
  Trigger,
  ValidationIssue,
} from '@ashen/core';
import { buildPool, validateCard } from '@ashen/core';
import { loadCustomCards } from '../storage.js';

/**
 * Forge form state (Task 24). The draft keeps numeric fields as strings while
 * editing (empty = invalid), so the form can distinguish "not entered yet"
 * from 0. draftToCard coerces; draftIssues flags via validateCard plus the
 * pool-reference rule (summon/copyCard cardIds must exist in the pool).
 */
export interface ForgeDraft {
  id: string; name: string; type: CardType; cost: number;
  attack: string; health: string;                    // strings while editing (empty = invalid)
  keywords: Keyword[]; trigger: Trigger | ''; effects: EffectSpec[];
  // single-trigger form: draftToCard maps `trigger` + `effects` → `triggers: [{ when, effects }]`
  // for creatures/artifacts; spells keep `effects` as cast effects and get no triggers.
  rarity: Rarity; art: ArtRecipe; flavor: string; uploadImage?: string;
}

export function createDraft(): ForgeDraft {
  return {
    id: '',                                        // derived at save time (slug of name)
    name: '',
    type: 'creature',
    cost: 2,
    attack: '',
    health: '',
    keywords: [],
    trigger: '',
    effects: [],
    rarity: 'common',
    art: { preset: 'arcane', palette: ['#241b4f', '#7b5cff'], glyph: '', seed: Math.floor(Math.random() * 2 ** 32) },
    flavor: '',
  };
}

/** Lowercase; runs of non-alphanumerics → '-'; dashes trimmed at both ends. Empty → 'untitled'. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

/** NaN/invalid → 0 (validateCard then flags empty health; attack 0 is legal). */
function toStat(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export function draftToCard(d: ForgeDraft): Card {
  const isSpell = d.type === 'spell';
  const card: Card = {
    id: slugify(d.name),
    name: d.name.trim(),
    type: d.type,
    cost: d.cost,
    keywords: d.keywords,
    effects: isSpell ? d.effects : [],              // creatures/artifacts use triggers only
    rarity: d.rarity,
    archetype: 'neutral',                           // custom cards are unaffiliated
    art: { ...d.art, ...(d.uploadImage ? { imageUrl: d.uploadImage } : {}) },
    flavor: d.flavor.trim() || undefined,
    author: 'custom',
    version: Date.now(),
  };
  if (d.type === 'creature') {
    card.attack = toStat(d.attack);
    card.health = toStat(d.health);
  }
  if (!isSpell && d.trigger) {
    card.triggers = [{ when: d.trigger, effects: d.effects }];
  }
  return card;
}

/**
 * Pool-reference rule (shared by the Forge save gate and the JSON import path,
 * audit 05 C1): a summon/copyCard effect's `cardId` must exist in the pool.
 * Missing cardIds are legal (summon no-ops, copyCard resolves a random enemy
 * creature card — see engine/effects.ts), so only present-but-unknown
 * references are flagged. Importing a card that violates this rule would save
 * fine but crash the engine at resolution (core/src/engine/effects.ts throws
 * 'Unknown card id'), so both entry points must enforce it.
 */
export function poolRuleIssues(card: Card, pool: ReadonlyMap<string, Card>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allEffects = [...card.effects, ...(card.triggers ?? []).flatMap((t) => t.effects)];
  for (const e of allEffects) {
    if ((e.kind === 'summon' || e.kind === 'copyCard') && e.cardId && !pool.has(e.cardId)) {
      issues.push({ field: 'effect', message: `Unknown card reference: ${e.cardId}`, severity: 'error' });
    }
  }
  return issues;
}

/**
 * validateCard(draftToCard(d)) PLUS the pool-reference rule (C1) PLUS a
 * warning when a creature/artifact carries effect rows with no trigger (M1 —
 * draftToCard drops those effects on save, a silent data-loss trap).
 */
export function draftIssues(d: ForgeDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (d.type === 'creature') {
    if (!d.attack.trim()) issues.push({ field: 'attack', message: 'Attack is required.', severity: 'error' });
    if (!d.health.trim()) issues.push({ field: 'health', message: 'Health is required.', severity: 'error' });
  }
  if (d.type !== 'spell' && d.trigger === '' && d.effects.length > 0) {
    issues.push({
      field: 'effect',
      message: 'Effects will be dropped: add a trigger or make it a spell.',
      severity: 'warning',
    });
  }
  const card = draftToCard(d);
  issues.push(...validateCard(card));

  const pool = new Map<string, Card>();
  for (const c of [...buildPool(), ...loadCustomCards()]) {
    if (!pool.has(c.id)) pool.set(c.id, c);
  }
  issues.push(...poolRuleIssues(card, pool));
  return issues;
}

/** Curated effect presets for the Forge's effect builder (Task 25). */
export const EFFECT_PRESETS: { label: string; spec: EffectSpec }[] = [
  { label: 'Deal 2 to any creature', spec: { kind: 'dealDamage', value: 2, target: 'anyCreature' } },
  { label: 'Deal 3 to an enemy creature', spec: { kind: 'dealDamage', value: 3, target: 'enemyCreature' } },
  { label: 'Heal 4 to your hero', spec: { kind: 'heal', value: 4, target: 'hero' } },
  { label: 'Draw 2 cards', spec: { kind: 'draw', value: 2 } },
  { label: '+2/+2 to a friendly creature', spec: { kind: 'buff', value: 2, value2: 2, target: 'friendlyCreature' } },
  { label: 'Summon 1 Giant Rat', spec: { kind: 'summon', value: 1, cardId: 'token-rat' } },
  { label: 'Destroy an enemy creature', spec: { kind: 'destroy', target: 'enemyCreature' } },
  { label: 'Freeze a creature', spec: { kind: 'freeze', target: 'anyCreature' } },
  { label: 'Give a friendly creature Shield', spec: { kind: 'giveKeyword', keyword: 'shield', target: 'friendlyCreature' } },
  { label: 'Next spell costs 1 less', spec: { kind: 'discountNextSpell', value: 1 } },
];
