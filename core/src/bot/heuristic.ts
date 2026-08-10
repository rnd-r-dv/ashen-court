import type { Game } from "../engine/game.js";
import type { PlayerIndex, PlayerState } from "../types.js";

export function evaluate(game: Game, me: PlayerIndex): number {
	const { players } = game.state;
	const meP = players[me],
		foeP = players[(1 - me) as PlayerIndex];
	const board = (p: PlayerState) =>
		p.board.reduce(
			(s, c) =>
				s +
				// Task 1: Attack (1.25/point, initiating) and Reflect (0.75/point,
				// defensive counter-damage) are complementary halves of one combat axis;
				// a fixture where reflect === attack scores exactly the old attack*2.
				c.attack * 1.25 +
				c.reflect * 0.75 +
				c.health +
				(c.keywords.includes("taunt") ? 2 : 0) +
				(c.keywords.includes("lifesteal") ? 2 : 0) +
				(c.keywords.includes("windfury") ? 2 : 0),
			0,
		);
	const enemyTaunts = foeP.board.filter((c) =>
		c.keywords.includes("taunt"),
	).length;
	// Enemy-taunt term (audit 03 M1): the +1.5 sign is spec-locked — it
	// SOFTENS the taunt's own board contribution rather than penalizing it
	// twice. The net effect is still a penalty: each enemy taunt is already
	// counted in -board(foeP)*1.3 (its +2 taunt bonus scaled 1.3×) plus the
	// -0.5 board-count term, so a 1/1 enemy taunt nets -(5*1.3) - 0.5 + 1.5 =
	// -5.5. Do not "fix" the sign to minus.
	return (
		board(meP) -
		board(foeP) * 1.3 +
		(meP.hero.hp - foeP.hero.hp) * 2 +
		meP.hand.length * 1.2 +
		meP.maxMana * 0.3 +
		(meP.board.length - foeP.board.length) * 0.5 +
		enemyTaunts * 1.5
	);
}
