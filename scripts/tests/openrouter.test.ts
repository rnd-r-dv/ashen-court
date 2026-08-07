// scripts/tests/openrouter.test.ts
import { describe, expect, it, vi } from 'vitest';
import { generateImage, RateLimitedError } from '../art/openrouter.js';

const PNG_B64 = Buffer.from('fake-image-bytes').toString('base64');

function okResponse(cost = 0.04) {
  return new Response(
    JSON.stringify({
      created: 1,
      data: [{ b64_json: PNG_B64, media_type: 'image/jpeg' }],
      usage: { cost },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function errResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: { code: status, message } }), { status });
}

const base = { prompt: 'a knight', aspectRatio: '3:2', apiKey: 'sk-test', sleep: async () => {} };

describe('generateImage', () => {
  it('decodes the image and reports the charge', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(0.037));
    const res = await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.bytes.toString()).toBe('fake-image-bytes');
    expect(res.mediaType).toBe('image/jpeg');
    expect(res.costUsd).toBe(0.037);
  });

  it('sends exactly the documented fields and nothing else', async () => {
    // An unlisted field is rejected with 400, so this guards against someone
    // "helpfully" adding width/height.
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/images');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(
      ['aspect_ratio', 'model', 'n', 'output_format', 'prompt'].sort(),
    );
    expect(body.model).toBe('black-forest-labs/flux.2-max:free');
    expect(body.aspect_ratio).toBe('3:2');
    expect(body.n).toBe(1);
    expect(body.output_format).toBe('jpeg');
  });

  it('sends the key as a bearer token and never in the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
    expect(init.body as string).not.toContain('sk-test');
  });

  it('retries a 429 and succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(errResponse(429, 'rate limited'))
      .mockResolvedValueOnce(okResponse());
    const res = await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.costUsd).toBe(0.04);
  });

  it('retries a 502 — upstream failures are not billed', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(errResponse(502, 'upstream failed'))
      .mockResolvedValueOnce(okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 400 — a bad prompt will fail identically forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(400, 'moderation blocked'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/moderation blocked/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a 402 — retrying with no credits just burns time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(402, 'insufficient credits'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/insufficient credits/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries and surfaces the last error', async () => {
    // A Response body can only be read once, so each attempt needs a fresh
    // Response — mirroring real fetch, which returns a new Response per call.
    const fetchImpl = vi.fn().mockImplementation(() => errResponse(429, 'still limited'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 2 }),
    ).rejects.toThrow(/still limited/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('reports a surviving 429 as RateLimitedError — the free daily cap', async () => {
    // The free tier allows 50 requests/day under $10 lifetime credits. A 429
    // that outlives seconds of backoff is that cap, and no amount of further
    // waiting inside one run will clear it.
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(429, 'daily limit'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 1 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('does not label a 502 as rate limited', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(502, 'upstream'));
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 1 }),
    ).rejects.not.toBeInstanceOf(RateLimitedError);
  });

  it('defaults to the free model and lets --model override it', async () => {
    // Fresh Response per call: the same Response cannot be read twice (its
    // body is consumed by the first generateImage).
    const fetchImpl = vi.fn().mockImplementation(() => okResponse());
    await generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    let body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.model).toBe('black-forest-labs/flux.2-max:free');

    // Override with a DIFFERENT model, or the assertion is tautological.
    fetchImpl.mockClear();
    await generateImage({
      ...base, model: 'black-forest-labs/flux.2-klein-4b:free',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.model).toBe('black-forest-labs/flux.2-klein-4b:free');
  });

  it('throws a clear error when the response carries no image', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], usage: { cost: 0 } }), { status: 200 }),
    );
    await expect(
      generateImage({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/no image/i);
  });
});
