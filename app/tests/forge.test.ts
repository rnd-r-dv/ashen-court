import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { buildPool, validateCard } from "@ashen/core";
import type { ForgeDraft } from "../src/forge/formState.js";
import {
	createDraft,
	draftToCard,
	draftIssues,
	poolRuleIssues,
	EFFECT_PRESETS,
} from "../src/forge/formState.js";
import { loadCustomCards } from "../src/storage.js";
import Forge from "../src/screens/Forge.js";

(
	globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A fully valid creature draft; spread overrides to build invalid variants. */
const validDraft = (over: Partial<ForgeDraft> = {}): ForgeDraft => ({
	...createDraft(),
	name: "Test Creature",
	type: "creature",
	cost: 2,
	attack: "3",
	// Task 3: Reflect is an explicit, independent authoring input — never
	// derived from Attack (the Task 1 bridge default is gone).
	reflect: "3",
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

	// Task 3: Reflect rides the draft as its own axis. The created creature
	// carries exactly what was entered; Attack and Reflect never move together.
	it("carries the draft's explicit Reflect into the created creature", () => {
		expect(draftToCard(validDraft()).reflect).toBe(3);
		expect(draftToCard(validDraft({ reflect: "0", attack: "5" })).reflect).toBe(
			0,
		);
		expect(draftToCard(validDraft({ reflect: "7", attack: "0" })).reflect).toBe(
			7,
		);
	});

	it("omits Reflect on spell and artifact drafts", () => {
		const spell = draftToCard(
			validDraft({
				type: "spell",
				attack: "5",
				reflect: "5",
				health: "5",
				trigger: "",
				effects: [{ kind: "draw", value: 1 }],
			}),
		);
		expect(spell.reflect).toBeUndefined();
		const artifact = draftToCard(
			validDraft({
				type: "artifact",
				attack: "5",
				reflect: "5",
				health: "5",
				trigger: "",
				effects: [],
			}),
		);
		expect(artifact.reflect).toBeUndefined();
	});

	it("requires an explicit Reflect entry on creature drafts", () => {
		const d = validDraft({ reflect: "" });
		expect(errors(d).some((i) => i.field === "reflect")).toBe(true);
	});

	it("converts a valid draft into a card that passes validateCard", () => {
		const card = draftToCard(validDraft());
		expect(validateCard(card).filter((i) => i.severity === "error")).toEqual(
			[],
		);
		expect(card.author).toBe("custom");
		expect(card.id).toBe("test-creature");
		// Task 3: every Forge-authored custom card stamps the Reflect schema.
		expect(card.schemaVersion).toBe(2);
		expect(card.reflect).toBe(3);
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

// ---- Forge screen UI (Task 3): the visible Reflect authoring surface ----
//
// Runtime tests on the REAL Forge screen (createRoot + act, the repo's jsdom
// harness — see forgeCollection.test.ts). These pin the visible control order
// and accessible labels, not just the form-state helpers: the creature stat
// editor must present Attack → Reflect → Health, Reflect must be required and
// never defaulted from Attack, and a buff effect row must edit its three stat
// deltas on independent axes.

let host: HTMLDivElement | null = null;
let root: Root | null = null;

async function mountForge() {
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => {
		root!.render(createElement(Forge));
	});
	return host;
}

/** Set a controlled input via the native value setter (React value tracker
 *  bypassed) + a bubbling input event — jsdom's direct `.value =` does not
 *  reach React's onChange. */
async function setInput(selector: string, value: string) {
	const el = host!.querySelector(selector) as HTMLInputElement | null;
	if (!el) throw new Error(`no input ${selector}`);
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)!.set!;
	await act(async () => {
		setter.call(el, value);
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

/** Set a controlled range input via the native value setter + input event —
 *  direct `.value =` bypasses React's value tracker, so onChange never fires. */
async function setRange(el: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)!.set!;
	await act(async () => {
		setter.call(el, value);
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function setSelect(selector: string, value: string) {
	const el = host!.querySelector(selector) as HTMLSelectElement | null;
	if (!el) throw new Error(`no select ${selector}`);
	await act(async () => {
		el.value = value;
		el.dispatchEvent(new Event("change", { bubbles: true }));
	});
}

async function click(btn: HTMLButtonElement) {
	await act(async () => {
		btn.click();
	});
}

/** Fill every field of a valid creature draft except Reflect (left empty). */
async function fillCreature(over: { reflect?: string } = {}) {
	await setInput("#forge-name", "Mirror Warden");
	await setInput("#forge-attack", "2");
	if (over.reflect !== undefined) await setInput("#forge-reflect", over.reflect);
	await setInput("#forge-health", "4");
}

const saveBtn = () => host!.querySelector(".forge-save-btn") as HTMLButtonElement;
const issues = () =>
	[...host!.querySelectorAll(".forge-issue-error")].map(
		(el) => el.textContent ?? "",
	);

beforeEach(() => localStorage.clear());

afterEach(async () => {
	if (root) await act(async () => root!.unmount());
	host?.remove();
	root = null;
	host = null;
	vi.restoreAllMocks();
});

describe("Forge creature stat editor (Task 3)", () => {
	it("presents Attack, Reflect, and Health in that order with accessible labels", async () => {
		await mountForge();
		const fields = [...host!.querySelectorAll(".forge-stats .forge-field")];
		const labels = fields.map(
			(el) => el.querySelector(".forge-label")?.textContent?.trim() ?? "",
		);
		// Visible order is the Task 3 contract: Attack, Reflect, Health.
		expect(labels).toEqual(["Attack", "Reflect", "Health"]);
		// Each stat input is named by a label for/id pair (accessible name).
		for (const id of ["forge-attack", "forge-reflect", "forge-health"]) {
			const label = host!.querySelector(`label[for="${id}"]`);
			expect(label, `missing label for ${id}`).not.toBeNull();
			expect(host!.querySelector(`#${id}`), `missing input ${id}`).not.toBeNull();
		}
	});

	it("does not default Reflect from Attack in a fresh draft", async () => {
		await mountForge();
		const reflect = host!.querySelector(
			"#forge-reflect",
		) as HTMLInputElement;
		const attack = host!.querySelector("#forge-attack") as HTMLInputElement;
		// A brand-new draft starts empty on both axes.
		expect(reflect.value).toBe("");
		expect(attack.value).toBe("");
	});

	it("requires Reflect: an empty Reflect entry blocks the save", async () => {
		await mountForge();
		await fillCreature(); // reflect deliberately left empty
		expect(issues().some((t) => /[Rr]eflect/.test(t))).toBe(true);
		expect(saveBtn().disabled).toBe(true);
	});

	it("saves a creature with its explicit Reflect, independent of Attack", async () => {
		await mountForge();
		await fillCreature({ reflect: "3" });
		expect(saveBtn().disabled).toBe(false);
		await click(saveBtn());
		const [saved] = loadCustomCards();
		expect(saved!.reflect).toBe(3);
		expect(saved!.attack).toBe(2);
		expect(saved!.schemaVersion).toBe(2);
	});
});

describe("Forge buff effect rows (Task 3)", () => {
	const buffPresetIndex = () =>
		EFFECT_PRESETS.findIndex((p) => p.spec.kind === "buff");

	async function addBuffRow() {
		await fillCreature({ reflect: "3" });
		// Creatures apply effects through triggers only (M1): pick a trigger so
		// the buff row survives to the saved card.
		await setSelect("#forge-trigger", "battlecry");
		const add = host!.querySelector(".forge-add-btn") as HTMLButtonElement;
		await click(add);
		const preset = host!.querySelector(
			".forge-effect-row select",
		) as HTMLSelectElement;
		await act(async () => {
			preset.value = String(buffPresetIndex());
			preset.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}

	it("exposes Attack, Reflect, and Health axis sliders in that order", async () => {
		await mountForge();
		await addBuffRow();
		const axes = [...host!.querySelectorAll(".forge-buff-axes label")].map(
			(el) => el.querySelector(".forge-buff-axis-name")?.textContent?.trim() ?? "",
		);
		expect(axes).toEqual(["attack", "reflect", "health"]);
		// Preset defaults: +2 Attack, +0 Reflect, +2 Health (+2/+2 preset).
		const values = [...host!.querySelectorAll(".forge-buff-axes input")].map(
			(el) => (el as HTMLInputElement).value,
		);
		expect(values).toEqual(["2", "0", "2"]);
	});

	it("edits the three axes independently and saves value/value3/value2", async () => {
		await mountForge();
		await addBuffRow();
		const sliders = [...host!.querySelectorAll(".forge-buff-axes input")] as HTMLInputElement[];
		// Attack → value, Reflect → value3, Health → value2 (independent deltas).
		await setRange(sliders[0]!, "5");
		await setRange(sliders[1]!, "6");
		await setRange(sliders[2]!, "7");
		await click(saveBtn());
		const [saved] = loadCustomCards();
		expect(saved!.triggers).toEqual([
			{
				when: "battlecry",
				effects: [
					{
						kind: "buff",
						value: 5,
						value3: 6,
						value2: 7,
						target: "friendlyCreature",
					},
				],
			},
		]);
	});
});
