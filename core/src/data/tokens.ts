import type { ArtRecipe, Card } from "../types.js";

/**
 * Default art preset for Phase 2 curated cards. The archetype->preset mapping
 * is defined by the Forge (Task 26); neutrals and tokens both default to
 * 'arcane' with this shared palette.
 */
export const ARCANE_PALETTE = ["#241b4f", "#7b5cff"];

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
function hashId(id: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** ArtRecipe for a curated card: 'arcane' preset, shared palette, id-derived seed. */
export function arcaneArt(id: string): ArtRecipe {
	return { preset: "arcane", palette: ARCANE_PALETTE, seed: hashId(id) };
}

const base = (
	id: string,
	name: string,
	type: Card["type"],
	cost: number,
	rarity: Card["rarity"],
	flavor?: string,
): Card => ({
	id,
	name,
	type,
	cost,
	keywords: [],
	effects: [],
	rarity,
	archetype: "token",
	art: arcaneArt(id),
	author: "curated",
	version: 1,
	schemaVersion: 2,
	flavor,
});

/**
 * Token cards (summoned by effects/hero powers, never drafted into decks).
 * Only tokens referenced by curated cards / hero powers live here — dead data
 * would trip validateDeck edge cases and confuse the Forge's token picker.
 */
export const TOKEN_CARDS: Card[] = [
	// Task 1: token creatures carry explicit Reflect (transitional = Attack
	// value, matching the curated builders until Task 2 hand-authors them).
	{
		...base(
			"token-rat",
			"Giant Rat",
			"creature",
			0,
			"common",
			"A rat grown fat on the leavings of war — and bold with it.",
		),
		attack: 1,
		health: 1,
		reflect: 1,
	},
	{
		...base(
			"token-skeleton",
			"Skeleton",
			"creature",
			0,
			"common",
			"The Court’s dead do not rest; they rise, reassemble, and march.",
		),
		attack: 1,
		health: 1,
		reflect: 1,
	},
	{
		...base(
			"token-wisp",
			"Choir Spirit",
			"creature",
			0,
			"common",
			"A voice that lingered after the song ended, singing still.",
		),
		attack: 1,
		health: 1,
		reflect: 1,
	},
	{
		...base(
			"token-dragon-whelp",
			"Dragon Whelp",
			"creature",
			0,
			"common",
			"Small yet, but the fire in its throat is patient.",
		),
		attack: 1,
		health: 1,
		reflect: 1,
	},
	{
		...base(
			"token-treant",
			"Root Treant",
			"creature",
			0,
			"common",
			"The deep roots answer the elder forest’s call.",
		),
		attack: 1,
		health: 1,
		keywords: ["taunt"],
		reflect: 1,
	},
	{
		...base(
			"token-phoenixash",
			"Phoenix Ash",
			"creature",
			0,
			"common",
			"From the embers of the fallen, a spark remembers the sky.",
		),
		attack: 2,
		health: 2,
		reflect: 2,
	},
];

/**
 * The Coin: player 1's one-shot 0-cost spell (design spec §4 "Mana: ... Second
 * player receives a 0-cost 'Mana Surge' spell token (the Coin) usable once").
 * refillMana 1 = "Gain 1 Mana" for THIS turn only — it raises current mana
 * without adding a crystal, so it never shifts player 1's mana curve. The
 * one-use gate is PlayerState.surged (engine/intents.ts + engine/game.ts).
 */
export const MANA_SURGE_CARD: Card = {
	...base(
		"mana-surge",
		"Mana Surge",
		"spell",
		0,
		"common",
		"A surge of raw mana floods the arena.",
	),
	effects: [{ kind: "refillMana", value: 1 }],
};
