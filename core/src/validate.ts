import type { Card, EffectKind, Keyword, Rarity } from './types.js';

export interface ValidationIssue { field: string; message: string; severity: 'error' | 'warning'; }

export const RARITY_COPY_LIMIT: Record<Rarity, number> = { common: 3, rare: 2, epic: 1, legendary: 1 };

/** Budget = attack + health for a vanilla creature at a given cost. */
export function statBudget(cost: number): number { return 2 + 2 * cost; }

/**
 * Design headroom allowed above statBudget() before a card is rejected (I10).
 * The baseline prices a *vanilla* creature; cards that carry a drawback, a
 * conditional upside, or an externally-paid cost are meant to sit above it.
 * Two curated tokens rely on this: token-treant (baseline 2, spends 3) and
 * token-phoenixash (baseline 2, spends 4) are 0-cost bodies whose real cost is
 * paid by the card that summons them. So the enforced ceiling — and the number
 * the error message must quote — is statBudget(cost) + STAT_BUDGET_SLACK, not
 * statBudget(cost) itself.
 */
export const STAT_BUDGET_SLACK = 4;

export const KEYWORD_COST: Record<Keyword, number> = {
  taunt: 1, rush: 1, charge: 2, windfury: 2, lifesteal: 1, ward: 1, shield: 1,
};

const CREATURE_ONLY_KEYWORDS: Keyword[] = ['taunt', 'rush', 'charge', 'windfury', 'lifesteal', 'ward', 'shield'];
const CREATURE_ONLY_TRIGGERS = ['battlecry', 'deathrattle', 'onDamage'];

export function validateCard(card: Card): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) => issues.push({ field, message, severity: 'error' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'warning' });

  if (!card.name.trim()) err('name', 'Name is required.');
  if (!/^[a-z0-9-]{3,32}$/.test(card.id)) err('id', 'ID must be lowercase letters, digits, dashes (3-32 chars).');
  if (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > 15) err('cost', 'Cost must be an integer 0..15.');
  if (card.type === 'creature') {
    if (card.attack === undefined || !Number.isInteger(card.attack) || card.attack < 0) err('attack', 'Creature needs attack >= 0.');
    if (card.health === undefined || !Number.isInteger(card.health) || card.health < 1) err('health', 'Creature needs health >= 1.');
  } else if (card.attack !== undefined || card.health !== undefined) {
    err('type', 'Only creatures have attack/health.');
  }
  for (const tg of card.triggers ?? []) {
    if (tg.when === 'battlecry' && card.type !== 'creature') err('trigger', 'Battlecry is creature-only.');
    if (tg.when === 'onDamage' && card.type !== 'creature') err('trigger', 'OnDamage is creature-only.');
    if (tg.effects.length === 0) err('effect', `Trigger ${tg.when} requires at least one effect.`);
  }
  if (card.type === 'spell' && (card.triggers ?? []).length > 0) err('trigger', 'Spells cannot have triggers.');
  if (card.type === 'spell' && (card.effects ?? []).length === 0) err('effect', 'Spells require at least one effect.');
  if (card.type !== 'spell' && (card.effects ?? []).length > 0) err('effect', 'Only spells use top-level effects; creatures/artifacts use triggers.');
  for (const k of card.keywords) {
    if (k === 'ward' && card.keywords.includes('taunt')) err('keywords', 'Ward and Taunt cannot combine.');
    if (card.type !== 'creature' && CREATURE_ONLY_KEYWORDS.includes(k)) err('keywords', `${k} is creature-only.`);
  }
  if (card.type === 'creature' && card.attack !== undefined && card.health !== undefined) {
    const budget = statBudget(card.cost);
    const ceiling = budget + STAT_BUDGET_SLACK;
    const spent = card.attack + card.health + card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
    if (spent > ceiling) {
      err('stats', `Stat+keyword total ${spent} exceeds the max ${ceiling} for cost ${card.cost} `
        + `(vanilla budget ${budget} + ${STAT_BUDGET_SLACK} design slack) by ${spent - ceiling}.`);
    }
  }
  const TARGET_KINDS: EffectKind[] = ['dealDamage', 'heal', 'buff', 'freeze', 'destroy', 'silence', 'giveKeyword'];
  const allEffects = [...(card.effects ?? []), ...(card.triggers ?? []).flatMap(t => t.effects)];
  for (const e of allEffects) {
    if (TARGET_KINDS.includes(e.kind) && !e.target) err('effect', `${e.kind} requires a target.`);
  }
  return issues;
}

export function validateDeck(cardIds: string[], pool: Map<string, Card>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const counts = new Map<string, number>();
  for (const id of cardIds) {
    const card = pool.get(id);
    if (!card) { issues.push({ field: 'deck', message: `Unknown card id: ${id}`, severity: 'error' }); continue; }
    if (card.archetype === 'token') issues.push({ field: 'deck', message: `Token cards cannot be in decks: ${id}`, severity: 'error' });
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
    if (n > RARITY_COPY_LIMIT[card.rarity]) issues.push({ field: 'deck', message: `More than ${RARITY_COPY_LIMIT[card.rarity]} copies of ${card.name} (${card.rarity}).`, severity: 'error' });
  }
  if (cardIds.length !== 60) issues.push({ field: 'deck', message: `Deck must be exactly 60 cards (has ${cardIds.length}).`, severity: 'error' });
  return issues;
}
