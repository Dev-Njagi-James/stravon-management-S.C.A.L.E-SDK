# Stravon Client SDK (S.C.A.L.E)

TypeScript client SDK for the Stravon Management Platform. Storage-only in v1 — auth-route coverage is deferred to v2.

## Install

```bash
npm install git+https://github.com/Dev-Njagi-James/stravon-management-S.C.A.L.E-SDK.git
```

## Requirements

Node 18+ (uses built-in `fetch` — no `axios`, `node-fetch`, or any added HTTP dependency).

## Quickstart

```ts
import { ScaleClient } from "stravon-scale-sdk";

const scale = new ScaleClient({ apiKey: "YOUR_API_KEY" });

const result = await scale.storage.upload({
  filename: "photo.jpg",
  contentType: "image/jpeg",
  body: fileBuffer,
});
```

## API Reference

### `storage.create(params)`

Maps to `POST /v1/storage/files`.

**Input:**
```ts
{ filename: string; contentType: string; fileSize?: number }
```

**Output:**
```ts
{ uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string }
```

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
{ key: string; contentType: string; fileSize?: number }
```

**Output:**
```ts
{ uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string }
```

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

### `storage.upload(params)` — convenience method

Orchestrates: `create()` → direct PUT to the returned `uploadUrl` → `complete()`.

**Input:**
```ts
{ filename: string; contentType: string; body: BodyInit }
```

**Output:**
```ts
{ key: string; uuid: string; filename: string; verified: boolean; bytes: number }
```

> **Note:** The intermediate PUT step goes directly to the storage provider (R2/Cloudflare), not through the backend. If that PUT fails, the SDK throws a plain `Error` — not one of the typed error classes below — because the failure came from the storage infrastructure, not the backend API.

---

## Error Handling

All six error classes are exported from the package root.

| Class | Thrown when |
|---|---|
| `ScaleError` | Base class for all SDK errors. Extends native `Error`. |
| `AuthError` | Backend returns 401 (bad or missing API key). |
| `RateLimitError` | Backend returns 429. Carries a `retryAfterMs: number` property matching the backend body `{ error: "rate_limit_exceeded", retryAfterMs }`. |
| `ValidationError` | Backend returns a 400-class response (bad input, missing required field, etc.). |
| `ServerError` | Backend returns a 5xx response. |
| `TimeoutError` | Client-side request exceeds the 10-second timeout. |

> **No retry logic** exists anywhere in the SDK. The caller decides whether and how to retry.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | (required) | Your project's API key. |
| `baseUrl` | `string` | `https://stravon-management.onrender.com` | Backend base URL. Change only when targeting a dev/staging deployment. |

The SDK enforces a fixed 10-second timeout on every backend request. This timeout is not currently configurable.

## Versioning

This SDK is versioned independently of the backend via git tags (semver). Install by tag, e.g. `npm install ...#v1.0.0`.