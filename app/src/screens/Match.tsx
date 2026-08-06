import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardSpec, GameEvent, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import { useMatch } from '../game/useMatch.js';
import { useNav } from '../App.js';
import type { MatchScreenSetup } from '../types.js';
import { loadSettings } from '../storage.js';
import Board from '../components/Board.js';
import type { BoardTargeting } from '../components/Board.js';
import CardView, { FACE_DOWN_CARD } from '../components/CardView.js';
import DamagePopup from '../components/DamagePopup.js';
import type { DamageEntry } from '../components/DamagePopup.js';
import Hand from '../components/Hand.js';
import PassDevice from '../components/PassDevice.js';
import { useAnimationQueue } from '../components/animations.js';
import { HERO_FX_ZERO } from '../components/animations.js';
import type { HeroFX } from '../components/animations.js';
import { playerVisibility } from '../game/playerVisibility.js';
import './animations.css';
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
 * Event queue (Task 39): useAnimationQueue consumes useMatch's events one at a
 * time and fires the event → animation map (draw slide, play slam + ripple,
 * damage popup + board shake, death dissolve, hero flash/HP tick, heal glow,
 * mana pop); the first enemy play/summon reveals the enemy row. Clicking
 * anywhere during the queue (or the Skip button) drains the rest instantly.
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

  // ---- Task 39: animation state -------------------------------
  // animScale halves every duration in fast mode (0.5) — framer variants get
  // the scale directly, CSS animations read the --anim-scale property set on
  // the .match root. Transient FX below are keyed/self-removing, so skip()
  // simply drops the events that have not played yet.
  const [animScale] = useState(() => (loadSettings().fastMode ? 0.5 : 1));
  // Enemy row reveal (Task 39): bot mode hides the enemy's creatures behind
  // the Task 37 grayscale until their first play/summon; hotseat is
  // pass-and-play with a public board, so it starts revealed.
  const [enemyRevealed, setEnemyRevealed] = useState<boolean>(setup.bot === undefined);
  const [popups, setPopups] = useState<DamageEntry[]>([]);
  const [ripples, setRipples] = useState<{ id: number; side: 'top' | 'bottom' }[]>([]);
  const [shakeSeq, setShakeSeq] = useState(0);
  const [heroFx, setHeroFx] = useState<[HeroFX, HeroFX]>([HERO_FX_ZERO, HERO_FX_ZERO]);
  const [manaPulse, setManaPulse] = useState(0);
  const fxIdRef = useRef(0);

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

  // ---- Task 39: event → animation map --------------------------------
  /** Board half an event belongs to ('top' = enemy zone, 'bottom' = mine). */
  function sideOf(player: PlayerIndex): 'top' | 'bottom' {
    return player === viewer ? 'bottom' : 'top';
  }

  /** Board side for a creature target (owner may already have left the board). */
  function creatureSideOf(id: string): 'top' | 'bottom' {
    const owner = state.players[0].board.some((c) => c.id === id)
      ? 0
      : state.players[1].board.some((c) => c.id === id)
        ? 1
        : null;
    return owner === null ? sideOf(foe) : sideOf(owner);
  }

  function addPopup(amount: number, kind: 'damage' | 'heal', side: 'top' | 'bottom') {
    setPopups((prev) => [...prev, { id: ++fxIdRef.current, amount, kind, side }]);
  }

  function removePopup(id: number) {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }

  function removeRipple(id: number) {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }

  /**
   * One queued event → the matching board animation. The state mirror already
   * reflects every event (useMatch updates state immediately), so this only
   * fires cosmetics; skip() drops the events that have not played yet.
   */
  function handleEvent(e: GameEvent) {
    switch (e.type) {
      case 'cardDrawn':
      case 'cardDrawnExtra':
        // New hand cards animate on mount via Hand's handEnter.
        break;
      case 'cardPlayed':
      case 'creatureSummoned':
      case 'tokenSummoned':
        // Slam (creature slot mount) + ripple at the played zone; the first
        // enemy play/summon reveals the enemy row (Task 37 grayscale lifted).
        if (e.player === foe) setEnemyRevealed(true);
        setRipples((prev) => [...prev, { id: ++fxIdRef.current, side: sideOf(e.player) }]);
        break;
      case 'damageDealt':
        // Damage popup + board shake; heroDamage additionally flashes the
        // portrait via its own event below.
        setShakeSeq((n) => n + 1);
        addPopup(
          e.amount,
          'damage',
          e.target.type === 'hero' ? sideOf(e.target.player) : creatureSideOf(e.target.id),
        );
        break;
      case 'heroDamaged':
        // Portrait flash + HP bar/number tick-down (HeroPortrait tween).
        setHeroFx((fx) =>
          fx.map((f, i) =>
            i === e.player ? { ...f, flash: f.flash + 1, kind: 'flash' as const } : f,
          ) as [HeroFX, HeroFX],
        );
        break;
      case 'heroHealed':
        // Green glow on the portrait + green heal popup.
        setHeroFx((fx) =>
          fx.map((f, i) =>
            i === e.player ? { ...f, heal: f.heal + 1, kind: 'heal' as const } : f,
          ) as [HeroFX, HeroFX],
        );
        addPopup(e.amount, 'heal', sideOf(e.player));
        break;
      case 'manaChanged':
        // Crystal tray pop (ManaTray replays on the new pulse counter).
        setManaPulse((n) => n + 1);
        break;
      default:
        break; // turnStart / turnEnd / buffApplied / … — Task 40 wires the rest
    }
  }

  // The animation queue consumes useMatch's event batches one per tick
  // (~180ms), drains useMatch's queue so it stays bounded, and exposes skip().
  const { skip, playing } = useAnimationQueue(events, {
    onEvent: handleEvent,
    drain: drainEvents,
    scale: animScale,
  });

  function skipAnimations() {
    skip();
    setPopups([]);
    setRipples([]);
  }

  // Enemy row reveal (Task 39): the first enemy play/summon lifts the Task 37
  // grayscale. Eager over the raw event stream (not the animation queue) so a
  // skip() can never leave the enemy row hidden.
  useEffect(() => {
    if (enemyRevealed) return;
    const revealed = events.some(
      (e) =>
        (e.type === 'cardPlayed' || e.type === 'creatureSummoned' || e.type === 'tokenSummoned') &&
        e.player === foe,
    );
    if (revealed) setEnemyRevealed(true);
  }, [events, enemyRevealed, foe]);

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

  // Board shake: a new keyframes array identity per damageDealt re-runs the
  // framer timeline; memoizing keeps unrelated re-renders from re-triggering.
  const shakeX = useMemo(() => (shakeSeq ? [0, -7, 7, -5, 5, -2, 0] : 0), [shakeSeq]);

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
      style={{ '--anim-scale': animScale } as CSSProperties}
      onClick={(e) => {
        // Click anywhere while the animation queue is playing skips the rest;
        // empty-space click while aiming still cancels targeting.
        if (playing) skipAnimations();
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
        {playing && (
          <button type="button" className="shell-btn match-skip" onClick={skipAnimations}>
            Skip
          </button>
        )}
      </div>

      <motion.div
        className="match-boardwrap"
        animate={{ x: shakeX }}
        transition={{ duration: 0.45 * animScale, ease: 'easeOut' }}
      >
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
          enemyRevealed={enemyRevealed}
          animScale={animScale}
          heroFx={heroFx}
          manaPulse={manaPulse}
        />
      </motion.div>

      <div className="match-fx" aria-hidden="true">
        {popups.map((p) => (
          <DamagePopup key={p.id} entry={p} scale={animScale} onDone={() => removePopup(p.id)} />
        ))}
        {ripples.map((r) => (
          <div
            key={r.id}
            className={`slam-ripple slam-ripple--${r.side}`}
            onAnimationEnd={() => removeRipple(r.id)}
          />
        ))}
      </div>

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
