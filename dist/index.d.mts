/** Function used to make authenticated backend requests. Injected by ScaleClient. */
type RequestFn = (path: string, init?: RequestInit, timeoutMs?: number) => Promise<Response>;
type UsageLevel = "ok" | "warn80" | "upgrade90" | "overage";
/** Usage state returned alongside create() and modify(). */
interface UsageSnapshot {
    usedBytes: number;
    quotaBytes: number;
    ceilingBytes: number;
    percent: number;
    level: UsageLevel;
    overageBytes: number;
}
/** Response of GET /v1/storage/usage. */
interface StorageUsageReport extends UsageSnapshot {
    tier: string;
    billingInterval: "monthly" | "annual";
    subscriptionStatus: "active" | "expired";
    currentPeriodEnd: string | null;
    fileCount: number;
    maxFileBytes: number;
}
interface PresignedUpload {
    uploadUrl: string;
    publicUrl: string;
    key: string;
    uuid: string;
    filename: string;
    usage: UsageSnapshot;
}
/** Storage namespace exposing the storage methods, usage(), and the upload() convenience. */
declare class StorageNamespace {
    /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
    private readonly requestFn;
    constructor(requestFn: RequestFn);
    /** POST /storage/files — create a new storage file. fileSize (bytes) is required. */
    create(params: {
        filename: string;
        contentType: string;
        fileSize: number;
    }): Promise<PresignedUpload>;
    /** POST /storage/files/complete — mark an upload complete. */
    complete(params: {
        key: string;
    }): Promise<{
        verified: boolean;
        bytes: number;
    }>;
    /** GET /storage/files?key= — fetch file metadata. */
    read(params: {
        key: string;
    }): Promise<{
        downloadUrl: string;
        publicUrl: string;
        key: string;
        filename: string;
    }>;
    /** POST /storage/files/batch-read — fetch metadata for up to 50 keys in one call. */
    batchRead(params: {
        keys: string[];
    }): Promise<{
        results: Array<{
            key: string;
            downloadUrl: string;
            publicUrl: string;
            filename: string;
        } | {
            key: string;
            error: string;
        }>;
        retryAfterMs?: number;
    }>;
    /** PATCH /storage/files?key= — in-place replace. fileSize (bytes) of the new file is required. */
    modify(params: {
        key: string;
        contentType: string;
        fileSize: number;
    }): Promise<PresignedUpload>;
    /** DELETE /storage/files?key= — delete a storage file. */
    delete(params: {
        key: string;
    }): Promise<{
        success: boolean;
        key: string;
    }>;
    /** GET /storage/usage — this project's storage usage against its tier quota. */
    usage(): Promise<StorageUsageReport>;
    /**
     * Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT.
     * fileSize is derived from the body (string, Blob/File, ArrayBuffer, typed array/Buffer).
     * For streams or FormData, pass fileSize explicitly.
     */
    upload(params: {
        filename: string;
        contentType: string;
        body: BodyInit;
        fileSize?: number;
    }): Promise<{
        key: string;
        uuid: string;
        filename: string;
        verified: boolean;
        bytes: number;
        usage: UsageSnapshot;
    }>;
}

/**
 * Scale Client SDK client.
 */
declare class ScaleClient {
    /** Project API key. Used to authenticate every request. */
    private readonly apiKey;
    /** Base URL for the backend. Defaults to the live backend. */
    private readonly baseUrl;
    /** Version prefix prepended to every request path. Callers never pass it. */
    private readonly versionPrefix;
    /** Client-side fetch timeout in milliseconds. Enforced by the fetch wrapper. */
    private readonly defaultTimeoutMs;
    /** Storage namespace, wired to this client's bound request function. */
    readonly storage: StorageNamespace;
    constructor(config: {
        apiKey: string;
        baseUrl?: string;
        timeoutMs?: number;
    });
    /**
     * Base fetch wrapper. Prepends version prefix and base URL, injects the API key
     * header, enforces the timeout, and maps status codes to typed errors.
     */
    private request;
    private readErrorBody;
}

/**
 * V8/Node-specific extension to the Error constructor for capturing a clean
 * stack trace. Declared here because it is not part of the standard
 * lib types; the SDK targets Node 18+ which provides it at runtime.
 */
declare global {
    interface ErrorConstructor {
        captureStackTrace?(error: Error, constructor?: Function): void;
    }
}
/**
 * Base error class for all SDK errors.
 * Extends the native Error so callers can rely on `instanceof Error`.
 */
declare class ScaleError extends Error {
    constructor(message: string);
}
/**
 * Thrown when the backend returns 401 (bad or missing API key).
 */
declare class AuthError extends ScaleError {
    constructor(message: string);
}
/**
 * Thrown when the backend returns 429 (rate limited).
 * Mirrors the backend body: { error: "rate_limit_exceeded", retryAfterMs: number }.
 */
declare class RateLimitError extends ScaleError {
    readonly retryAfterMs: number;
    constructor(message: string, retryAfterMs: number);
}
/**
 * Thrown on a 400-class response indicating bad input (e.g. missing required field).
 */
declare class ValidationError extends ScaleError {
    constructor(message: string);
}
/**
 * Thrown when the backend returns a 5xx response.
 */
declare class ServerError extends ScaleError {
    constructor(message: string);
}
/**
 * Thrown when the SDK's own client-side fetch timeout is hit.
 * (Default timeout enforced later in client.ts.)
 */
declare class TimeoutError extends ScaleError {
    constructor(message: string);
}
/**
 * Thrown on 403 storage_ceiling_exceeded. Carries the limit and current usage in bytes.
 */
declare class QuotaExceededError extends ScaleError {
    readonly limitBytes?: number;
    readonly usedBytes?: number;
    constructor(message: string, limitBytes?: number, usedBytes?: number);
}
/**
 * Thrown on 403 subscription_expired. Create and modify are blocked; read, usage and delete still work.
 */
declare class SubscriptionExpiredError extends ScaleError {
    constructor(message: string);
}

export { AuthError, type PresignedUpload, QuotaExceededError, RateLimitError, ScaleClient, ScaleError, ServerError, type StorageUsageReport, SubscriptionExpiredError, TimeoutError, type UsageLevel, type UsageSnapshot, ValidationError };
