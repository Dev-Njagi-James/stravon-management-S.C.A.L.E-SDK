// src/errors.ts
var ScaleError = class extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var AuthError = class extends ScaleError {
  constructor(message) {
    super(message);
  }
};
var RateLimitError = class extends ScaleError {
  retryAfterMs;
  constructor(message, retryAfterMs) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
};
var ValidationError = class extends ScaleError {
  constructor(message) {
    super(message);
  }
};
var ServerError = class extends ScaleError {
  constructor(message) {
    super(message);
  }
};
var TimeoutError = class extends ScaleError {
  constructor(message) {
    super(message);
  }
};
var QuotaExceededError = class extends ScaleError {
  limitBytes;
  usedBytes;
  constructor(message, limitBytes, usedBytes) {
    super(message);
    this.limitBytes = limitBytes;
    this.usedBytes = usedBytes;
  }
};
var SubscriptionExpiredError = class extends ScaleError {
  constructor(message) {
    super(message);
  }
};

// src/storage.ts
function resolveBodySize(body) {
  if (typeof body === "string")
    return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return void 0;
}
var StorageNamespace = class {
  /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
  requestFn;
  constructor(requestFn) {
    this.requestFn = requestFn;
  }
  /** POST /storage/files — create a new storage file. fileSize (bytes) is required. */
  async create(params) {
    const response = await this.requestFn("/storage/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    return await response.json();
  }
  /** POST /storage/files/complete — mark an upload complete. */
  async complete(params) {
    const response = await this.requestFn("/storage/files/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    return await response.json();
  }
  /** GET /storage/files?key= — fetch file metadata. */
  async read(params) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      void 0,
      2e4
    );
    return await response.json();
  }
  /** POST /storage/files/batch-read — fetch metadata for up to 50 keys in one call. */
  async batchRead(params) {
    const response = await this.requestFn("/storage/files/batch-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    return await response.json();
  }
  /** PATCH /storage/files?key= — in-place replace. fileSize (bytes) of the new file is required. */
  async modify(params) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: params.contentType,
          fileSize: params.fileSize
        })
      }
    );
    return await response.json();
  }
  /** DELETE /storage/files?key= — delete a storage file. */
  async delete(params) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      {
        method: "DELETE"
      }
    );
    return await response.json();
  }
  /** GET /storage/usage — this project's storage usage against its tier quota. */
  async usage() {
    const response = await this.requestFn("/storage/usage");
    return await response.json();
  }
  /**
   * Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT.
   * fileSize is derived from the body (string, Blob/File, ArrayBuffer, typed array/Buffer).
   * For streams or FormData, pass fileSize explicitly.
   */
  async upload(params) {
    const fileSize = params.fileSize ?? resolveBodySize(params.body);
    if (fileSize === void 0 || !Number.isInteger(fileSize) || fileSize <= 0) {
      throw new ValidationError(
        "fileSize could not be determined from body; pass fileSize explicitly"
      );
    }
    const created = await this.create({
      filename: params.filename,
      contentType: params.contentType,
      fileSize
    });
    const putResponse = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      },
      body: params.body
    });
    if (!putResponse.ok) {
      throw new Error(
        `Upload to storage failed with status ${putResponse.status}`
      );
    }
    const completed = await this.complete({ key: created.key });
    return {
      key: created.key,
      uuid: created.uuid,
      filename: created.filename,
      verified: completed.verified,
      bytes: completed.bytes,
      usage: created.usage
    };
  }
};

// src/client.ts
var ScaleClient = class {
  /** Project API key. Used to authenticate every request. */
  apiKey;
  /** Base URL for the backend. Defaults to the live backend. */
  baseUrl;
  /** Version prefix prepended to every request path. Callers never pass it. */
  versionPrefix = "/v1";
  /** Client-side fetch timeout in milliseconds. Enforced by the fetch wrapper. */
  defaultTimeoutMs;
  /** Storage namespace, wired to this client's bound request function. */
  storage;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://stravon-management.onrender.com";
    this.defaultTimeoutMs = config.timeoutMs ?? 65e3;
    this.storage = new StorageNamespace(this.request.bind(this));
  }
  /**
   * Base fetch wrapper. Prepends version prefix and base URL, injects the API key
   * header, enforces the timeout, and maps status codes to typed errors.
   */
  async request(path, init, timeoutMs) {
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
        signal: controller.signal
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
            body.usedBytes
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
  async readErrorBody(response) {
    let message = response.statusText;
    let code;
    let retryAfterMs = 0;
    let limitBytes;
    let usedBytes;
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
    }
    return { message, code, retryAfterMs, limitBytes, usedBytes };
  }
};
export {
  AuthError,
  QuotaExceededError,
  RateLimitError,
  ScaleClient,
  ScaleError,
  ServerError,
  SubscriptionExpiredError,
  TimeoutError,
  ValidationError
};
