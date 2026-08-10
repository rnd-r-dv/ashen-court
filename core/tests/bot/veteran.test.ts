import { describe, it, expect } from "vitest";
import { CardRegistry } from "../../src/cards.js";
import {
	buildPool,
	DECK_DEFS,
	expandDeck,
	HEROES,
} from "../../src/data/index.js";
import type { ArchetypeId } from "../../src/data/index.js";
import { Game } from "../../src/engine/game.js";
import type { Card } from "../../src/types.js";
import { Veteran, mulliganPolicy } from "../../src/bot/policies.js";
import { makeTestSetup, addCreature } from "../helpers.js";

/** Synthetic charge creature card (no stat-budget validation at register). */
const chargeBeast = (id: string, attack: number, health: number): Card => ({
	id,
	name: `Test ${id}`,
	type: "creature",
	cost: 1,
	attack,
	health,
	reflect: attack, // Task 1 transitional fixture parity
	keywords: ["charge"],
	effects: [],
	rarity: "common",
	archetype: "neutral",
	art: { preset: "shadow", palette: ["#1a1a2e", "#3a3a5e"], seed: 1 },
	author: "curated",
	version: 1,
});

describe("Veteran", () => {
	it("chooses the intent maximizing evaluate()", () => {
		// own 3/3 charge attacker vs a 1-damage spell in hand: attacking the enemy
		// hero (3 damage) scores far higher than the play (1 damage to own board +
		// losing a card), so veteran must pick the attack.
		const game = Game.create(makeTestSetup());
		game.state.phase = "main";
		game.state.players[0].mana = 10;
		addCreature(game, 0, {
			id: "t-001",
			attack: 3,
			health: 3,
			keywords: ["charge"],
		});
		game.state.players[0].hand = ["test-spell"]; // 1-cost dealDamage 1 anyCreature → can only target the own creature
		const intent = Veteran.chooseIntent(game, 0);
		expect(intent).toMatchObject({
			kind: "attack",
			target: { type: "hero", player: 1 },
		});
	});

	it("prefers lethal when available", () => {
		// enemy hero at 1 HP and a charge creature in hand (mana 10): veteran
		// plays the creature, then attacks the hero for lethal.
		const game = Game.create(makeTestSetup());
		game.state.phase = "main";
		game.state.players[1].hero.hp = 1;
		game.state.players[0].mana = 10;
		game.registry.register(chargeBeast("syn-charge-beast", 3, 1));
		game.state.players[0].hand = ["syn-charge-beast"];

		// step 1: playing the 3/1 charge creature beats the hero power (creature
		// adds board value AND reaches the same lethal), so playCard wins.
		const play = Veteran.chooseIntent(game, 0);
		expect(play).toMatchObject({ kind: "playCard", handIndex: 0 });
		game.submit(play);

		// step 2: the played charge creature attacks the hero; the hero power is
		// spent to keep it out of the running (it would tie on score).
		game.state.players[0].hero.usedPower = true;
		const attack = Veteran.chooseIntent(game, 0);
		expect(attack).toMatchObject({
			kind: "attack",
			attackerId: game.state.players[0].board[0]!.id,
			target: { type: "hero", player: 1 },
		});
		game.submit(attack);
		expect(game.state.phase).toBe("gameOver");
	});

	it("never produces illegal intents across 100 seeded random states", () => {
		const pool = new CardRegistry(buildPool());
		const deckKeys = Object.keys(DECK_DEFS) as ArchetypeId[];
		for (let i = 0; i < 100; i++) {
			const ids = expandDeck(DECK_DEFS[deckKeys[i % 12]!]);
			const game = Game.create(
				{
					seed: i,
					decks: [ids, ids],
					heroes: [HEROES[i % 12]!, HEROES[(i + 7) % 12]!],
				},
				pool,
			);
			// both players mulligan through the policy, then play ~8 veteran turns
			game.submit(mulliganPolicy(game, 0));
			game.submit(mulliganPolicy(game, 1));
			for (let step = 0; step < 8; step++) {
				expect(() =>
					game.submit(Veteran.chooseIntent(game, game.currentPlayer())),
				).not.toThrow();
				if (game.state.phase === "gameOver") break;
			}
		}
	});
});
