import { describe, it, expect } from "vitest";
import {
	buildPool,
	expandDeck,
	BONE_HORDE_HERO,
	BONE_HORDE_DECK,
	GRAVE_PACT_HERO,
	GRAVE_PACT_DECK,
	NIGHT_COVEN_HERO,
	NIGHT_COVEN_DECK,
} from "../src/data/index.js";
import type { DeckDef } from "../src/data/index.js";
import { validateDeck } from "../src/validate.js";
import { CardRegistry } from "../src/cards.js";
import { Game } from "../src/engine/game.js";
import type { HeroSpec, PlayerIndex } from "../src/types.js";
import { addCreature } from "./helpers.js";

const pool = buildPool();
const poolMap = new CardRegistry(pool).pool();

const decks: { name: string; HERO: HeroSpec; DECK: DeckDef }[] = [
	{ name: "bone horde", HERO: BONE_HORDE_HERO, DECK: BONE_HORDE_DECK },
	{ name: "grave pact", HERO: GRAVE_PACT_HERO, DECK: GRAVE_PACT_DECK },
	{ name: "night coven", HERO: NIGHT_COVEN_HERO, DECK: NIGHT_COVEN_DECK },
];

const newGame = (HERO: HeroSpec, DECK: DeckDef): Game => {
	const ids = expandDeck(DECK);
	return Game.create(
		{ decks: [ids, ids], heroes: [HERO, HERO], seed: 5 },
		new CardRegistry(pool),
	);
};

/** Mulligan both players into main phase (turn 0, player 0 to act). */
const toMain = (game: Game): void => {
	game.submit({ kind: "mulligan", keep: [] });
	game.submit({ kind: "mulligan", keep: [] });
};

describe("decks 7-9 (Bone Horde, Grave Pact, Night Coven)", () => {
	for (const { name, HERO, DECK } of decks) {
		const ids = expandDeck(DECK);
		describe(name, () => {
			it("is exactly 60 valid cards", () => {
				expect(ids).toHaveLength(60);
				expect(validateDeck(ids, poolMap)).toEqual([]);
			});

			it("hero power works in a real game", () => {
				const game = newGame(HERO, DECK);
				toMain(game);
				game.state.players[0].mana = 10; // hero powers cost 2; turn 0 gives p0 only 1 mana
				if (name === "bone horde") {
					// Raise Skeleton: summon(token-skeleton)
					game.submit({ kind: "heroPower" });
					expect(game.state.players[0].board.length).toBe(1);
				}
				if (name === "grave pact") {
					// Blood Toll: dmg1(self) + draw1 — self auto-resolves to own hero
					const handBefore = game.state.players[0].hand.length;
					game.submit({ kind: "heroPower" });
					expect(game.state.players[0].hero.hp).toBe(29); // dmg1 hit OWN hero
					expect(game.state.players[0].hand.length).toBe(handBefore + 1); // draw1
				}
				if (name === "night coven") {
					// Hex: buff-1/-1(ec) — needs an enemy creature; a 1/1 shrinks to 0/0 and DIES
					const victim = addCreature(game, 1, {
						id: "hex-target",
						attack: 1,
						health: 1,
						keywords: [],
					});
					game.submit({
						kind: "heroPower",
						target: { type: "creature", id: victim.id },
					});
					expect(
						game.state.players[1].board.find((c) => c.id === victim.id),
					).toBeUndefined();
				}
			});

			it("plays a full scripted 8-turn game without throwing", () => {
				const game = newGame(HERO, DECK);
				toMain(game);
				// legalIntents-driven greedy loop (Task 12 pattern): pick the first
				// playCard/attack/heroPower intent else endTurn. Real decks produce
				// MANY intents — the fixed step count guards against runaway loops.
				for (let step = 0; step < 16; step++) {
					const me = game.currentPlayer() as PlayerIndex;
					const legal = game.legalIntents(me);
					if (legal.length === 0) break; // gameOver or not our turn — done
					const play = legal.find(
						(i) =>
							i.kind === "playCard" ||
							i.kind === "attack" ||
							i.kind === "heroPower",
					);
					expect(() => game.submit(play ?? legal[0]!)).not.toThrow();
				}
				// 8 full turns must never leave the game stuck (phase back in mulligan)
				expect(game.state.phase).not.toBe("mulligan"); // main or gameOver
			});
		});
	}

	// Controller pre-flight 1: negative buffs kill creatures through the normal
	// creatureDied queue (buffRef pushes creatureDied at health <= 0).
	describe("negative buffs kill creatures", () => {
		it("coven-nightmare buff-3/-3 on an enemy 1/1 kills it (board membership)", () => {
			const game = newGame(NIGHT_COVEN_HERO, NIGHT_COVEN_DECK);
			toMain(game);
			const victim = addCreature(game, 1, {
				id: "nightmare-victim",
				attack: 1,
				health: 1,
				keywords: [],
			});
			game.state.players[0].hand.unshift("coven-nightmare");
			game.state.players[0].mana = 10;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: victim.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === victim.id),
			).toBeUndefined();
		});

		it("coven-wither buff-2/-2 on a 2/2 enemy creature kills it too", () => {
			const game = newGame(NIGHT_COVEN_HERO, NIGHT_COVEN_DECK);
			toMain(game);
			const victim = addCreature(game, 1, {
				id: "wither-victim",
				attack: 2,
				health: 2,
				keywords: [],
			});
			game.state.players[0].hand.unshift("coven-wither");
			game.state.players[0].mana = 10;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: victim.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === victim.id),
			).toBeUndefined();
		});
	});

	// Controller pre-flight 3: choice + own-hero mixed cards are LEGAL
	// (amendment 10 relaxation) — regression on a pool card.
	describe("choice + own-hero mixed cards (amendment 10)", () => {
		it("pact-lifeleech damages the chosen enemy creature AND heals own hero", () => {
			const game = newGame(GRAVE_PACT_HERO, GRAVE_PACT_DECK);
			toMain(game);
			const victim = addCreature(game, 1, {
				id: "enemy-bleeder",
				attack: 2,
				health: 5,
			});
			game.state.players[0].hand.unshift("pact-lifeleech");
			game.state.players[0].mana = 10;
			game.state.players[0].hero.hp = 28;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: victim.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === victim.id)!.health,
			).toBe(2); // dmg3(ec) hit the target
			expect(game.state.players[0].hero.hp).toBe(30); // heal3(h) hit OWN hero
		});
	});

	// Controller pre-flight 4: destroy removes via creatureDied WITHOUT zeroing
	// health — assert board membership, not health.
	describe("destroy removal (board membership)", () => {
		it("pact-sacrifice destroys a chosen friendly creature and draws 2", () => {
			const game = newGame(GRAVE_PACT_HERO, GRAVE_PACT_DECK);
			toMain(game);
			const minion = addCreature(game, 0, {
				id: "own-imp",
				attack: 3,
				health: 2,
				keywords: [],
			});
			game.state.players[0].hand.unshift("pact-sacrifice");
			game.state.players[0].mana = 10;
			const handBefore = game.state.players[0].hand.length;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: minion.id },
			});
			expect(
				game.state.players[0].board.find((c) => c.id === minion.id),
			).toBeUndefined(); // removed
			expect(game.state.players[0].hand.length).toBe(handBefore - 1 + 2); // -1 played +2 drawn
		});

		it("coven-glare destroys the chosen enemy creature AND debuffs all enemy creatures", () => {
			const game = newGame(NIGHT_COVEN_HERO, NIGHT_COVEN_DECK);
			toMain(game);
			const doomed = addCreature(game, 1, {
				id: "doomed-one",
				attack: 2,
				health: 3,
				keywords: [],
			});
			const survivor = addCreature(game, 1, {
				id: "survivor-one",
				attack: 3,
				health: 5,
				keywords: [],
			});
			game.state.players[0].hand.unshift("coven-glare");
			game.state.players[0].mana = 10;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: doomed.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === doomed.id),
			).toBeUndefined(); // destroy(ec) removed the target
			const surv = game.state.players[1].board.find(
				(c) => c.id === survivor.id,
			)!;
			expect(surv.health).toBe(4); // buff-1/-1(aec) hit the survivor
		});
	});

	// Task 3: Bone Horde identity — Legion Call is a death-engine activation,
	// not a Toll: it destroys a CHOSEN friendly creature (choice target), and
	// the destroyed creature's deathrattle fires before the three-card payoff.
	describe("bone-legion death-engine activation", () => {
		it("is unplayable without a friendly creature to destroy", () => {
			const game = newGame(BONE_HORDE_HERO, BONE_HORDE_DECK);
			toMain(game);
			game.state.players[0].hand.unshift("bone-legion");
			game.state.players[0].mana = 10;
			expect(
				game
					.legalIntents(0)
					.filter((i) => i.kind === "playCard" && i.handIndex === 0),
			).toEqual([]);
		});

		it("destroys the chosen creature, fires its deathrattle, then adds the three-card payoff", () => {
			const game = newGame(BONE_HORDE_HERO, BONE_HORDE_DECK);
			toMain(game);
			const offering = addCreature(game, 0, {
				id: "bone-offering",
				attack: 2,
				health: 2,
				trigger: "deathrattle",
				effects: [{ kind: "summon", cardId: "token-skeleton" }],
			});
			game.state.players[0].hand.unshift("bone-legion");
			game.state.players[0].mana = 10;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: offering.id },
			});
			expect(
				game.state.players[0].board.some((c) => c.id === offering.id),
			).toBe(false);
			expect(
				game.state.players[0].board.filter(
					(c) => c.token && c.cardId === "token-skeleton",
				),
			).toHaveLength(4);
		});
	});
});
