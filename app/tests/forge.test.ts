import { describe, it, expect } from 'vitest';
import { validateCard } from '@ashen/core';
import type { ForgeDraft } from '../src/forge/formState.js';
import { createDraft, draftToCard, draftIssues } from '../src/forge/formState.js';

/** A fully valid creature draft; spread overrides to build invalid variants. */
const validDraft = (over: Partial<ForgeDraft> = {}): ForgeDraft => ({
  ...createDraft(),
  name: 'Test Creature',
  type: 'creature',
  cost: 2,
  attack: '3',
  health: '4',
  keywords: [],
  trigger: 'battlecry',
  effects: [{ kind: 'dealDamage', value: 1, target: 'anyCreature' }],
  rarity: 'rare',
  ...over,
});

const errors = (d: ForgeDraft) => draftIssues(d).filter((i) => i.severity === 'error');

describe('forge form state', () => {
  it('flags a 0-cost 15/15 creature for exceeding the stat budget', () => {
    const d = validDraft({ cost: 0, attack: '15', health: '15' });
    expect(errors(d).some((i) => i.field === 'stats')).toBe(true);
  });

  it('flags a spell carrying a creature-only keyword', () => {
    const d = validDraft({
      type: 'spell',
      keywords: ['taunt'],
      trigger: '',
      effects: [{ kind: 'draw', value: 2 }],
    });
    expect(errors(d).some((i) => i.field === 'keywords' && i.message.includes('taunt'))).toBe(true);
  });

  it('flags a battlecry creature whose trigger has no effects', () => {
    const d = validDraft({ trigger: 'battlecry', effects: [] });
    expect(errors(d).some((i) => i.message.includes('battlecry'))).toBe(true);
  });

  it('reports zero errors for a valid draft', () => {
    expect(errors(validDraft())).toEqual([]);
  });

  it('converts a valid draft into a card that passes validateCard', () => {
    const card = draftToCard(validDraft());
    expect(validateCard(card).filter((i) => i.severity === 'error')).toEqual([]);
    expect(card.author).toBe('custom');
    expect(card.id).toBe('test-creature');
    // single-trigger form: trigger + effects become a triggers group; no top-level cast effects
    expect(card.triggers).toEqual([
      { when: 'battlecry', effects: [{ kind: 'dealDamage', value: 1, target: 'anyCreature' }] },
    ]);
    expect(card.effects).toEqual([]);
    // id auto-slugs from name (lowercase, non-alphanumerics -> dashes)
    expect(draftToCard(validDraft({ name: 'Cursed  Blade!' })).id).toBe('cursed-blade');
    expect(draftToCard(createDraft()).id).toBe('untitled');
  });

  it('flags a summon effect that references a card outside the pool', () => {
    const d = validDraft({ effects: [{ kind: 'summon', value: 1, cardId: 'token-nonexistent' }] });
    expect(errors(d).some((i) => i.message.includes('token-nonexistent'))).toBe(true);
  });
});
