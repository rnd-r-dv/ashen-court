import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { makeTestSetup, addCreature } from './helpers.js';
import type { Intent } from '../src/types.js';

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

  it('mulligan phase returns []', () => {
    const game = Game.create(makeTestSetup());   // fresh game starts in mulligan
    expect(game.legalIntents(0)).toEqual([]);
    expect(game.legalIntents(1)).toEqual([]);
  });
});
