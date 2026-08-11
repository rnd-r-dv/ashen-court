import { describe, it, expect } from "vitest";
import { Game } from "../src/engine/game.js";
import { makeTestSetup, addCreature } from "./helpers.js";
import { applyEffect } from "../src/engine/effects.js";
import { buildPool } from "../src/data/index.js";
import {
	immediateConsumeAffordability,
	requiredConsumeTokens,
	validatePlayCard,
} from "../src/engine/intents.js";
import type { Card, EffectSpec, Intent, PlayerIndex } from "../src/types.js";

/** Synthetic card factory: a spell by default, a creature when triggers are given. */
const toll = (
	id: string,
	effects: EffectSpec[],
	triggers?: Card["triggers"],
): Card => ({
	id,
	name: `Toll ${id}`,
	type: triggers ? "creature" : "spell",
	cost: 2,
	attack: triggers ? 2 : undefined,
	health: triggers ? 2 : undefined,
	reflect: triggers ? 2 : undefined,
	keywords: [],
	effects,
	triggers,
	rarity: "common",
	archetype: "neutral",
	art: { preset: "shadow", palette: ["#1a1a2e", "#3a3a5e"], seed: 1 },
	author: "custom",
	version: 1,
});

const consume = (value?: number): EffectSpec => ({
	kind: "consume",
	...(value !== undefined ? { value } : {}),
});

/** Main-phase game; `player` has `hand`, 10 mana, and exactly `tokens`
 *  friendly token creatures on board (via the real summon path). */
const setup = (
	hand: string[],
	tokens: number,
	player: PlayerIndex = 0,
): Game => {
	const game = Game.create(makeTestSetup());
	game.state.phase = "main";
	game.state.players[player].mana = 10;
	game.state.players[player].maxMana = 10;
	game.state.players[player].hand = hand;
	if (tokens > 0) {
		applyEffect(
			game,
			{ player, cardId: "test" },
			{ kind: "summon", cardId: "token-rat", value: tokens },
		);
	}
	return game;
};

describe("requiredConsumeTokens", () => {
	it("sums every immediate consume clause, defaulting omitted values to 1", () => {
		const spell = toll("toll-sum", [
			consume(1),
			consume(2),
			{ kind: "dealDamage", value: 3, target: "any" },
		]);
		expect(requiredConsumeTokens(spell)).toBe(3);
	});
	it("counts battlecry consumes as immediate", () => {
		const creature = toll(
			"toll-bc",
			[],
			[
				{
					when: "battlecry",
					effects: [
						consume(2),
						{
							kind: "buff",
							value: 1,
							value2: 1,
							target: "allFriendlyCreatures",
						},
					],
				},
			],
		);
		expect(requiredConsumeTokens(creature)).toBe(2);
	});
	it("ignores consume in later triggers (deathrattle is a payoff, not a cost)", () => {
		const creature = toll(
			"toll-dr",
			[],
			[{ when: "deathrattle", effects: [consume(2)] }],
		);
		expect(requiredConsumeTokens(creature)).toBe(0);
	});
});

describe("immediateConsumeAffordability", () => {
	const card = toll("toll-2", [
		consume(2),
		{ kind: "dealDamage", value: 3, target: "any" },
	]);
	it("reports 0, 1, 2 available tokens against a consume(2) cost", () => {
		expect(immediateConsumeAffordability(setup([], 0).state, 0, card)).toEqual({
			required: 2,
			available: 0,
			payable: false,
		});
		expect(immediateConsumeAffordability(setup([], 1).state, 0, card)).toEqual({
			required: 2,
			available: 1,
			payable: false,
		});
		expect(immediateConsumeAffordability(setup([], 2).state, 0, card)).toEqual({
			required: 2,
			available: 2,
			payable: true,
		});
	});
});

describe("validatePlayCard gates immediate Consume", () => {
	const card = toll("toll-2", [
		consume(2),
		{ kind: "dealDamage", value: 3, target: "any" },
	]);
	// The affordability gate intentionally runs before target validation, so an
	// unfunded Toll reports its missing resource even when the target is absent.
	it("rejects with the exact approved message at 0 and 1 tokens", () => {
		let g = setup(["toll-2"], 0);
		g.registry.register(card);
		expect(validatePlayCard(g, { kind: "playCard", handIndex: 0 }, 0)).toBe(
			"Need 2 friendly tokens to consume (have 0)",
		);
		g = setup(["toll-2"], 1);
		g.registry.register(card);
		expect(validatePlayCard(g, { kind: "playCard", handIndex: 0 }, 0)).toBe(
			"Need 2 friendly tokens to consume (have 1)",
		);
	});
	it("accepts at 2 tokens once the remaining target validation is also satisfied", () => {
		const g = setup(["toll-2"], 2);
		g.registry.register(card);
		expect(
			validatePlayCard(
				g,
				{ kind: "playCard", handIndex: 0, target: { type: "hero", player: 1 } },
				0,
			),
		).toBeNull();
	});
	it("tokens summoned by the same card never satisfy the cost", () => {
		// summon first, THEN consume: with 0 pre-play tokens the card is
		// unplayable even though it would create a rat before consuming one.
		const selfSummon = toll("toll-selfsummon", [
			{ kind: "summon", cardId: "token-rat" },
			consume(1),
			{ kind: "dealDamage", value: 2, target: "any" },
		]);
		const g = setup(["toll-selfsummon"], 0);
		g.registry.register(selfSummon);
		expect(validatePlayCard(g, { kind: "playCard", handIndex: 0 }, 0)).toBe(
			"Need 1 friendly tokens to consume (have 0)",
		);
	});
});

describe("legalIntents omits unaffordable Consume plays", () => {
	it("excludes the toll spell at 0 tokens, includes it at 2", () => {
		const card = toll("toll-spell", [
			consume(2),
			{ kind: "dealDamage", value: 3, target: "any" },
		]);
		let g = setup(["toll-spell"], 0);
		g.registry.register(card);
		expect(g.legalIntents(0).filter((i) => i.kind === "playCard")).toHaveLength(
			0,
		);
		g = setup(["toll-spell"], 2);
		g.registry.register(card);
		// 'any' enumerates one intent per legal ref: both heroes + the 2 friendly
		// token rats = 4 (the plan's toHaveLength(1) is unreachable — a hero is
		// always a legal 'any' target, so a dealDamage 'any' spell can never yield
		// a single ref).
		expect(g.legalIntents(0).filter((i) => i.kind === "playCard")).toHaveLength(
			4,
		);
	});
	it("excludes a consume battlecry creature at 0 tokens, includes it at 2", () => {
		const card = toll(
			"toll-creature",
			[],
			[
				{
					when: "battlecry",
					effects: [
						consume(2),
						{
							kind: "buff",
							value: 1,
							value2: 1,
							target: "allFriendlyCreatures",
						},
					],
				},
			],
		);
		let g = setup(["toll-creature"], 0);
		g.registry.register(card);
		expect(g.legalIntents(0).filter((i) => i.kind === "playCard")).toHaveLength(
			0,
		);
		g = setup(["toll-creature"], 2);
		g.registry.register(card);
		expect(g.legalIntents(0).filter((i) => i.kind === "playCard")).toHaveLength(
			1,
		);
	});
});

describe("enumeration agrees with validation (spec test 7)", () => {
	const playCard = (i: Intent): i is Extract<Intent, { kind: "playCard" }> =>
		i.kind === "playCard";
	it("every enumerated playCard intent passes validatePlayCard; an unaffordable toll appears in neither path", () => {
		// 1 token: the consume(1) spell is affordable, the consume(2) battlecry is not.
		const cheap = toll("toll-cheap", [
			consume(1),
			{ kind: "dealDamage", value: 2, target: "enemyCreature" },
		]);
		const dear = toll(
			"toll-dear",
			[],
			[
				{
					when: "battlecry",
					effects: [
						consume(2),
						{
							kind: "buff",
							value: 1,
							value2: 1,
							target: "allFriendlyCreatures",
						},
					],
				},
			],
		);
		const g = setup(["toll-cheap", "toll-dear"], 1);
		g.registry.register(cheap);
		g.registry.register(dear);
		const enemy = addCreature(g, 1, {
			id: "enemy-scout",
			attack: 2,
			health: 2,
		});
		const plays = g.legalIntents(0).filter(playCard);
		// toll-cheap (consume 1 <= 1 token): exactly one intent, aimed at the enemy creature
		const cheapPlays = plays.filter((i) => i.handIndex === 0);
		expect(cheapPlays).toHaveLength(1);
		expect(cheapPlays[0]!.target).toEqual({ type: "creature", id: enemy.id });
		// toll-dear (consume 2 > 1 token): absent from enumeration
		expect(plays.filter((i) => i.handIndex === 1)).toHaveLength(0);
		// agreement: every enumerated playCard intent passes validatePlayCard
		for (const i of plays) expect(validatePlayCard(g, i, 0)).toBeNull();
		// and the unaffordable card is rejected by validation, not silently legal
		expect(
			validatePlayCard(
				g,
				{
					kind: "playCard",
					handIndex: 1,
					target: { type: "creature", id: enemy.id },
				},
				0,
			),
		).toBe("Need 2 friendly tokens to consume (have 1)");
	});
});

describe("determinism", () => {
	it("the gate mutates nothing: rejected and accepted toll plays replay byte-identically", () => {
		const card = toll("toll-det", [
			consume(1),
			{ kind: "dealDamage", value: 2, target: "any" },
		]);
		const a = Game.create(makeTestSetup());
		const b = Game.create(makeTestSetup());
		for (const g of [a, b]) {
			g.state.phase = "main";
			g.state.players[0].mana = 10;
			g.state.players[0].maxMana = 10;
			g.registry.register(card);
			g.state.players[0].hand = ["toll-det", "t-001"];
		}
		// rejected opportunity: 0 tokens -> the toll card is legal-intent-invisible
		expect(
			a.legalIntents(0).some((i) => i.kind === "playCard" && i.handIndex === 0),
		).toBe(false);
		// accepted opportunity: summon 1 token, then the toll is legal and played
		for (const g of [a, b]) {
			applyEffect(
				g,
				{ player: 0, cardId: "test" },
				{ kind: "summon", cardId: "token-rat", value: 1 },
			);
		}
		const play = a
			.legalIntents(0)
			.find((i) => i.kind === "playCard" && i.handIndex === 0)!;
		expect(() => a.submit(play)).not.toThrow();
		b.submit(play);
		// identical seeds + identical accepted intents -> byte-identical state
		expect(a.serialize()).toBe(b.serialize());
	});
});

describe("curated Vermin Toll determinism", () => {
	it("rejects unfunded Nibble, then replays the same accepted intent byte-identically when funded", () => {
		const nibble = buildPool().find((c) => c.id === "vermin-nibble")!;

		const rejected = setup(["vermin-nibble"], 0);
		rejected.registry.register(nibble);
		addCreature(rejected, 1, { id: "nibble-target", attack: 2, health: 2 });
		expect(
			rejected
				.legalIntents(0)
				.some((i) => i.kind === "playCard" && i.handIndex === 0),
		).toBe(false);

		const a = setup(["vermin-nibble"], 1);
		a.registry.register(nibble);
		const victim = addCreature(a, 1, {
			id: "nibble-target",
			attack: 2,
			health: 2,
		});
		const b = Game.deserialize(a.serialize(), a.registry);
		const intent = a
			.legalIntents(0)
			.find(
				(i) =>
					i.kind === "playCard" &&
					i.handIndex === 0 &&
					i.target?.type === "creature" &&
					i.target.id === victim.id,
			);
		expect(intent).toBeDefined();
		expect(b.legalIntents(0)).toContainEqual(intent);
		expect(a.submit(intent!)).toEqual(b.submit(intent!));
		expect(a.serialize()).toBe(b.serialize());
	});
});
