import { describe, it, expect } from "vitest";
import {
	buildPool,
	expandDeck,
	EMBER_COURT_HERO,
	EMBER_COURT_DECK,
	HOLLOW_CHOIR_HERO,
	HOLLOW_CHOIR_DECK,
	VERMIN_SWARM_HERO,
	VERMIN_SWARM_DECK,
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
	{ name: "ember court", HERO: EMBER_COURT_HERO, DECK: EMBER_COURT_DECK },
	{ name: "hollow choir", HERO: HOLLOW_CHOIR_HERO, DECK: HOLLOW_CHOIR_DECK },
	{ name: "vermin swarm", HERO: VERMIN_SWARM_HERO, DECK: VERMIN_SWARM_DECK },
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

describe("decks 1-3 (Ember Court, Hollow Choir, Vermin Swarm)", () => {
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
				if (name === "hollow choir") game.state.players[0].hero.hp = 28; // Lullaby heal2(h) needs room
				// Lullaby is hero/self-targeted: the supplied ref (enemy hero) is
				// IGNORED — the heal must hit p0's OWN hero (auto-resolve ruling).
				game.submit({ kind: "heroPower", target: { type: "hero", player: 1 } });
				if (name === "ember court")
					expect(game.state.players[1].hero.hp).toBe(29); // Ember Bolt dmg1
				if (name === "hollow choir")
					expect(game.state.players[0].hero.hp).toBe(30); // Lullaby heal2(h)
				if (name === "vermin swarm")
					expect(game.state.players[0].board.length).toBe(1); // Rat Call summon(token-rat)
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

	// Step 1b regression: mixed cards pair a choice kind with a hero/self heal.
	// Before the fix, validateEffectTargets demanded the choice-ref satisfy the
	// hero spec too (unplayable) and the playCard loop passed intent.target as
	// the explicit ref for hero/self (healing the CHOSEN target instead of the
	// caster's own hero).
	describe("hero/self auto-resolve for mixed cards (controller ruling)", () => {
		it("ember-cauterize deals 6 to the chosen target and charges Ash (no heal)", () => {
			const game = newGame(EMBER_COURT_HERO, EMBER_COURT_DECK);
			toMain(game);
			const victim = addCreature(game, 1, {
				id: "enemy-scout",
				attack: 2,
				health: 7,
			});
			game.state.players[0].hand.unshift("ember-cauterize");
			game.state.players[0].mana = 10;
			game.state.players[0].hero.hp = 20;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: victim.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === victim.id)!.health,
			).toBe(1); // 6 damage to the target
			expect(game.state.players[0].hero.hp).toBe(20); // NO heal lands
			expect(game.state.players[0].overload).toBe(1); // Ash charged at resolution
		});

		it("choir-verdict destroys the chosen enemy creature AND heals own hero", () => {
			const game = newGame(HOLLOW_CHOIR_HERO, HOLLOW_CHOIR_DECK);
			toMain(game);
			const victim = addCreature(game, 1, {
				id: "enemy-cultist",
				attack: 3,
				health: 6,
			});
			game.state.players[0].hand.unshift("choir-verdict");
			game.state.players[0].mana = 10;
			game.state.players[0].hero.hp = 24;
			game.submit({
				kind: "playCard",
				handIndex: 0,
				target: { type: "creature", id: victim.id },
			});
			expect(
				game.state.players[1].board.find((c) => c.id === victim.id),
			).toBeUndefined(); // destroy(ec) removed the target
			expect(game.state.players[0].hero.hp).toBe(29); // heal5(h) hit OWN hero
		});
	});
});
