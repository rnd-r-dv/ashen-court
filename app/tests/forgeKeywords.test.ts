import { describe, it, expect } from 'vitest';
import { KEYWORD_COST } from '@ashen/core';
import type { EffectSpec } from '@ashen/core';
import { KEYWORDS, EFFECT_PRESETS, buffAxis, createDraft, draftToCard } from '../src/forge/formState.js';

describe('forge authoring surface', () => {
  it('offers every keyword the engine defines', () => {
    // Forge.tsx used to restate the Keyword union as a literal. An incomplete
    // Keyword[] is still a valid Keyword[], so venom and stealth were added to
    // the engine and silently never reached the picker. This is the test that
    // fails next time.
    expect([...KEYWORDS].sort()).toEqual(Object.keys(KEYWORD_COST).sort());
  });

  it('offers a preset for every effect kind', () => {
    // EFFECT_PRESETS has the same restatement shape for EffectKind. Adding an
    // EffectKind without a preset makes the mechanic unreachable in the Forge
    // even though the engine executes it.
    const kinds = new Set(EFFECT_PRESETS.map(p => p.spec.kind));
    for (const kind of [
      'dealDamage', 'draw', 'heal', 'buff', 'summon', 'gainMana', 'refillMana',
      'freeze', 'destroy', 'copyCard', 'giveKeyword', 'discountMostExpensive',
      'discountNextSpell', 'silence', 'returnToHand', 'spellPower', 'overload',
      'consume', 'discover',
    ]) {
      expect(kinds, `no Forge preset for ${kind}`).toContain(kind);
    }
  });

  it('preserves the discover preset through draftToCard in spell and trigger effects', () => {
    const preset = EFFECT_PRESETS.find((p) => p.spec.kind === 'discover');
    expect(preset).toBeDefined();
    const spec = preset!.spec;

    // Spell: the preset lands in the card's cast effects verbatim.
    const spell = draftToCard({
      ...createDraft(),
      name: 'Glimpse',
      type: 'spell',
      effects: [spec],
    });
    expect(spell.effects).toEqual([{ kind: 'discover' }]);

    // Creature trigger: the preset is preserved in the trigger's effects and
    // creatures never carry cast effects.
    const creature = draftToCard({
      ...createDraft(),
      name: 'Omen',
      type: 'creature',
      attack: '1',
      health: '2',
      trigger: 'onDamage',
      effects: [spec],
    });
    expect(creature.triggers).toEqual([{ when: 'onDamage', effects: [{ kind: 'discover' }] }]);
    expect(creature.effects).toEqual([]);
  });

  it("maps a buff spec's three stat axes to the value/value3/value2 slots (Task 3)", () => {
    // Attack → value, Reflect → value3, Health → value2: the documented
    // three-axis buff contract (core types: value2 historically defaulted to
    // value for serialized compatibility, so editing writes each axis
    // explicitly rather than relying on the fallback).
    const spec: EffectSpec = { kind: 'buff', value: 5, value3: 6, value2: 7 };
    expect(buffAxis(spec, 'attack')).toBe(5);
    expect(buffAxis(spec, 'reflect')).toBe(6);
    expect(buffAxis(spec, 'health')).toBe(7);
  });

  it('defaults an unset axis to 0 — a +2/+2 preset exposes an editable 0 Reflect axis (Task 3)', () => {
    const preset = EFFECT_PRESETS.find((p) => p.spec.kind === 'buff');
    expect(preset).toBeDefined();
    const spec = preset!.spec;
    // The preset prices Attack and Health (+2/+2); its Reflect axis is
    // unset, so the authoring surface must show 0 and let it be edited
    // independently of the other two.
    expect(buffAxis(spec, 'attack')).toBe(2);
    expect(buffAxis(spec, 'health')).toBe(2);
    expect(buffAxis(spec, 'reflect')).toBe(0);
  });
});
