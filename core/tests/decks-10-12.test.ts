import { describe, it, expect } from 'vitest';
import {
  buildPool, expandDeck,
  STARFORGED_HERO, STARFORGED_DECK,
  ETERNAL_VIGIL_HERO, ETERNAL_VIGIL_DECK,
  STORMWROUGHT_HERO, STORMWROUGHT_DECK,
} from '../src/data/index.js';
import type { DeckDef } from '../src/data/index.js';
import { validateDeck } from '../src/validate.js';
import { CardRegistry } from '../src/cards.js';
import { Game } from '../src/engine/game.js';
import type { HeroSpec, PlayerIndex } from '../src/types.js';
import { addCreature } from './helpers.js';

const pool = buildPool();
const poolMap = new CardRegistry(pool).pool();

const decks: { name: string; HERO: HeroSpec; DECK: DeckDef }[] = [
  { name: 'starforged', HERO: STARFORGED_HERO, DECK: STARFORGED_DECK },
  { name: 'eternal vigil', HERO: ETERNAL_VIGIL_HERO, DECK: ETERNAL_VIGIL_DECK },
  { name: 'stormwrought', HERO: STORMWROUGHT_HERO, DECK: STORMWROUGHT_DECK },
];

const newGame = (HERO: HeroSpec, DECK: DeckDef): Game => {
  const ids = expandDeck(DECK);
  return Game.create(
    { decks: [ids, ids], heroes: [HERO, HERO], seed: 5 },
    new CardRegistry(pool),
  );
};

/** Mulligan both players into main phase (turn 0, player 0 to act). */
const toMain = (game: Game): void => {
  game.submit({ kind: 'mulligan', keep: [] });
  game.submit({ kind: 'mulligan', keep: [] });
};

describe('decks 10-12 (Starforged, Eternal Vigil, Stormwrought)', () => {
  for (const { name, HERO, DECK } of decks) {
    const ids = expandDeck(DECK);
    describe(name, () => {
      it('is exactly 60 valid cards', () => {
        expect(ids).toHaveLength(60);
        expect(validateDeck(ids, poolMap)).toEqual([]);
      });

      it('hero power works in a real game', () => {
        const game = newGame(HERO, DECK);
        toMain(game);
        game.state.players[0].mana = 10;   // hero powers cost 2; turn 0 gives p0 only 1 mana
        if (name === 'eternal vigil') {
          // Renewal heal1(afc): multi-target AoE, auto-resolves — no target ref.
          const target = addCreature(game, 0, { id: 'vigil-mend-target', attack: 1, health: 3 });
          target.health = 2;   // heal 1 must bring it back to maxHealth 3
        }
        game.submit({ kind: 'heroPower' });
        if (name === 'starforged') expect(game.state.players[0].hero.discountMostExpensive).toBe(1);       // Star Rite discCheap1
        if (name === 'eternal vigil') expect(game.state.players[0].board[0]!.health).toBe(3);          // Renewal heal1(afc)
        if (name === 'stormwrought') expect(game.state.players[0].hero.discountNextSpell).toBe(1);     // Static discSpell1
      });

      it('plays a full scripted 8-turn game without throwing', () => {
        const game = newGame(HERO, DECK);
        toMain(game);
        // legalIntents-driven greedy loop (Task 12 pattern): pick the first
        // playCard/attack/heroPower intent else endTurn. Real decks produce
        // MANY intents — the fixed step count guards against runaway loops.
        for (let step = 0; step < 16; step++) {
          const me = game.currentPlayer() as PlayerIndex;
          const legal = game.legalIntents(me);
          if (legal.length === 0) break;   // gameOver or not our turn — done
          const play = legal.find(i => i.kind === 'playCard' || i.kind === 'attack' || i.kind === 'heroPower');
          expect(() => game.submit(play ?? legal[0]!)).not.toThrow();
        }
        // 8 full turns must never leave the game stuck (phase back in mulligan)
        expect(game.state.phase).not.toBe('mulligan');   // main or gameOver
      });
    });
  }

  // Controller pre-flight: targeted battlecries are FIXED in the base
  // (amendment 11, commit 27e288a) — cardPlayed.target rides the event into
  // fireTriggers and legalIntents/validatePlayCard enumerate + validate the
  // battlecry choice. storm-emberwitch (BC dmg1(any)) is the pool card that
  // exercises the fix end-to-end.
  describe('targeted battlecry regression (storm-emberwitch)', () => {
    it('damages the chosen enemy creature and leaves own hero untouched', () => {
      const game = newGame(STORMWROUGHT_HERO, STORMWROUGHT_DECK);
      toMain(game);
      const victim = addCreature(game, 1, { id: 'enemy-ward', attack: 2, health: 3 });
      game.state.players[0].mana = 10;
      game.state.players[0].hero.hp = 30;
      game.state.players[0].hand.unshift('storm-emberwitch');
      game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: victim.id } });
      expect(game.state.players[1].board.find(c => c.id === victim.id)!.health).toBe(2);   // dmg1(any) hit the target
      expect(game.state.players[0].hero.hp).toBe(30);                                       // own hero untouched
    });
  });
});
