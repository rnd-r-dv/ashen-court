// scripts/art/styles.ts

/**
 * Prose style blocks — layer 1 of the three-layer prompt (see the design spec,
 * section 3.3). One per archetype, plus a deliberately unplaced 'neutral'.
 *
 * These are the prose form of the identities already locked in
 * app/src/components/artPresets.ts (each archetype has a gradient, an accent
 * colour, a glyph and a silhouette shape). Keep the two in sympathy: if an
 * archetype's palette changes there, its block should change here.
 */

/**
 * Appended to every prompt. The text-suppression clause is load-bearing rather
 * than boilerplate: FLUX.2's headline capability is rendering legible text, so
 * without it the model will happily paint words into card art.
 */
export const GLOBAL_SUFFIX =
  'dark fantasy illustration, painterly, dramatic chiaroscuro, single centred subject, ' +
  'subject centred with headroom, wide landscape composition, ' +
  'no text, no lettering, no watermark, no border, no frame';

export const STYLE_BLOCKS: Record<string, string> = {
  ember:
    'forge-lit red and molten orange, drifting ash and cinders, a cracked volcanic keep',
  choir:
    'pale cathedral light, cold blue and bone-white, drifting incense and frost, a ruined gothic sanctuary',
  vermin:
    'sickly green and wet brown, guttering tallow light, a flooded undercity of pipes and refuse',
  dragon:
    'antique gold and deep indigo, high thin air, a cloud-wreathed mountain eyrie',
  roots:
    'mossy green and damp bark, shafts of low sun, an overgrown forest hall swallowed by roots',
  dance:
    'violet shadow and knife-edge highlight, smoke and silk, a moonlit rooftop above a sleeping city',
  bone:
    'dry ivory and dust-gold, still air, an ossuary of stacked skulls and guttered candles',
  pact:
    'grave-lilac and cold iron, low creeping mist, a sunken cemetery under a starless sky',
  coven:
    'hexed yellow-green and bruised purple, hanging charms, a swamp coven-house on stilts',
  star:
    'pale gold and deep night blue, drifting constellations, an observatory open to the void',
  vigil:
    'warm parchment and burnished steel, steady lamplight, a fortified watchpost at dusk',
  storm:
    'storm-grey and electric blue, sheeting rain, a wind-lashed cliff above a breaking sea',

  /**
   * Deliberately low-chroma and unplaced. A neutral card is played in all 12
   * decks, so it must not import a rival archetype's palette — today they share
   * the 'arcane' preset, which is why Bulwark Knight reads as though it belongs
   * to some other deck.
   */
  neutral:
    'muted stone grey and weathered iron, plain overcast light, an unremarkable ' +
    'borderland of rock and scrub, no strong colour cast',
};

/**
 * Tokens are summoned onto the board and are seen in play, so they need art —
 * but they belong to no deck, so they take the neutral look. Aliased rather
 * than duplicated so the two can never drift.
 */
STYLE_BLOCKS['token'] = STYLE_BLOCKS['neutral']!;

/** Unknown archetypes fall back to neutral. A missing block must never throw
 *  mid-run and abandon a batch that has already been paid for. */
export function styleFor(archetype: string): string {
  return STYLE_BLOCKS[archetype] ?? STYLE_BLOCKS['neutral']!;
}
