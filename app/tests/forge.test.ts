import { describe, it, expect } from "vitest";
import { buildPool, validateCard } from "@ashen/core";
import type { ForgeDraft } from "../src/forge/formState.js";
import {
	createDraft,
	draftToCard,
	draftIssues,
	poolRuleIssues,
} from "../src/forge/formState.js";

/** A fully valid creature draft; spread overrides to build invalid variants. */
const validDraft = (over: Partial<ForgeDraft> = {}): ForgeDraft => ({
	...createDraft(),
	name: "Test Creature",
	type: "creature",
	cost: 2,
	attack: "3",
	health: "4",
	keywords: [],
	trigger: "battlecry",
	effects: [{ kind: "dealDamage", value: 1, target: "anyCreature" }],
	rarity: "rare",
	...over,
});

const errors = (d: ForgeDraft) =>
	draftIssues(d).filter((i) => i.severity === "error");

describe("forge form state", () => {
	it("flags a 0-cost 15/15 creature for exceeding the stat budget", () => {
		const d = validDraft({ cost: 0, attack: "15", health: "15" });
		expect(errors(d).some((i) => i.field === "stats")).toBe(true);
	});

	it("flags a spell carrying a creature-only keyword", () => {
		const d = validDraft({
			type: "spell",
			keywords: ["taunt"],
			trigger: "",
			effects: [{ kind: "draw", value: 2 }],
		});
		expect(
			errors(d).some(
				(i) => i.field === "keywords" && i.message.includes("taunt"),
			),
		).toBe(true);
	});

	it("flags a battlecry creature whose trigger has no effects", () => {
		const d = validDraft({ trigger: "battlecry", effects: [] });
		expect(errors(d).some((i) => i.message.includes("battlecry"))).toBe(true);
	});

	it("reports zero errors for a valid draft", () => {
		expect(errors(validDraft())).toEqual([]);
	});

	// Task 1 compatibility bridge: Forge has no Reflect field yet (Task 3 adds
	// explicit input), so a created creature mirrors its Attack. The core
	// contract requires reflect >= 0 on every creature, so this default keeps
	// Forge-created cards valid.
	it("gives a Forge-created creature Reflect equal to its Attack (Task 1 bridge)", () => {
		expect(draftToCard(validDraft()).reflect).toBe(3);
		expect(draftToCard(validDraft({ attack: "0", health: "2" })).reflect).toBe(
			0,
		);
		expect(
			draftToCard(
				validDraft({
					type: "spell",
					attack: "5",
					health: "5",
					trigger: "",
					effects: [{ kind: "draw", value: 1 }],
				}),
			).reflect,
		).toBeUndefined();
	});

	it("converts a valid draft into a card that passes validateCard", () => {
		const card = draftToCard(validDraft());
		expect(validateCard(card).filter((i) => i.severity === "error")).toEqual(
			[],
		);
		expect(card.author).toBe("custom");
		expect(card.id).toBe("test-creature");
		// single-trigger form: trigger + effects become a triggers group; no top-level cast effects
		expect(card.triggers).toEqual([
			{
				when: "battlecry",
				effects: [{ kind: "dealDamage", value: 1, target: "anyCreature" }],
			},
		]);
		expect(card.effects).toEqual([]);
		// id auto-slugs from name (lowercase, non-alphanumerics -> dashes)
		expect(draftToCard(validDraft({ name: "Cursed  Blade!" })).id).toBe(
			"cursed-blade",
		);
		expect(draftToCard(createDraft()).id).toBe("untitled");
	});

	it("flags a summon effect that references a card outside the pool", () => {
		const d = validDraft({
			effects: [{ kind: "summon", value: 1, cardId: "token-nonexistent" }],
		});
		expect(errors(d).some((i) => i.message.includes("token-nonexistent"))).toBe(
			true,
		);
	});

	it("warns when a creature has effects but no trigger — they would be dropped on save (M1)", () => {
		const d = validDraft({
			trigger: "",
			effects: [{ kind: "draw", value: 1 }],
		});
		const warns = draftIssues(d).filter((i) => i.severity === "warning");
		expect(warns.some((i) => i.message.includes("dropped"))).toBe(true);
		// Save stays enabled: warning severity does not gate the save button.
		expect(errors(d)).toEqual([]);
	});
});

describe("poolRuleIssues (shared Forge/import pool-reference rule, C1)", () => {
	const empty = new Map<string, ReturnType<typeof draftToCard>>();

	it("flags a summon to an unknown cardId", () => {
		const card = draftToCard(
			validDraft({
				effects: [{ kind: "summon", value: 1, cardId: "token-rat" }],
			}),
		);
		expect(
			poolRuleIssues(card, empty).some((i) => i.message.includes("token-rat")),
		).toBe(true);
	});

	it("flags a copyCard to an unknown cardId", () => {
		const card = draftToCard(
			validDraft({ effects: [{ kind: "copyCard", cardId: "ember-bolt" }] }),
		);
		expect(
			poolRuleIssues(card, empty).some((i) => i.message.includes("ember-bolt")),
		).toBe(true);
	});

	it("passes references that exist in the pool", () => {
		const card = draftToCard(
			validDraft({
				effects: [{ kind: "summon", value: 1, cardId: "token-rat" }],
			}),
		);
		const pool = new Map<string, ReturnType<typeof draftToCard>>();
		for (const c of [...buildPool(), card]) pool.set(c.id, c);
		expect(poolRuleIssues(card, pool)).toEqual([]);
	});

	it("is exactly the rule draftIssues applies for a non-spell card (triggers flattened)", () => {
		const d = validDraft({
			effects: [{ kind: "summon", value: 1, cardId: "token-nonexistent" }],
		});
		const card = draftToCard(d);
		expect(poolRuleIssues(card, empty)).toEqual(errors(d));
	});
});
