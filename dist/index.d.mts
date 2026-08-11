/** Function used to make authenticated backend requests. Injected by ScaleClient. */
type RequestFn = (path: string, init?: RequestInit, timeoutMs?: number) => Promise<Response>;
/** Storage namespace exposing the five storage methods plus the upload() convenience. */
declare class StorageNamespace {
    /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
    private readonly requestFn;
    constructor(requestFn: RequestFn);
    /** POST /storage/files — create a new storage file. */
    create(params: {
        filename: string;
        contentType: string;
        fileSize?: number;
    }): Promise<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
        uuid: string;
        filename: string;
    }>;
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
    /** PATCH /storage/files?key= — in-place replace of file metadata. */
    modify(params: {
        key: string;
        contentType: string;
        fileSize?: number;
    }): Promise<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
        uuid: string;
        filename: string;
    }>;
    /** DELETE /storage/files?key= — delete a storage file. */
    delete(params: {
        key: string;
    }): Promise<{
        success: boolean;
        key: string;
    }>;
    /** Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT. */
    upload(params: {
        filename: string;
        contentType: string;
        body: BodyInit;
    }): Promise<{
        key: string;
        uuid: string;
        filename: string;
        verified: boolean;
        bytes: number;
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

export { AuthError, RateLimitError, ScaleClient, ScaleError, ServerError, TimeoutError, ValidationError };
