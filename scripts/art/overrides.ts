// scripts/art/overrides.ts

/**
 * Per-card subject overrides — the repair path, not the main path.
 *
 * Layer 2 of the prompt is normally `${card.name}. ${card.flavor}`, and all 285
 * curated cards carry flavor text, so there is no gap to fill. An entry here
 * replaces that line for one card whose flavor produces a bad image (wrong
 * subject, unreadable composition, accidental lettering).
 *
 * Workflow: add the entry, then regenerate just that card:
 *   npm run art:generate -- --force choir-seraph
 *
 * Expected to stay small. A large map means the style blocks are wrong and
 * should be fixed instead.
 */
export const SUBJECT_OVERRIDES: Record<string, string> = {
  // 'choir-seraph': 'A weeping winged figure in tattered vestments, wings folded, ...',
};
