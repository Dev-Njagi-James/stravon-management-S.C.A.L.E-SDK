# SDK_CONTEXT — Stravon Client SDK (S.C.A.L.E)

Facts derived only from `package.json`, `tsconfig.json`, `src/*.ts`, `dist/`, and repo docs. Anything absent is marked **NOT FOUND**.

## 1. Package

- **name:** `@stravon/scale-sdk` (package.json:2)
- **version:** `1.2.0` (package.json:3)
- **language:** TypeScript (tsconfig target `ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `declaration: true`)
- **build tool:** `tsup` (`tsup src/index.ts --format esm,cjs --dts`, package.json:12). Dev deps: `tsup ^8.5.1`, `typescript ^5.6.3`. No runtime `dependencies` block.
- **package type:** `"type": "commonjs"` (package.json:17). Emits both ESM (`dist/index.mjs`) and CJS (`dist/index.js`) plus types (`dist/index.d.ts`, `dist/index.d.mts`).
- **entry points:**
  - `main`: `dist/index.js`
  - `types`: `dist/index.d.ts`
  - `files`: `["dist"]` only (package.json:7-9)
- **public exports** (src/index.ts):
  - Value: `ScaleClient`
  - Error classes: `ScaleError`, `AuthError`, `RateLimitError`, `ValidationError`, `ServerError`, `TimeoutError`, `QuotaExceededError`, `SubscriptionExpiredError`
  - Types: `UsageLevel`, `UsageSnapshot`, `StorageUsageReport`, `PresignedUpload`
  - Not exported from index: `RequestFn` (type), `StorageNamespace` (class) — declared in src/storage.ts but not re-exported from src/index.ts.

## 2. Auth

- **Mechanism:** Project API key only. No Clerk, no OAuth, no project token separate from the API key, no service-role credential (src/client.ts:31-40).
- **Header name:** `x-api-key` (src/client.ts:54).
- **Where held:** Passed to `ScaleClient` constructor as `config.apiKey` (string, required); stored as `private readonly apiKey` on the instance (src/client.ts:17, 36). Injected into every request via `headers.set("x-api-key", this.apiKey)` in the private `request()` wrapper (src/client.ts:53-54).
- **Version prefix:** `/v1` is prepended at the client level (`versionPrefix`, src/client.ts:23); callers never pass it.
- **Auth failures:** 401 → `AuthError` (src/client.ts:67-69).

## 3. Endpoints consumed

All paths are relative to `baseUrl` (default `https://stravon-management.onrender.com`) with `/v1` prefix. All authenticated via `x-api-key`. No `Content-Type: application/json` is set on GET/DELETE calls (no body). JSON bodies are set only where noted.

### POST `/v1/storage/files` — `storage.create()`
- Request: `{ filename: string; contentType: string; fileSize: number }` (JSON body, src/storage.ts:61-72)
- Response (`PresignedUpload`): `{ uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string; usage: UsageSnapshot }`
- Errors: `QuotaExceededError` (403 `storage_ceiling_exceeded`), `SubscriptionExpiredError` (403 `subscription_expired`), `ValidationError` (other 4xx), `AuthError` (401), `RateLimitError` (429), `ServerError` (5xx), `TimeoutError`.

### POST `/v1/storage/files/complete` — `storage.complete()`
- Request: `{ key: string }` (JSON body)
- Response: `{ verified: boolean; bytes: number }`
- Errors: same mapping as create.

### GET `/v1/storage/files?key=...` — `storage.read()`
- Request: query `key` (URL-encoded); no body.
- Response: `{ downloadUrl: string; publicUrl: string; key: string; filename: string }`
- Timeout: uses `20000` ms internally (src/storage.ts:85-90) overriding the default.
- Errors: same mapping; read not blocked by quota/subscription.

### PATCH `/v1/storage/files?key=...` — `storage.modify()`
- Request: query `key`; JSON body `{ contentType: string; fileSize: number }` (src/storage.ts:121-134)
- Response: `PresignedUpload` (same shape as create)
- Errors: same mapping as create.

### DELETE `/v1/storage/files?key=...` — `storage.delete()`
- Request: query `key`; no body.
- Response: `{ success: boolean; key: string }`
- Errors: same mapping; delete not blocked by quota/subscription.

### POST `/v1/storage/files/batch-read` — `storage.batchRead()`
- Request: `{ keys: string[] }` (JSON body). Max 50 keys per call (enforced backend; SDK does not pre-check).
- Response:
  ```ts
  {
    results: Array<
      { key: string; downloadUrl: string; publicUrl: string; filename: string }
      | { key: string; error: string }
    >;
    retryAfterMs?: number;
  }
  ```
  (src/storage.ts:100-118). Per-key `error` values documented in README: `"not_found"`, `"cross_project"`, `"rate_limit_exceeded"`.
- Errors: `RateLimitError` (429) only when zero keys could be served; otherwise per-key `{ key, error }` entries. `ValidationError` (400) for empty/`>50`/missing body.

### GET `/v1/storage/usage` — `storage.usage()`
- Request: none.
- Response (`StorageUsageReport`): see Section 4.

### Convenience: `storage.upload()` (no single backend route)
- Orchestrates `create()` → direct `fetch(uploadUrl, { method: "PUT", ... })` → `complete()`.
- PUT goes directly to storage provider (R2/Cloudflare), NOT the backend. PUT headers: `Content-Type: <contentType>`, `Cache-Control: public, max-age=31536000, immutable` (src/storage.ts:181-188).
- A failed PUT throws a plain `Error` (not a typed SDK error) (src/storage.ts:190-194).
- Response: `{ key: string; uuid: string; filename: string; verified: boolean; bytes: number; usage: UsageSnapshot }`.

### Error-code → class mapping (src/client.ts:67-96)
| Status / body | Class |
|---|---|
| 401 | `AuthError` |
| 429 (body `{ error:"rate_limit_exceeded", retryAfterMs }`) | `RateLimitError` (carries `retryAfterMs`) |
| 403 body `code === "storage_ceiling_exceeded"` | `QuotaExceededError` (carries optional `limitBytes`, `usedBytes`) |
| 403 body `code === "subscription_expired"` | `SubscriptionExpiredError` |
| other 4xx (incl. 403 fallthrough) | `ValidationError` |
| 5xx | `ServerError` |
| client-side AbortController timeout | `TimeoutError` |

### Project-status endpoint
- **NOT FOUND.** No project-status endpoint, route, method, or type exists in `src/`, `dist/`, or repo docs. The only status-like field is `subscriptionStatus` inside `StorageUsageReport` (GET `/v1/storage/usage`). Request shape, response shape, and error codes: **NOT FOUND**.

## 4. Usage/metering data available

Source: `StorageUsageReport extends UsageSnapshot` (src/storage.ts:10-30). Returned by `storage.usage()` (GET `/v1/storage/usage`) and the `usage` field on `create()`/`modify()`/`upload()` returns.

| Field | Type | Origin |
|---|---|---|
| `tier` | `string` | API (`StorageUsageReport`) — SDK does not enumerate values; README/docs reference tiers Entry/Starter/Growth/Scale |
| `billingInterval` | `"monthly" \| "annual"` | API |
| `subscriptionStatus` | `"active" \| "expired"` | API |
| `currentPeriodEnd` | `string \| null` | API (reset/period-end marker) |
| `usedBytes` | `number` | API (storage used) |
| `quotaBytes` | `number` | API (storage limit) |
| `ceilingBytes` | `number` | API (hard cap; uploads rejected here) |
| `percent` | `number` | API (usage percent) |
| `level` | `"ok" \| "warn80" \| "upgrade90" \| "overage"` | API |
| `overageBytes` | `number` | API |
| `fileCount` | `number` | API (`StorageUsageReport` only) |
| `maxFileBytes` | `number` | API (`StorageUsageReport` only, tier single-file limit) |

- **Tier:** exposed as free-form `string` `tier` from API; the SDK has no tier enum/constant.
- **Reset period:** only `currentPeriodEnd` (string|null) is exposed; no explicit "reset day/interval" field. Billing cadence via `billingInterval`. Exact reset semantics: **NOT FOUND** in code.
- **Request counts / call-log counts:** **NOT FOUND.** No endpoint or type exposes request counts or `call_logs` counts. (`call_logs` schema appears only in `PROJECT_INSTRUCTIONS_BATCH_READ (1).md` as backend-side, not SDK.)
- **Computed client-side:** Only `fileSize` derivation in `upload()` via `resolveBodySize()` — byte size from `string` (UTF-8 via `TextEncoder`), `Blob`, `ArrayBuffer`, or typed-array/`ArrayBuffer` view (src/storage.ts:42-49, 164-173). All usage/limit/percent/level/overage values are returned by the API, NOT computed in the SDK. Remaining quota (`quotaBytes - usedBytes`) is documented in README but not computed or exposed by the SDK. Units are decimal (1 GB = 1,000,000,000 bytes) per README.

## 5. Existing client API (public)

`ScaleClient` (src/client.ts:15)
- `constructor(config: { apiKey: string; baseUrl?: string; timeoutMs?: number })` — creates client; `baseUrl` defaults to `https://stravon-management.onrender.com`, `timeoutMs` defaults to `65000`.
- `readonly storage: StorageNamespace` — storage namespace bound to this client's request function.
- `private request(path, init?, timeoutMs?)` — base fetch wrapper (not public).
- `private readErrorBody(response)` — parses error body (not public).

`StorageNamespace` (src/storage.ts:52) — reachable via `client.storage`; not exported from package root.
- `create(params: { filename: string; contentType: string; fileSize: number }): Promise<PresignedUpload>` — reserve storage + get presigned upload URL.
- `complete(params: { key: string }): Promise<{ verified: boolean; bytes: number }>` — mark upload complete.
- `read(params: { key: string }): Promise<{ downloadUrl: string; publicUrl: string; key: string; filename: string }>` — fetch one file's metadata (20s timeout).
- `batchRead(params: { keys: string[] }): Promise<{ results: Array<...>; retryAfterMs?: number }>` — fetch metadata for up to 50 keys.
- `modify(params: { key: string; contentType: string; fileSize: number }): Promise<PresignedUpload>` — in-place replace (returns new presigned upload).
- `delete(params: { key: string }): Promise<{ success: boolean; key: string }>` — delete a file.
- `usage(): Promise<StorageUsageReport>` — read project storage usage/quota/overage.
- `upload(params: { filename: string; contentType: string; body: BodyInit; fileSize?: number }): Promise<{ key: string; uuid: string; filename: string; verified: boolean; bytes: number; usage: UsageSnapshot }>` — convenience create→PUT→complete.

Error classes (src/errors.ts): `ScaleError` (base, extends `Error`), `AuthError`, `RateLimitError` (`retryAfterMs`), `ValidationError`, `ServerError`, `TimeoutError`, `QuotaExceededError` (`limitBytes?`, `usedBytes?`), `SubscriptionExpiredError`.

No other public classes/functions exist.

## 6. Framework assumptions

- **Framework:** None. Library, not an application (no React, Next.js, or NestJS). No UI components.
- **Module formats:** Emits ESM + CJS + `.d.ts`/`.d.mts` via tsup. Package declares `"type": "commonjs"` but ships both formats.
- **Runtime target:** Node 18+; relies on built-in global `fetch`, `Headers`, `AbortController`, `Blob`, `ArrayBuffer`, `TextEncoder`. No `axios`/`node-fetch`/HTTP dependency.
- **SSR constraints:** **NOT FOUND** — no explicit SSR handling, no `window`/`document`/`localStorage` references. Uses only standard web/Node globals (`fetch`, `Blob`, `AbortController`), so no DOM dependency is declared in code. Any SSR behavior is implicit, not documented.
- **Peer dependencies:** **NOT FOUND** — no `peerDependencies` in package.json. Browser vs Node bundling: no browser-specific build (per SDK v1 instructions), no UMD.

## 7. Styling approach

- **NOT FOUND.** No UI exists. No CSS, no styling library, no component files. Nothing to style.

## 8. Error handling, retry, caching, polling

- **Error handling:** Centralized status→class mapping in `ScaleClient.request()` (Section 3 table). Error messages prefer backend `message` field, fall back to `error` code, then `statusText` (src/client.ts:109-136). Non-JSON error bodies keep `statusText`.
- **Timeout:** `AbortController`-based per request; default `65000` ms (`timeoutMs` option), `read()` uses `20000` ms. Aborts throw `TimeoutError` (src/client.ts:56-58, 100-102).
- **Retry:** **None.** No retry/backoff anywhere; `upload()` PUT has no retry (README, src/storage.ts:153-157). `RateLimitError.retryAfterMs` is surfaced but never acted on.
- **Caching:** No SDK-level response caching. Only client-side cache hint: `upload()` PUT sends `Cache-Control: public, max-age=31536000, immutable` to the storage provider (src/storage.ts:185). No caching of `downloadUrl`s.
- **Polling:** **NOT FOUND.** No polling, intervals, or watch loops.

## 9. Gaps — data a usage widget would need that the API does not currently expose

- **Request/call counts:** No endpoint returns request counts or `call_logs` aggregates (total calls, per-action counts, throttled count). **NOT FOUND** in SDK/API surface.
- **Rate-limit state:** No current token/bucket level, remaining requests, or refill window; only a reactive `retryAfterMs` on 429.
- **Reset details:** Only `currentPeriodEnd` (string|null); no reset day-of-cycle, next-reset timestamp, or per-window usage breakdown.
- **Historical / time-series usage:** `usage()` returns a single current snapshot only; no usage history, trend, or per-day series.
- **Per-file / per-resource breakdown:** `fileCount` and `maxFileBytes` exist, but no list of files, per-file sizes, largest-file identification, or per-tier breakdown.
- **Tier enumeration:** `tier` is an untyped `string`; no enum or numeric limits exposed by the SDK (quota/ceiling come as bytes only).
- **Project status endpoint:** **NOT FOUND** — no project-level status/health/plan endpoint of any kind (method, path, request, response, error codes all absent).
- **Overage/billing projection:** `overageBytes` is exposed, but no cost/price, projected overage, or billing-amount fields.
- **Computed client-side gaps:** Remaining quota (`quotaBytes - usedBytes`) and percentage are available (percent from API) but the SDK exposes no helper to compute remaining bytes; a widget would compute it itself from `quotaBytes`/`usedBytes`.