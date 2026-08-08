// scripts/art/generate.ts
import { mkdir, writeFile, access, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { buildPool, DECK_DEFS, HEROES } from '@ashen/core';
import { inCoverage, parseCoverage, type Coverage } from './coverage.js';
import { DEFAULT_MODEL, generateImage, RateLimitedError } from './openrouter.js';
import type { GenerateResult } from './openrouter.js';
import { cardArtPath, heroArtPath } from './paths.js';
import { buildCardPrompt, buildHeroPrompt, type BuiltPrompt } from './prompt.js';

/**
 * Offline art generation CLI. Run from the repo root:
 *
 *   npm run art:generate -- --dry-run
 *   npm run art:generate -- --commit --force a --force b --force c   # Stage 0 cards
 *   npm run art:generate -- --commit --no-cards --only choir         # Stage 0 hero
 *   npm run art:generate -- --commit --coverage epic+
 *   npm run art:generate -- --commit --model black-forest-labs/flux.2-klein-4b:free
 *
 * DEFAULTS TO --dry-run and to the FREE model variant. Both a real request and
 * a paid model require an explicit flag.
 *
 * Free tier is capped at 20 requests/minute and 50/day (1000/day once $10 of
 * credits has ever been purchased). Requests are spaced automatically, so a
 * full 297-image pass takes ~16 minutes on the 1000/day tier. A daily-cap 429
 * stops the run cleanly — re-running the same command later resumes, because
 * anything already written is skipped.
 */

/** Written size per aspect — derived from what the UI renders at 2x DPR. */
const TARGET_SIZE: Record<string, { width: number; height: number }> = {
  '3:2': { width: 480, height: 320 },   // banded card panel, 220x147 CSS
  '3:4': { width: 528, height: 704 },   // full-bleed card,    240x336 CSS
  '1:1': { width: 256, height: 256 },   // hero circle,         92x92  CSS
};

/**
 * Free-tier limit is 20 requests/minute, so requests are spaced at least this
 * far apart. 3.2s leaves headroom against clock skew and request duration.
 * Paid variants have no such cap, so they are not paced at all — see
 * requestSpacingMs.
 */
const MIN_REQUEST_SPACING_MS = 3200;

/**
 * How long to wait between image requests. Only the free `:free` variants are
 * rate-capped (20/min); a paid model has no per-minute cap, so pacing a paid
 * run would stretch a 78-image epic+ batch out for no reason. A 429 on a paid
 * model still recovers via generateImage's retry-with-backoff.
 */
export function requestSpacingMs(model: string): number {
  return model.endsWith(':free') ? MIN_REQUEST_SPACING_MS : 0;
}

export interface Args {
  dryRun: boolean;
  coverage: Coverage;
  only: string | null;
  limit: number | null;
  force: string[];
  heroes: boolean;
  /** Generate cards. --no-cards clears it, leaving heroes only. */
  cards: boolean;
  model: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: true, coverage: 'all', only: null, limit: null, force: [],
    heroes: true, cards: true, model: DEFAULT_MODEL,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    switch (flag) {
      case '--commit': args.dryRun = false; break;
      case '--dry-run': args.dryRun = true; break;
      case '--no-heroes': args.heroes = false; break;
      // Heroes are appended after cards in job order, so --limit can never
      // reach them. This is the only way to generate heroes on their own,
      // which is what makes the 1:1 aspect path smoke-testable.
      case '--no-cards': args.cards = false; break;
      case '--coverage': args.coverage = parseCoverage(argv[++i] ?? ''); break;
      case '--only': args.only = argv[++i] ?? null; break;
      case '--force': args.force.push(argv[++i] ?? ''); break;
      case '--model': args.model = argv[++i] ?? DEFAULT_MODEL; break;
      case '--limit': {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`--limit expects a positive integer, got "${argv[i]}"`);
        }
        args.limit = n;
        break;
      }
      default:
        // Never ignore an unknown flag: a typo'd --limt would silently
        // generate the entire pool.
        throw new Error(`Unknown flag "${flag}"`);
    }
  }
  return args;
}

interface Job { key: string; outPath: string; built: BuiltPrompt; }

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function buildJobs(args: Args): Job[] {
  const forced = new Set(args.force);
  const jobs: Job[] = [];

  for (const card of args.cards ? buildPool() : []) {
    // --force means "exactly these cards". Without this branch, --force merely
    // waived the coverage filter, so `--force a --force b --force c --limit 3`
    // still enumerated the whole pool and then sliced the first three in pool
    // order — generating three arbitrary cards instead of the three asked for.
    if (forced.size > 0) {
      if (!forced.has(card.id)) continue;
    } else {
      if (args.only !== null && card.archetype !== args.only) continue;
      if (!inCoverage(card.rarity, args.coverage)) continue;
    }
    jobs.push({
      key: card.id,
      outPath: resolve(cardArtPath(card.id)),
      built: buildCardPrompt(card),
    });
  }

  // Forced runs are card-only: --force names card ids, never hero names.
  if (args.heroes && forced.size === 0) {
    // HEROES is positionally zipped with Object.keys(DECK_DEFS) — index i of
    // one matches index i of the other. Both the app and the server rely on
    // this ordering; do not sort either side.
    const keys = Object.keys(DECK_DEFS);
    HEROES.forEach((hero, i) => {
      if (args.only !== null && keys[i] !== args.only) return;
      jobs.push({
        key: hero.name,
        outPath: resolve(heroArtPath(hero.name)),
        built: buildHeroPrompt(hero.name, keys[i]!),
      });
    });
  }

  return jobs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const forced = new Set(args.force);

  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!args.dryRun && !apiKey) {
    console.error('OPENROUTER_API_KEY is not set. Export it before running with --commit.');
    process.exit(1);
  }

  let jobs = buildJobs(args);

  // Skip anything already generated, so a crashed run resumes for free.
  const pending: Job[] = [];
  for (const job of jobs) {
    if (!forced.has(job.key) && await exists(job.outPath)) continue;
    pending.push(job);
  }
  jobs = args.limit === null ? pending : pending.slice(0, args.limit);

  console.log(`${jobs.length} image(s) to generate` +
    (args.dryRun ? ' — DRY RUN, nothing will be spent or written' : ''));

  if (args.dryRun) {
    for (const job of jobs) {
      console.log(`\n--- ${job.key}  [${job.built.aspectRatio}]\n${job.built.prompt}`);
    }
    console.log(`\nDry run complete. ${jobs.length} prompt(s) shown, $0.00 spent.`);
    return;
  }

  console.log(`model: ${args.model}`);

  let total = 0;
  let done = 0;
  const spacingMs = requestSpacingMs(args.model);
  for (const [i, job] of jobs.entries()) {
    // Free tier allows 20 requests/minute. Space them rather than burst and
    // eat 429s; the first request is not delayed. Paid models are not paced.
    if (i > 0 && spacingMs > 0) await new Promise((r) => setTimeout(r, spacingMs));

    // Annotated, not `let res;` — the latter is an implicit any that leans on
    // control-flow inference to recover a type, which is fragile under strict.
    let res: GenerateResult;
    try {
      res = await generateImage({
        prompt: job.built.prompt,
        aspectRatio: job.built.aspectRatio,
        apiKey: apiKey!,
        model: args.model,
      });
    } catch (err) {
      if (err instanceof RateLimitedError) {
        // Free tier: 50 requests/day under $10 lifetime credits, 1000 above.
        // Nothing in this run can clear that, so stop cleanly. Everything
        // already written is skipped on the next run, so re-running the same
        // command tomorrow resumes exactly here.
        console.error(
          `\nRate limited after ${done} image(s) — this is almost certainly the ` +
          `free tier's DAILY cap.\nRe-run the same command tomorrow; the ` +
          `${done} image(s) already written will be skipped.`,
        );
        break;
      }
      throw err;
    }

    done++;
    total += res.costUsd;

    const meta = await sharp(res.bytes).metadata();
    const target = TARGET_SIZE[job.built.aspectRatio]!;
    await mkdir(dirname(job.outPath), { recursive: true });
    // Write to a .tmp sibling and rename into place: rename is atomic on
    // POSIX, so a SIGINT/SIGKILL mid-write can only leave a truncated .tmp,
    // never a truncated final file. The skip check tests job.outPath only,
    // so a crashed run resumes without permanently skipping a card — the
    // exact interruption the resume feature is for. A stale .tmp left by an
    // interrupted run is harmless: the next writeFile overwrites it.
    const tmpPath = `${job.outPath}.tmp`;
    await writeFile(
      tmpPath,
      await sharp(res.bytes)
        .resize(target.width, target.height, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer(),
    );
    await rename(tmpPath, job.outPath);

    const mp = ((meta.width ?? 0) * (meta.height ?? 0)) / 1e6;
    console.log(
      `[${i + 1}/${jobs.length}] ${job.key}  ` +
      `src=${meta.width}x${meta.height} (${mp.toFixed(2)}MP)  ` +
      `provider=${res.provider ?? 'unknown'}  ` +
      `$${res.costUsd.toFixed(4)}  running=$${total.toFixed(2)}`,
    );
  }

  const perImage = done > 0 ? total / done : 0;
  console.log(`\nDone. ${done}/${jobs.length} image(s), $${total.toFixed(2)} total, ` +
    `$${perImage.toFixed(4)}/image.`);
  if (perImage > 0) {
    console.log(`Extrapolated spend: all=297 -> $${(perImage * 297).toFixed(2)}  ` +
      `rare+=146 -> $${(perImage * 146).toFixed(2)}  ` +
      `epic+=78 -> $${(perImage * 78).toFixed(2)}`);
  } else {
    console.log('$0.00 charged — the free variant. The binding constraint is the ' +
      'daily request cap (50/day under $10 lifetime credits, 1000/day above), ' +
      'not money: all=297, rare+=146, epic+=78 requests.');
  }
}

// Only run when invoked directly, so the test can import parseArgs safely.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
