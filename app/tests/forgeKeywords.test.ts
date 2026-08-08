import { describe, it, expect } from 'vitest';
import { KEYWORD_COST } from '@ashen/core';
import { KEYWORDS } from '../src/forge/formState.js';
import { EFFECT_PRESETS } from '../src/forge/formState.js';

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
      'consume',
    ]) {
      expect(kinds, `no Forge preset for ${kind}`).toContain(kind);
    }
  });
});
