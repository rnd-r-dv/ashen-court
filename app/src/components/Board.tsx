import { useMemo } from 'react';
import type { Card as CardSpec, CreatureState, GameState, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import CardView, { FACE_DOWN_CARD } from './CardView.js';
import HeroPortrait from './HeroPortrait.js';
import ManaTray from './ManaTray.js';
import './board.css';

/**
 * Board (Task 31): the battlefield. Enemy zone on top (enemy hero, enemy
 * hand silhouettes, enemy creatures), friendly zone below (friendly
 * creatures, friendly hero, mana tray, hero power, End Turn). Pure
 * presentational: Match passes `legal` + targeting state and receives
 * callbacks. Targeting highlights come from the legal intents' target refs
 * (intents.ts enumerates one intent per legal target).
 */

export type BoardTargetingKind = 'play' | 'attack' | 'heroPower';

export interface BoardTargeting {
  kind: BoardTargetingKind;
  handIndex?: number;
  attackerId?: string;
}

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

  function creatureSlot(c: CreatureState, friendly: boolean) {
    const def = getCard(c.cardId);
    if (!def) return null;
    const ref: TargetRef = { type: 'creature', id: c.id };
    const targetable = isTarget(ref);
    const selectable = friendly && myTurn && !inTargeting && attackers.has(c.id);
    const selected = friendly && targeting?.kind === 'attack' && targeting.attackerId === c.id;
    return (
      <CardView
        key={c.id}
        card={def}
        size="board"
        stats={{ attack: c.attack, health: c.health }}
        status={{ exhausted: c.exhausted, frozen: c.frozen, shields: c.shields }}
        targetable={targetable}
        selected={selected}
        muted={inTargeting && !targetable}
        onClick={
          targetable
            ? (e) => {
                e.stopPropagation();
                onTargetClick(ref);
              }
            : selectable
              ? (e) => {
                  e.stopPropagation();
                  onSelectAttacker(c.id);
                }
              : undefined
        }
      />
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
            onClick={
              foeHeroTarget
                ? (e) => {
                    e.stopPropagation();
                    onTargetClick({ type: 'hero', player: foe });
                  }
                : undefined
            }
          />
          <div className="board-enemyhand" aria-label={`Enemy hand: ${foeP.hand.length} cards`}>
            {foeP.hand.map((id, i) => (
              <CardView key={`${id}-${i}`} card={FACE_DOWN_CARD} size="board" faceDown />
            ))}
          </div>
        </div>
        <div className="board-row board-row--top">
          {foeP.board.length === 0 && <p className="board-empty">—</p>}
          {foeP.board.map((c) => creatureSlot(c, false))}
        </div>
      </section>

      {/* friendly zone (bottom) */}
      <section className="board-zone board-zone--bottom" aria-label="Your side">
        <div className="board-row board-row--bottom">
          {meP.board.length === 0 && <p className="board-empty">—</p>}
          {meP.board.map((c) => creatureSlot(c, true))}
        </div>
        <div className="board-side board-side--bottom">
          <HeroPortrait
            hero={meP.hero}
            player={me}
            isViewer
            active={currentPlayer === me}
            targetable={myHeroTarget}
            dimmed={inTargeting && !myHeroTarget}
            onClick={
              myHeroTarget
                ? (e) => {
                    e.stopPropagation();
                    onTargetClick({ type: 'hero', player: me });
                  }
                : undefined
            }
            onPowerClick={onHeroPower}
            powerEnabled={myTurn && heroPowerLegal && !inTargeting}
          />
          <ManaTray mana={meP.mana} maxMana={meP.maxMana} />
          <button
            type="button"
            className="shell-btn board-endturn"
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
