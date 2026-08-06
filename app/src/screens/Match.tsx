import { useEffect, useMemo, useState } from 'react';
import type { Card as CardSpec, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import { useMatch } from '../game/useMatch.js';
import { useNav } from '../App.js';
import type { MatchScreenSetup } from '../types.js';
import Board from '../components/Board.js';
import type { BoardTargeting } from '../components/Board.js';
import CardView, { FACE_DOWN_CARD } from '../components/CardView.js';
import Hand from '../components/Hand.js';
import PassDevice from '../components/PassDevice.js';
import { playerVisibility } from '../game/playerVisibility.js';
import './match.css';

/**
 * Match (Task 31, hotseat flow Task 32): the board screen. Wires useMatch
 * (Task 30) with the driver from App's match entry (bot mode auto-plays the
 * opponent). Hotseat pass-and-play: the screen tracks a `viewer` (whoever
 * holds the device), shows a pass overlay between turns (and between the two
 * mulligans) while the incoming player's hand stays face-down, and flips the
 * viewer on confirm. Owns the interaction state machine on top of `legal`:
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
  const { state, events, submit, legal: hookLegal, drainEvents } = useMatch({
    driver: setup.driver,
    myPlayer: setup.myPlayer,
    bot: setup.bot,
    onGameOver: (result) => navigate({ name: 'victory', result }),
  });

  const [targeting, setTargeting] = useState<BoardTargeting | null>(null);
  const [awaiting, setAwaiting] = useState(false); // submit in flight (button re-click guard)

  // Hotseat pass-and-play (Task 32): the viewer is whoever currently holds
  // the device — starts as the first pick (player 0) and alternates as the
  // pass overlay is confirmed. Bot mode never passes, so the viewer stays
  // the single human. Hands render face-down until the incoming player
  // confirms — the visibility contract lives in playerVisibility.
  const [viewer, setViewer] = useState<PlayerIndex>(setup.myPlayer);

  const me = viewer;
  const foe = (1 - viewer) as PlayerIndex;
  const meP = state.players[viewer];
  const currentPlayer = (state.turn % 2) as PlayerIndex;
  // The engine's acting player: current player in main, mulligan actor during
  // mulligan (turn stays 0 through both mulligans — see playerVisibility).
  const actor: PlayerIndex =
    state.phase === 'mulligan' ? ((state.mulligansDone[0] ? 1 : 0) as PlayerIndex) : currentPlayer;
  const visible = playerVisibility(state, viewer);
  const myTurn = state.phase === 'main' && currentPlayer === viewer;
  const inTargeting = targeting !== null;
  const isBotMode = setup.bot !== undefined;
  // Hotseat hands hide only at pass points (between turns and between the two
  // mulligan phases). Bot mode never hides anything: the viewer's own hand
  // stays up during the bot's turn, exactly as in Task 31.
  const hideHands = !isBotMode && !visible;
  // Pass overlay: same gate as hideHands. Game over navigates away on the
  // next batch, so never flash an overlay on it.
  const passVisible = hideHands && state.phase !== 'gameOver';

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

  // Legal intents for the current acting player. Bot mode: useMatch computes
  // them for the single human (myPlayer). Hotseat: both humans submit through
  // the same driver, so the acting player is whoever's turn it is — read them
  // straight from the engine (legalIntents returns [] unless it is genuinely
  // that player's main turn).
  const legal = useMemo<Intent[]>(() => {
    if (isBotMode) return hookLegal;
    return setup.driver.game().legalIntents(viewer);
  }, [isBotMode, hookLegal, setup.driver, viewer, state]);

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

  // Pass point: the incoming player's hand sits face-down until they confirm
  // the overlay — only its size is visible (the same info the board's
  // enemy-hand silhouettes already show).
  const handHidden = (
    <div
      className="match-hand-hidden"
      aria-label={`Hand hidden — pass the device (${state.players[actor].hand.length} cards)`}
    >
      {state.players[actor].hand.map((id, i) => (
        <CardView key={`${id}-${i}`} card={FACE_DOWN_CARD} size="hand" faceDown />
      ))}
    </div>
  );

  const passOverlay = passVisible ? (
    <PassDevice player={actor} onConfirm={() => setViewer(actor)} />
  ) : null;

  // ---- mulligan phase ----
  if (state.phase === 'mulligan') {
    // The mulligan actor sees their own hand and picks keeps; the other
    // player sees the pass overlay (their hand stays hidden) until they take
    // the device. Engine order is fixed: player 0 mulligans, then player 1.
    const mineDone = state.mulligansDone[viewer];
    return (
      <div className="match match--mulligan">
        <h1 className="shell-title">Mulligan</h1>
        <p className="shell-subtitle">
          {mineDone
            ? 'Waiting for the other player’s mulligan…'
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
        {hideHands ? (
          handHidden
        ) : (
          <Hand
            hand={meP.hand}
            getCard={getCard}
            playable={playable}
            interactive={myTurn}
            targeting={inTargeting}
            onCardClick={onHandCardClick}
          />
        )}
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
