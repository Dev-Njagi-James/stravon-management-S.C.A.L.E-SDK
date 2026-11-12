# Stravon Client SDK (S.C.A.L.E)

TypeScript client SDK for the Stravon Management Platform. Storage-only in v1 — auth-route coverage is deferred to v2.

## Install

```bash
npm install @stravon/scale-sdk
```

## Requirements

Node 18+ (uses built-in `fetch` — no `axios`, `node-fetch`, or any added HTTP dependency).

## Quickstart

```ts
import { ScaleClient } from "@stravon/scale-sdk";

const scale = new ScaleClient({ apiKey: "YOUR_API_KEY" });

const result = await scale.storage.upload({
  filename: "photo.jpg",
  contentType: "image/jpeg",
  body: fileBuffer,
});
```

console.log(result.usage.level); // "ok" | "warn80" | "upgrade90" | "overage"

## API Reference

### `storage.create(params)`

Maps to `POST /v1/storage/files`.

**Input:**

```ts
{ filename: string; contentType: string; fileSize: number }
```

**Output:**

```ts
{ uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string; usage: UsageSnapshot }
```

`fileSize` is the exact byte size of the file and is required. `contentType` must be `image/*` or `video/*`. `fileSize` must be a positive integer. The size is reserved against the project's storage quota before the URL is issued. Rejections: `QuotaExceededError`, `SubscriptionExpiredError`, `ValidationError` (see Error Handling).

### `storage.complete(params)`

Maps to `POST /v1/storage/files/complete`.

**Input:**

```ts
{ key: string }
```

**Output:**

```ts
{ verified: boolean; bytes: number }
```

### `storage.read(params)`

Maps to `GET /v1/storage/files?key=...`.

**Input:**

```ts
{ key: string }
```

**Output:**

```ts
{ downloadUrl: string; publicUrl: string; key: string; filename: string }
```

### `storage.modify(params)`

Maps to `PATCH /v1/storage/files?key=...`.

**Input:**

```ts
{ key: string; contentType: string; fileSize: number }
```

**Output:**

```ts
{ uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string; usage: UsageSnapshot }
```

`fileSize` is the byte size of the replacement file and is required. Replacing a file counts the larger of old and new size, not both.

### `storage.delete(params)`

Maps to `DELETE /v1/storage/files?key=...`.

**Input:**

```ts
{ key: string }
```

**Output:**

```ts
{ success: boolean; key: string }
```

### `storage.usage()`

Maps to `GET /v1/storage/usage`.

**Input:** none.

**Output:**

```ts
{

 tier: string;
 billingInterval: "monthly" | "annual";
 subscriptionStatus: "active" | "expired";
 currentPeriodEnd: string | null;
 usedBytes: number;
 quotaBytes: number;
 ceilingBytes: number;
 percent: number;
 level: "ok" | "warn80" | "upgrade90" | "overage";
 overageBytes: number;
 fileCount: number;
 maxFileBytes: number;
}
```

**Behavior:**

- `level`: `ok` under 80% of quota, `warn80` from 80% to under 90%, `upgrade90` from 90% to under 100%, `overage` at 100% or more.
- Uploads continue past 100% of quota and the excess is recorded as `overageBytes`. Uploads are rejected at `ceilingBytes` with `QuotaExceededError`.
- Remaining quota: `quotaBytes - usedBytes`.
- Units are decimal: 1 GB = 1,000,000,000 bytes.
- Read, usage, and delete are never blocked by quota or subscription state.
- Counts against the project's shared rate-limit bucket.

### `storage.upload(params)` — convenience method

Orchestrates: `create()` → direct PUT to the returned `uploadUrl` → `complete()`.

**Input:**

```ts
{ filename: string; contentType: string; body: BodyInit; fileSize?: number }
```

**Output:**

```ts
{ key: string; uuid: string; filename: string; verified: boolean; bytes: number; usage: UsageSnapshot }
```

`fileSize` is derived automatically from `string`, `Blob`/`File`, `ArrayBuffer`, and typed-array/`Buffer` bodies. For streams or `FormData` the size cannot be determined, so pass `fileSize` explicitly or a `ValidationError` is thrown before any request is made. `usage` is the state at reservation time, before this file's bytes were verified.

> **Note:** The intermediate PUT step goes directly to the storage provider (R2/Cloudflare), not through the backend. If that PUT fails, the SDK throws a plain `Error` — not one of the typed error classes below — because the failure came from the storage infrastructure, not the backend API.

---

### `storage.batchRead(params)`

Maps to `POST /v1/storage/files/batch-read`.

**Input:**

```ts
{ keys: string[] }
```

**Output:**

```ts
{
  results: Array<
    { key: string; downloadUrl: string; publicUrl: string; filename: string }
    | { key: string; error: string }
  >;
  retryAfterMs?: number;
}
```

**Behavior:**

- Max 50 keys per call. Excess keys result in a 400 error before any tokens are consumed.
- Partial failure is supported: individual keys that don't exist, belong to another project, or exceed rate limits come back as `{ key, error }` entries inside `results` — the call does **not** throw for these. Possible per-key `error` values: `"not_found"`, `"cross_project"`, `"rate_limit_exceeded"`.
- If **zero** keys in the batch could be served (batch fully throttled), a `RateLimitError` is thrown — same as other methods, carrying `retryAfterMs`.
- The order of `results` matches the order of input `keys`.

## Error Handling

All eight error classes are exported from the package root.

| Class | Thrown when |
| --- | --- |
| `ScaleError` | Base class for all SDK errors. Extends native `Error`. |
| `AuthError` | Backend returns 401 (bad or missing API key). |
| `RateLimitError` | Backend returns 429. Carries a `retryAfterMs: number` property matching the backend body `{ error: "rate_limit_exceeded", retryAfterMs }`. |
 | `QuotaExceededError` | Backend returns 403 `storage_ceiling_exceeded`. Carries `limitBytes` and `usedBytes` (both optional numbers). |
 | `SubscriptionExpiredError` | Backend returns 403 `subscription_expired`. `create()` and `modify()` are blocked; `read()`, `usage()`, and `delete()` still work. |
 | `ValidationError` | Backend returns any other 400-class response, including 403 `file_too_large` (file exceeds the tier's single-file limit), non-image/video `contentType`, and missing or invalid `fileSize`. |
| `ServerError` | Backend returns a 5xx response. |
| `TimeoutError` | Client-side request exceeds the configured timeout (see Configuration below). |

> **No retry logic** exists anywhere in the SDK. The caller decides whether and how to retry.

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | (required) | Your project's API key. |
| `baseUrl` | `string` | `https://stravon-management.onrender.com` | Backend base URL. Change only when targeting a dev/staging deployment. |
| `timeoutMs` | `number` | `65000` | Client-side request timeout in milliseconds, applied to every backend request unless overridden per-call internally (e.g. `read()` uses a 20000ms timeout). Configurable via the constructor: `new ScaleClient({ apiKey, baseUrl, timeoutMs })`. |

## Versioning

This SDK is versioned independently of the backend via git tags (semver). Install by tag, e.g. `npm install ...#v1.2.0`

## Changelog

### v1.0.1

- **Fixed:** `upload()` now sends `Cache-Control` header on the underlying PUT so CDN caching works correctly. No change to method signatures.

### v1.0.2

- **Changed:** Default client-side request timeout raised from 10000ms to 65000ms, and made configurable via the `timeoutMs` constructor option. `read()` now uses a shorter 20000ms timeout internally.

### v1.1.0

- **Added:** `storage.batchRead(params)` — fetch metadata for up to 50 keys in one call.

### v1.2.0

- **Breaking:** `fileSize` is now required on `storage.create()` and `storage.modify()`. The backend rejects requests without it (400). TypeScript callers omitting it get a compile error.
- **Added:** `storage.usage()` — read the project's storage usage, quota, and overage state.
- **Added:** `usage` field on the return values of `create()`, `modify()`, and `upload()`.
- **Added:** `QuotaExceededError` and `SubscriptionExpiredError`. 403 responses were previously all thrown as `ValidationError`.
- **Changed:** `upload()` derives `fileSize` from the body automatically and accepts an optional `fileSize` for streams and `FormData`.
- **Fixed:** error messages now use the backend's `message` field when present. Previously a Nest validation error surfaced only as "Bad Request".
