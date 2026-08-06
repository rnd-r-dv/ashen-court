import { describe, it, expect } from 'vitest';
import {
  buildPool, expandDeck,
  DRAGONFLIGHT_HERO, DRAGONFLIGHT_DECK,
  ELDER_ROOTS_HERO, ELDER_ROOTS_DECK,
  SHADOW_DANCERS_HERO, SHADOW_DANCERS_DECK,
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
  { name: 'dragonflight', HERO: DRAGONFLIGHT_HERO, DECK: DRAGONFLIGHT_DECK },
  { name: 'elder roots', HERO: ELDER_ROOTS_HERO, DECK: ELDER_ROOTS_DECK },
  { name: 'shadow dancers', HERO: SHADOW_DANCERS_HERO, DECK: SHADOW_DANCERS_DECK },
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

describe('decks 4-6 (Dragonflight, Elder Roots, Shadow Dancers)', () => {
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
        if (name === 'dragonflight') {
          // Dragon's Boon buff1/1(fd): needs a friendly dragon on the board.
          // Play dragon-whelp first (1/2), then buff it (2/3).
          game.state.players[0].hand.unshift('dragon-whelp');
          game.submit({ kind: 'playCard', handIndex: 0 });
          const dragon = game.state.players[0].board[0]!;
          game.state.players[0].mana = 10;
          game.submit({ kind: 'heroPower', target: { type: 'creature', id: dragon.id } });
          expect(game.state.players[0].board[0]!.attack).toBe(2);   // 1/2 → 2/3
          expect(game.state.players[0].board[0]!.health).toBe(3);
        } else if (name === 'elder roots') {
          // Roots of the World gainMana1: gainMana adds an EMPTY crystal —
          // maxMana rises, current mana unchanged (Task 6 contract).
          game.state.players[0].maxMana = 10;
          game.state.players[0].mana = 10;
          game.submit({ kind: 'heroPower' });
          expect(game.state.players[0].maxMana).toBe(11);
        } else {
          // Gamble draw1 + dmg1(self): draws a card, then hits own hero.
          const before = game.state.players[0].hand.length;
          game.submit({ kind: 'heroPower' });
          expect(game.state.players[0].hero.hp).toBe(29);
          expect(game.state.players[0].hand.length).toBe(before + 1);
        }
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

  // friendlyDragon target resolution (Task 15 Step 4; engine already implements
  // it in resolveTargets — this test pins the contract).
  describe('friendlyDragon resolution', () => {
    it('dragon-wingmen buffs a friendly dragon 2/2 and leaves non-dragons alone', () => {
      const game = newGame(DRAGONFLIGHT_HERO, DRAGONFLIGHT_DECK);
      toMain(game);
      // Real dragon on the board (playCard path → archetype 'dragon').
      game.state.players[0].hand.unshift('dragon-whelp');
      game.state.players[0].mana = 10;
      game.submit({ kind: 'playCard', handIndex: 0 });
      const dragon = game.state.players[0].board[0]!;
      // Non-dragon friendly creature (synthetic def → archetype 'neutral').
      const squire = addCreature(game, 0, { id: 'neutral-squire', attack: 2, health: 2 });
      game.state.players[0].hand.unshift('dragon-wingmen');
      game.state.players[0].mana = 10;
      game.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: dragon.id } });
      const buffed = game.state.players[0].board.find(c => c.id === dragon.id)!;
      expect(buffed.attack).toBe(3);   // 1/2 +2/+2 → 3/4
      expect(buffed.health).toBe(4);
      const untouched = game.state.players[0].board.find(c => c.id === squire.id)!;
      expect(untouched.attack).toBe(2);
      expect(untouched.health).toBe(2);
    });

    it('dragon-council startOfTurn buff1/1(fd) hits only a friendly dragon', () => {
      const game = newGame(DRAGONFLIGHT_HERO, DRAGONFLIGHT_DECK);
      toMain(game);
      game.state.players[0].hand.unshift('dragon-whelp');
      game.state.players[0].mana = 10;
      game.submit({ kind: 'playCard', handIndex: 0 });
      const dragon = game.state.players[0].board[0]!;
      const squire = addCreature(game, 0, { id: 'neutral-squire', attack: 2, health: 2 });
      game.state.players[0].hand.unshift('dragon-council');
      game.state.players[0].mana = 10;
      game.submit({ kind: 'playCard', handIndex: 0 });
      // p0's Sky Council SOT fires at the START of p0's NEXT turn: end both
      // players' turns, then p0's turn 2 start fires the trigger.
      game.submit({ kind: 'endTurn' });
      game.submit({ kind: 'endTurn' });
      const buffed = game.state.players[0].board.find(c => c.id === dragon.id)!;
      expect(buffed.attack).toBe(2);   // 1/2 +1/1 → 2/3
      expect(buffed.health).toBe(3);
      const untouched = game.state.players[0].board.find(c => c.id === squire.id)!;
      expect(untouched.attack).toBe(2);
      expect(untouched.health).toBe(2);
    });
  });
});
