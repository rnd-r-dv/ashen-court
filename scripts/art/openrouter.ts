// scripts/art/openrouter.ts

/**
 * OpenRouter Images API client for the FLUX.2 family.
 * Request contract: https://openrouter.ai/black-forest-labs/flux.2-klein-4b/llms.txt
 * (the llms.txt lives at the non-:free path; the schema is the same).
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/images';

/**
 * All :free variants cost $0, so the default is chosen on fitness alone.
 *
 * This is a default to REVISIT, not a proven winner: "max" is a tier name, and
 * larger models often trend toward photorealism and literal interpretation,
 * which is the opposite of what stylised card art wants. Reversing is cheap by
 * construction — --model swaps it, --force regenerates, and every FLUX variant
 * shares this request schema. If the first real output disappoints, switch.
 *
 * Swappable across FLUX variants (flux.2-klein-4b:free, flux.2-pro:free) at
 * zero cost. NOT swappable to recraft/recraft-v3:free, which takes a different
 * request shape (image_config, no documented aspect_ratio) — that is client
 * work, not a flag. Recraft is the first thing to try if FLUX output proves
 * inconsistent across archetypes, since its `style` parameter would enforce
 * house style structurally rather than through prompt wording.
 */
export const DEFAULT_MODEL = 'black-forest-labs/flux.2-max:free';

/**
 * Only 429 (rate limited) and 502 (upstream failure, not billed) are worth
 * retrying. 400 moderation, 401 bad key, 402 no credits, 403 spend limit and
 * 404 no provider all fail identically on a second attempt.
 */
const RETRYABLE = new Set([429, 502]);

export interface GenerateResult {
  bytes: Buffer;
  mediaType: string;
  costUsd: number;
  /** Serving provider, when OpenRouter reports it — logged so a cheaper
   *  provider can be pinned later if per-image cost comes back high. */
  provider: string | null;
}

export interface GenerateOptions {
  prompt: string;
  aspectRatio: string;
  apiKey: string;
  /** Defaults to DEFAULT_MODEL (the free variant). */
  model?: string;
  /** Injected by tests only. Production omits it. */
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Injected by tests only, to skip real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
}

/** Thrown when a 429 outlives its retries. On the free tier that almost
 *  always means the DAILY cap, not the per-minute one — backing off further
 *  cannot help, so the caller should stop the run and resume tomorrow. */
export class RateLimitedError extends Error {}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateImage(opts: GenerateOptions): Promise<GenerateResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;

  // The narrow, per-model documented field set. Accepted fields vary BY MODEL:
  // flux.2-klein-4b's llms.txt lists only these and rejects anything else with
  // 400, while OpenRouter's general image docs list a wider set (resolution,
  // size, quality, background, ...). Build against the narrow set.
  //
  // If `size` turns out to be accepted by the chosen model it would let us
  // request 480x320 directly and drop the sharp downscale entirely — probe it
  // once by hand before designing around it.
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio,
    output_format: 'jpeg',
    n: 1,
  };

  let lastError = new Error('no attempt made');
  let lastStatus = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = await res.json() as {
        data?: Array<{ b64_json?: string; media_type?: string }>;
        usage?: { cost?: number };
        provider?: string;
      };
      const first = json.data?.[0];
      if (!first?.b64_json) {
        throw new Error('OpenRouter returned no image in data[0].b64_json');
      }
      return {
        bytes: Buffer.from(first.b64_json, 'base64'),
        mediaType: first.media_type ?? 'image/jpeg',
        costUsd: json.usage?.cost ?? 0,
        provider: json.provider ?? null,
      };
    }

    const message = await readErrorMessage(res);
    lastStatus = res.status;
    lastError = new Error(`OpenRouter ${res.status}: ${message}`);
    if (!RETRYABLE.has(res.status)) throw lastError;
    // Exponential backoff: 1s, 2s, 4s.
    if (attempt < maxRetries) await sleep(1000 * 2 ** attempt);
  }

  // A 429 that outlived seconds of backoff is the daily cap, not the
  // per-minute one. Distinguished so the CLI can stop cleanly and tell the
  // operator to resume tomorrow instead of grinding through 200 more failures.
  if (lastStatus === 429) throw new RateLimitedError(lastError.message);
  throw lastError;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json() as { error?: { message?: string } };
    return json.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
