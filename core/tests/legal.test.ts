import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { validatePlayCard } from '../src/engine/intents.js';
import { makeTestSetup, addCreature } from './helpers.js';
import type { Card, Intent } from '../src/types.js';

// Type-guard filters: TS keeps discriminated-union narrowing on the results.
const playCard = (i: Intent): i is Extract<Intent, { kind: 'playCard' }> => i.kind === 'playCard';
const attack = (i: Intent): i is Extract<Intent, { kind: 'attack' }> => i.kind === 'attack';
const heroPower = (i: Intent): i is Extract<Intent, { kind: 'heroPower' }> => i.kind === 'heroPower';

const main = (game: Game) => { game.state.phase = 'main'; };

describe('legalIntents', () => {
  it('enumerates playable cards with valid targets and legal attacks', () => {
    const game = Game.create(makeTestSetup());
    main(game);
    game.state.players[0].mana = 10;
    game.state.players[0].maxMana = 10;
    game.state.players[0].hand = ['t-001', 'test-spell', 'test-spell-2'];   // 3-cost creature, 1-cost targeted spell, 2-cost AoE spell
    // enemy board: taunt 1/1 + plain 1/1 (board ids distinct from hand ids so
    // the hand cards keep their pool defs/costs)
    const taunt = addCreature(game, 1, { id: 't-010', attack: 1, health: 1, keywords: ['taunt'], exhausted: false });
    const plain = addCreature(game, 1, { id: 't-011', attack: 1, health: 1, keywords: [], exhausted: false });
    // own board: one attacker
    const own = addCreature(game, 0, { id: 't-012', attack: 1, health: 1, keywords: [], exhausted: false });

    const intents = game.legalIntents(0);

    // playCard: creature has no effects → single no-target intent
    const t001 = intents.filter(playCard).filter(i => i.handIndex === 0);
    expect(t001).toHaveLength(1);
    expect(t001[0]!.target).toBeUndefined();
    // test-spell (anyCreature) → one intent per creature on either side (3)
    expect(intents.filter(playCard).filter(i => i.handIndex === 1)).toHaveLength(3);
    // test-spell-2 (allEnemies + self) → AoE, no target choice → single no-target intent
    const aoe = intents.filter(playCard).filter(i => i.handIndex === 2);
    expect(aoe).toHaveLength(1);
    expect(aoe[0]!.target).toBeUndefined();

    // attacks: taunt present → ONLY the taunt defender, never the hero or the plain 1/1
    const attacks = intents.filter(attack);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.target).toEqual({ type: 'creature', id: taunt.id });
    expect(attacks.some(i => i.target.type === 'hero')).toBe(false);
    expect(attacks.some(i => i.target.type === 'creature' && i.target.id === plain.id)).toBe(false);

    // hero power: Test Power 'any' → both heroes + all 3 creatures
    const hps = intents.filter(heroPower);
    expect(hps).toHaveLength(5);
    expect(hps.some(i => i.target!.type === 'hero' && i.target!.player === 0)).toBe(true);
    expect(hps.some(i => i.target!.type === 'hero' && i.target!.player === 1)).toBe(true);
    expect(hps.some(i => i.target!.type === 'creature' && i.target!.id === own.id)).toBe(true);

    // endTurn is always legal in main
    expect(intents.some(i => i.kind === 'endTurn')).toBe(true);
  });

  it('excludes plays that exceed mana and attacks from exhausted creatures', () => {
    const game = Game.create(makeTestSetup());
    main(game);
    game.state.players[0].mana = 2;
    game.state.players[0].maxMana = 2;
    game.state.players[0].hand = ['t-001', 'test-spell'];   // 3-cost creature (unaffordable), 1-cost targeted spell
    const fresh = addCreature(game, 0, { id: 't-012', attack: 1, health: 1, keywords: [] });   // fresh summon → exhausted

    let intents = game.legalIntents(0);
    // t-001 costs 3 > mana 2 → no playCard intent
    expect(intents.filter(playCard).filter(i => i.handIndex === 0)).toHaveLength(0);
    // test-spell costs 1 ≤ mana 2 → playable; anyCreature → the own creature is its only target
    expect(intents.filter(playCard).filter(i => i.handIndex === 1)).toHaveLength(1);
    // exhausted creature cannot attack
    expect(intents.filter(attack)).toHaveLength(0);

    // ready the creature → its attack intent appears (canAttack)
    fresh.exhausted = false;
    fresh.attacksLeft = 1;
    intents = game.legalIntents(0);
    const attacks = intents.filter(attack);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.target).toEqual({ type: 'hero', player: 1 });   // no enemy creatures → hero
  });

  it('includes no attack to hero when taunt present', () => {
    const game = Game.create(makeTestSetup());
    main(game);
    game.state.players[0].mana = 10;
    game.state.players[0].hand = ['t-001'];
    const taunt = addCreature(game, 1, { id: 't-010', attack: 1, health: 1, keywords: ['taunt'], exhausted: false });
    addCreature(game, 0, { id: 't-012', attack: 2, health: 2, keywords: [], exhausted: false });

    const attacks = game.legalIntents(0).filter(attack);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.target).toEqual({ type: 'creature', id: taunt.id });
    expect(attacks.some(i => i.target.type === 'hero')).toBe(false);
  });

  // audit 02: targetVariants enumerated refs for the FIRST choice-target spec
  // only, while validateEffectTargets validates the one supplied ref against
  // EVERY choice spec. A card with two DIFFERENT choice targets therefore
  // produced intents that submit() rejects — the UI offered the card and
  // errored on click, and the bot's greedyBest silently skipped it. No curated
  // card has this shape today, but the Forge can build one and Forge cards run
  // the identical path, so the fixture is synthetic.
  describe('enumeration agrees with validation for multi-choice-target cards', () => {
    const mixed = (id: string, effects: Card['effects']): Card => ({
      id, name: `Mixed ${id}`, type: 'spell', cost: 1, keywords: [], effects,
      rarity: 'common', archetype: 'neutral',
      art: { preset: 'shadow', palette: ['#1a1a2e', '#3a3a5e'], seed: 1 },
      author: 'custom', version: 1,
    });

    it('every enumerated playCard intent passes validatePlayCard', () => {
      const game = Game.create(makeTestSetup());
      main(game);
      game.state.players[0].mana = 10;
      game.registry.register(mixed('mix-any-friendly', [
        { kind: 'dealDamage', value: 2, target: 'anyCreature' },
        { kind: 'buff', value: 1, target: 'friendlyCreature' },
      ]));
      game.state.players[0].hand = ['mix-any-friendly'];
      const friendly = addCreature(game, 0, { id: 't-012', attack: 1, health: 1, keywords: [] });
      addCreature(game, 1, { id: 't-013', attack: 1, health: 1, keywords: [] });

      const intents = game.legalIntents(0).filter(playCard);
      // intersection of anyCreature and friendlyCreature = the friendly board
      expect(intents).toHaveLength(1);
      expect(intents[0]!.target).toEqual({ type: 'creature', id: friendly.id });
      for (const i of intents) expect(validatePlayCard(game, i, 0)).toBeNull();
    });

    it('an empty intersection makes the card unplayable, not falsely legal', () => {
      const game = Game.create(makeTestSetup());
      main(game);
      game.state.players[0].mana = 10;
      game.registry.register(mixed('mix-enemy-friendly', [
        { kind: 'dealDamage', value: 2, target: 'enemyCreature' },
        { kind: 'buff', value: 1, target: 'friendlyCreature' },
      ]));
      game.state.players[0].hand = ['mix-enemy-friendly'];
      addCreature(game, 0, { id: 't-012', attack: 1, health: 1, keywords: [] });
      addCreature(game, 1, { id: 't-013', attack: 1, health: 1, keywords: [] });

      // no single ref can be both an enemy and a friendly creature
      expect(game.legalIntents(0).filter(playCard)).toHaveLength(0);
    });
  });

  it('mulligan phase returns []', () => {
    const game = Game.create(makeTestSetup());   // fresh game starts in mulligan
    expect(game.legalIntents(0)).toEqual([]);
    expect(game.legalIntents(1)).toEqual([]);
  });
});
