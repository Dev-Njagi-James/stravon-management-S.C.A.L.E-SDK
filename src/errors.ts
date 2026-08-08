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
export class ScaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when the backend returns 401 (bad or missing API key).
 */
export class AuthError extends ScaleError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when the backend returns 429 (rate limited).
 * Mirrors the backend body: { error: "rate_limit_exceeded", retryAfterMs: number }.
 */
export class RateLimitError extends ScaleError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown on a 400-class response indicating bad input (e.g. missing required field).
 */
export class ValidationError extends ScaleError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when the backend returns a 5xx response.
 */
export class ServerError extends ScaleError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when the SDK's own client-side fetch timeout is hit.
 * (Default timeout enforced later in client.ts.)
 */
export class TimeoutError extends ScaleError {
  constructor(message: string) {
    super(message);
  }
}
