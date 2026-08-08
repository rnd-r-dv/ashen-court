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

  // Moderation repair (2026-08-08): the flavor line "the axe falls" depicts
  // an execution, which OpenRouter's moderation flagged as violence (400).
  // The override keeps the card's identity — an executioner's axe — without
  // any person or act, so the prompt itself cannot read as violence.
  'neutral-execute':
    'An empty stone courthouse hall, a single ceremonial axe resting upright in a stand beside a judge\'s dais, dust motes in still air, no people',

  // Pact archetype: every flavor line references paying with blood or pieces
  // of the self, which trips moderation even though the mechanics are abstract
  // payment. The overrides keep the card's identity (mirror, stair, lord,
  // gravefall, bargain) without the self-harm / blood wording. (2026-08-08)
  'pact-mirror':
    'A tall dark mirror standing in a stone archway of a sunken court, its glass showing a faint stranger\'s reflection in candlelight',
  'pact-ascend':
    'A spiral stone staircase rising through drifting mist toward a slit of pale sky, each step lit by a single candle',
  'pact-lord':
    'A robed figure seated at a stone table beneath a heavy wax-sealed ledger, a court hall dim behind, candlelight',
  'pact-morticia':
    'A pale noblewoman in black and violet court dress standing before a freshly turned grave at dusk, bare trees around',
  'pact-immortal':
    'An ornate hourglass of black glass and gold on a stone pedestal, its sand drifting upward like embers, no people',

  // coven-glare: "death sentence with no appeal" reads as threat; the glare
  // itself is the card, so drop the sentencing framing. (2026-08-08)
  'coven-glare':
    'A stern witch\'s face half-lit by candle flame, piercing pale eyes, dark hood, swamp coven-house bokeh behind',
};
