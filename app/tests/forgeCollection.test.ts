// Forge card-collection delete-path tests (audit finding 22). deleteCustomCard
// was fully implemented and tested at the storage layer but had zero
// production callers: once a card was forged it could never be removed from
// the UI. These tests drive the real Forge screen and pin the three delete
// outcomes (throw = referenced, false = storage full, true = deleted) plus the
// list rendering and the ImportExport refresh wiring.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { Card as CardSpec } from "@ashen/core";
import { saveCustomCard, loadCustomCards } from "../src/storage.js";
import Forge from "../src/screens/Forge.js";

(
	globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const card = (over: Partial<CardSpec> = {}): CardSpec => ({
	id: "custom-col-001",
	name: "Collection Test",
	type: "creature",
	cost: 3,
	attack: 3,
	health: 3,
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

afterEach(async () => {
	if (root) await act(async () => root!.unmount());
	host?.remove();
	root = null;
	host = null;
	vi.restoreAllMocks();
});

async function mountForge() {
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => {
		root!.render(createElement(Forge));
	});
	return host;
}

async function click(btn: HTMLButtonElement) {
	await act(async () => {
		btn.click();
	});
}

/** The Delete button inside the collection row for a named card. */
function deleteBtn(name: string): HTMLButtonElement {
	return host!.querySelector(
		`.forge-collection button[aria-label="Delete ${name}"]`,
	) as HTMLButtonElement;
}

function rowNames(): string[] {
	return [...host!.querySelectorAll(".forge-collection .forge-card-name")].map(
		(el) => el.textContent ?? "",
	);
}

function toastText(): string {
	return host!.querySelector(".forge-toast")?.textContent ?? "";
}

describe("Forge card collection", () => {
	it("lists a saved custom card", async () => {
		saveCustomCard(card({ id: "custom-col-001", name: "Cinder Warden" }));
		await mountForge();

		expect(rowNames()).toContain("Cinder Warden");
		expect(
			host!.querySelector(".forge-collection .forge-side-title")?.textContent,
		).toMatch(/1/);
	});

	it("deletes a card from storage and from the list on confirm", async () => {
		saveCustomCard(card({ id: "custom-col-001", name: "Cinder Warden" }));
		vi.spyOn(window, "confirm").mockReturnValue(true);
		await mountForge();
		expect(rowNames()).toContain("Cinder Warden");

		await click(deleteBtn("Cinder Warden"));

		expect(loadCustomCards()).toEqual([]);
		expect(rowNames()).not.toContain("Cinder Warden");
		expect(toastText()).toMatch(/Deleted "Cinder Warden"/);
	});

	it("a cancelled confirm deletes nothing and shows no toast", async () => {
		saveCustomCard(card({ id: "custom-col-001", name: "Cinder Warden" }));
		vi.spyOn(window, "confirm").mockReturnValue(false);
		await mountForge();

		await click(deleteBtn("Cinder Warden"));

		expect(loadCustomCards().map((c) => c.id)).toEqual(["custom-col-001"]);
		expect(rowNames()).toContain("Cinder Warden");
		expect(toastText()).toBe("");
	});

	it("refuses to delete a card another card summons, keeping both", async () => {
		saveCustomCard(card({ id: "custom-col-001", name: "Summoner" }));
		saveCustomCard(
			card({
				id: "custom-col-002",
				name: "Summoned",
				effects: [{ kind: "summon", cardId: "custom-col-001", value: 1 }],
			}),
		);
		vi.spyOn(window, "confirm").mockReturnValue(true);
		await mountForge();

		await click(deleteBtn("Summoner"));

		expect(loadCustomCards().map((c) => c.id)).toEqual([
			"custom-col-001",
			"custom-col-002",
		]);
		expect(rowNames()).toContain("Summoner");
		expect(toastText()).toMatch(/custom-col-002/);
	});

	it("does not report success when the delete write is rejected", async () => {
		saveCustomCard(card({ id: "custom-col-001", name: "Cinder Warden" }));
		vi.spyOn(window, "confirm").mockReturnValue(true);
		await mountForge();

		// Quota rejection on the delete write (deleteCustomCard → write → false).
		// Swap the global rather than spy: jsdom's Storage is a Proxy and
		// vi.spyOn cannot shadow its methods (same convention as storage.test.ts
		// and deckBuilder.test.ts). Reads still proxy to the real store so the
		// screen keeps rendering the saved card.
		const real = globalThis.localStorage;
		const readOnlyStore: Storage = {
			get length() {
				return real.length;
			},
			clear() {},
			key(i: number) {
				return real.key(i);
			},
			getItem(k: string) {
				return real.getItem(k);
			},
			removeItem() {},
			setItem() {
				throw new DOMException("QuotaExceededError", "QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: readOnlyStore,
			configurable: true,
			writable: true,
		});
		try {
			await click(deleteBtn("Cinder Warden"));
			// The card is still listed and the toast says storage full, not "Deleted".
			expect(rowNames()).toContain("Cinder Warden");
			expect(toastText()).not.toMatch(/Deleted/);
			expect(toastText()).toMatch(/could not be deleted|storage/i);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: real,
				configurable: true,
				writable: true,
			});
		}
		expect(loadCustomCards().map((c) => c.id)).toEqual(["custom-col-001"]);
	});
});
