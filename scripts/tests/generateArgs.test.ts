// scripts/tests/generateArgs.test.ts
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../art/generate.js';

describe('parseArgs', () => {
  it('defaults to the safest possible run', () => {
    const a = parseArgs([]);
    // Safe means: spends nothing until explicitly told to, on the free model.
    expect(a.dryRun).toBe(true);
    expect(a.coverage).toBe('all');
    expect(a.only).toBeNull();
    expect(a.limit).toBeNull();
    expect(a.force).toEqual([]);
    expect(a.heroes).toBe(true);
    expect(a.cards).toBe(true);
    expect(a.model).toBe('black-forest-labs/flux.2-max:free');
  });

  it('accepts --model for the other FLUX variants', () => {
    // Only across models sharing the FLUX request schema. recraft/recraft-v3:free
    // takes an image_config object instead and needs schema work in
    // openrouter.ts, not just this flag.
    // A model that is NOT the default, so the assertion means something.
    expect(parseArgs(['--model', 'black-forest-labs/flux.2-klein-4b:free']).model)
      .toBe('black-forest-labs/flux.2-klein-4b:free');
  });

  it('turns off dry-run only when --commit is passed explicitly', () => {
    expect(parseArgs(['--commit']).dryRun).toBe(false);
  });

  it('parses coverage', () => {
    expect(parseArgs(['--coverage', 'epic+']).coverage).toBe('epic+');
  });

  it('rejects an unknown coverage rather than defaulting to all', () => {
    expect(() => parseArgs(['--coverage', 'epic'])).toThrow(/coverage/i);
  });

  it('parses limit as a positive integer', () => {
    expect(parseArgs(['--limit', '3']).limit).toBe(3);
    expect(() => parseArgs(['--limit', '0'])).toThrow(/limit/i);
    expect(() => parseArgs(['--limit', 'three'])).toThrow(/limit/i);
  });

  it('parses --only and --no-heroes', () => {
    expect(parseArgs(['--only', 'choir']).only).toBe('choir');
    expect(parseArgs(['--no-heroes']).heroes).toBe(false);
  });

  it('parses --no-cards, the only way to generate heroes alone', () => {
    // Heroes are appended AFTER cards in job order, so --limit can never
    // reach them. Without this flag the 1:1 aspect path cannot be smoke
    // -tested on its own, and Stage 0 would validate only 3:2 and 3:4.
    const a = parseArgs(['--no-cards']);
    expect(a.cards).toBe(false);
    expect(a.heroes).toBe(true);
  });

  it('collects repeated --force ids', () => {
    expect(parseArgs(['--force', 'choir-seraph', '--force', 'ember-imp']).force)
      .toEqual(['choir-seraph', 'ember-imp']);
  });

  it('keeps --force and --limit independent', () => {
    // Regression guard for the Stage 0 batch: --force must select WHICH cards,
    // --limit only caps how many. An earlier version let --force waive the
    // coverage filter without restricting the job set, so a forced + limited
    // run generated the first N cards in pool order instead of the forced ids.
    const a = parseArgs(['--force', 'x', '--force', 'y', '--limit', '3']);
    expect(a.force).toEqual(['x', 'y']);
    expect(a.limit).toBe(3);
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    // Silently ignoring --limt would generate the whole pool by accident.
    expect(() => parseArgs(['--limt', '3'])).toThrow(/unknown/i);
  });
});
