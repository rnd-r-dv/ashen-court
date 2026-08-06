import { describe, it, expect } from 'vitest';
import { buildPool, expandDeck, EMBER_COURT_HERO, EMBER_COURT_DECK, HOLLOW_CHOIR_DECK } from '../src/data/index.js';
import { CardRegistry } from '../src/cards.js';
import { Game } from '../src/engine/game.js';
import { addCreature } from './helpers.js';

const pool = buildPool();
const emberDeck = expandDeck(EMBER_COURT_DECK);
const game = (deck = emberDeck, seed = 7) =>
  Game.create(
    { decks: [deck, deck], heroes: [EMBER_COURT_HERO, EMBER_COURT_HERO], seed },
    new CardRegistry(pool),
  );

function toMain(g: Game): void {
  g.submit({ kind: 'mulligan', keep: [] });
  g.submit({ kind: 'mulligan', keep: [] });
  g.state.players[0].mana = 10;
}

// Task 15 controller ruling: a creature's battlecry with a choice target uses
// the playCard intent target (cardPlayed.target rides the event into
// fireTriggers). Without the fix, sparkmage's dmg1(any) hit the CASTER'S own
// hero and exorcist's destroy(ec) nuked the FIRST enemy creature.
describe('targeted battlecries (Task 15 ruling)', () => {
  it('ember-sparkmage battlecry damages the CHOSEN enemy creature, not own hero', () => {
    const g = game();
    toMain(g);
    const victim = addCreature(g, 1, { id: 'v1', attack: 2, health: 3, keywords: [] });
    g.state.players[0].hero.hp = 30;
    g.state.players[0].hand.unshift('ember-sparkmage');
    g.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: victim.id } });
    expect(victim.health).toBe(2);
    expect(g.state.players[0].hero.hp).toBe(30);   // own hero untouched
  });

  it('choir-exorcist battlecry destroys the CHOSEN enemy creature, not the first', () => {
    const g = game(expandDeck(HOLLOW_CHOIR_DECK));
    toMain(g);
    const first = addCreature(g, 1, { id: 'e1', attack: 1, health: 1, keywords: [] });
    const chosen = addCreature(g, 1, { id: 'e2', attack: 1, health: 1, keywords: [] });
    g.state.players[0].hand.unshift('choir-exorcist');
    g.submit({ kind: 'playCard', handIndex: 0, target: { type: 'creature', id: chosen.id } });
    expect(g.state.players[1].board.some(c => c.id === chosen.id)).toBe(false);   // destroyed (removed via creatureDied)
    expect(first.health).toBe(1);    // untouched
  });

  it('legalIntents enumerates playCard with a target for choice battlecries', () => {
    const g = game();
    toMain(g);
    const enemy = addCreature(g, 1, { id: 'c1', attack: 1, health: 1, keywords: [] });
    g.state.players[0].hand.unshift('ember-sparkmage');
    const intents = g.legalIntents(0).filter(i => i.kind === 'playCard');
    expect(intents.length).toBeGreaterThan(0);
    expect(intents.some(i => i.kind === 'playCard' && i.target?.type === 'creature' && i.target.id === enemy.id)).toBe(true);
  });
});
