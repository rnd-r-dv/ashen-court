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

// --- Task 2: approved hand-authored Reflect ledger (§2–§4) ---
//
// One row per immutable creature id: [cost, Attack, Reflect, Health]. The
// ledger (docs/superpowers/specs/2026-08-09-reflect-balance-ledger.md) is the
// auditable hand-authoring artifact that replaces the Task 1 transitional
// `reflect = attack` mirror. These exact values must match the pool
// byte-for-byte; any drift (ID, cost, Attack, Health, or Reflect) fails.
// 140 curated rows + 6 token rows = 146. The token rows sit in TOKEN_LEDGER
// below so the `!card.token` filtered `pool` can never accidentally double-count.
const LEDGER: Record<
	string,
	[cost: number, attack: number, reflect: number, health: number]
> = {
	// --- Ember Court (13), lean Aggressor ---
	"ember-cinderling": [1, 2, 1, 1],
	"ember-sparkmage": [1, 1, 0, 1],
	"ember-ashhunter": [2, 2, 1, 2],
	"ember-flamewhelp": [2, 2, 2, 1],
	"ember-firebrand": [3, 3, 2, 3],
	"ember-igniter": [3, 2, 1, 3],
	"ember-hellhound": [4, 4, 2, 3],
	"ember-phoenixwhelp": [5, 5, 3, 4],
	"ember-flamebringer": [6, 5, 4, 5],
	"ember-ashwing": [7, 7, 5, 6],
	"ember-magmasoul": [8, 7, 7, 7],
	"ember-phoenix": [9, 8, 6, 8],
	"ember-emberlord": [6, 5, 4, 5],
	// --- Hollow Choir (10), lean Guardian ---
	"choir-acolyte": [1, 1, 1, 2],
	"choir-sergeant": [2, 2, 2, 3],
	"choir-warden": [3, 2, 3, 4],
	"choir-praetor": [4, 3, 4, 5],
	"choir-luminarch": [5, 4, 4, 6],
	"choir-seraph": [6, 5, 6, 6],
	"choir-martyr": [5, 3, 4, 5],
	"choir-exorcist": [6, 4, 5, 7],
	"choir-lightbringer": [7, 6, 7, 8],
	"choir-lady": [9, 6, 7, 8],
	// --- Vermin Swarm (12), lean Weak Width ---
	"vermin-squeaker": [1, 1, 1, 1],
	"vermin-scavenger": [1, 2, 0, 1],
	"vermin-brute": [2, 3, 1, 2],
	"vermin-swarmlord": [3, 2, 1, 4],
	"vermin-gnawer": [3, 3, 2, 3],
	"vermin-warband": [4, 5, 3, 4],
	"vermin-alpha": [4, 3, 2, 3],
	"vermin-breeder": [5, 3, 3, 4],
	"vermin-plaguemaster": [5, 3, 3, 5],
	"vermin-queen": [6, 4, 4, 6],
	"vermin-rattus": [8, 8, 7, 8],
	"vermin-plagueking": [7, 6, 5, 6],
	// --- Dragonflight (14), lean Balanced ---
	"dragon-whelp": [1, 1, 1, 2],
	"dragon-scaleglider": [2, 2, 1, 3],
	"dragon-hunter": [3, 3, 2, 3],
	"dragon-roost": [3, 2, 3, 4],
	"dragon-hatchling": [3, 3, 3, 3],
	"dragon-elderscale": [4, 3, 4, 5],
	"dragon-drakeling": [5, 5, 4, 5],
	"dragon-matriarch": [5, 4, 5, 5],
	"dragon-seer": [4, 2, 4, 5],
	"dragon-warden": [6, 5, 6, 6],
	"dragon-prince": [7, 7, 6, 7],
	"dragon-tyrant": [8, 8, 8, 6],
	"dragon-worldeater": [10, 10, 11, 10],
	"dragon-celestial": [6, 4, 3, 4],
	// --- Elder Roots (11), lean Ramp Wall ---
	"roots-sapling": [1, 1, 2, 2],
	"roots-sprout": [2, 2, 2, 2],
	"roots-barkhide": [3, 2, 3, 4],
	"roots-forager": [3, 3, 3, 3],
	"roots-ancients": [4, 4, 4, 4],
	"roots-ironwood": [5, 4, 5, 6],
	"roots-worldtree": [6, 5, 5, 5],
	"roots-treant": [7, 7, 7, 7],
	"roots-goliath": [8, 8, 8, 8],
	"roots-titan": [10, 10, 11, 10],
	"roots-worldmother": [12, 12, 12, 12],
	// --- Shadow Dancers (8), lean Evasion/Aggressor ---
	"dance-acrobat": [2, 2, 1, 2],
	"dance-dervish": [2, 3, 1, 1],
	"dance-bladeweaver": [4, 4, 3, 4],
	"dance-trickster": [5, 4, 4, 4],
	"dance-illusionist": [6, 5, 4, 5],
	"dance-puppet": [7, 6, 5, 6],
	"dance-shadow": [7, 5, 4, 5],
	"dance-nyx": [9, 8, 8, 8],
	// --- Bone Horde (12), lean Rebuild/Defensive ---
	"bone-scrapper": [1, 1, 1, 2],
	"bone-marauder": [2, 3, 3, 1],
	"bone-gravedigger": [2, 2, 2, 2],
	"bone-cairn": [3, 0, 3, 4],
	"bone-raider": [3, 3, 4, 3],
	"bone-skull": [4, 2, 3, 5],
	"bone-necromancer": [5, 3, 4, 4],
	"bone-warlord": [6, 6, 7, 6],
	"bone-behemoth": [7, 7, 8, 7],
	"bone-whisper": [5, 3, 4, 6],
	"bone-overlord": [9, 8, 9, 10],
	"bone-king": [10, 8, 10, 10],
	// --- Grave Pact (9), lean Aggressor/Self-damage ---
	"pact-imp": [2, 3, 1, 2],
	"pact-leech": [2, 2, 2, 2],
	"pact-masochist": [3, 3, 3, 4],
	"pact-ravager": [4, 5, 3, 3],
	"pact-cultist": [4, 4, 3, 4],
	"pact-fiend": [5, 6, 3, 4],
	"pact-dread": [6, 6, 5, 6],
	"pact-lord": [8, 8, 7, 8],
	"pact-morticia": [9, 7, 6, 9],
	// --- Night Coven (7), lean Control/Debuff ---
	"coven-familiar": [2, 2, 2, 2],
	"coven-bog": [3, 2, 3, 4],
	"coven-raven": [4, 4, 4, 4],
	"coven-scare": [4, 1, 4, 7],
	"coven-eldritch": [6, 6, 5, 6],
	"coven-abyss": [9, 8, 7, 9],
	"coven-queen": [10, 7, 9, 10],
	// --- Starforged (11), lean Balanced ---
	"star-acolyte": [2, 2, 2, 3],
	"star-guardian": [3, 2, 3, 4],
	"star-sentinel": [4, 3, 4, 5],
	"star-mage": [5, 4, 5, 6],
	"star-prophet": [4, 3, 3, 3],
	"star-oracle": [5, 3, 4, 4],
	"star-giant": [7, 7, 7, 7],
	"star-wanderer": [8, 8, 6, 8],
	"star-megastar": [10, 10, 8, 10],
	"star-archon": [12, 12, 12, 12],
	"star-constellation": [8, 7, 6, 7],
	// --- Eternal Vigil (11), lean Healing Wall ---
	"vigil-guard": [1, 1, 2, 3],
	"vigil-squire": [2, 2, 2, 2],
	"vigil-paladin": [3, 2, 3, 4],
	"vigil-monk": [3, 3, 4, 3],
	"vigil-shieldbearer": [4, 1, 3, 6],
	"vigil-crusader": [5, 4, 4, 5],
	"vigil-avenger": [5, 5, 5, 4],
	"vigil-warden": [6, 5, 6, 6],
	"vigil-archon": [7, 6, 7, 7],
	"vigil-saint": [8, 6, 7, 9],
	"vigil-aldric": [9, 8, 9, 8],
	// --- Stormwrought (10), lean Spell Tempo ---
	"storm-adept": [2, 2, 1, 2],
	"storm-emberwitch": [3, 3, 2, 2],
	"storm-rider": [4, 4, 4, 3],
	"storm-sorcerer": [4, 3, 3, 4],
	"storm-mistweaver": [4, 3, 3, 3],
	"storm-stormcaller": [6, 5, 4, 5],
	"storm-leviathan": [7, 7, 7, 7],
	"storm-siren": [5, 4, 4, 4],
	"storm-thunderhead": [9, 9, 8, 9],
	"storm-zephyra": [10, 9, 9, 9],
	// --- Neutrals (12), lean Balanced ---
	"neutral-militia": [1, 1, 2, 2],
	"neutral-boar": [1, 2, 1, 1],
	"neutral-hound": [2, 2, 1, 2],
	"neutral-golem": [3, 3, 3, 3],
	"neutral-squire": [2, 2, 2, 1],
	"neutral-sentinel": [3, 1, 3, 4],
	"neutral-ogre": [5, 5, 5, 5],
	"neutral-bear": [4, 4, 4, 4],
	"neutral-swift": [2, 2, 2, 1],
	"neutral-knight": [5, 4, 5, 5],
	"neutral-colossus": [7, 7, 7, 7],
	"neutral-titan": [9, 9, 9, 9],
};

/** Token creatures (§4): all six stay at parity with their Attack. */
const TOKEN_LEDGER: Record<
	string,
	[cost: number, attack: number, reflect: number, health: number]
> = {
	"token-rat": [0, 1, 1, 1],
	"token-skeleton": [0, 1, 1, 1],
	"token-wisp": [0, 1, 1, 1],
	"token-dragon-whelp": [0, 1, 1, 1],
	"token-treant": [0, 1, 1, 1],
	"token-phoenixash": [0, 2, 2, 2],
};

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

	// --- Task 2 ledger invariants (approved 2026-08-10) ---
	//
	// These assert the exact hand-authored values from the balance ledger, not
	// properties of reflect=attack data. The full pool (including tokens) is
	// used where the ledger states a population that includes them.

	it("exactly 140 curated creatures and 6 token creatures carry the ledger", () => {
		const all = buildPool();
		const curated = all.filter(
			(c) => c.type === "creature" && c.archetype !== "token",
		);
		const tokens = all.filter(
			(c) => c.type === "creature" && c.archetype === "token",
		);
		expect(curated).toHaveLength(140);
		expect(tokens).toHaveLength(6);
		// Every ledger id exists in the pool as a creature and vice versa — the
		// exact 146-row population the ledger was counted from.
		const ledgerIds = new Set([
			...Object.keys(LEDGER),
			...Object.keys(TOKEN_LEDGER),
		]);
		const poolIds = new Set([...curated, ...tokens].map((c) => c.id));
		expect(ledgerIds.size).toBe(146);
		expect(ledgerIds).toEqual(poolIds);
	});

	it("every creature matches the ledger's exact cost/Attack/Reflect/Health", () => {
		const all = buildPool();
		const merged = { ...LEDGER, ...TOKEN_LEDGER };
		const creatures = all.filter((c) => c.type === "creature");
		expect(creatures).toHaveLength(146);
		for (const c of creatures) {
			const row = merged[c.id];
			expect(row, `${c.id} missing from the approved ledger`).toBeDefined();
			expect(
				[c.cost, c.attack, c.reflect, c.health],
				`${c.id} drifts from the approved ledger`, // no cost/A/H/Reflect drift
			).toEqual(row);
		}
	});

	it("every creature Reflect is an integer and no non-creature has Reflect", () => {
		const all = buildPool();
		const nonCreatures = all.filter((c) => c.type !== "creature");
		expect(nonCreatures).toHaveLength(139); // 124 spells + 14 artifacts + mana-surge
		for (const c of nonCreatures) {
			expect(
				c.reflect,
				`${c.id} must not carry a creature stat`,
			).toBeUndefined();
		}
		for (const c of all.filter((c) => c.type === "creature")) {
			expect(Number.isInteger(c.reflect), `${c.id} reflect ${c.reflect}`).toBe(
				true,
			);
			expect(c.reflect!, `${c.id} reflect`).toBeGreaterThanOrEqual(0);
		}
	});

	it("pool-wide mean of Reflect - Attack stays inside [-0.5, +0.5]", () => {
		const all = buildPool();
		const creatures = all.filter((c) => c.type === "creature");
		const curated = creatures.filter((c) => c.archetype !== "token");
		const sumDelta = (rows: typeof creatures) =>
			rows.reduce((s, c) => s + ((c.reflect ?? 0) - (c.attack ?? 0)), 0);
		// Ledger §6.2: sum -9 over 146 (tokens contribute 0), -9 over the 140
		// curated population. Assert the exact sums, not just the band.
		expect(sumDelta(creatures)).toBe(-9);
		expect(sumDelta(curated)).toBe(-9);
		const mean146 = sumDelta(creatures) / creatures.length;
		const mean140 = sumDelta(curated) / curated.length;
		expect(mean146).toBeGreaterThanOrEqual(-0.5);
		expect(mean146).toBeLessThanOrEqual(0.5);
		expect(mean140).toBeGreaterThanOrEqual(-0.5);
		expect(mean140).toBeLessThanOrEqual(0.5);
	});

	it("pool-wide diversity keeps all three Reflect-vs-Attack directions", () => {
		// Ledger §7.1: 48 creatures with R < A, 54 with R = A, 44 with R > A.
		const creatures = buildPool().filter((c) => c.type === "creature");
		const lt = creatures.filter(
			(c) => (c.reflect ?? 0) < (c.attack ?? 0),
		).length;
		const eq = creatures.filter(
			(c) => (c.reflect ?? 0) === (c.attack ?? 0),
		).length;
		const gt = creatures.filter(
			(c) => (c.reflect ?? 0) > (c.attack ?? 0),
		).length;
		expect(lt).toBe(48);
		expect(eq).toBe(54);
		expect(gt).toBe(44);
	});

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
