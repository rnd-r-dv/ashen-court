import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardSpec, GameEvent, Intent, PlayerIndex, TargetRef } from '@ashen/core';
import { useMatch } from '../game/useMatch.js';
import type { LanMatchDriver } from '../game/lanDriver.js';
import { useNav } from '../App.js';
import type { MatchScreenSetup } from '../types.js';
import { loadSettings, saveSettings } from '../storage.js';
import { useHotkeys } from '../hooks/useHotkeys.js';
import Board from '../components/Board.js';
import type { BoardTargeting } from '../components/Board.js';
import CardView, { FACE_DOWN_CARD } from '../components/CardView.js';
import DamagePopup from '../components/DamagePopup.js';
import type { DamageEntry } from '../components/DamagePopup.js';
import Hand from '../components/Hand.js';
import PassDevice from '../components/PassDevice.js';
import Projectile from '../components/Projectile.js';
import type { ProjectileEntry, ProjectileKind } from '../components/Projectile.js';
import TurnBanner from '../components/TurnBanner.js';
import type { TurnBannerEntry } from '../components/TurnBanner.js';
import { useAnimationQueue } from '../components/animations.js';
import { HERO_FX_ZERO } from '../components/animations.js';
import type { HeroFX } from '../components/animations.js';
import { playerVisibility } from '../game/playerVisibility.js';
import './animations.css';
import './match.css';

/** Deterministic ember-burst seeds for the win cinematic (no RNG — identical
 *  positions every replay; delays stagger the rise). */
const EMBER_SEEDS = Array.from({ length: 14 }, (_, i) => ({
  left: 6 + ((i * 37) % 86),
  drift: (i % 2 === 0 ? 1 : -1) * (16 + ((i * 13) % 42)),
  delay: (i % 5) * 0.055,
}));

/** Rejected-intent banner lifetime (I1, audit 04) — transient, then auto-dismissed. */
const ERROR_BANNER_MS = 4000;

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
 *
 * Task 40 extends the map with spell/turn/win FX: effectResolved+dealDamage
 * fires a kind-themed projectile from the caster's hand/hero to the target
 * (or an AoE ring + tint from the zone center), tokenSummoned pops a golden
 * burst, heroPowerUsed flashes the portrait glyph, turnStart sweeps a
 * TurnBanner + pulses the board, turnEnd dims, and gameOver runs a slow-mo
 * bloom + ember burst before the existing onGameOver navigation fires.
 */

export default function Match({ setup }: { setup: MatchScreenSetup }) {
  const { navigate } = useNav();
  // Fast mode (Task 39): every duration halves; Task 40's win cinematic
  // (slow-mo, bloom, embers, navigation delay) is skipped entirely.
  // Task 41: `fastMode` is live state — the F hotkey flips it mid-match
  // (persisted via storage.ts, mirroring Menu's toggle), so animScale
  // rescales every animation on the spot.
  const [fastMode, setFastMode] = useState(() => loadSettings().fastMode);
  const animScale = fastMode ? 0.5 : 1;
  const { state, events, submit, legal: hookLegal, drainEvents } = useMatch({
    driver: setup.driver,
    myPlayer: setup.myPlayer,
    bot: setup.bot,
    // Task 40: the win cinematic plays over the frozen board (~1.5s), then
    // the existing victory navigation fires. Fast mode skips the delay.
    onGameOver: (result) => {
      navTimerRef.current = setTimeout(
        () => navigate({ name: 'victory', result }),
        fastMode ? 0 : 1500,
      );
    },
    // I1 (audit 04): a rejected submit (invalid/duplicate intent — the local
    // driver's engine throws) must be visible, not a silent unhandled
    // rejection. Release the awaiting guard too: no batch or state change
    // will acknowledge a rejected intent.
    onError: (message) => {
      setAwaiting(false);
      setErrorMsg(message);
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setErrorMsg(null), ERROR_BANNER_MS);
    },
  });

  const [targeting, setTargeting] = useState<BoardTargeting | null>(null);
  const [awaiting, setAwaiting] = useState(false); // submit in flight (button re-click guard)
  // I1 (audit 04): rejected-intent banner — a transient top-center alert,
  // auto-dismissed after ERROR_BANNER_MS (or replaced by the next error).
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // Enemy row reveal (Task 39): bot mode hides the enemy's creatures behind
  // the Task 37 grayscale until their first play/summon; hotseat is
  // pass-and-play with a public board, so it starts revealed. LAN behaves like
  // bot mode (remote opponent — fog of war until first play).
  const [enemyRevealed, setEnemyRevealed] = useState<boolean>(setup.mode === 'hotseat');
  const [popups, setPopups] = useState<DamageEntry[]>([]);
  const [ripples, setRipples] = useState<{ id: number; side: 'top' | 'bottom' }[]>([]);
  const [shakeSeq, setShakeSeq] = useState(0);
  const [heroFx, setHeroFx] = useState<[HeroFX, HeroFX]>([HERO_FX_ZERO, HERO_FX_ZERO]);
  const [manaPulse, setManaPulse] = useState(0);
  const fxIdRef = useRef(0);

  // ---- Task 40: spell / turn / win animation state ----
  const [projectiles, setProjectiles] = useState<ProjectileEntry[]>([]);
  const [banners, setBanners] = useState<TurnBannerEntry[]>([]);
  const [tokenBursts, setTokenBursts] = useState<{ id: number; side: 'top' | 'bottom' }[]>([]);
  const [dims, setDims] = useState<{ id: number }[]>([]);
  const [turnPulseSeq, setTurnPulseSeq] = useState(0);
  const [powerFx, setPowerFx] = useState<[number, number]>([0, 0]);
  const [gameOverFx, setGameOverFx] = useState(0); // 0 = cinematic off; >0 = key
  // Damage targets per sourceCardId since the last effectResolved (the spell's
  // damageDealt events precede its effectResolved, so the resolution knows
  // where to aim).
  const dmgTargetsRef = useRef<Record<string, TargetRef[]>>({});
  // Creature → owner snapshot for popup sides. The state mirror refreshes at
  // batch arrival, so a creature killed in this resolution is already gone
  // from state.players[*].board when the queue processes its damageDealt —
  // creatureSideOf would fall back to 'top' even for a friendly kill. Record
  // owners from the raw event payloads as each batch arrives (before the
  // queue drains them), so popups land on the right half for dead creatures.
  const creatureOwnerRef = useRef<Map<string, PlayerIndex>>(new Map());
  useEffect(() => {
    for (const e of events) {
      if (e.type === 'cardPlayed' && e.creatureId !== undefined) {
        creatureOwnerRef.current.set(e.creatureId, e.player);
      } else if (e.type === 'creatureSummoned' || e.type === 'tokenSummoned') {
        creatureOwnerRef.current.set(e.creatureId, e.player);
      }
    }
  }, [events]);
  // Delayed popup/shake timers for spell damage (land on projectile impact);
  // cleared by skip() and on unmount.
  const pendingFxRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Win-navigation timer (cleared on unmount so rematch/menu never double-fire).
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const isBotMode = setup.mode === 'bot';
  // Hands hide only at hotseat pass points (between turns and between the two
  // mulligan phases). Bot mode never hides anything: the viewer's own hand
  // stays up during the bot's turn, exactly as in Task 31. LAN never hides:
  // the viewer always sees their own hand (the enemy hand is never rendered
  // in main phase anyway) and never sees the pass overlay.
  const hideHands = setup.mode === 'hotseat' && !visible;
  // M6 (audit 04): at game over the pass-and-play contract is over — render
  // an empty hand placeholder (not silhouettes) so the winner's hand size
  // never leaks to the other seat during the 1.5s cinematic.
  const gameOver = state.phase === 'gameOver';
  // Pass overlay: same gate as hideHands, and never in LAN. Game over
  // navigates away on the next batch, so never flash an overlay on it.
  const passVisible = hideHands && setup.mode !== 'lan' && !gameOver;

  // M4 (audit 04): keyed on the registry identity, not just the driver — a
  // LAN reconnect rebuilds the shadow (and its CardRegistry) while the driver
  // object is stable, and the memo must follow the live registry.
  const registry = setup.driver.game().registry;
  /** Resolve card ids against the engine registry (unknown ids → undefined). */
  const getCard = useMemo(() => {
    const reg = registry;
    return (id: string): CardSpec | undefined => {
      try {
        return reg.get(id);
      } catch {
        return undefined;
      }
    };
  }, [setup.driver, registry]);

  // ---- Task 39: event → animation map --------------------------------
  /** Board half an event belongs to ('top' = enemy zone, 'bottom' = mine). */
  function sideOf(player: PlayerIndex): 'top' | 'bottom' {
    return player === viewer ? 'bottom' : 'top';
  }

  /** Board side for a creature target (owner may already have left the board). */
  function creatureSideOf(id: string): 'top' | 'bottom' {
    // Prefer the ingest-time owner snapshot: a creature killed this
    // resolution is already gone from the mirror, but its cardPlayed/
    // creatureSummoned/tokenSummoned payload still names its player.
    const recorded = creatureOwnerRef.current.get(id);
    if (recorded !== undefined) return sideOf(recorded);
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

  function removeProjectile(id: number) {
    setProjectiles((prev) => prev.filter((p) => p.id !== id));
  }

  function removeBanner(id: number) {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }

  function removeTokenBurst(id: number) {
    setTokenBursts((prev) => prev.filter((t) => t.id !== id));
  }

  function removeDim(id: number) {
    setDims((prev) => prev.filter((d) => d.id !== id));
  }

  // ---- Task 40: screen-position + projectile-kind helpers ----
  // Positions are resolved against the .match root (the .match-fx overlay is
  // inset: 0 over it), so queried bounding rects are translated into fx-space.
  // Any lookup that fails (element not mounted yet, jsdom, dead creature)
  // returns null and the caller falls back — never throws.
  function pointOf(selector: string): { x: number; y: number } | null {
    const el = document.querySelector(selector);
    const host = document.querySelector('.match');
    if (!(el instanceof HTMLElement) || !(host instanceof HTMLElement)) return null;
    const a = el.getBoundingClientRect();
    const b = host.getBoundingClientRect();
    return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
  }

  const heroCircle = (player: PlayerIndex) => pointOf(`.heroportrait[data-player="${player}"] .heroportrait-circle`);
  const creatureSlot = (id: string) => pointOf(`.board-slot[data-creature-id="${id}"]`);
  const handArea = (player: PlayerIndex) => pointOf(player === viewer ? '.match-handwrap' : '.board-enemyhand');
  const zoneCenter = (side: 'top' | 'bottom') => pointOf(side === 'top' ? '.board-zone--top' : '.board-zone--bottom');

  // Last-known slot position per creatureId (M2, audit 04). The state mirror
  // refreshes at batch arrival, so a creature killed earlier in the same
  // resolution is gone from state.players[*].board — and its slot unmounted —
  // when the queue processes its damageDealt. Snapshot the slot point on
  // every state change while the creature is alive, so a spell projectile
  // lands on the last-known position instead of the foe hero (inconsistent
  // with targetSide's owner snapshot). Entries intentionally persist after
  // death: targetPoint only consults the map when the slot is already gone
  // (i.e. the creature is not on the board), so a stale entry can never
  // mis-aim a live target.
  const slotPointRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    for (const p of state.players) {
      for (const c of p.board) {
        const pt = creatureSlot(c.id);
        if (pt) slotPointRef.current.set(c.id, pt);
      }
    }
  }, [state]);

  /** Landing point for a damageDealt target (dead creature → last-known slot → foe hero). */
  function targetPoint(ref: TargetRef): { x: number; y: number } | null {
    if (ref.type === 'hero') return heroCircle(ref.player);
    return creatureSlot(ref.id) ?? slotPointRef.current.get(ref.id) ?? heroCircle(foe);
  }

  /** Board half a damageDealt target belongs to. */
  function targetSide(ref: TargetRef): 'top' | 'bottom' {
    return ref.type === 'hero' ? sideOf(ref.player) : creatureSideOf(ref.id);
  }

  /** Projectile kind from a card's art preset (spell theme). */
  function projectileKindFor(card: CardSpec): ProjectileKind {
    switch (card.art.preset) {
      case 'ember':
        return 'fireball';
      case 'frost':
      case 'storm':
        return 'frost';
      case 'shadow':
      case 'void':
      case 'curse':
      case 'bone':
        return 'shadow';
      default:
        return 'starbeam';
    }
  }

  /** Projectile kind from a hero name (hero power theme). */
  function heroKindForName(name: string): ProjectileKind {
    const n = name.toLowerCase();
    if (n.includes('ember') || n.includes('flame') || n.includes('fire')) return 'fireball';
    if (n.includes('frost') || n.includes('storm') || n.includes('wrought')) return 'frost';
    if (n.includes('shadow') || n.includes('void') || n.includes('grave') || n.includes('hex') || n.includes('choir')) {
      return 'shadow';
    }
    return 'starbeam';
  }

  /** True when damageDealt's source is a spell or the hero power (→ FX). */
  function isSpellDamage(sourceCardId: string): boolean {
    if (sourceCardId === 'hero-power') return true;
    const card = getCard(sourceCardId);
    return card?.type === 'spell';
  }

  /** True when a spell's dealDamage spec hits multiple targets (→ AoE ring). */
  function aoeFor(sourceCardId: string): boolean {
    if (sourceCardId === 'hero-power') return false; // hero powers are single-target
    const card = getCard(sourceCardId);
    if (!card) return false;
    return card.effects.some(
      (s) =>
        s.kind === 'dealDamage' &&
        (s.target === 'allEnemies' ||
          s.target === 'allEnemyCreatures' ||
          s.target === 'allFriendlyCreatures'),
    );
  }

  /** Launch a single-target projectile from the caster's hand/hero. */
  function launchProjectile(kind: ProjectileKind, from: 'hand' | 'hero', caster: PlayerIndex, ref: TargetRef) {
    const fromPt = from === 'hero' ? heroCircle(caster) : handArea(caster);
    const toPt = targetPoint(ref);
    if (!fromPt || !toPt) return;
    setProjectiles((prev) => [
      ...prev,
      { id: ++fxIdRef.current, kind, from: fromPt, to: toPt, side: targetSide(ref) },
    ]);
  }

  /** Launch an AoE ring + tint flash from the target zone's center. */
  function launchAoe(kind: ProjectileKind, side: 'top' | 'bottom') {
    const center = zoneCenter(side);
    if (!center) return;
    setProjectiles((prev) => [
      ...prev,
      { id: ++fxIdRef.current, kind, from: center, to: center, aoe: true, side },
    ]);
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
        // Tokens additionally pop a golden burst at the zone (Task 40).
        if (e.player === foe) setEnemyRevealed(true);
        setRipples((prev) => [...prev, { id: ++fxIdRef.current, side: sideOf(e.player) }]);
        if (e.type === 'tokenSummoned') {
          setTokenBursts((prev) => [...prev, { id: ++fxIdRef.current, side: sideOf(e.player) }]);
        }
        break;
      case 'damageDealt':
        // Record the target for the spell's effectResolved to aim at, then
        // popup + board shake. Spell damage lands on the projectile's impact
        // (delayed by the flight budget); attack/other damage stays immediate.
        {
          const targets = dmgTargetsRef.current[e.sourceCardId] ?? [];
          targets.push(e.target);
          if (targets.length > 8) targets.shift();
          dmgTargetsRef.current[e.sourceCardId] = targets;
          // M1 (audit 04): shield-absorbed hits emit damageDealt with amount 0
          // (core shields branch) — no popup (a '-0' float) and no board
          // shake. The target is still recorded above so a spell's projectile
          // aims at the shielded creature, not the fallback.
          if (e.amount <= 0) return;
          const side = e.target.type === 'hero' ? sideOf(e.target.player) : creatureSideOf(e.target.id);
          if (isSpellDamage(e.sourceCardId)) {
            const delayMs = (aoeFor(e.sourceCardId) ? 0.75 : 0.55) * animScale * 1000;
            const timer = setTimeout(() => {
              pendingFxRef.current.delete(timer);
              setShakeSeq((n) => n + 1);
              addPopup(e.amount, 'damage', side);
            }, delayMs);
            pendingFxRef.current.add(timer);
          } else {
            setShakeSeq((n) => n + 1);
            addPopup(e.amount, 'damage', side);
          }
        }
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
      case 'effectResolved':
        // Spell resolution (Task 40): dealDamage launches the kind-themed
        // projectile from the caster's hand/hero to the recorded target(s) —
        // or an AoE ring + tint from the zone center. The targets are
        // consumed here (damageDealt precedes effectResolved per effect).
        {
          const targets = dmgTargetsRef.current[e.sourceCardId] ?? [];
          dmgTargetsRef.current[e.sourceCardId] = [];
          if (e.kind === 'dealDamage' && isSpellDamage(e.sourceCardId)) {
            // M3 (audit 04): the old `projectileKindFor(getCard(id)!)` threw on
            // a registry miss inside handleEvent (violating the module's
            // no-crash claim). Guarded fallback, consistent with the try/catch
            // getCard design — a miss (shouldn't happen: isSpellDamage implies
            // the card resolved) becomes the default starbeam.
            const card = getCard(e.sourceCardId);
            const kind: ProjectileKind =
              e.sourceCardId === 'hero-power'
                ? heroKindForName(state.players[e.player].hero.name)
                : card
                  ? projectileKindFor(card)
                  : 'starbeam';
            if (aoeFor(e.sourceCardId)) {
              launchAoe(kind, targets.length > 0 ? targetSide(targets[0]!) : sideOf(foe));
            } else {
              const ref = targets[targets.length - 1] ?? ({ type: 'hero', player: foe } as TargetRef);
              const from = e.sourceCardId === 'hero-power' ? 'hero' : 'hand';
              launchProjectile(kind, from, e.player, ref);
            }
          }
        }
        break;
      case 'heroPowerUsed':
        // Glyph flash on the user's portrait (Task 40). The power's own
        // damage projectile already launched via its effectResolved above.
        setPowerFx((fx) =>
          fx.map((f, i) => (i === e.player ? f + 1 : f)) as [number, number],
        );
        break;
      case 'turnStart':
        // Turn banner sweep + board pulse (Task 40).
        setBanners((prev) => [
          ...prev,
          {
            id: ++fxIdRef.current,
            text: e.player === viewer ? 'Your Turn' : state.players[e.player].hero.name,
            kicker: `Turn ${Math.floor(state.turn / 2) + 1}`,
            mine: e.player === viewer,
          },
        ]);
        setTurnPulseSeq((n) => n + 1);
        break;
      case 'turnEnd':
        // Dim-out veil as the turn hands over (Task 40).
        setDims((prev) => [...prev, { id: ++fxIdRef.current }]);
        break;
      case 'gameOver':
        // Win cinematic (Task 40): slow-mo class + bloom + ember burst + a
        // title banner; the navigation timer (onGameOver) already runs and
        // hands off to the victory screen. Fast mode skips all of it.
        if (!fastMode) {
          setGameOverFx((n) => n + 1);
          setBanners((prev) => [
            ...prev,
            {
              id: ++fxIdRef.current,
              text:
                e.winner === 'draw'
                  ? 'Draw'
                  : e.winner === viewer
                    ? 'Victory'
                    : isBotMode
                      ? 'Defeat'
                      : `Player ${e.winner + 1} wins`,
              kicker: e.reason,
              mine: e.winner === viewer,
              holdMs: 900,
            },
          ]);
        }
        break;
      default:
        break; // buffApplied / frozen / spellFizzled / … — cosmetic no-ops
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
    setProjectiles([]);
    setBanners([]);
    setTokenBursts([]);
    setDims([]);
    setGameOverFx(0);
    // Cancel spell-damage popups that were delayed to the projectile impact.
    for (const t of pendingFxRef.current) clearTimeout(t);
    pendingFxRef.current.clear();
  }

  // Unmount safety: never navigate or popup after teardown (rematch/menu).
  useEffect(
    () => () => {
      if (navTimerRef.current !== null) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
      for (const t of pendingFxRef.current) clearTimeout(t);
      pendingFxRef.current.clear();
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    },
    [],
  );

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

  // A submit is acknowledged once the next event batch arrives (LAN echo /
  // local resolution tree). One edge emits no batch: the mulligan keep-all
  // (all 3 cards kept while the other player still has to mulligan — audit
  // M7) returns []. There the state-mirror change the submit caused is the
  // acknowledgement — compare the object snapshot taken at submit time.
  const awaitingStateRef = useRef(state);
  useEffect(() => {
    if (!awaiting) return;
    if (events.length > 0 || state !== awaitingStateRef.current) setAwaiting(false);
  }, [awaiting, events, state]);

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

  // Turn-start board pulse (Task 40): a fresh keyframes identity per turnStart
  // re-runs the subtle scale pop alongside any active shake.
  const pulseScale = useMemo(() => (turnPulseSeq ? [1, 1.012, 1] : 1), [turnPulseSeq]);

  function submitOnce(intent: Intent) {
    // I1 (audit 04): one submit in flight at a time. `awaiting` is set here
    // and released when the next batch arrives (or the state mirror changes
    // — the empty-batch mulligan keep-all — or the submit rejects via
    // onError). Without the guard, a double-click inside the LAN latency
    // window submits the same intent twice (the server rejects the second
    // silently), and in local modes the second submit throws inside an async
    // driver → unhandled promise rejection with zero feedback.
    if (awaiting) return;
    setAwaiting(true);
    awaitingStateRef.current = state;
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

  function toggleFastMode() {
    setFastMode((prev) => {
      const next = !prev;
      saveSettings({ fastMode: next });
      return next;
    });
  }

  // ---- Task 41: keyboard shortcuts ----
  // E/M/Space/F, wired to the same actions as the on-screen controls
  // (useHotkeys ignores events while typing in inputs and drops modifier
  // chords). E respects the End Turn button's disabled gate; Space only
  // skips while the animation queue is playing.
  useHotkeys({
    e: () => {
      if (myTurn && !inTargeting) submitOnce({ kind: 'endTurn' });
    },
    f: toggleFastMode,
    ' ': () => {
      if (playing) skipAnimations();
    },
  });

  // I3 (audit 04): LAN divergence must be visible. The driver raises a
  // resync flag when its shadow cannot apply an echoed intent; render it as a
  // persistent banner (v1 recovery: rejoin by code) instead of the silent
  // freeze the audit found. Local/hotseat drivers carry no flag — the cast
  // reads undefined and renders nothing.
  const resyncRequested = (setup.driver as LanMatchDriver).resyncRequested;
  const alerts = (
    <>
      {errorMsg !== null && (
        <div className="match-alert" role="alert">
          {errorMsg}
        </div>
      )}
      {resyncRequested && (
        <div className="match-alert match-alert--resync" role="status">
          Out of sync — rejoin by code
        </div>
      )}
    </>
  );

  // ---- mulligan phase ----
  if (state.phase === 'mulligan') {
    // The engine's mulligan actor (fixed order: player 0, then player 1,
    // tracked by mulligansDone — turn stays 0 through both). The actor sees
    // their own hand and picks keeps; anyone else waits. Hotseat shows the
    // pass overlay for the incoming player (viewer !== actor → hand hidden →
    // PassDevice for the engine actor); LAN never passes — each client's
    // viewer is their own seat, so only the actor's client renders the hand.
    const mineDone = state.mulligansDone[viewer];
    const iAmActor = viewer === actor;
    const showMulliganHand = iAmActor && !mineDone;
    return (
      <div className="match match--mulligan">
        {alerts}
        <h1 className="shell-title">Mulligan</h1>
        <p className="shell-subtitle">
          {showMulliganHand
            ? 'Keep or redraw each card — redrawn cards are replaced from your deck.'
            : 'Waiting for the other player’s mulligan…'}
        </p>
        {showMulliganHand && (
          <MulliganHand
            hand={meP.hand}
            getCard={getCard}
            onConfirm={(keep) => submitOnce({ kind: 'mulligan', keep })}
          />
        )}
        {!showMulliganHand && <p className="match-waiting">The match begins shortly…</p>}
        {passOverlay}
      </div>
    );
  }

  // ---- main phase ----
  const turnNumber = Math.floor(state.turn / 2) + 1;
  const showWinFx = gameOverFx > 0;
  return (
    <div
      className={`match${showWinFx ? ' match--gameover' : ''}`}
      style={{ '--anim-scale': animScale } as CSSProperties}
      onClick={(e) => {
        // Click anywhere while the animation queue is playing skips the rest;
        // empty-space click while aiming still cancels targeting.
        if (playing) skipAnimations();
        if (inTargeting && e.target === e.currentTarget) setTargeting(null);
      }}
    >
      {alerts}
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
        animate={{ x: shakeX, scale: pulseScale }}
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
          powerFx={powerFx}
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
        {tokenBursts.map((t) => (
          <div
            key={t.id}
            className={`token-pop token-pop--${t.side}`}
            onAnimationEnd={() => removeTokenBurst(t.id)}
          />
        ))}
        {projectiles.map((p) => (
          <Projectile key={p.id} entry={p} scale={animScale} onDone={() => removeProjectile(p.id)} />
        ))}
        {dims.map((d) => (
          <motion.div
            key={d.id}
            className="turn-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.6 * animScale, times: [0, 0.35, 1], ease: 'easeInOut' }}
            onAnimationComplete={() => removeDim(d.id)}
          />
        ))}
        {showWinFx && (
          <>
            <div className="gameover-bloom" />
            {EMBER_SEEDS.map((e, i) => (
              <div
                key={i}
                className="gameover-ember"
                style={
                  {
                    left: `${e.left}%`,
                    '--ember-drift-x': `${e.drift}px`,
                    animationDelay: `${e.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
          </>
        )}
        {banners.map((b) => (
          <TurnBanner key={b.id} entry={b} scale={animScale} onDone={() => removeBanner(b.id)} />
        ))}
      </div>

      <div className="match-handwrap">
        {hideHands ? (
          gameOver ? (
            // Empty placeholder: keeps the hand area's layout height without
            // leaking the hand size (audit M6).
            <div className="match-hand-hidden" aria-hidden="true" />
          ) : (
            handHidden
          )
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

  // Task 41: M confirms the mulligan with the current keep/redraw selection
  // (the component only mounts while the viewer is the mulligan actor, so the
  // hotkey is gated to exactly that window).
  useHotkeys({
    m: () => onConfirm([...keep].sort((a, b) => a - b)),
  });

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
        aria-keyshortcuts="m"
        onClick={() => onConfirm([...keep].sort((a, b) => a - b))}
      >
        Confirm — keep {keep.size}, redraw {hand.length - keep.size}
      </button>
    </div>
  );
}
