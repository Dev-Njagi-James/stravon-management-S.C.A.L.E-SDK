import {
  AuthError,
  RateLimitError,
  ValidationError,
  ServerError,
  TimeoutError,
  QuotaExceededError,
  SubscriptionExpiredError,
} from "./errors";
import { StorageNamespace } from "./storage";

/**
 * Scale Client SDK client.
 */
export class ScaleClient {
  /** Project API key. Used to authenticate every request. */
  private readonly apiKey: string;

  /** Base URL for the backend. Defaults to the live backend. */
  private readonly baseUrl: string;

  /** Version prefix prepended to every request path. Callers never pass it. */
  private readonly versionPrefix = "/v1";

  /** Client-side fetch timeout in milliseconds. Enforced by the fetch wrapper. */
  private readonly defaultTimeoutMs: number;

  /** Storage namespace, wired to this client's bound request function. */
  public readonly storage: StorageNamespace;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://stravon-management.onrender.com";
    this.defaultTimeoutMs = config.timeoutMs ?? 65000;
    this.storage = new StorageNamespace(this.request.bind(this));
  }

  /**
   * Base fetch wrapper. Prepends version prefix and base URL, injects the API key
   * header, enforces the timeout, and maps status codes to typed errors.
   */
  private async request(
    path: string,
    init?: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const url = `${this.baseUrl}${this.versionPrefix}${path}`;

    const headers = new Headers(init?.headers);
    headers.set("x-api-key", this.apiKey);

    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new AuthError((await this.readErrorBody(response)).message);
      }

      if (response.status === 429) {
        const { message, retryAfterMs } = await this.readErrorBody(response);
        throw new RateLimitError(message, retryAfterMs);
      }
      if (response.status === 403) {
        const body = await this.readErrorBody(response);
        if (body.code === "storage_ceiling_exceeded") {
          throw new QuotaExceededError(
            body.message,
            body.limitBytes,
            body.usedBytes,
          );
        }
        if (body.code === "subscription_expired") {
          throw new SubscriptionExpiredError(body.message);
        }
        throw new ValidationError(body.message);
      }

      if (response.status >= 400 && response.status <= 499) {
        throw new ValidationError((await this.readErrorBody(response)).message);
      }

      if (response.status >= 500 && response.status <= 599) {
        throw new ServerError((await this.readErrorBody(response)).message);
      }

      return response;
    } catch (err) {
      if (controller.signal.aborted) {
        throw new TimeoutError(`Request timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readErrorBody(response: Response): Promise<{
    message: string;
    code?: string;
    retryAfterMs: number;
    limitBytes?: number;
    usedBytes?: number;
  }> {
    let message = response.statusText;
    let code: string | undefined;
    let retryAfterMs = 0;
    let limitBytes: number | undefined;
    let usedBytes: number | undefined;

    try {
      const data = await response.json();
      if (typeof data?.error === "string") code = data.error;
      if (typeof data?.message === "string") message = data.message;
      else if (code) message = code;
      if (typeof data?.retryAfterMs === "number")
        retryAfterMs = data.retryAfterMs;
      if (typeof data?.limitBytes === "number") limitBytes = data.limitBytes;
      if (typeof data?.usedBytes === "number") usedBytes = data.usedBytes;
    } catch {
      // Body not JSON — keep statusText as the message.
    }

    return { message, code, retryAfterMs, limitBytes, usedBytes };
  }
}
