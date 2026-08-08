# Stravon Client SDK — Project Instructions: SDK v1 (Storage-Only)

Scope of this document: SDK v1 only. Separate repo from `stravon-management`. Client release cadence decoupled from backend deploys. Do not build auth-route coverage in this version — deferred to SDK v2.

Status: Repo scaffolded. `package.json` and `tsconfig.json` fixed and verified. Build tooling (`tsup`) in place. Source files not yet written.

## Why a Separate Repo

Backend (`stravon-management`) and SDK ship on independent schedules. SDK versions are git-installable with their own semver tags, unrelated to backend deploy history. A subfolder of the backend repo would couple the two — rejected for that reason.

## Stack (fixed, do not substitute)

- TypeScript, compiled via `tsup` to ESM + CJS with `.d.ts` output
- Node 18+ only — relies on built-in `fetch`, no `axios`, `node-fetch`, or any added HTTP dependency
- No framework. This is a library, not an application. No NestJS, no Next.js.
- Git-installable distribution (`npm install git+https://github.com/...#v1.0.0` style), semver-tagged independent of backend releases

## Client Shape

```ts
const client = new StravonClient({ apiKey: string, baseUrl?: string });
client.storage.create(...)
client.storage.complete(...)
client.storage.read(...)
client.storage.modify(...)
client.storage.delete(...)
client.storage.upload(...)  // convenience: create -> PUT -> complete, orchestrated
```

Version prefix (`/v1/`) baked in at the client level — callers never specify it per-call.

## `.storage` Namespace — Method Contracts

Mirror the confirmed backend route contracts in `PROJECT_INSTRUCTIONS_PHASE2.md`. Do not invent response shapes — match the backend exactly.

### `create(params)`
Maps to `POST /v1/storage/files`.
Input: `{ filename: string, contentType: string, fileSize?: number }`
Output: `{ uploadUrl, publicUrl, key, uuid, filename }`

### `complete(params)`
Maps to `POST /v1/storage/files/complete`.
Input: `{ key: string }`
Output: `{ verified: boolean, bytes: number }`

### `read(params)`
Maps to `GET /v1/storage/files?key=`.
Input: `{ key: string }`
Output: `{ downloadUrl, publicUrl, key, filename }`

### `modify(params)`
Maps to `PATCH /v1/storage/files?key=`.
Input: `{ key: string, contentType: string, fileSize?: number }`
Output: `{ uploadUrl, publicUrl, key, uuid, filename }` — same key/uuid as target, in-place replace.

### `delete(params)`
Maps to `DELETE /v1/storage/files?key=`.
Input: `{ key: string }`
Output: `{ success: boolean, key: string }`

### `upload(params)` — convenience method
Orchestrates: `create()` → `fetch(uploadUrl, { method: 'PUT', body, headers: { 'Content-Type': contentType } })` → `complete({ key })`.
Input: `{ filename: string, contentType: string, body: BodyInit }`
Output: `{ key, uuid, filename, verified, bytes }` — merged result of create + complete.
No retry on the PUT step — a failed PUT surfaces immediately as a thrown error, per no-retry policy.

## Error Handling — Typed Error Classes

All errors extend a common base, distinguished by class, not by string matching on `.message`.

| Class | Thrown when |
|---|---|
| `AuthError` | 401 from the backend (bad/missing API key) |
| `RateLimitError` | 429 from the backend — include `retryAfterMs` from the response body as a property |
| `ValidationError` | 400-class response indicating bad input (e.g. missing required field) |
| `ServerError` | 5xx from the backend |
| `TimeoutError` | Client-side fetch timeout — SDK enforces its own timeout on every call (default TBD, confirm before building) |

No retry logic anywhere in the SDK, including on `RateLimitError` or `TimeoutError`. The caller decides whether and how to retry. This mirrors the backend's own no-silent-retry rule.

## Explicitly Out of Scope for v1

- `/v1/auth/*` coverage — deferred to SDK v2, gated on Phase 4 auth-route rate-limiting verification landing in the backend first
- Any retry/backoff logic
- Any bundler-specific build target beyond ESM/CJS + types (no browser-specific build, no UMD)
- Reading `projects.tier` or anything requiring elevated/service-role credentials — SDK only ever uses a project's own API key

## Build Order

1. `src/errors.ts` — five typed error classes
2. `src/client.ts` — `StravonClient` constructor, base fetch wrapper (auth header injection, timeout, error-class mapping from status code)
3. `src/storage.ts` — five methods + `upload()`, built on the client's fetch wrapper
4. `src/index.ts` — exports
5. Manual verification against the live backend (`https://stravon-management.onrender.com`) using a real test project's API key before tagging a release

## Reference Documents

- `PROJECT_INSTRUCTIONS_PHASE2.md` — authoritative backend route contracts this SDK wraps
- `PROJECT_INSTRUCTIONS_PHASE4.md` — rate limiting; `RateLimitError` shape must match the backend's actual 429 body
