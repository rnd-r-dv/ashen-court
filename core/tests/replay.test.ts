import { describe, it, expect } from "vitest";
import { Game } from "../src/engine/game.js";
import type { GameEvent, Intent } from "../src/types.js";
import { makeTestSetup, addCreature } from "./helpers.js";

describe("serialization", () => {
	it("clone() produces an equal state", () => {
		const a = Game.create(makeTestSetup());
		a.state.phase = "main";
		const b = a.clone();
		expect(b.serialize()).toBe(a.serialize()); // fresh game: the log is empty, so this is total equality
	});
	// audit 02 bug 16: clone() is the BOT SEARCH path (evaluate() reads only
	// state.players), so it drops the append-only event log instead of
	// round-tripping the whole match history through JSON on every search node —
	// measured 0.155ms → 0.012ms per clone at turn 40, and flat in match length
	// rather than growing. serialize()/deserialize() stay lossless.
	it("clone() drops the event log but keeps everything else identical", () => {
		const a = Game.create(makeTestSetup());
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "endTurn" });
		expect(a.state.log.length).toBeGreaterThan(0);
		const b = a.clone();
		expect(b.state.log).toEqual([]);
		// everything OTHER than the log round-trips exactly, rngState included
		expect(JSON.stringify({ ...b.state, log: 0 })).toBe(
			JSON.stringify({ ...a.state, log: 0 }),
		);
		expect(b.state.rngState).toEqual(a.state.rngState);
	});
	it("a clone stays deterministic: same intents → same state as the original", () => {
		const a = Game.create(makeTestSetup());
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "mulligan", keep: [] });
		const b = a.clone();
		// Drive both through the same legalIntents-derived script (the rng position
		// must survive cloning, or a random effect would diverge here).
		for (let step = 0; step < 8; step++) {
			if (a.state.phase === "gameOver") break;
			const me = a.currentPlayer();
			const legal = a.legalIntents(me);
			const intent =
				legal.find(
					(i) =>
						i.kind === "playCard" ||
						i.kind === "attack" ||
						i.kind === "heroPower",
				) ?? legal[0]!;
			expect(a.submit(intent)).toEqual(b.submit(intent));
		}
		// identical modulo the log the clone never inherited
		expect(JSON.stringify({ ...b.state, log: 0 })).toBe(
			JSON.stringify({ ...a.state, log: 0 }),
		);
	});
	it("serialize() itself stays lossless — the log survives a round-trip", () => {
		const a = Game.create(makeTestSetup());
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "endTurn" });
		const b = Game.deserialize(a.serialize(), a.registry);
		expect(b.state.log).toEqual(a.state.log);
		expect(b.serialize()).toBe(a.serialize());
	});
	it("applying identical intents to two games from the same seed diverges identically (replay)", () => {
		const a = Game.create(makeTestSetup());
		const b = Game.create(makeTestSetup());
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "mulligan", keep: [] });
		b.submit({ kind: "mulligan", keep: [] });
		b.submit({ kind: "mulligan", keep: [] });
		// legalIntents-driven deterministic script: same seed → same states → same
		// picks. legalIntents returns fully-formed intents (targets where required).
		for (let step = 0; step < 8; step++) {
			if (a.state.phase === "gameOver") break;
			const me = a.currentPlayer();
			const legal = a.legalIntents(me);
			const play = legal.find(
				(i) =>
					i.kind === "playCard" ||
					i.kind === "attack" ||
					i.kind === "heroPower",
			);
			const intent = play ?? legal[0]!; // endTurn fallback (main phase always has it)
			const ea = a.submit(intent);
			const eb = b.submit(intent);
			expect(ea).toEqual(eb);
		}
		expect(a.serialize()).toBe(b.serialize());
	});
	it("serialize/deserialize round-trips identical after a script of intents", () => {
		const a = Game.create(makeTestSetup());
		const script: Intent[] = [
			{ kind: "mulligan", keep: [] },
			{ kind: "mulligan", keep: [] },
			{ kind: "endTurn" },
		];
		for (const i of script) a.submit(i);
		const b = Game.deserialize(a.serialize(), a.registry);
		expect(b.serialize()).toBe(a.serialize());
	});
	it("applyEvent-driven game matches submit-driven game (dispatch-driven flows only)", () => {
		const a = Game.create(makeTestSetup());
		const b = Game.create(makeTestSetup());
		// Dispatch-driven flows (turn transitions + beginTurn emissions) are fully
		// event-captured, so replaying the events via applyEvent reconstructs state.
		// playCard/attack/heroPower resolve INLINE in submit (mana payment, hand
		// removal, summon, damage are direct mutations; their events are the
		// broadcast/animation stream) — NOT event-reconstructable by design.
		// NOTE: mulligan DISCARDS are inline too, so both games run their own
		// mulligan submits; only the endTurn resolution is replayed as events.
		a.submit({ kind: "mulligan", keep: [] });
		a.submit({ kind: "mulligan", keep: [] });
		b.submit({ kind: "mulligan", keep: [] });
		b.submit({ kind: "mulligan", keep: [] });
		const events = a.submit({ kind: "endTurn" });
		// submit returns the FULL resolution tree (Task 9 session-wrap) — the
		// beginTurn follow-ups in `events` are the RESULT of dispatching turnEnd,
		// which regenerates them. Only the direct event is replayable input;
		// re-applying the follow-ups would double-draw/duplicate the log.
		for (const evt of events) if (evt.type === "turnEnd") b.applyEvent(evt);
		// Full serialization equality is valid: setup shuffle consumes the seeded RNG
		// identically in both games and mulligan/endTurn consume none, so rngState
		// matches after the replay.
		expect(b.serialize()).toBe(a.serialize());
	});
	it("serialize mid-mulligan preserves mulligan progress", () => {
		const a = Game.create(makeTestSetup());
		a.submit({ kind: "mulligan", keep: [] });
		const b = Game.deserialize(a.serialize(), a.registry);
		expect(a.state.phase).toBe("mulligan");
		b.submit({ kind: "mulligan", keep: [] }); // must be player 1, not player 0 again
		expect(b.state.phase).toBe("main");
	});
	// Task 1: Reflect rides live CreatureState like Attack/Health, so it must
	// survive the lossless state surface (serialize/deserialize AND clone).
	it("live creature Reflect survives serialize/deserialize and clone", () => {
		const a = Game.create(makeTestSetup());
		a.state.phase = "main";
		const c = addCreature(a, 0, {
			id: "t-a",
			attack: 2,
			health: 3,
			reflect: 4,
			exhausted: false,
		});
		expect(c.reflect).toBe(4);
		const b = Game.deserialize(a.serialize(), a.registry);
		expect(b.state.players[0].board[0]!.reflect).toBe(4);
		expect(a.clone().state.players[0].board[0]!.reflect).toBe(4);
	});
	it("a legacy creature state without reflect reflects nothing, never undefined damage", () => {
		const a = Game.create(makeTestSetup());
		a.state.phase = "main";
		const attacker = addCreature(a, 0, {
			id: "t-a",
			attack: 3,
			health: 5,
			exhausted: false,
			reflect: 3,
		});
		addCreature(a, 1, { id: "t-b", attack: 1, health: 6, reflect: 4 });
		// Simulate a save written before the field existed: strip every creature's
		// reflect from the JSON, exactly as plain JSON round-trips of old states do.
		const legacy = a.serialize().replace(/"reflect":\d+,/g, "");
		const old = Game.deserialize(legacy, a.registry);
		const atk = old.state.players[0].board[0]!;
		const def = old.state.players[1].board[0]!;
		const evts = old.submit({
			kind: "attack",
			attackerId: atk.id,
			target: { type: "creature", id: def.id },
		});
		// every emitted damage amount is a defined number — no undefined/NaN
		// counter-damage may leak from the malformed state
		const dmg = evts.filter(
			(e): e is Extract<GameEvent, { type: "damageDealt" }> =>
				e.type === "damageDealt",
		);
		expect(dmg.length).toBeGreaterThan(0);
		expect(dmg.every((e) => Number.isFinite(e.amount))).toBe(true);
		// the legacy defender reflected nothing (its missing field), the attacker took its 3 in
		expect(atk.health).toBe(5);
		expect(def.health).toBe(3);
	});
});
