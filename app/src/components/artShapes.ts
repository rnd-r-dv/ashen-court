import type { ArtShape } from './artPresets.js';

/**
 * Deterministic shape generators (Task 38).
 *
 * Each generator takes a seeded PRNG (from `mulberry32(recipe.seed)`) and a
 * canvas size, and returns an array of SVG path `d` strings that CardArt
 * fills as a midground silhouette. Jitter comes exclusively from the rng —
 * the same seed always produces the identical shape, so art is stable across
 * re-renders, serialization and replays. No Math.random, no Date.now.
 *
 * Shapes are designed for `fillRule="evenodd"`: subpaths nested inside an
 * outline (eye sockets, crescent bite, shield boss) punch holes, so a single
 * accent fill reads as a real silhouette.
 */

export type Rng = () => number;
export interface Size { w: number; h: number }
export type ShapeGenerator = (rng: Rng, size: Size) => string[];

/** Tiny mulberry32 PRNG — 32-bit state, returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Small deterministic geometry helpers (no state, no randomness here)
 * ------------------------------------------------------------------ */

const rnd = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const ri = (rng: Rng, min: number, max: number) => Math.floor(rnd(rng, min, max + 1));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Closed polygon path from a list of [x, y] points. */
const poly = (pts: ReadonlyArray<readonly [number, number]>): string =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${r1(x)} ${r1(y)}`).join(' ') + ' Z';

/** Full-circle path (two arcs) centered at (x, y) with radius r. */
const circle = (x: number, y: number, r: number): string =>
  `M ${r1(x - r)} ${r1(y)} A ${r1(r)} ${r1(r)} 0 1 1 ${r1(x + r)} ${r1(y)} A ${r1(r)} ${r1(r)} 0 1 1 ${r1(x - r)} ${r1(y)} Z`;

/** Rotate a point around the origin (radians). */
const rot = (x: number, y: number, ang: number): readonly [number, number] => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
};

/** Expand a polyline into a filled ribbon of the given half-width. */
function ribbon(pts: ReadonlyArray<readonly [number, number]>, half: number): string {
  const edgeL: Array<readonly [number, number]> = [];
  const edgeR: Array<readonly [number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * half;
    const py = (dx / len) * half;
    edgeL.push([x1 + px, y1 + py]);
    edgeR.push([x1 - px, y1 - py]);
  }
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dx = last[0] - prev[0];
  const dy = last[1] - prev[1];
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * half;
  const py = (dx / len) * half;
  edgeL.push([last[0] + px, last[1] + py]);
  edgeR.push([last[0] - px, last[1] - py]);
  return poly([...edgeL, ...edgeR.reverse()]);
}

/** Rounded-cap capsule along a segment (femurs, ribs). */
const capsule = (
  x1: number, y1: number, x2: number, y2: number, r: number,
): string => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * r;
  const py = (dx / len) * r;
  return (
    `M ${r1(x1 + px)} ${r1(y1 + py)} L ${r1(x2 + px)} ${r1(y2 + py)} ` +
    `A ${r1(r)} ${r1(r)} 0 1 1 ${r1(x2 - px)} ${r1(y2 - py)} ` +
    `L ${r1(x1 - px)} ${r1(y1 - py)} ` +
    `A ${r1(r)} ${r1(r)} 0 1 1 ${r1(x1 + px)} ${r1(y1 + py)} Z`
  );
};

/* ------------------------------------------------------------------ *
 * The 12 shape generators — each (rng, size) => path d strings
 * ------------------------------------------------------------------ */

/** Flame — three licks around a jittered central tongue. */
export function flame(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const tipX = cx + rnd(rng, -16, 16);
  const tipY = 64 + rnd(rng, 0, 26);
  const lw = 30 + rnd(rng, -7, 12);
  const rw = 30 + rnd(rng, -7, 12);
  const bulgeY = 92 + rnd(rng, -14, 20);

  const outer =
    `M ${cx} 262 ` +
    `C ${r1(cx - lw * 1.3)} ${r1(172 + rnd(rng, -20, 20))}, ${r1(cx - lw * 0.75)} ${r1(bulgeY)}, ${r1(tipX - 16)} ${r1(tipY + 30)} ` +
    `L ${r1(tipX)} ${r1(tipY)} ` +
    `C ${r1(tipX + 16)} ${r1(tipY + 30)}, ${r1(cx + rw * 0.75)} ${r1(bulgeY)}, ${r1(cx + rw * 1.3)} ${r1(172 + rnd(rng, -20, 20))} ` +
    `C ${r1(cx + rw * 0.6)} ${r1(226 + rnd(rng, -15, 15))}, ${r1(cx + lw * 0.4)} ${r1(246 + rnd(rng, -10, 10))}, ${cx} 262 Z`;

  const lick = (off: number): string => {
    const t = 158 + rnd(rng, -16, 16);
    const t2 = t + rnd(rng, -8, 10);
    return (
      `M ${r1(cx + off)} 262 ` +
      `C ${r1(cx + off - 17)} ${r1(226 + rnd(rng, -10, 10))}, ${r1(cx + off - 15)} ${r1(196 + rnd(rng, -10, 10))}, ${r1(cx + off - 7)} ${r1(t)} ` +
      `L ${r1(cx + off + 4)} ${r1(t2)} ` +
      `C ${r1(cx + off + 13)} ${r1(194 + rnd(rng, -10, 10))}, ${r1(cx + off + 13)} ${r1(228 + rnd(rng, -10, 10))}, ${r1(cx + off + 6)} 262 Z`
    );
  };

  return [outer, lick(-26), lick(26)];
}

/** Ice — a rooted crystal cluster: one tall shard plus four angled ones. */
export function ice(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const baseY = 252;
  const paths: string[] = [];

  const shard = (ang: number, len: number, w: number): string => {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = -dy * w;
    const py = dx * w;
    const bx = cx + dx * 26;
    const by = baseY + dy * 26;
    // jagged tip: pull the tip slightly off-axis and shorten it a bit
    const tx = bx + dx * len + px * rnd(rng, -1.8, 1.8);
    const ty = by + dy * len + py * rnd(rng, -1.8, 1.8);
    return poly([[bx + px, by + py], [tx, ty], [bx - px, by - py]]);
  };

  paths.push(shard(-Math.PI / 2, 150 + rnd(rng, -14, 20), 11 + rnd(rng, -2, 3)));
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const ang = -Math.PI / 2 + side * rnd(rng, 0.35, 0.85);
    paths.push(shard(ang, 88 + rnd(rng, -10, 30), 7 + rnd(rng, -1.5, 3)));
  }
  // two small facet flakes near the base
  for (let i = 0; i < 2; i++) {
    const fx = cx + rnd(rng, -30, 30);
    const fy = baseY - rnd(rng, 14, 34);
    paths.push(poly([[fx - 7, fy], [fx, fy - 11], [fx + 7, fy], [fx, fy + 5]]));
  }
  return paths;
}

/** Skull — cranium + jaw outline with eye-socket / nose holes (evenodd). */
export function skull(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const cw = 40 + rnd(rng, -4, 5);      // cranium half-width
  const ch = 34 + rnd(rng, -4, 5);      // cranium half-height
  const topY = 104 + rnd(rng, -7, 7);   // cranium top
  const jawY = topY + 2 * ch - 6 + rnd(rng, -4, 4);
  const jawH = 58 + rnd(rng, -6, 8);

  const d =
    `M ${r1(cx - cw)} ${r1(topY + ch * 0.4)} ` +
    `A ${r1(cw)} ${r1(ch)} 0 1 1 ${r1(cx + cw)} ${r1(topY + ch * 0.4)} ` +
    `A ${r1(cw)} ${r1(ch)} 0 1 1 ${r1(cx - cw)} ${r1(topY + ch * 0.4)} Z ` +
    `M ${r1(cx - cw * 0.86)} ${r1(jawY)} L ${r1(cx + cw * 0.86)} ${r1(jawY)} ` +
    `L ${r1(cx + cw * 0.72)} ${r1(jawY + jawH)} ` +
    `C ${r1(cx + cw * 0.55)} ${r1(jawY + jawH + 15 + rnd(rng, -5, 5))}, ${r1(cx - cw * 0.55)} ${r1(jawY + jawH + 15 + rnd(rng, -5, 5))}, ${r1(cx - cw * 0.72)} ${r1(jawY + jawH)} Z ` +
    circle(cx - 15 + rnd(rng, -3, 3), topY + ch + 12 + rnd(rng, -4, 4), 8.5 + rnd(rng, -1.5, 2)) + ' ' +
    circle(cx + 15 + rnd(rng, -3, 3), topY + ch + 12 + rnd(rng, -4, 4), 8.5 + rnd(rng, -1.5, 2)) + ' ' +
    `M ${r1(cx - 5)} ${r1(topY + ch * 2 - 8)} L ${r1(cx + 5)} ${r1(topY + ch * 2 - 8)} L ${r1(cx)} ${r1(topY + ch * 2 + 4 + rnd(rng, -3, 3))} Z ` +
    `M ${r1(cx - 8)} ${r1(jawY + 14)} L ${r1(cx - 6)} ${r1(jawY + 14)} L ${r1(cx - 6)} ${r1(jawY + 30 + rnd(rng, -4, 6))} L ${r1(cx - 8)} ${r1(jawY + 30 + rnd(rng, -4, 6))} Z ` +
    `M ${r1(cx + 6)} ${r1(jawY + 14)} L ${r1(cx + 8)} ${r1(jawY + 14)} L ${r1(cx + 8)} ${r1(jawY + 30 + rnd(rng, -4, 6))} L ${r1(cx + 6)} ${r1(jawY + 30 + rnd(rng, -4, 6))} Z`;
  return [d];
}

/** Leaf — a cluster of 3–4 teardrop leaves fanning from a shared base. */
export function leaf(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const baseY = 240 + rnd(rng, -14, 14);
  const paths: string[] = [];

  for (let i = 0; i < ri(rng, 3, 4); i++) {
    const ang = -Math.PI / 2 + rnd(rng, -0.72, 0.72);
    const len = rnd(rng, 118, 162);
    const bw = 15 + rnd(rng, 0, 9);
    const local: Array<readonly [number, number]> = [
      [0, 0],
      [-bw, -len * 0.36],
      [-bw, -len * 0.78],
      [0, -len],
      [bw, -len * 0.78],
      [bw, -len * 0.36],
    ];
    const pts = local.map(([x, y]) => {
      const [rx, ry] = rot(x, y, ang);
      return [rx + cx, ry + baseY] as const;
    });
    paths.push(
      `M ${r1(pts[0]![0])} ${r1(pts[0]![1])} ` +
      `C ${r1(pts[1]![0])} ${r1(pts[1]![1])}, ${r1(pts[2]![0])} ${r1(pts[2]![1])}, ${r1(pts[3]![0])} ${r1(pts[3]![1])} ` +
      `C ${r1(pts[4]![0])} ${r1(pts[4]![1])}, ${r1(pts[5]![0])} ${r1(pts[5]![1])}, ${r1(pts[0]![0])} ${r1(pts[0]![1])} Z`,
    );
  }
  return paths;
}

/** Four-point sparkle (diamond) — used by the starfield and as accents. */
function sparkle(x: number, y: number, r: number, ang = 0): string {
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a = ang + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.36;
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
  }
  return poly(pts);
}

/** Star — a seeded starfield: many small diamonds plus two bright sparkles. */
export function star(rng: Rng, size: Size): string[] {
  const paths: string[] = [];
  for (let i = 0; i < ri(rng, 10, 16); i++) {
    const x = rnd(rng, 26, size.w - 26);
    const y = rnd(rng, 42, 238);
    paths.push(sparkle(x, y, rnd(rng, 1.6, 4.4), rnd(rng, 0, Math.PI)));
  }
  for (let i = 0; i < 2; i++) {
    const x = rnd(rng, 42, size.w - 42);
    const y = rnd(rng, 56, 200);
    paths.push(sparkle(x, y, rnd(rng, 5.5, 8), rnd(rng, 0, Math.PI / 2)));
  }
  return paths;
}

/** Storm — two or three forked lightning bolts as filled ribbons. */
export function storm(rng: Rng, size: Size): string[] {
  const paths: string[] = [];
  const bolts = ri(rng, 2, 3);
  for (let i = 0; i < bolts; i++) {
    const x0 = rnd(rng, 55, size.w - 55);
    const y0 = 52 + rnd(rng, 0, 26);
    const xE = rnd(rng, 45, size.w - 45);
    const yE = 238 + rnd(rng, 0, 40);
    const segs = ri(rng, 3, 5);
    const pts: Array<readonly [number, number]> = [[x0, y0]];
    for (let s = 0; s < segs; s++) {
      const nx = pts[s]![0] + (xE - x0) / segs + rnd(rng, -34, 34);
      const ny = pts[s]![1] + (yE - y0) / segs + rnd(rng, -12, 18);
      pts.push([nx, ny]);
    }
    pts.push([xE, yE]);
    paths.push(ribbon(pts, rnd(rng, 2.6, 4.2)));
    if (i === bolts - 1) {
      const src = pts[ri(rng, 1, pts.length - 2)]!;
      paths.push(ribbon([src, [src[0] + rnd(rng, -32, 32), src[1] + rnd(rng, 14, 36)]], rnd(rng, 1.6, 2.4)));
    }
  }
  return paths;
}

/** Gem — a faceted crown-and-pavilion diamond. */
export function gem(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const topY = 62 + rnd(rng, -8, 8);
  const botY = 282 + rnd(rng, -10, 10);
  const girdleY = 164 + rnd(rng, -10, 10);
  const hw = 58 + rnd(rng, -8, 8);

  const outer = poly([[cx, topY], [cx + hw, girdleY], [cx, botY], [cx - hw, girdleY]]);
  const inner = poly([
    [cx + rnd(rng, -7, 7), girdleY - 54 - rnd(rng, 0, 8)],
    [cx + rnd(rng, -7, 7), girdleY - 14],
    [cx + rnd(rng, -7, 7), girdleY + 66 + rnd(rng, 0, 8)],
    [cx + rnd(rng, -7, 7), girdleY + 12],
  ]);
  const band = poly([
    [cx - hw * 0.5, girdleY - 4], [cx + hw * 0.5, girdleY - 4],
    [cx + hw * 0.5, girdleY + 4], [cx - hw * 0.5, girdleY + 4],
  ]);
  return [outer, inner, band];
}

/** Bone — a pile of crossed femurs and curved ribs. */
export function bone(rng: Rng, size: Size): string[] {
  const paths: string[] = [];
  const thick = 8 + rnd(rng, -1, 3);

  paths.push(capsule(84 + rnd(rng, -8, 8), 148 + rnd(rng, -8, 8), 166 + rnd(rng, -8, 8), 258 + rnd(rng, -8, 8), thick));
  paths.push(capsule(166 + rnd(rng, -8, 8), 148 + rnd(rng, -8, 8), 84 + rnd(rng, -8, 8), 258 + rnd(rng, -8, 8), thick));
  paths.push(capsule(102 + rnd(rng, -6, 6), 282 + rnd(rng, -8, 6), 152 + rnd(rng, -6, 6), 282 + rnd(rng, -8, 6), thick - 2));
  paths.push(capsule(112 + rnd(rng, -6, 6), 132 + rnd(rng, -6, 6), 146 + rnd(rng, -6, 6), 116 + rnd(rng, -6, 6), thick - 3));

  for (let i = 0; i < 2; i++) {
    const x = 88 + rnd(rng, 0, 40);
    const y = 186 + rnd(rng, -20, 30);
    paths.push(ribbon([[x, y], [x + 14 + rnd(rng, -4, 6), y + 34], [x - 10 + rnd(rng, -6, 4), y + 52 + rnd(rng, -4, 6)]], 5));
  }
  return paths;
}

/** Moon — a crescent (bite circle punched out via evenodd) plus a star. */
export function moon(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const cy = 172 + rnd(rng, -16, 16);
  const r = 62 + rnd(rng, -8, 10);
  const biteX = r * 0.52 + rnd(rng, -4, 6);
  const biteY = rnd(rng, -10, 10);

  const d =
    circle(cx, cy, r) + ' ' +
    circle(cx + biteX, cy + biteY, r * 0.9);
  const starX = cx - r - 34 + rnd(rng, -6, 6);
  const starY = cy - r * 0.7 + rnd(rng, -10, 10);
  return [d, sparkle(starX, starY, 4 + rnd(rng, 0, 2), rnd(rng, 0, Math.PI / 2))];
}

/** Eye — almond ring, iris annulus and pupil dot, all evenodd holes. */
export function eye(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const ey = 176 + rnd(rng, -14, 14);
  const wd = 66 + rnd(rng, -8, 8);
  const ht = 27 + rnd(rng, -6, 6);
  const irisR = 15 + rnd(rng, -3, 3);
  const pupR = 6 + rnd(rng, -1.5, 1.5);
  const ix = cx + rnd(rng, -6, 6);
  const iy = ey + rnd(rng, -5, 5);

  const almond = (x: number, y: number, w: number, h: number): string =>
    `M ${r1(x - w)} ${r1(y)} ` +
    `C ${r1(x - w * 0.42)} ${r1(y - h)}, ${r1(x + w * 0.42)} ${r1(y - h)}, ${r1(x + w)} ${r1(y)} ` +
    `C ${r1(x + w * 0.42)} ${r1(y + h)}, ${r1(x - w * 0.42)} ${r1(y + h)}, ${r1(x - w)} ${r1(y)} Z`;

  const outer = almond(cx, ey, wd, ht) + ' ' + circle(ix, iy, irisR + 2.5);
  const irisRing = circle(ix, iy, irisR) + ' ' + circle(ix, iy, pupR);
  const pupil = circle(ix + rnd(rng, -1.5, 1.5), iy + rnd(rng, -1.5, 1.5), Math.max(1.5, pupR - 1));
  return [outer, irisRing, pupil];
}

/** Shield — kiteshield outline with boss and rivet holes. */
export function shield(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const wd = 46 + rnd(rng, -6, 8);
  const y0 = 60 + rnd(rng, -6, 6);
  const ptY = 274 + rnd(rng, -10, 12);
  const bulge = 10 + rnd(rng, -4, 6);

  const d =
    `M ${r1(cx - wd)} ${r1(y0)} ` +
    `Q ${r1(cx)} ${r1(y0 - bulge)}, ${r1(cx + wd)} ${r1(y0)} ` +
    `C ${r1(cx + wd * 1.05)} ${r1(y0 + 58 + rnd(rng, -8, 8))}, ${r1(cx + wd * 0.82)} ${r1(y0 + 118 + rnd(rng, -10, 10))}, ${r1(cx)} ${r1(ptY)} ` +
    `C ${r1(cx - wd * 0.82)} ${r1(y0 + 118 + rnd(rng, -10, 10))}, ${r1(cx - wd * 1.05)} ${r1(y0 + 58 + rnd(rng, -8, 8))}, ${r1(cx - wd)} ${r1(y0)} Z ` +
    circle(cx + rnd(rng, -3, 3), y0 + 92 + rnd(rng, -6, 8), 15 + rnd(rng, -2, 3)) + ' ' +
    circle(cx - wd * 0.62 + rnd(rng, -2, 2), y0 + 30, 2.6) + ' ' +
    circle(cx + wd * 0.62 + rnd(rng, -2, 2), y0 + 30, 2.6);
  return [d];
}

/** Sword — two blades crossed at a seeded crossing point. */
export function sword(rng: Rng, size: Size): string[] {
  const cx = size.w / 2;
  const px = cx + rnd(rng, -8, 8);
  const py = 196 + rnd(rng, -12, 12);

  const swordAt = (ang: number): string[] => {
    const t = (pts: ReadonlyArray<readonly [number, number]>): string =>
      poly(pts.map(([x, y]) => {
        const [rx, ry] = rot(x, y, ang);
        return [rx + px, ry + py] as const;
      }));
    const [bx, by] = rot(0, 38, ang);
    return [
      t([[0, -98], [5.5, -14], [8, 8], [-8, 8], [-5.5, -14]]),
      t([[-24, -6], [24, -6], [22, 5], [-22, 5]]),
      t([[-3.2, 8], [3.2, 8], [2.8, 32], [-2.8, 32]]),
      circle(bx + px, by + py, 7),
    ];
  };

  return [...swordAt(rnd(rng, -0.72, -0.52)), ...swordAt(rnd(rng, 0.52, 0.72))];
}

/** Record of all 12 generators, keyed by ArtShape. */
export const SHAPE_GENERATORS: Record<ArtShape, ShapeGenerator> = {
  flame, ice, skull, leaf, star, storm, gem, bone, moon, eye, shield, sword,
};

/** Resolve a shape to its seeded path strings (CardArt's single entry point). */
export function shapePaths(shape: ArtShape, rng: Rng, size: Size): string[] {
  return SHAPE_GENERATORS[shape](rng, size);
}
