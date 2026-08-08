import { AuthError, RateLimitError, ValidationError, ServerError, TimeoutError } from "./errors";
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
  private readonly defaultTimeoutMs = 10000;

  /** Storage namespace, wired to this client's bound request function. */
  public readonly storage: StorageNamespace;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://stravon-management.onrender.com";
    this.storage = new StorageNamespace(this.request.bind(this));
  }

  /**
   * Base fetch wrapper. Prepends version prefix and base URL, injects the API key
   * header, enforces the timeout, and maps status codes to typed errors.
   */
  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${this.versionPrefix}${path}`;

    const headers = new Headers(init?.headers);
    headers.set("x-api-key", this.apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

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

      if (response.status >= 400 && response.status <= 499) {
        throw new ValidationError((await this.readErrorBody(response)).message);
      }

      if (response.status >= 500 && response.status <= 599) {
        throw new ServerError((await this.readErrorBody(response)).message);
      }

      return response;
    } catch (err) {
      if (controller.signal.aborted) {
        throw new TimeoutError(`Request timed out after ${this.defaultTimeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readErrorBody(response: Response): Promise<{ message: string; retryAfterMs: number }> {
    let message = response.statusText;
    let retryAfterMs = 0;

    try {
      const data = await response.json();
      if (typeof data?.error === "string") message = data.error;
      else if (typeof data?.message === "string") message = data.message;
      if (typeof data?.retryAfterMs === "number") retryAfterMs = data.retryAfterMs;
    } catch {
      // Body not JSON — keep statusText as the message.
    }

    return { message, retryAfterMs };
  }
}