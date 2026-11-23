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

## Usage widget

A framework-agnostic web-component-style widget that renders a project's storage usage as a donut chart plus a detail table. It mounts into any element and manages its own polling, refresh, and teardown.

### Install path

```bash
npm install @stravon/scale-sdk
```

The widget is a separate entry point: import it from `@stravon/scale-sdk/widget`, not the package root.

```ts
import { mountUsageWidget } from "@stravon/scale-sdk/widget";
```

### `fetchUsage` contract

`mountUsageWidget(target, options)` requires a `fetchUsage` function that resolves to a `StorageUsageReport` (the same type returned by `client.storage.usage()`):

```ts
interface UsageWidgetOptions {
  fetchUsage: () => Promise<StorageUsageReport>;
  refreshMs?: number;          // poll interval; 0 disables, 1-4999 raised to 5000; default 60000
  brand?: UsageWidgetBrand;    // optional color/font/radius overrides (see Branding)
  title?: string;
  onUpgrade?: () => void;      // fires for upgrade90 / overage / expired states
  onError?: (err: unknown) => void;
}

interface UsageWidgetBrand {
  accent?: string;    // ring and header icon; default #002147
  action?: string;    // Upgrade/Renew button background; default #d4af37
  actionInk?: string; // Upgrade/Renew button text; default #111111
  ink?: string;       // text color; default #002147
  surface?: string;   // card background; default #f6f4eb
  font?: string;      // CSS font-family; default Inter, system-ui, …
  radius?: string;    // card corner radius; default 20px
}

interface UsageWidgetHandle {
  refresh(): Promise<void>;    // force a reload
  destroy(): void;             // remove host + stop polling
}
```

The widget renders `usedBytes`, `quotaBytes`, `ceilingBytes`, `percent`/`level`, `overageBytes`, `tier`, `billingInterval`, `subscriptionStatus`, `currentPeriodEnd`, `fileCount`, and `maxFileBytes`. `formatBytes` uses decimal units (1 GB = 1,000,000,000 B). See the field mapping table below.

### Server-route pattern (recommended)

`fetchUsage` should call your own backend route, which calls the SDK server-side with the project's API key. The widget never sees the raw key.

```ts
// Server route (e.g. GET /api/storage-usage)
import { ScaleClient } from "@stravon/scale-sdk";
const client = new ScaleClient({ apiKey: process.env.STRAVON_API_KEY! });
// return await client.storage.usage();
```

```ts
// Client
import { mountUsageWidget } from "@stravon/scale-sdk/widget";

const w = mountUsageWidget("#usage", {
  fetchUsage: () => fetch("/api/storage-usage").then((r) => r.json()),
  onUpgrade: () => (location.href = "/billing"),
});
// w.destroy() on unmount
```

`usageFromClient(client)` is a server-side helper that adapts a `ScaleClient` to the `fetchUsage` shape: `fetchUsage: usageFromClient(client)`.

> **Warning — API key in the browser:** Do NOT construct a `ScaleClient` with a raw API key in browser/client code and pass it as `fetchUsage`. Any key shipped to the browser is public and can be extracted. Route through your own backend (above) and keep `STRAVON_API_KEY` server-side only.

React / SPA cleanup:

```tsx
useEffect(() => {
  const w = mountUsageWidget(ref.current!, { fetchUsage });
  return () => w.destroy();
}, []);
```

### How the widget loads data

The widget never talks to Stravon directly. It calls `fetchUsage()`, which must resolve to a `StorageUsageReport`. Your backend route is what calls the SDK with the API key.

```
mountUsageWidget -> fetchUsage() -> integrator backend route -> client.storage.usage() -> GET /v1/storage/usage -> StorageUsageReport -> widget re-renders
```

- **Load:** `fetchUsage()` is called once immediately on mount. Until it resolves, the card shows "Loading usage".
- **Update:** a successful fetch replaces the previous report in full and the card re-renders. Call `widget.refresh()` to reload on demand.
- **Error:** if the first fetch fails, the card shows the error and a Retry button. If a later refresh fails, the last good data stays visible with a "Refresh failed" banner.
- **Polling:** with `refreshMs` (default `60000` ms) the widget refetches on that interval; `refreshMs: 0` disables polling; values `1`–`4999` are raised to `5000`. Polls are skipped while the document is hidden, and a `visibilitychange` back to visible refetches only if the data is older than `refreshMs`. An error carrying `retryAfterMs` pushes the next poll out to at least that delay.

Server route:

```ts
import { ScaleClient } from "@stravon/scale-sdk";
const client = new ScaleClient({ apiKey: process.env.STRAVON_API_KEY! });
// GET /api/storage-usage
return Response.json(await client.storage.usage());
```

Client:

```ts
import { mountUsageWidget } from "@stravon/scale-sdk/widget";
const widget = mountUsageWidget("#usage", {
  fetchUsage: () => fetch("/api/storage-usage").then((r) => r.json()),
});
```

After uploads / mutations:

```ts
await client.storage.upload(...); // or modify(...) / delete(...)
await widget.refresh();
```

Call `await widget.refresh()` after every upload, modify, or delete. The usage snapshot returned by `upload()` lacks `fileCount` and `maxFileBytes`, so it cannot render the full card on its own — refetch via `refresh()` to get a complete `StorageUsageReport`.

> **Do not ship the API key to the browser.** Never construct a `ScaleClient` with a real API key in client-side code, and never pass such a client as `fetchUsage`. Keep `STRAVON_API_KEY` server-side and let the browser call only your own route.

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fetchUsage` | `() => Promise<StorageUsageReport>` | (required) | Resolves usage data. Point at your backend route, not the SDK directly. |
| `refreshMs` | `number` | `60000` | Poll interval in ms. `0` disables polling; `1`–`4999` raised to `5000`. |
| `brand` | `UsageWidgetBrand` | Stravon defaults | Optional color / font / radius overrides (see Branding). |
| `title` | `string` | `"Storage"` | Heading text. |
| `onUpgrade` | `() => void` | — | Called when the primary button (Upgrade/Renew plan) is clicked; shown only for `upgrade90`, `overage`, or expired. |
| `onError` | `(err: unknown) => void` | — | Called when a refresh fails. Last good data stays visible. |

### Behavior

- Polls on `refreshMs`; skips a scheduled poll while the document is hidden and refreshes on `visibilitychange` if stale.
- `refresh()` coalesces concurrent calls (no overlapping requests).
- On refresh failure the last successfully loaded data remains rendered with an error banner; a manual Retry / Refresh button is available.
- `destroy()` removes the host element, clears the poll timer, and unregisters the visibility listener.

### Branding

The widget is locked to the Stravon brand by default (navy `#002147`, gold `#d4af37`, cream `#f6f4eb`, Inter). `brand` is an optional override: it sets CSS custom properties on the host element that the widget's internal styles read. Omit any field to keep the Stravon default.

| `brand` field | CSS variable set | Default | Affects |
| --- | --- | --- | --- |
| `accent` | `--scale-accent` | `#002147` | Ring, header icon, focus outline |
| `action` | `--scale-action` | `#d4af37` | Upgrade/Renew button background (and its border) |
| `actionInk` | `--scale-action-ink` | `#111111` | Upgrade/Renew button text color |
| `ink` | `--scale-ink` | `#002147` | Text color |
| `surface` | `--scale-surface` | `#f6f4eb` | Card background |
| `font` | `--scale-font` | `Inter, system-ui, …` | Card font-family |
| `radius` | `--scale-radius` | `20px` | Card corner radius |

Minimal usage — the defaults already match Stravon:

```ts
const widget = mountUsageWidget("#usage", { fetchUsage });
```

The host app must load the Inter font; otherwise the widget falls back to `system-ui`.

Because these are standard CSS custom properties on the host, you can also set them directly on the mount target instead of via `brand`:

```css
#usage { --scale-accent: #0f8a6d; --scale-ink: #10161f; --scale-radius: 12px; }
```

### Field mapping

Where each `StorageUsageReport` field appears in the rendered widget:

| Field | Widget location | Notes |
| --- | --- | --- |
| `tier` | Header subtitle | Rendered as `"<Tier> plan · <Billing>"` (e.g. `Growth plan · Annual`). |
| `billingInterval` | Header subtitle | Capitalized, after `plan ·`. |
| `subscriptionStatus` | Status pill | `"Active"` / `"Expired"`; expired adds the `bad` pill style. |
| `usedBytes` | Donut + "used of quota" line | Drives ring fraction and center percentage. |
| `quotaBytes` | Donut + "used of quota" line | Denominator for the ring; `percent = round(used/quota*100)`. |
| `percent` | (not displayed) | The widget computes its own percentage from `usedBytes`/`quotaBytes`. |
| `level` | Ring color + note banner | `ok`/`warn80`/`upgrade90`/`overage` set ring color; `warn80`/`upgrade90` add a note. |
| `overageBytes` | "Over quota by …" line + overage banner | Shown only when `> 0`. |
| `ceilingBytes` | Footer "Hard cap …" | Compact units. |
| `currentPeriodEnd` | Stats "Period ends" | Formatted date, or "Not set" when null/invalid. |
| `fileCount` | Stats "Files" | Integer. |
| `maxFileBytes` | Stats "Max file size" | Compact units (number + unit). |

Byte values use decimal units (1 GB = 1,000,000,000 B): values below 100 in a unit show one decimal (e.g. `1.0 KB`), values ≥ 100 show an integer (e.g. `100 MB`); compact fields (footer hard cap, max file size) strip a trailing `.0` (`1 KB`).

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
