import { describe, it, expect, beforeEach } from "vitest";
import type { Card } from "@ashen/core";
import {
	saveCustomCard,
	loadCustomCards,
	deleteCustomCard,
	saveDeck,
	loadDecks,
	deleteDeck,
	deckKey,
	exportCardsJson,
	importCardsJson,
	saveSettings,
	loadSettings,
} from "../src/storage.js";

const card = (over: Partial<Card> = {}): Card => ({
	id: "custom-001",
	name: "Test",
	type: "creature",
	cost: 3,
	attack: 3,
	health: 3,
	reflect: 3,
	keywords: [],
	effects: [],
	rarity: "common",
	archetype: "neutral",
	art: { preset: "shadow", palette: ["#111", "#333"], seed: 1 },
	author: "custom",
	version: 1,
	...over,
});

beforeEach(() => localStorage.clear());

describe("custom cards", () => {
	it("saves and loads a custom card", () => {
		saveCustomCard(card());
		expect(loadCustomCards()).toEqual([card()]);
	});
	// Task 1 compatibility bridge: storage written before the Reflect contract
	// existed holds creatures with no `reflect`. Loading normalizes them
	// deterministically to Reflect = Attack (ids and `version` untouched) so
	// they validate and fight with mirror-stat parity. Task 3 replaces this
	// bridge with an explicit Forge input + schemaVersion migration.
	it("normalizes stored legacy creatures missing Reflect to Reflect = Attack (Task 1 bridge)", () => {
		const legacy = card({ id: "legacy-001", name: "Old Guard", version: 7 });
		delete legacy.reflect; // shape as saved before the field existed
		localStorage.setItem("tcg.customCards", JSON.stringify([legacy]));
		const [loaded] = loadCustomCards();
		expect(loaded!.reflect).toBe(3); // attack of the legacy 3/3
		expect(loaded!.id).toBe("legacy-001"); // identity preserved
		expect(loaded!.version).toBe(7); // revision value preserved
	});
	it("does NOT silently repair a schemaVersion-2 creature missing Reflect (Task 3 owns the gate)", () => {
		const schema2 = card({ id: "schema2-001", schemaVersion: 2 });
		delete schema2.reflect;
		localStorage.setItem("tcg.customCards", JSON.stringify([schema2]));
		const [loaded] = loadCustomCards();
		expect(loaded!.reflect).toBeUndefined(); // a 2-stamped card is authored, not legacy
	});
	it("upserts by id when the name is unchanged (re-saving an edit)", () => {
		saveCustomCard(card());
		saveCustomCard(card({ version: 2 }));
		const cards = loadCustomCards();
		expect(cards).toHaveLength(1);
		expect(cards[0]).toEqual(card({ version: 2 }));
	});
	it("refuses to overwrite an existing custom card with a different name (I2 slug collision)", () => {
		saveCustomCard(card());
		expect(() => saveCustomCard(card({ name: "Renamed" }))).toThrow(
			/already used by "Test"/,
		);
		expect(loadCustomCards()).toEqual([card()]);
	});
	it("refuses to save a card whose id collides with a curated card (I2 — it would be invisible)", () => {
		// 'ember-bolt' is a curated id in buildPool().
		expect(() =>
			saveCustomCard(card({ id: "ember-bolt", name: "Ember Bolt" })),
		).toThrow(/curated card/);
		expect(loadCustomCards()).toEqual([]);
	});
	it("saves a card once renamed to a free slug (I2)", () => {
		saveCustomCard(card({ id: "alpha-strike", name: "Alpha Strike" }));
		expect(() =>
			saveCustomCard(card({ id: "alpha-strike", name: "Alpha Strike!" })),
		).toThrow();
		saveCustomCard(card({ id: "beta-strike", name: "Beta Strike" }));
		expect(loadCustomCards().map((c) => c.id)).toEqual([
			"alpha-strike",
			"beta-strike",
		]);
	});
	it("deletes by id", () => {
		saveCustomCard(card());
		saveCustomCard(card({ id: "custom-002", name: "Other" }));
		deleteCustomCard("custom-001");
		expect(loadCustomCards()).toEqual([
			card({ id: "custom-002", name: "Other" }),
		]);
	});
	it("blocks deleting a card referenced by another custom card effect (C2)", () => {
		saveCustomCard(card()); // B = custom-001
		saveCustomCard(
			card({
				// A references B via copyCard
				id: "custom-002",
				name: "Other",
				triggers: [
					{
						when: "battlecry",
						effects: [{ kind: "copyCard", cardId: "custom-001" }],
					},
				],
			}),
		);
		expect(() => deleteCustomCard("custom-001")).toThrow(
			/Cannot delete custom-001: referenced by custom-002/,
		);
		expect(loadCustomCards()).toHaveLength(2);
	});
	it("blocks deleting a card contained in a saved deck overlay (C2)", () => {
		saveCustomCard(card());
		saveDeck("my-deck", ["custom-001"]);
		expect(() => deleteCustomCard("custom-001")).toThrow(
			/Cannot delete custom-001: referenced by deck:custom:my-deck/,
		);
		expect(loadCustomCards()).toHaveLength(1);
	});
	it("reports delete failure when localStorage rejects the write (I9)", () => {
		// Backing store seeded with a real card, so the delete path runs its full
		// reference check and only the final write() fails.
		const backing = new Map<string, string>([
			["tcg.customCards", JSON.stringify([card()])],
		]);
		const real = globalThis.localStorage;
		const broken: Storage = {
			get length() {
				return backing.size;
			},
			clear() {
				backing.clear();
			},
			key() {
				return null;
			},
			getItem(k: string) {
				return backing.get(k) ?? null;
			},
			removeItem(k: string) {
				backing.delete(k);
			},
			setItem() {
				throw new DOMException("QuotaExceededError", "QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: broken,
			configurable: true,
			writable: true,
		});
		try {
			expect(deleteCustomCard("custom-001")).toBe(false);
			expect(deleteDeck("bone")).toBe(false);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: real,
				configurable: true,
				writable: true,
			});
		}
	});
	it("reports delete success when the write lands (I9)", () => {
		saveCustomCard(card());
		saveDeck("bone", ["custom-001"]);
		expect(deleteDeck("bone")).toBe(true);
		expect(deleteCustomCard("custom-001")).toBe(true);
		expect(loadCustomCards()).toEqual([]);
		expect(loadDecks()).toEqual({});
	});
	it("reports save failure when localStorage rejects the write (I1 quota)", () => {
		// Replace the jsdom storage global with one whose setItem always throws
		// (vi.spyOn cannot shadow Storage.prototype methods reliably here).
		const real = globalThis.localStorage;
		const broken: Storage = {
			get length() {
				return 0;
			},
			clear() {},
			key() {
				return null;
			},
			getItem() {
				return null;
			},
			removeItem() {},
			setItem() {
				throw new DOMException("QuotaExceededError", "QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: broken,
			configurable: true,
			writable: true,
		});
		try {
			expect(saveCustomCard(card())).toBe(false);
			expect(saveDeck("x", ["a"])).toBe(false);
			expect(saveSettings({ fastMode: true })).toBe(false);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: real,
				configurable: true,
				writable: true,
			});
		}
	});
});

describe("deck overlay (namespaced custom:<slug> keys)", () => {
	it("saves under the namespaced key and round-trips", () => {
		const ids = Array.from(
			{ length: 60 },
			(_, i) => `t-${String(i).padStart(3, "0")}`,
		);
		saveDeck("bone", ids);
		expect(loadDecks()).toEqual({ [deckKey("bone")]: ids });
		expect(loadDecks()[deckKey("bone")]).toEqual(ids);
		deleteDeck("bone");
		expect(loadDecks()).toEqual({});
	});
	it("a custom deck named like a curated archetype stays namespaced (I4)", () => {
		saveDeck("ember", ["overlay-only"]);
		expect(loadDecks()).toEqual({ "custom:ember": ["overlay-only"] });
		deleteDeck("ember");
	});
	it("load-then-edit round-trip: a broken overlay can be repaired and re-saved (I3)", () => {
		const good = Array.from(
			{ length: 59 },
			(_, i) => `t-${String(i).padStart(3, "0")}`,
		);
		saveDeck("my-deck", [...good, "vanished-card"]);
		const loaded = loadDecks()[deckKey("my-deck")]!;
		expect(loaded).toContain("vanished-card");
		// edit: drop the broken card, re-save under the same slug
		const repaired = loaded.filter((id) => id !== "vanished-card");
		saveDeck("my-deck", repaired);
		expect(loadDecks()[deckKey("my-deck")]).toEqual(repaired);
	});
});

describe("settings", () => {
	it("round-trips settings", () => {
		saveSettings({ fastMode: true });
		expect(loadSettings()).toEqual({ fastMode: true });
	});
});

describe("shape-checked reads (M5)", () => {
	it("falls back to the empty default for valid-JSON-wrong-shape storage", () => {
		localStorage.setItem("tcg.decks", JSON.stringify({ a: 5 }));
		expect(loadDecks()).toEqual({});
		localStorage.setItem("tcg.decks", JSON.stringify({ "custom:x": [1, 2] }));
		expect(loadDecks()).toEqual({});
		localStorage.setItem(
			"tcg.customCards",
			JSON.stringify({ not: "an array" }),
		);
		expect(loadCustomCards()).toEqual([]);
		localStorage.setItem("tcg.settings", JSON.stringify("fast!"));
		expect(loadSettings()).toEqual({ fastMode: false });
	});
	it("drops non-card garbage from the custom-cards array", () => {
		localStorage.setItem("tcg.customCards", JSON.stringify([card(), 5, null]));
		expect(loadCustomCards()).toEqual([card()]);
	});
});

describe("JSON import/export", () => {
	it("export then import round-trips", () => {
		const json = exportCardsJson([card()]);
		expect(importCardsJson(json)).toEqual([card()]);
	});
	it("import rejects invalid JSON and invalid cards", () => {
		expect(() => importCardsJson("not json")).toThrow();
		expect(() =>
			importCardsJson(JSON.stringify([{ id: "bad id!" }])),
		).toThrow();
	});
	it("import rejects a card whose summon effect references an unknown card (C1 pool rule)", () => {
		const bad = card({
			id: "custom-summon",
			triggers: [
				{
					when: "battlecry",
					effects: [{ kind: "summon", value: 1, cardId: "token-nonexistent" }],
				},
			],
		});
		expect(() => importCardsJson(JSON.stringify([bad]))).toThrow(
			"Invalid card custom-summon: Unknown card reference: token-nonexistent",
		);
	});
	it("import rejects a card whose copyCard effect references an unknown card (C1)", () => {
		const bad = card({
			id: "custom-copy",
			triggers: [
				{ when: "battlecry", effects: [{ kind: "copyCard", cardId: "nope" }] },
			],
		});
		expect(() => importCardsJson(JSON.stringify([bad]))).toThrow(
			"Invalid card custom-copy: Unknown card reference: nope",
		);
	});
	it("import accepts a summon to a known curated card (C1)", () => {
		const ok = card({
			id: "custom-summon-ok",
			triggers: [
				{
					when: "battlecry",
					effects: [{ kind: "summon", value: 1, cardId: "token-rat" }],
				},
			],
		});
		expect(importCardsJson(JSON.stringify([ok]))).toEqual([ok]);
	});
	it("import rejects a null element with the documented error, not a TypeError (I5)", () => {
		expect(() => importCardsJson("[null]")).toThrow(
			"Invalid card ?: malformed card data",
		);
	});
	it("import rejects token-archetype cards (M6)", () => {
		const token = card({
			id: "token-rat",
			name: "Giant Rat",
			archetype: "token",
		});
		expect(() => importCardsJson(JSON.stringify([token]))).toThrow(
			"Invalid card token-rat: Token archetype cards cannot be imported.",
		);
	});
	it("normalizes curated-author imports to custom (M6)", () => {
		const curated = card({ author: "curated" });
		const [imported] = importCardsJson(JSON.stringify([curated]));
		expect(imported!.author).toBe("custom");
	});
});
