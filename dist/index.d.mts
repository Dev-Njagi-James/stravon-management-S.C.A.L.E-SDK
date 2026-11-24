import { S as StorageNamespace } from './errors-DSxiOpqn.mjs';
export { A as AuthError, P as PresignedUpload, Q as QuotaExceededError, R as RateLimitError, a as ScaleError, b as ServerError, c as StorageUsageReport, d as SubscriptionExpiredError, T as TimeoutError, U as UsageLevel, e as UsageSnapshot, V as ValidationError } from './errors-DSxiOpqn.mjs';

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

export { ScaleClient };
