import type { Card, EffectSpec, EffectTarget, HeroPower, Trigger } from './types.js';
import { TOKEN_CARDS } from './data/tokens.js';

/**
 * Card rules-text generation (Task 43) — the player-facing "what does this
 * card do" requirement. Text is generated FROM the machine-readable
 * EffectSpec[]/TriggerSpec[] so it can never drift from behavior: the engine
 * executes the specs, this module describes them, and both read the same data.
 *
 * Format is Hearthstone-style: sentence case, trailing period, spaces between
 * a spell's effects, and newline-separated "Trigger: X" groups on creatures
 * and artifacts. Keyword-only and vanilla cards return '' — stats speak for
 * themselves (keywords already render as chips on the frame).
 *
 * Both functions are deterministic and pure (no RNG, no state).
 */

/** Canonical trigger display order (matches the brief's listed order). */
const TRIGGER_ORDER: Trigger[] = ['battlecry', 'deathrattle', 'startOfTurn', 'endOfTurn', 'onDamage'];

const TRIGGER_LABEL: Record<Trigger, string> = {
  battlecry: 'Battlecry',
  deathrattle: 'Deathrattle',
  startOfTurn: 'Start of Turn',
  endOfTurn: 'End of Turn',
  onDamage: 'On Damage',
};

/** Player-facing names for every EffectTarget union member. */
const TARGET_NAMES: Record<EffectTarget, string> = {
  any: 'any target',
  hero: 'your hero',
  self: 'your hero',
  anyCreature: 'a creature',
  enemyCreature: 'an enemy creature',
  friendlyCreature: 'a friendly creature',
  friendlyDragon: 'a friendly Dragon',
  allEnemies: 'all enemies',
  allEnemyCreatures: 'all enemy creatures',
  allFriendlyCreatures: 'all friendly creatures',
  randomEnemy: 'a random enemy',
  randomEnemyCreature: 'a random enemy creature',
};

/**
 * Display names for token cards (summoned by effects, never drafted). Derived
 * from TOKEN_CARDS so names can never drift from the pool; unknown ids fall
 * back to the raw cardId (validated by the summon coverage test).
 */
const TOKEN_NAMES = new Map(TOKEN_CARDS.map((t) => [t.id, t.name]));

/** Negative numbers render as U+2212 (typographic minus); positives keep +. */
const signed = (n: number): string => (n < 0 ? `\u2212${-n}` : `+${n}`);

/** Simple append pluralization; both callers' nouns (mana crystals, pool token
 *  names) fit it, so an irregular `pluralForm` override has no user yet. */
const plural = (n: number, singular: string, pluralForm = `${singular}s`): string =>
  n === 1 ? singular : pluralForm;

const tokenName = (cardId: string): string => TOKEN_NAMES.get(cardId) ?? cardId;

const target = (t?: EffectTarget): string => (t ? TARGET_NAMES[t] : '');

/** One sentence for one EffectSpec. Exported for unit testing. */
export function effectText(effect: EffectSpec): string {
  const v = effect.value ?? 0;
  switch (effect.kind) {
    case 'dealDamage':
      return `Deal ${v} damage to ${target(effect.target)}.`;
    case 'heal':
      return `Restore ${v} health to ${target(effect.target)}.`;
    case 'draw':
      return `Draw ${v === 1 ? 'a card' : `${v} cards`}.`;
    case 'buff': {
      const v2 = effect.value2 ?? effect.value ?? 0;
      return `Give ${target(effect.target)} ${signed(v)}/${signed(v2)}.`;
    }
    case 'summon': {
      const n = effect.value ?? 1;
      const name = tokenName(effect.cardId ?? '');
      return `Summon ${n} ${plural(n, name)}.`;
    }
    case 'gainMana':
      return `Gain ${v} ${plural(v, 'empty mana crystal')}.`;
    case 'refillMana':
      return `Gain ${v} Mana.`;
    case 'freeze':
      return `Freeze ${target(effect.target)}.`;
    case 'destroy':
      return `Destroy ${target(effect.target)}.`;
    case 'copyCard':
      return effect.cardId
        ? `Add a copy of ${tokenName(effect.cardId)} to your hand.`
        : 'Add a copy of a random enemy creature to your hand.';
    case 'giveKeyword': {
      const kw = effect.keyword;
      // charAt(0): noUncheckedIndexedAccess makes kw[0] possibly-undefined
      return `Give ${target(effect.target)} ${kw ? kw.charAt(0).toUpperCase() + kw.slice(1) : ''}.`;
    }
    case 'discountMostExpensive':
      // engine discounts only the most expensive CREATURE in hand (intents.ts
      // playEffectiveCost) — the text must say creature, not card (audit 02 I-1).
      return `Your most expensive creature costs ${v} less this turn.`;
    case 'discountNextSpell':
      return `Your next spell costs ${v} less this turn.`;
  }
}

/** Rules text for a whole card. */
export function cardText(card: Card): string {
  if (card.type === 'spell') {
    return card.effects.map(effectText).join(' ');
  }
  // creatures/artifacts: one "Trigger: X" group per present trigger type, in
  // canonical order (battlecry first, like Hearthstone), effects joined with
  // spaces inside the group, groups joined with newlines. No triggers → ''.
  const groups = card.triggers ?? [];
  return TRIGGER_ORDER.map((when) => {
    const effects = groups.filter((g) => g.when === when).flatMap((g) => g.effects);
    return effects.length > 0 ? `${TRIGGER_LABEL[when]}: ${effects.map(effectText).join(' ')}` : '';
  })
    .filter(Boolean)
    .join('\n');
}

/** Rules text for a hero power (its effect list, spell-style). */
export function heroPowerText(power: HeroPower): string {
  return power.effects.map(effectText).join(' ');
}
