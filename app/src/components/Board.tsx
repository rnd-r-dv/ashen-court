import { useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardSpec, CreatureState, GameState, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import type { ArchetypeId } from '@ashen/core';
import CardView, { FACE_DOWN_CARD } from './CardView.js';
import HeroPortrait, { HeroPowerBlazon } from './HeroPortrait.js';
import DeckCount from './DeckCount.js';
import ManaTray from './ManaTray.js';
import { deathFade, playSlam } from './animations.js';
import type { HeroFX } from './animations.js';
import { houseOfHeroName } from '../game/house.js';
import './board.css';

/**
 * Stable partition of one side's board by `creature.token`: normal creatures
 * keep their relative order in the register, tokens keep theirs in the
 * sub-band. Splitting must never reorder either group — order is part of the
 * board's visual state (slot points drive combat FX).
 *
 * Task 5B: there are no capacity slots any more. The engine's normal cap
 * (BOARD_CAP, core) stays exactly seven — the board simply renders the
 * occupied formation, and tokens never consume a normal slot (they live in
 * the always-mounted token sub-band below).
 */
function partitionRegisters(board: readonly CreatureState[]): [CreatureState[], CreatureState[]] {
  const normals: CreatureState[] = [];
  const tokens: CreatureState[] = [];
  for (const c of board) (c.token ? tokens : normals).push(c);
  return [normals, tokens];
}

/**
 * Hand-authored flat charges (Task 6): one engraved device per house, drawn
 * inline as plain SVG strokes/fills — no gradients, no glows (the Armorial
 * contract). Tinted by the house tincture via CSS (--house-* on
 * [data-house]).
 */
const HOUSE_CHARGE: Record<ArchetypeId, ReactElement> = {
  // Ember Court — a flame.
  ember: <path d="M12 3c1.9 2.8 4.3 4.3 4.3 7.6a4.3 4.3 0 0 1-8.6 0c0-3.3 2.4-4.8 4.3-7.6Z" />,
  // Hollow Choir — a bell.
  choir: (
    <>
      <path d="M8.5 13.5V10a3.5 3.5 0 0 1 7 0v3.5l1.9 2.4H6.6l1.9-2.4Z" />
      <path d="M10.4 19a1.6 1.6 0 0 0 3.2 0" />
    </>
  ),
  // Vermin Swarm — a crown (the Rat King).
  vermin: <path d="M5.5 9.3l2.7 2.7L12 6.3l3.8 5.7 2.7-2.7V18h-13V9.3Z" />,
  // Dragonflight — a wing.
  dragon: <path d="M4 19.3c5.2-1.6 8.8-4.8 10.4-9.8.5 3 1.7 5.3 3.8 6.9-4.9.6-9 1.7-14.2 2.9Z" />,
  // Elder Roots — a tree.
  roots: (
    <>
      <path d="M12 3v9" />
      <path d="M5.8 8.2a6.2 6.2 0 0 1 12.4 0 4.7 4.7 0 0 1-2 8.9H7.8a4.7 4.7 0 0 1-2-8.9Z" />
      <path d="M9.5 20.5h5" />
    </>
  ),
  // Shadow Dancers — a dagger.
  dance: (
    <>
      <path d="M5.5 18.5L15 9" />
      <path d="M11.5 13.5l3 3" />
      <path d="M16.5 6.5l2.2 2.2" />
    </>
  ),
  // Bone Horde — a skull.
  bone: (
    <>
      <path d="M8.7 12.7a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />
      <path d="M15.3 12.7a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />
      <path d="M8.7 12.7v3.8" />
      <path d="M15.3 12.7v3.8" />
      <path d="M7 17.2h10" />
    </>
  ),
  // Grave Pact — a blood drop.
  pact: <path d="M12 3.5c3.2 4.2 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-5.8 5.5-10Z" />,
  // Night Coven — a crescent moon.
  coven: <path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4A8.5 8.5 0 0 1 15.5 3.5Z" />,
  // Starforged — a four-pointed star.
  star: <path d="M12 3l2.1 4.9L19 10l-4.9 2.1L12 17l-2.1-4.9L5 10l4.9-2.1L12 3Z" />,
  // Eternal Vigil — a keep.
  vigil: (
    <>
      <path d="M8.5 21V10.5L12 7l3.5 3.5V21" />
      <path d="M10.5 21v-4h3v4" />
      <path d="M9 10.5V7.5h6v3" />
    </>
  ),
  // Stormwrought — a lightning bolt.
  storm: <path d="M13.5 3L7 13h4l-1.5 8L17 10.5h-4L13.5 3Z" />,
};

/** The margin banner for one side's house: tinctured charge + house name. */
function HouseBanner({ heroName }: { heroName: string }) {
  const house = houseOfHeroName(heroName);
  return (
    <div className="board-house" data-house={house.archetype} aria-label={`House of ${house.heroName}`}>
      <svg className="board-house-charge" viewBox="0 0 24 24" aria-hidden="true">
        {HOUSE_CHARGE[house.archetype]}
      </svg>
      <span className="board-house-name">{house.heroName}</span>
    </div>
  );
}

/**
 * Board (Task 31): the battlefield. Enemy zone on top (enemy hero, enemy
 * hand silhouettes, enemy creatures), friendly zone below (friendly
 * creatures, friendly hero, mana tray, hero power, End Turn). Pure
 * presentational: Match passes `legal` + targeting state and receives
 * callbacks. Targeting highlights come from the legal intents' target refs
 * (intents.ts enumerates one intent per legal target).
 *
 * Task 6: the board reads as a ruled page — each zone is a banded register
 * under its house banner in the margin, tokens sit in a subordinate sub-band
 * that never consumes a normal-row slot, and both zones keep every
 * targeting/right-click/keyword/silence/death/animation wire intact.
 *
 * Task 7: left-click inspects any revealed creature when neither targeting
 * nor attack-selection takes precedence; right-click ALWAYS inspects and
 * suppresses the native context menu, even during targeting. Both margins
 * carry a permanent hero-power blazon (name, cost, generated text) so each
 * hero's power reads without hover.
 */

/**
 * Active targeting mode. A discriminated union, deliberately NOT one flat
 * shape with two optional payload fields: each kind carries exactly the field
 * it needs, so the consumer (Match.onTargetClick) reads `handIndex` /
 * `attackerId` without a defensive `??` default. Those defaults were the bug —
 * `attackerId ?? ''` at least failed loudly ("Attacker not found"), but
 * `handIndex ?? 0` silently played whatever card sat in hand slot 0, turning a
 * state bug into a wrong and irreversible game action. With the union the
 * fallbacks are unrepresentable rather than merely unused.
 */
export type BoardTargeting =
  | { kind: 'play'; handIndex: number }
  | { kind: 'attack'; attackerId: string }
  | { kind: 'heroPower' };

export type BoardTargetingKind = BoardTargeting['kind'];

export interface BoardProps {
  state: GameState;
  viewer: PlayerIndex;
  /** Resolve a card id to its spec (unknown ids → undefined, skipped). */
  getCard: (id: string) => CardSpec | undefined;
  /** Legal intents for the viewer's current turn ([] off-turn). */
  legal: Intent[];
  targeting: BoardTargeting | null;
  /** Viewer's main-phase turn. */
  myTurn: boolean;
  onSelectAttacker: (creatureId: string) => void;
  onTargetClick: (ref: TargetRef) => void;
  onHeroPower: () => void;
  onEndTurn: () => void;
  /** Cancel the active targeting mode (empty-space click). */
  onCancel: () => void;
  /** Open the inspect panel for a revealed board creature (Task 7). */
  onInspect: (creatureId: string) => void;
  /** Enemy board creatures revealed (first enemy play/summon, Task 39). */
  enemyRevealed?: boolean;
  /** Animation duration scale (fast mode 0.5). */
  animScale?: number;
  /** Per-hero flash/heal sequence counters (damage flash, heal glow). */
  heroFx?: [HeroFX, HeroFX];
  /** Per-hero hero-power-used counters (glyph flash, Task 40). */
  powerFx?: [number, number];
  /** manaChanged sequence counter — retriggers the crystal pop. */
  manaPulse?: number;
  /** combatStarted cue (Task 8): both combatants nudge inward one beat; the
   *  seq key re-triggers the nudge for a fresh exchange. Living plates only —
   *  a combatant already absent from the final state gets its strike from the
   *  retained point (Match's fx layer) instead. */
  combatCue?: { attackerId: string; defenderId: string; seq: number } | null;
}

function refKey(ref: TargetRef): string {
  return ref.type === 'hero' ? `hero:${ref.player}` : `creature:${ref.id}`;
}

/** Valid target refs for the active targeting mode, from the legal intents. */
function candidatesFor(legal: Intent[], targeting: BoardTargeting | null): Set<string> | null {
  if (!targeting) return null;
  const set = new Set<string>();
  for (const i of legal) {
    const matches =
      (targeting.kind === 'play' && i.kind === 'playCard' && i.handIndex === targeting.handIndex) ||
      (targeting.kind === 'attack' && i.kind === 'attack' && i.attackerId === targeting.attackerId) ||
      (targeting.kind === 'heroPower' && i.kind === 'heroPower');
    if (matches && i.target) {
      set.add(refKey(i.target));
    }
  }
  return set;
}

export default function Board({
  state,
  viewer,
  getCard,
  legal,
  targeting,
  myTurn,
  onSelectAttacker,
  onTargetClick,
  onHeroPower,
  onEndTurn,
  onCancel,
  onInspect,
  enemyRevealed = true,
  animScale = 1,
  heroFx = undefined,
  powerFx = undefined,
  manaPulse = 0,
  combatCue = null,
}: BoardProps) {
  const me = viewer;
  const foe = (1 - viewer) as PlayerIndex;
  const meP = state.players[me];
  const foeP = state.players[foe];
  const currentPlayer = (state.turn % 2) as PlayerIndex;
  const inTargeting = targeting !== null;

  const [meNormals, meTokens] = partitionRegisters(meP.board);
  const [foeNormals, foeTokens] = partitionRegisters(foeP.board);

  const candidates = useMemo(() => candidatesFor(legal, targeting), [legal, targeting]);
  const isTarget = (ref: TargetRef): boolean => candidates?.has(refKey(ref)) ?? false;

  // Attack-ready friendly creatures (one or more legal attack intents).
  const attackers = useMemo(() => {
    const set = new Set<string>();
    for (const i of legal) {
      if (i.kind === 'attack') set.add(i.attackerId);
    }
    return set;
  }, [legal]);

  const heroPowerLegal = useMemo(() => legal.some((i) => i.kind === 'heroPower'), [legal]);
  const myHeroTarget = isTarget({ type: 'hero', player: me });
  const foeHeroTarget = isTarget({ type: 'hero', player: foe });

  // Click handler for a valid target (both heroes and creatures use it):
  // stopPropagation first so the board's empty-space cancel never also fires.
  const targetClick = (ref: TargetRef) => (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onTargetClick(ref);
  };

  function creatureSlot(c: CreatureState, friendly: boolean, token: boolean) {
    const def = getCard(c.cardId);
    if (!def) return null;
    const ref: TargetRef = { type: 'creature', id: c.id };
    const targetable = isTarget(ref);
    const selectable = friendly && myTurn && !inTargeting && attackers.has(c.id);
    const selected = friendly && targeting?.kind === 'attack' && targeting.attackerId === c.id;    // Task 7: an unrevealed enemy (face-down) must never leak its identity or
    // state through the inspect surface — only revealed creatures are
    // readable. The click grammar layers onto the existing wires: left-click
    // targets a valid target, else selects an attack-ready friendly creature,
    // else inspects; right-click ALWAYS inspects (suppressing the native
    // context menu), including during targeting.
    //
    // Fix round 1: the inspect branch is gated on !inTargeting. While aiming,
    // a left-click on a NON-target creature must not open inspection — it
    // falls through with no onClick, bubbles to the board root, and cancels
    // the targeting mode (empty-space cancel). Right-click stays the inspect
    // path during targeting.
    const inspectable = friendly || enemyRevealed;
    const inspect = () => onInspect(c.id);
    // Task 8: the living plate makes the same 140ms inward nudge toward the
    // combatant (friendly → up, enemy → down), re-keyed per combatStarted seq
    // so a fresh exchange replays it. Only while the cue names this creature.
    const struckNow =
      combatCue !== null && (combatCue.attackerId === c.id || combatCue.defenderId === c.id);
    const plate = (
      <CardView
        card={def}
        size="board"
        faceDown={!friendly && !enemyRevealed}
        stats={{ attack: c.attack, reflect: c.reflect, health: c.health }}
        keywords={c.keywords}
        silenced={c.silenced}
        status={{ exhausted: c.exhausted, frozen: c.frozen, shields: c.shields }}
        targetable={targetable}
        selected={selected}
        muted={inTargeting && !targetable}
        onClick={
          targetable
            ? targetClick(ref)
            : selectable
              ? (e) => {
                  e.stopPropagation();
                  onSelectAttacker(c.id);
                }
              : !inTargeting && inspectable
                ? (e) => {
                    e.stopPropagation();
                    inspect();
                  }
                : undefined
        }
      />
    );
    return (
      // Task 39: creatures slam in on mount (playSlam) and dissolve into
      // embers on death (deathFade, via the row's AnimatePresence exit).
      // Tokens share every wire (targeting, selection, live stats, silence,
      // death slot) — only the scale differs (Task 6). tabIndex -1 makes the
      // slot programmatically focusable so closing the inspect panel can
      // return focus to the creature that opened it (Task 7).
      <motion.div
        key={c.id}
        className={`board-slot${token ? ' board-slot--token' : ''}`}
        data-creature-id={c.id}
        tabIndex={-1}
        variants={{ ...playSlam(animScale), ...deathFade(animScale) }}
        initial="slam"
        animate="enter"
        exit="exit"
        onContextMenu={
          inspectable
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                inspect();
              }
            : undefined
        }
      >
        {struckNow && combatCue !== null ? (
          <motion.div
            key={`nudge-${combatCue.seq}`}
            initial={{ y: 0 }}
            animate={{ y: [0, friendly ? -6 : 6, 0] }}
            transition={{ duration: 0.14 * animScale, ease: 'linear' }}
          >
            {plate}
          </motion.div>
        ) : (
          plate
        )}
      </motion.div>
    );
  }

  return (
    <div
      className={`board${inTargeting ? ' board--targeting' : ''}`}
      onClick={() => {
        // Empty-space click while aiming → cancel (interactive elements
        // stopPropagation so their clicks never land here).
        if (inTargeting) onCancel();
      }}
    >
      {/* enemy zone (top) */}
      <section
        className={`board-zone board-zone--top${currentPlayer === foe ? ' board-zone--active' : ''}`}
        aria-label="Enemy side"
      >
        <div className="board-margin">
          <HouseBanner heroName={foeP.hero.name} />
          {/* Permanent hero-power blazon — the enemy power reads without
              hover (Task 7). */}
          <HeroPowerBlazon hero={foeP.hero} />
        </div>
        <div className="board-zone-body">
          <div className="board-side board-side--top">
            <HeroPortrait
              hero={foeP.hero}
              player={foe}
              isViewer={false}
              active={currentPlayer === foe}
              targetable={foeHeroTarget}
              dimmed={inTargeting && !foeHeroTarget}
              fx={heroFx?.[foe]}
              powerFx={powerFx?.[foe]}
              animScale={animScale}
              onClick={foeHeroTarget ? targetClick({ type: 'hero', player: foe }) : undefined}
            />
            <DeckCount remaining={foeP.deck.length} label="Enemy deck" />
            <div className="board-enemyhand" aria-label={`Enemy hand: ${foeP.hand.length} cards`}>
              {foeP.hand.map((id, i) => (
                <CardView key={`${id}-${i}`} card={FACE_DOWN_CARD} size="board" faceDown />
              ))}
            </div>
          </div>
          <div className="board-register board-player-register">
            <div className="board-row board-row--top">
              <AnimatePresence>{foeNormals.map((c) => creatureSlot(c, false, false))}</AnimatePresence>
              {/* Task 5B: the token sub-band is ALWAYS mounted inside the
                  player register, reserving exactly one token card's width.
                  Empty content is visibility-hidden (:empty, exit-safe) and
                  aria-hidden — the reserve stays in the layout, so a spawn
                  changes no outer register bounds. */}
              <div
                className="board-token-register board-token-register--top"
                aria-label={foeTokens.length > 0 ? 'Enemy tokens' : undefined}
                aria-hidden={foeTokens.length === 0 ? true : undefined}
              >
                <AnimatePresence>{foeTokens.map((c) => creatureSlot(c, false, true))}</AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Task 5B: the reserved axis between the two registers — an empty,
          pointer-inert effects layer with no ornament. Combat FX (Match's
          .match-fx overlay) fly across it; the lane itself only guarantees
          the lane stays empty and never eats a click. */}
      <div className="board-combat-lane" aria-hidden="true" />

      {/* friendly zone (bottom) */}
      <section
        className={`board-zone board-zone--bottom${currentPlayer === me ? ' board-zone--active' : ''}`}
        aria-label="Your side"
      >
        <div className="board-margin">
          <HouseBanner heroName={meP.hero.name} />
          {/* Permanent hero-power blazon — the player's own power reads
              without hover (Task 7). */}
          <HeroPowerBlazon hero={meP.hero} />
        </div>
          <div className="board-zone-body">
            <div className="board-register board-player-register">
              <div className="board-row board-row--bottom">
                <AnimatePresence>{meNormals.map((c) => creatureSlot(c, true, false))}</AnimatePresence>
                {/* Task 5B: always-mounted token sub-band (see the enemy side). */}
                <div
                  className="board-token-register board-token-register--bottom"
                  aria-label={meTokens.length > 0 ? 'Your tokens' : undefined}
                  aria-hidden={meTokens.length === 0 ? true : undefined}
                >
                  <AnimatePresence>{meTokens.map((c) => creatureSlot(c, true, true))}</AnimatePresence>
                </div>
              </div>
            </div>
          <div className="board-side board-side--bottom">
            <HeroPortrait
              hero={meP.hero}
              player={me}
              isViewer
              active={currentPlayer === me}
              targetable={myHeroTarget}
              dimmed={inTargeting && !myHeroTarget}
              fx={heroFx?.[me]}
              powerFx={powerFx?.[me]}
              animScale={animScale}
              onClick={myHeroTarget ? targetClick({ type: 'hero', player: me }) : undefined}
              onPowerClick={onHeroPower}
              powerEnabled={myTurn && heroPowerLegal && !inTargeting}
            />
            <DeckCount remaining={meP.deck.length} label="Your deck" />
            <ManaTray
              mana={meP.mana}
              maxMana={meP.maxMana}
              lockedMana={meP.lockedMana}
              pulse={manaPulse}
              animScale={animScale}
            />
            <button
              type="button"
              className="shell-btn board-endturn"
              aria-keyshortcuts="e"
              onClick={onEndTurn}
              disabled={!myTurn || inTargeting}
            >
              End Turn
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
