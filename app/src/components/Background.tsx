// Ambient background layer (Task 36). Fixed behind every screen: two drifting
// fog banks (CSS-animated radial gradients), a canvas of floating embers, and
// a vignette. Cosmetic only — pointer-events are disabled and the ember
// animation uses Math.random (ambient FX, not engine simulation, so
// determinism is not required). The animation is skipped entirely under
// prefers-reduced-motion, leaving a single quiet frame of static embers.
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
      ctx.globalCompositeOperation = 'lighter'; // additive glow on overlap
      // Scatter embers across the visible area on first sizing.
      for (const e of embers) {
        e.x = Math.random() * width;
        e.y = Math.random() * height;
      }
    }

    const drawEmber = (x: number, y: number, r: number, alpha: number) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, `rgba(255, 180, 84, ${alpha})`);
      glow.addColorStop(0.35, `rgba(255, 140, 60, ${alpha * 0.45})`);
      glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.fillStyle = `rgba(255, 224, 170, ${Math.min(1, alpha + 0.15)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
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
        drawEmber(x, e.y, e.size, 0.15 + 0.55 * flicker);
      }
      rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      // Static embers only — no animation loop.
      for (const e of embers) {
        drawEmber(e.x, e.y, e.size, 0.3);
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
      <div className="bg-fog bg-fog-a" />
      <div className="bg-fog bg-fog-b" />
      <canvas ref={canvasRef} className="bg-embers" />
      <div className="bg-vignette" />
    </div>
  );
}
