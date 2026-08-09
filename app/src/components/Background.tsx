// Ambient background layer (Task 36 -> Task 9). Fixed behind every screen:
// two drifting flat house-field washes (background.css) and a canvas of flat
// ember flecks — the old fog radial gradients, the ember glow and the
// vignette are gone (the Armorial world has no gradients or soft glows).
// Cosmetic only — pointer-events are disabled and the ember animation uses
// Math.random (ambient FX, not engine simulation, so determinism is not
// required). The animation is skipped entirely under prefers-reduced-motion,
// leaving a single quiet frame of static flecks.
import { useEffect, useRef } from 'react';
import './background.css';

const EMBER_COUNT = 60;

interface Ember {
  x: number;       // horizontal position (px)
  y: number;       // vertical position (px, 0 = top)
  size: number;    // core radius (px)
  speed: number;   // upward drift (px/s)
  sway: number;    // horizontal sway amplitude (px)
  swaySpeed: number; // sway oscillation rate
  phase: number;   // per-ember phase offset
  flicker: number; // alpha flicker rate
}

/** Flat cream flecks — solid discs, no radial-gradient glow, no additive
 *  compositing. The colour is the engraved hairline's cream at varying
 *  alpha, so the flecks read as ink specks on the page, not torch light. */
function drawEmber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
) {
  ctx.fillStyle = `rgba(232, 224, 206, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let lastTime = performance.now();

    const embers: Ember[] = Array.from({ length: EMBER_COUNT }, () => ({
      x: 0,
      y: 0,
      size: 0.8 + Math.random() * 1.9,
      speed: 6 + Math.random() * 16,
      sway: 8 + Math.random() * 22,
      swaySpeed: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      flicker: 1.5 + Math.random() * 3,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Scatter flecks across the visible area on first sizing.
      for (const e of embers) {
        e.x = Math.random() * width;
        e.y = Math.random() * height;
      }
    }

    const frame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // clamp tab-switch gaps
      lastTime = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);
      for (const e of embers) {
        e.y -= e.speed * dt; // slow upward drift
        if (e.y < -6) {
          // Respawn at the bottom, fresh horizontal position.
          e.y = height + 6;
          e.x = Math.random() * width;
        }
        const x = e.x + Math.sin(t * e.swaySpeed + e.phase) * e.sway;
        const flicker = 0.5 + 0.5 * Math.sin(t * e.flicker + e.phase);
        drawEmber(ctx, x, e.y, e.size, 0.1 + 0.35 * flicker);
      }
      rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      // Static flecks only — no animation loop.
      for (const e of embers) {
        drawEmber(ctx, e.x, e.y, e.size, 0.25);
      }
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="bg-layer" aria-hidden="true">
      <div className="bg-wash bg-wash--coven" />
      <div className="bg-wash bg-wash--house-ember" />
      <canvas ref={canvasRef} className="bg-embers" />
    </div>
  );
}
