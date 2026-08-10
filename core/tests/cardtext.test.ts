import { describe, it, expect } from 'vitest';
import { cardText, heroPowerText, effectText, KEYWORD_TEXT } from '../src/cardtext.js';
import { buildPool, HEROES, TOKEN_CARDS } from '../src/data/index.js';
import type { Card, EffectSpec, HeroPower, TriggerSpec } from '../src/types.js';

/** Minimal synthetic card shell — tests pass only the fields under test. */
const card = (over: Partial<Card>): Card => ({
  id: 'synthetic', name: 'Synthetic', type: 'spell', cost: 1,
  keywords: [], effects: [], rarity: 'common', archetype: 'test',
  art: { preset: 'arcane', palette: ['#000', '#fff'], seed: 1 },
  author: 'custom', version: 1,
  ...over,
});

const spellCard = (effects: EffectSpec[]): Card =>
  card({ type: 'spell', effects });

const creatureCard = (triggers: TriggerSpec[], keywords: string[] = []): Card =>
  card({ type: 'creature', triggers, keywords: keywords as Card['keywords'] });

describe('effectText — one template per EffectKind (Task 43)', () => {
  it('dealDamage', () => {
    expect(effectText({ kind: 'dealDamage', value: 5, target: 'any' })).toBe('Deal 5 damage to any target.');
  });
  it('heal', () => {
    expect(effectText({ kind: 'heal', value: 3, target: 'hero' })).toBe('Restore 3 health to your hero.');
  });
  it('draw — singular', () => {
    expect(effectText({ kind: 'draw', value: 1 })).toBe('Draw a card.');
  });
  it('draw — plural', () => {
    expect(effectText({ kind: 'draw', value: 3 })).toBe('Draw 3 cards.');
  });
  it('buff — value2 defaults to value (Attack + Health named)', () => {
    expect(effectText({ kind: 'buff', value: 2, target: 'friendlyCreature' })).toBe('Give a friendly creature +2 Attack and +2 Health.');
  });
  it('buff — negatives render as U+2212', () => {
    expect(effectText({ kind: 'buff', value: -1, value2: -1, target: 'enemyCreature' })).toBe('Give an enemy creature \u22121 Attack and \u22121 Health.');
  });
  // Task 1: buffs may modify Attack, Reflect, and Health independently; the
  // text names only the non-zero deltas in the visible order Attack, Reflect,
  // Health (brief examples). A zero-only buff is invalid authoring → no text.
  it('buff — non-zero deltas in Attack, Reflect, Health order', () => {
    // value2 omitted → health defaults to attack (engine behavior), so the
    // text names it; value2: 0 names no health (brief example 1).
    expect(effectText({ kind: 'buff', value: 2, value2: 0, value3: 1, target: 'friendlyCreature' })).toBe('Give a friendly creature +2 Attack and +1 Reflect.');
    expect(effectText({ kind: 'buff', value3: 1, value2: 2, target: 'allFriendlyCreatures' })).toBe('Give all friendly creatures +1 Reflect and +2 Health.');
    expect(effectText({ kind: 'buff', value2: 3, target: 'friendlyCreature' })).toBe('Give a friendly creature +3 Health.');
  });
  it('buff — zero-only deltas produce no text (invalid buffs)', () => {
    expect(effectText({ kind: 'buff', target: 'friendlyCreature' })).toBe('');
  });
  it('summon — single token, display name from token map', () => {
    expect(effectText({ kind: 'summon', cardId: 'token-skeleton' })).toBe('Summon 1 Skeleton.');
  });
  it('summon — plural count', () => {
    expect(effectText({ kind: 'summon', cardId: 'token-rat', value: 3 })).toBe('Summon 3 Giant Rats.');
  });
  it('summon — unknown token id falls back to the raw cardId', () => {
    expect(effectText({ kind: 'summon', cardId: 'mystery-token' })).toBe('Summon 1 mystery-token.');
  });
  it('gainMana — singular', () => {
    expect(effectText({ kind: 'gainMana', value: 1 })).toBe('Gain 1 empty mana crystal.');
  });
  it('gainMana — plural', () => {
    expect(effectText({ kind: 'gainMana', value: 2 })).toBe('Gain 2 empty mana crystals.');
  });
  it('refillMana', () => {
    expect(effectText({ kind: 'refillMana', value: 4 })).toBe('Gain 4 Mana.');
  });
  it('freeze', () => {
    expect(effectText({ kind: 'freeze', target: 'anyCreature' })).toBe('Freeze a creature.');
  });
  it('destroy', () => {
    expect(effectText({ kind: 'destroy', target: 'enemyCreature' })).toBe('Destroy an enemy creature.');
  });
  it('copyCard — with cardId', () => {
    expect(effectText({ kind: 'copyCard', cardId: 'token-wisp' })).toBe('Add a copy of Choir Spirit to your hand.');
  });
  it('copyCard — no cardId (random enemy creature)', () => {
    expect(effectText({ kind: 'copyCard' })).toBe('Add a copy of a random enemy creature to your hand.');
  });
  it('giveKeyword', () => {
    expect(effectText({ kind: 'giveKeyword', keyword: 'shield', target: 'friendlyCreature' })).toBe('Give a friendly creature Shield.');
  });
  it('discountMostExpensive', () => {
    expect(effectText({ kind: 'discountMostExpensive', value: 1 })).toBe('Your most expensive creature costs 1 less this turn.');
  });
  it('discountNextSpell', () => {
    expect(effectText({ kind: 'discountNextSpell', value: 2 })).toBe('Your next spell costs 2 less this turn.');
  });
  it('discover (Task 1)', () => {
    expect(effectText({ kind: 'discover' })).toBe('Discover a card.');
  });
});

describe('cardText — target-name mapping through multi-effect cards (Task 43)', () => {
  it('spell effects join with a space', () => {
    const c = spellCard([
      { kind: 'dealDamage', value: 2, target: 'allEnemies' },
      { kind: 'draw', value: 1 },
    ]);
    expect(cardText(c)).toBe('Deal 2 damage to all enemies. Draw a card.');
  });
  it('every target kind renders its mapped name', () => {
    const targets = {
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
    } as const;
    for (const [target, expected] of Object.entries(targets)) {
      const text = cardText(spellCard([{ kind: 'dealDamage', value: 1, target: target as EffectSpec['target'] }]));
      expect(text, target).toBe(`Deal 1 damage to ${expected}.`);
    }
  });
  it('creature triggers group by name, joined with newlines', () => {
    const c = creatureCard([
      { when: 'deathrattle', effects: [{ kind: 'summon', cardId: 'token-skeleton' }] },
      { when: 'battlecry', effects: [{ kind: 'dealDamage', value: 3, target: 'allEnemies' }] },
    ]);
    // canonical order: battlecry first, then deathrattle
    expect(cardText(c)).toBe('Battlecry: Deal 3 damage to all enemies.\nDeathrattle: Summon 1 Skeleton.');
  });
  it('startOfTurn / endOfTurn / onDamage labels', () => {
    const c = creatureCard([
      { when: 'startOfTurn', effects: [{ kind: 'gainMana', value: 1 }] },
      { when: 'endOfTurn', effects: [{ kind: 'draw', value: 1 }] },
      { when: 'onDamage', effects: [{ kind: 'heal', value: 1, target: 'hero' }] },
    ]);
    expect(cardText(c)).toBe(
      'Start of Turn: Gain 1 empty mana crystal.\nEnd of Turn: Draw a card.\nOn Damage: Restore 1 health to your hero.',
    );
  });
  it('multiple effects inside one trigger group join with a space', () => {
    const c = creatureCard([
      { when: 'battlecry', effects: [
        { kind: 'dealDamage', value: 2, target: 'any' },
        { kind: 'freeze', target: 'anyCreature' },
      ] },
    ]);
    expect(cardText(c)).toBe('Battlecry: Deal 2 damage to any target. Freeze a creature.');
  });
});

describe('cardText — vanilla and keyword-only cards (Task 43)', () => {
  it('vanilla creature returns empty string (stats speak for themselves)', () => {
    expect(cardText(creatureCard([], []))).toBe('');
  });
  it('keyword-only creature returns empty string', () => {
    expect(cardText(creatureCard([], ['taunt', 'rush']))).toBe('');
  });
  it('spell with no effects returns empty string', () => {
    expect(cardText(spellCard([]))).toBe('');
  });
  it('artifact with no triggers returns empty string', () => {
    expect(cardText(card({ type: 'artifact', triggers: [], effects: [] }))).toBe('');
  });
});

describe('cardText — real curated cards (Task 43)', () => {
  it('ember-cauterize exact string', () => {
    const pool = new Map(buildPool().map((c) => [c.id, c]));
    expect(cardText(pool.get('ember-cauterize')!)).toBe('Deal 3 damage to any target. Restore 3 health to your hero.');
  });
  it('pool coverage — every card with rules-bearing data has non-empty text, spells always', () => {
    const pool = buildPool();
    for (const c of pool) {
      const hasTriggers = (c.triggers?.length ?? 0) > 0;
      const text = cardText(c);
      if (c.type === 'spell') {
        expect(text, c.id).not.toBe('');
      } else if (hasTriggers) {
        // creatures/artifacts: triggers render; keyword-only/vanilla return ''
        expect(text, c.id).not.toBe('');
      }
      // generated text must never leak raw ids / gaps — catches missing targets or cardIds
      expect(text, c.id).not.toMatch(/undefined/);
      expect(text, c.id).not.toMatch(/\s{2}| \./);
    }
  });
  it('token display names resolve for every summon cardId in the pool', () => {
    const tokenIds = new Set(TOKEN_CARDS.map((t) => t.id));
    for (const c of buildPool()) {
      for (const e of c.effects) {
        if (e.kind === 'summon' && e.cardId) expect(tokenIds.has(e.cardId), `${c.id}: ${e.cardId}`).toBe(true);
      }
    }
  });
});

describe('keyword text', () => {
  it('distinguishes ward from shield', () => {
    expect(KEYWORD_TEXT.ward).toBe('Absorbs the next enemy spell or effect that targets this creature.');
    expect(KEYWORD_TEXT.shield).toBe('Absorbs the next instance of damage from any source.');
  });

  it('covers every keyword', () => {
    const keywords = ['taunt', 'rush', 'charge', 'windfury', 'lifesteal', 'ward', 'shield', 'venom', 'stealth'] as const;
    for (const k of keywords) {
      expect(KEYWORD_TEXT[k].length).toBeGreaterThan(0);
    }
  });
});

describe('heroPowerText (Task 43)', () => {
  it('renders the power effect list like a spell', () => {
    const power: HeroPower = {
      name: 'Test Power', cost: 2,
      effects: [
        { kind: 'dealDamage', value: 1, target: 'any' },
        { kind: 'draw', value: 1 },
      ],
    };
    expect(heroPowerText(power)).toBe('Deal 1 damage to any target. Draw a card.');
  });
  it('every curated hero power produces non-empty text', () => {
    for (const hero of HEROES) {
      expect(heroPowerText(hero.power), hero.power.name).not.toBe('');
    }
  });
});
