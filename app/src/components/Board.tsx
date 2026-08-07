import { useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardSpec, CreatureState, GameState, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import CardView, { FACE_DOWN_CARD } from './CardView.js';
import HeroPortrait from './HeroPortrait.js';
import ManaTray from './ManaTray.js';
import { deathFade, playSlam } from './animations.js';
import type { HeroFX } from './animations.js';
import './board.css';

/**
 * Board (Task 31): the battlefield. Enemy zone on top (enemy hero, enemy
 * hand silhouettes, enemy creatures), friendly zone below (friendly
 * creatures, friendly hero, mana tray, hero power, End Turn). Pure
 * presentational: Match passes `legal` + targeting state and receives
 * callbacks. Targeting highlights come from the legal intents' target refs
 * (intents.ts enumerates one intent per legal target).
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
  enemyRevealed = true,
  animScale = 1,
  heroFx = undefined,
  powerFx = undefined,
  manaPulse = 0,
}: BoardProps) {
  const me = viewer;
  const foe = (1 - viewer) as PlayerIndex;
  const meP = state.players[me];
  const foeP = state.players[foe];
  const currentPlayer = (state.turn % 2) as PlayerIndex;
  const inTargeting = targeting !== null;

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

  function creatureSlot(c: CreatureState, friendly: boolean) {
    const def = getCard(c.cardId);
    if (!def) return null;
    const ref: TargetRef = { type: 'creature', id: c.id };
    const targetable = isTarget(ref);
    const selectable = friendly && myTurn && !inTargeting && attackers.has(c.id);
    const selected = friendly && targeting?.kind === 'attack' && targeting.attackerId === c.id;
    return (
      // Task 39: creatures slam in on mount (playSlam) and dissolve into
      // embers on death (deathFade, via the row's AnimatePresence exit).
      <motion.div
        key={c.id}
        className="board-slot"
        data-creature-id={c.id}
        variants={{ ...playSlam(animScale), ...deathFade(animScale) }}
        initial="slam"
        animate="enter"
        exit="exit"
      >
        <CardView
          card={def}
          size="board"
          faceDown={!friendly && !enemyRevealed}
          stats={{ attack: c.attack, health: c.health }}
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
                : undefined
          }
        />
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
      <section className="board-zone board-zone--top" aria-label="Enemy side">
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
          <div className="board-enemyhand" aria-label={`Enemy hand: ${foeP.hand.length} cards`}>
            {foeP.hand.map((id, i) => (
              <CardView key={`${id}-${i}`} card={FACE_DOWN_CARD} size="board" faceDown />
            ))}
          </div>
        </div>
        <div className="board-row board-row--top">
          {foeP.board.length === 0 && <p className="board-empty">—</p>}
          <AnimatePresence>{foeP.board.map((c) => creatureSlot(c, false))}</AnimatePresence>
        </div>
      </section>

      {/* friendly zone (bottom) */}
      <section className="board-zone board-zone--bottom" aria-label="Your side">
        <div className="board-row board-row--bottom">
          {meP.board.length === 0 && <p className="board-empty">—</p>}
          <AnimatePresence>{meP.board.map((c) => creatureSlot(c, true))}</AnimatePresence>
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
          <ManaTray mana={meP.mana} maxMana={meP.maxMana} pulse={manaPulse} animScale={animScale} />
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
      </section>
    </div>
  );
}
