import { useEffect, useMemo, useState } from 'react';
import type { Card as CardSpec, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import { useMatch } from '../game/useMatch.js';
import { useNav } from '../App.js';
import type { MatchScreenSetup } from '../types.js';
import Board from '../components/Board.js';
import type { BoardTargeting } from '../components/Board.js';
import Hand from '../components/Hand.js';
import CardView from '../components/CardView.js';
import './match.css';

/**
 * Match (Task 31): the board screen. Wires useMatch (Task 30) with the
 * driver from App's match entry (bot mode auto-plays the opponent; hotseat
 * v1 renders both sides but only wires player 0 — the pass flow lands in
 * Task 32). Owns the interaction state machine on top of `legal`:
 *   - click a playable card → resolve instantly if no effect needs a target,
 *     otherwise enter targeting mode; legal intents enumerate one variant per
 *     valid target ref, so candidates come straight from `legal`.
 *   - click a ready attacker → targeting mode with its attack targets.
 *   - hero power button → same resolution as cards.
 *   - click a target → submit the intent with that ref; click elsewhere
 *     (empty board space, hand, root margin) → cancel.
 * Mulligan phase renders the keep/redraw UI (per-card toggles, confirm).
 * Event queue is drained per batch; Task 39 replaces this with per-tick
 * animation consumption.
 */

export default function Match({ setup }: { setup: MatchScreenSetup }) {
  const { navigate } = useNav();
  const { state, events, submit, legal, drainEvents, myPlayer } = useMatch({
    driver: setup.driver,
    myPlayer: setup.myPlayer,
    bot: setup.bot,
    onGameOver: (result) => navigate({ name: 'victory', result }),
  });

  const [targeting, setTargeting] = useState<BoardTargeting | null>(null);
  const [awaiting, setAwaiting] = useState(false); // submit in flight (button re-click guard)

  const me = myPlayer;
  const foe = (1 - myPlayer) as PlayerIndex;
  const meP = state.players[me];
  const foeP = state.players[foe];
  const currentPlayer = (state.turn % 2) as PlayerIndex;
  const myTurn = state.phase === 'main' && currentPlayer === me;
  const inTargeting = targeting !== null;
  const isBotMode = setup.bot !== undefined;

  /** Resolve card ids against the engine registry (unknown ids → undefined). */
  const getCard = useMemo(() => {
    const reg = setup.driver.game().registry;
    return (id: string): CardSpec | undefined => {
      try {
        return reg.get(id);
      } catch {
        return undefined;
      }
    };
  }, [setup.driver]);

  // Drain the pending event queue each batch so it stays bounded. Task 39
  // replaces this with per-animation-tick event consumption.
  useEffect(() => {
    if (events.length > 0) drainEvents();
  }, [events, drainEvents]);

  // A submit is acknowledged once the next event batch arrives.
  useEffect(() => {
    if (awaiting && events.length > 0) setAwaiting(false);
  }, [awaiting, events]);

  // Hand indices with at least one legal playCard intent.
  const playable = useMemo(() => {
    const set = new Set<number>();
    for (const i of legal) {
      if (i.kind === 'playCard') set.add(i.handIndex);
    }
    return set;
  }, [legal]);

  function submitOnce(intent: Intent) {
    setAwaiting(true);
    submit(intent);
  }

  function onHandCardClick(handIndex: number) {
    if (!myTurn) return;
    if (targeting) {
      // Clicking a hand card while aiming cancels the targeting mode.
      setTargeting(null);
      return;
    }
    const intents = legal.filter(
      (i): i is Extract<Intent, { kind: 'playCard' }> => i.kind === 'playCard' && i.handIndex === handIndex,
    );
    if (intents.length === 0) return; // not legal
    if (intents.some((i) => i.target !== undefined)) {
      setTargeting({ kind: 'play', handIndex });
    } else {
      submitOnce({ kind: 'playCard', handIndex });
    }
  }

  function onHeroPower() {
    if (!myTurn || targeting) return;
    const intents = legal.filter((i): i is Extract<Intent, { kind: 'heroPower' }> => i.kind === 'heroPower');
    if (intents.length === 0) return;
    if (intents.some((i) => i.target !== undefined)) {
      setTargeting({ kind: 'heroPower' });
    } else {
      submitOnce({ kind: 'heroPower' });
    }
  }

  function onSelectAttacker(creatureId: string) {
    if (!myTurn || targeting) return;
    setTargeting({ kind: 'attack', attackerId: creatureId });
  }

  function onTargetClick(ref: TargetRef) {
    if (!targeting) return;
    const t = targeting;
    setTargeting(null);
    if (t.kind === 'play') {
      submitOnce({ kind: 'playCard', handIndex: t.handIndex ?? 0, target: ref });
    } else if (t.kind === 'attack') {
      submitOnce({ kind: 'attack', attackerId: t.attackerId ?? '', target: ref });
    } else {
      submitOnce({ kind: 'heroPower', target: ref });
    }
  }

  // Hotseat v1: player 1 (the second human) cannot act yet — show the
  // pass-device note instead of a dead board. Task 32 owns the real flow.
  const passVisible =
    !isBotMode &&
    ((state.phase === 'main' && currentPlayer === foe) ||
      (state.phase === 'mulligan' && state.mulligansDone[me] && !state.mulligansDone[foe]));

  const passOverlay = passVisible ? (
    <div className="match-pass">
      <div className="match-pass-inner">
        <h2 className="shell-title">Player {foe + 1}&apos;s turn</h2>
        <p className="shell-subtitle">Pass the device to Player {foe + 1}.</p>
        <p className="match-pass-note">The full pass-and-play flow lands in a later update.</p>
      </div>
    </div>
  ) : null;

  // ---- mulligan phase ----
  if (state.phase === 'mulligan') {
    const mineDone = state.mulligansDone[me];
    return (
      <div className="match match--mulligan">
        <h1 className="shell-title">Mulligan</h1>
        <p className="shell-subtitle">
          {mineDone
            ? 'Waiting for your opponent…'
            : 'Keep or redraw each card — redrawn cards are replaced from your deck.'}
        </p>
        {!mineDone && (
          <MulliganHand
            hand={meP.hand}
            getCard={getCard}
            onConfirm={(keep) => submitOnce({ kind: 'mulligan', keep })}
          />
        )}
        {mineDone && <p className="match-waiting">The match begins shortly…</p>}
        {passOverlay}
      </div>
    );
  }

  // ---- main phase ----
  const turnNumber = Math.floor(state.turn / 2) + 1;
  return (
    <div
      className="match"
      onClick={(e) => {
        // Root-margin click while aiming → cancel (interactive elements stop
        // propagation, so this only fires on genuinely empty space).
        if (inTargeting && e.target === e.currentTarget) setTargeting(null);
      }}
    >
      <div className="match-topbar">
        <span className={`match-banner${myTurn ? ' match-banner--mine' : ''}`}>
          {myTurn ? 'Your turn' : currentPlayer === foe ? 'Enemy turn…' : ''} · Turn {turnNumber}
        </span>
        {inTargeting && (
          <span className="match-hint">Choose a target — click elsewhere to cancel</span>
        )}
      </div>

      <Board
        state={state}
        viewer={me}
        getCard={getCard}
        legal={legal}
        targeting={targeting}
        myTurn={myTurn}
        onSelectAttacker={onSelectAttacker}
        onTargetClick={onTargetClick}
        onHeroPower={onHeroPower}
        onEndTurn={() => submitOnce({ kind: 'endTurn' })}
        onCancel={() => setTargeting(null)}
      />

      <div className="match-handwrap">
        <Hand
          hand={meP.hand}
          getCard={getCard}
          playable={playable}
          interactive={myTurn}
          targeting={inTargeting}
          onCardClick={onHandCardClick}
        />
      </div>

      {passOverlay}
    </div>
  );
}

/** Mulligan hand: per-card keep/redraw toggles (all kept by default) + confirm. */
function MulliganHand({
  hand,
  getCard,
  onConfirm,
}: {
  hand: string[];
  getCard: (id: string) => CardSpec | undefined;
  onConfirm: (keep: number[]) => void;
}) {
  const [keep, setKeep] = useState<Set<number>>(() => new Set(hand.map((_, i) => i)));

  function toggle(i: number) {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="mulligan">
      <div className="mulligan-hand">
        {hand.map((id, i) => {
          const card = getCard(id);
          if (!card) return null;
          const kept = keep.has(i);
          return (
            <div key={`${i}-${id}`} className="mulligan-card">
              <CardView card={card} size="hand" muted={!kept} onClick={() => toggle(i)} />
              <button
                type="button"
                className={`mulligan-toggle${kept ? ' mulligan-toggle--keep' : ' mulligan-toggle--redraw'}`}
                onClick={() => toggle(i)}
              >
                {kept ? 'Keep' : 'Redraw'}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="shell-btn shell-btn-primary"
        onClick={() => onConfirm([...keep].sort((a, b) => a - b))}
      >
        Confirm — keep {keep.size}, redraw {hand.length - keep.size}
      </button>
    </div>
  );
}
