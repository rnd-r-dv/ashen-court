# OpenRouter Image API — Forge "Generate art" (DEFERRED)

**Status: DEFERRED — do not implement now.** The current SDD run (Tasks 31/32/39-42 + QA)
is mid-flight. This doc captures the API contract and the proposed integration design for
a post-run enhancement: generating card art for custom Forge cards via
`black-forest-labs/flux.2-klein-4b` on OpenRouter, feeding the existing `art.imageUrl`
pipeline.

Canonical source (pasted by user 2026-08-06):
https://openrouter.ai/black-forest-labs/flux.2-klein-4b/llms.txt

---

## 1. Model / API

- Model id: `black-forest-labs/flux.2-klein-4b`
- Endpoint: `POST https://openrouter.ai/api/v1/images`
- Headers: `Authorization: Bearer $OPENROUTER_API_KEY`, `Content-Type: application/json`
- Docs: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- Model page: https://openrouter.ai/black-forest-labs/flux.2-klein-4b
- Discovery: https://openrouter.ai/api/v1/images/models
- Key creation: https://openrouter.ai/settings/keys

### Request fields (accepted by this model)

| Field | Type | Notes |
|---|---|---|
| `model` | string (required) | `"black-forest-labs/flux.2-klein-4b"` |
| `prompt` | string (required) | text description |
| `aspect_ratio` | string (optional) | `"1:1" \| "4:3" \| "3:4" \| "3:2" \| "2:3" \| "16:9" \| "9:16" \| "21:9" \| "auto"` |
| `output_format` | string (optional) | `"png" \| "jpeg"` |
| `n` | integer (optional) | 1–1 |
| `input_references` | array (optional) | up to 4 image refs for image-to-image, as `{ "type": "image_url", "image_url": { "url": "…" } }`; url = https URL or base64 data URL |
| `seed` | integer (optional) | sample deterministically; determinism NOT guaranteed per provider |
| `provider` | object (optional) | routing preferences, accepted on every request |

Unlisted values are rejected; a listed value can still be refused by the serving provider.

### Response

```json
{
  "created": 1748372400,
  "data": [{ "b64_json": "<base64 image bytes>", "media_type": "image/png" }],
  "usage": { "prompt_tokens": 0, "completion_tokens": 4175, "total_tokens": 4175, "cost": 0.04 }
}
```

- Base64-decode `data[i].b64_json` → bytes; `media_type` gives the extension.
- `usage.cost` = USD charge (~$0.04/image for the example).

### Errors

`{"error": {"code": <number>, "message": <string>}}` with HTTP status:

- 400 malformed body / unsupported param / content moderation
- 401 missing or invalid API key
- 402 insufficient credits
- 403 spend limit / key disabled / provider blocked
- 404 unknown model or no serving provider
- 413 body too large
- 429 rate limited (retry with backoff)
- 502 upstream generation failed (not billed)

### Example

```bash
curl -X POST https://openrouter.ai/api/v1/images \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  "model": "black-forest-labs/flux.2-klein-4b",
  "prompt": "Editorial architectural photograph of a contemporary neighborhood storefront at blue hour...",
  "n": 1,
  "output_format": "jpeg",
  "aspect_ratio": "16:9"
}'
```

---

## 2. Proposed integration design (post-run, NOT approved yet)

### Why it fits

- The Forge already persists user art via `draft.uploadImage → art.imageUrl`
  (Task 23/33 wiring: saved through localStorage, carried in LAN `customCards` sync).
  A "Generate" result is just another imageUrl — zero pipeline changes.
- Seeded `seed` param aligns with the procedural-art determinism ethos, though
  provider determinism is not guaranteed (accept non-determinism for custom cards).

### Security decision (locked in discussion)

The API key must NOT live in the browser bundle. The app is a Vite client; direct
browser calls would expose the key. Use a server-side proxy:

- The existing Node server (`server/src/index.ts`, WebSocket on PORT default 8080)
  gains an HTTP route — `POST /api/generate` — reading `OPENROUTER_API_KEY` from env.
- The Forge's Generate button `fetch('http://<host>:8080/api/generate')` and stores the
  returned data URL in the draft's `uploadImage`.
- Single-player-only users without the server get the button disabled + a hint
  ("Run the server with OPENROUTER_API_KEY to generate art").
- Optional future: per-user key override in settings (localStorage) for hosted setups —
  deferred.

### Proposed pieces (when approved)

1. `server/src/generate.ts` — `generateImage(prompt, opts): Promise<{ b64_json, media_type }>`
   calling the OpenRouter endpoint via fetch; `OPENROUTER_API_KEY` env; error mapping to
   the documented codes; timeout + retry on 429/502.
2. `server/src/index.ts` — attach an HTTP handler (Node `http.createServer` feeding the
   `WebSocketServer({ server })`) with `POST /api/generate`; validate body
   `{ prompt: string, aspect_ratio?: string, seed?: number, format?: 'png'|'jpeg' }`;
   CORS `*` (dev), size cap on prompt.
3. `app/src/forge/formState.ts` — `generateArt(state)` action hooking the fetch; storing
   into `uploadImage` so save rides the existing path.
4. `app/src/screens/Forge.tsx` — "Generate art" button next to the preset picker / upload:
   prompt auto-built from archetype preset name + name + effect summary (editable),
   aspect 3:4 (card portrait), output_format png; spinner + disable while pending;
   error toast on failure; "Use" replaces the current image.
5. Tests: server route (mock fetch / real endpoint behind env guard), Forge action unit
   test with mocked fetch; manual two-browser check not required (single-user feature).

### Constraints / risks

- Cost per call (~$0.04) — user-initiated only, never prefetch.
- Provider non-determinism vs seed — accept for custom cards; never used for curated pool.
- 429/502 — backoff + clear error message.
- Content moderation 400s — surface the provider message in the toast.
- Key scope — `OPENROUTER_API_KEY` documented in server README; never committed.
