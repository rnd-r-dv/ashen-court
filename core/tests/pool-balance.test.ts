import { describe, it, expect } from "vitest";
import { buildPool } from "../src/data/index.js";
import { cardText } from "../src/cardtext.js";
import {
	statBudget,
	KEYWORD_COST,
	validateCard,
	STAT_BUDGET_SLACK,
} from "../src/validate.js";
import { TOKEN_CAP } from "../src/engine/effects.js";

const pool = buildPool().filter((c) => c.archetype !== "token");

describe("pool balance", () => {
	it("every card passes validateCard with no errors", () => {
		for (const card of pool) {
			const errors = validateCard(card).filter((i) => i.severity === "error");
			expect(
				errors,
				`${card.id}: ${errors.map((e) => e.message).join("; ")}`,
			).toHaveLength(0);
		}
	});

	it("no creature sits far BELOW its stat budget", () => {
		const under: string[] = [];
		for (const card of pool) {
			if (card.type !== "creature") continue;
			if (cardText(card).length > 0) continue; // text pays for stats
			// Task 1 weighted spend (matches validateCard): Attack and Reflect are
			// complementary halves of one axis, so they are averaged together.
			const spent =
				(card.health ?? 0) +
				((card.attack ?? 0) + (card.reflect ?? 0)) / 2 +
				card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
			// A vanilla body must land within 2 of its budget in either direction.
			if (spent < statBudget(card.cost) - 2)
				under.push(`${card.id} (${spent} vs ${statBudget(card.cost)})`);
		}
		expect(under, `underpowered vanillas: ${under.join(", ")}`).toHaveLength(0);
	});

	it("no creature exceeds the ceiling", () => {
		for (const card of pool) {
			if (card.type !== "creature") continue;
			const spent =
				(card.health ?? 0) +
				((card.attack ?? 0) + (card.reflect ?? 0)) / 2 +
				card.keywords.reduce((s, k) => s + KEYWORD_COST[k], 0);
			expect(spent, card.id).toBeLessThanOrEqual(
				statBudget(card.cost) + STAT_BUDGET_SLACK,
			);
		}
	});

	it("no summon effect promises more tokens than the row can hold", () => {
		for (const card of pool) {
			const specs = [
				...card.effects,
				...(card.triggers ?? []).flatMap((t) => t.effects),
			];
			for (const s of specs) {
				if (s.kind !== "summon") continue;
				expect(
					s.value ?? 1,
					`${card.id} summons ${s.value}`,
				).toBeLessThanOrEqual(TOKEN_CAP);
			}
		}
	});

	it("at most 45 cards carry no rules text and no keyword", () => {
		const blank = pool.filter(
			(c) => cardText(c).length === 0 && c.keywords.length === 0,
		);
		expect(
			blank.length,
			`blank cards: ${blank.map((c) => c.id).join(", ")}`,
		).toBeLessThanOrEqual(45);
	});

	// --- Structural dead-card rules (Task 18) ---
	//
	// Draw and mana are tempo LOANS, not commodities. A card is worth ~1.5 mana
	// flat, so a pure-draw spell above 1.5x its card count never repays; a pure
	// ramp spell above cost 3 never repays before MAX_MANA and the natural
	// +1/turn catch up. Both are dead on arrival regardless of tuning, so these
	// are hard structural bounds, not balance taste.

	const allSpecs = (c: (typeof pool)[number]) => [
		...c.effects,
		...(c.triggers ?? []).flatMap((t) => t.effects),
	];
	const sumOf = (c: (typeof pool)[number], kind: string) =>
		allSpecs(c)
			.filter((s) => s.kind === kind)
			.reduce((n, s) => n + (s.value ?? 0), 0);
	const onlyKinds = (c: (typeof pool)[number], kinds: string[]) =>
		c.effects.length > 0 && c.effects.every((e) => kinds.includes(e.kind));

	it("a pure-draw spell costs at most 1.5 mana per card drawn", () => {
		const bad: string[] = [];
		for (const card of pool) {
			if (card.type !== "spell" || !onlyKinds(card, ["draw"])) continue;
			const n = sumOf(card, "draw");
			if (card.cost > Math.floor(1.5 * n))
				bad.push(`${card.id} (cost ${card.cost}, draws ${n})`);
		}
		expect(bad, `overpriced pure draw: ${bad.join(", ")}`).toHaveLength(0);
	});

	it("a pure-ramp spell costs at most 3", () => {
		const bad: string[] = [];
		for (const card of pool) {
			if (card.type !== "spell" || !onlyKinds(card, ["gainMana"])) continue;
			if (card.cost > 3) bad.push(`${card.id} (cost ${card.cost})`);
		}
		expect(bad, `late ramp is dead ramp: ${bad.join(", ")}`).toHaveLength(0);
	});

	it("a one-shot refillMana returns more mana than the card costs", () => {
		const bad: string[] = [];
		for (const card of pool) {
			// SPELLS ONLY, and only their own effects — never trigger effects. A
			// recurring artifact that refills 1 mana every turn pays for itself over
			// the game, so comparing one tick against the whole cost is nonsense.
			// The rule is about one-shot mana: a refill that does not exceed its own
			// cost is a Coin you paid for.
			if (card.type !== "spell") continue;
			const refill = card.effects
				.filter((e) => e.kind === "refillMana")
				.reduce((n, e) => n + (e.value ?? 0), 0);
			if (refill > 0 && refill <= card.cost)
				bad.push(`${card.id} (cost ${card.cost}, refills ${refill})`);
		}
		expect(bad, `net-negative mana: ${bad.join(", ")}`).toHaveLength(0);
	});

	it("a pure-heal spell costs at most 3", () => {
		const bad: string[] = [];
		for (const card of pool) {
			if (card.type !== "spell" || !onlyKinds(card, ["heal"])) continue;
			// Healing is card disadvantage unless it is attached to a body or a
			// second effect. Above 3 mana it is never the right play.
			if (card.cost > 3) bad.push(`${card.id} (cost ${card.cost})`);
		}
		expect(bad, `unattached healing: ${bad.join(", ")}`).toHaveLength(0);
	});

	it("a single-target damage spell deals at least its cost", () => {
		const single = [
			"any",
			"hero",
			"anyCreature",
			"enemyCreature",
			"randomEnemy",
			"randomEnemyCreature",
		];
		const bad: string[] = [];
		for (const card of pool) {
			if (card.type !== "spell") continue;
			if (
				!(
					card.effects.length > 0 &&
					card.effects.every(
						(e) =>
							e.kind === "dealDamage" && single.includes(e.target as string),
					)
				)
			)
				continue;
			const n = sumOf(card, "dealDamage");
			if (n < card.cost) bad.push(`${card.id} (cost ${card.cost}, deals ${n})`);
		}
		expect(bad, `below-rate removal: ${bad.join(", ")}`).toHaveLength(0);
	});

	it("no card is strictly dominated by another in the same archetype", () => {
		// Same archetype, same rarity (so copy limits match), same type, identical
		// stats/keywords/effects, different cost — the pricier one can never be
		// the right play, so it is a dead slot in a 21-card core.
		const groups = new Map<string, typeof pool>();
		for (const card of pool) {
			const key = [
				card.archetype,
				card.rarity,
				card.type,
				card.attack ?? "-",
				card.health ?? "-",
				[...card.keywords].sort().join("/"),
				JSON.stringify([
					...card.effects,
					...(card.triggers ?? []).flatMap((t) => [t.when, ...t.effects]),
				]),
			].join("|");
			const g = groups.get(key);
			if (g) g.push(card);
			else groups.set(key, [card]);
		}
		const bad: string[] = [];
		for (const g of groups.values()) {
			if (g.length > 1 && new Set(g.map((c) => c.cost)).size > 1) {
				bad.push(g.map((c) => `${c.id}@${c.cost}`).join(" vs "));
			}
		}
		expect(bad, `strictly dominated: ${bad.join("; ")}`).toHaveLength(0);
	});
});
