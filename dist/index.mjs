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

// src/storage.ts
var StorageNamespace = class {
  /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
  requestFn;
  constructor(requestFn) {
    this.requestFn = requestFn;
  }
  /** POST /storage/files — create a new storage file. */
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
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`);
    return await response.json();
  }
  /** PATCH /storage/files?key= — in-place replace of file metadata. */
  async modify(params) {
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: params.contentType, fileSize: params.fileSize })
    });
    return await response.json();
  }
  /** DELETE /storage/files?key= — delete a storage file. */
  async delete(params) {
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`, {
      method: "DELETE"
    });
    return await response.json();
  }
  /** Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT. */
  async upload(params) {
    const created = await this.create({ filename: params.filename, contentType: params.contentType });
    const putResponse = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": params.contentType },
      body: params.body
    });
    if (!putResponse.ok) {
      throw new Error(`Upload to storage failed with status ${putResponse.status}`);
    }
    const completed = await this.complete({ key: created.key });
    return {
      key: created.key,
      uuid: created.uuid,
      filename: created.filename,
      verified: completed.verified,
      bytes: completed.bytes
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
  defaultTimeoutMs = 1e4;
  /** Storage namespace, wired to this client's bound request function. */
  storage;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://stravon-management.onrender.com";
    this.storage = new StorageNamespace(this.request.bind(this));
  }
  /**
   * Base fetch wrapper. Prepends version prefix and base URL, injects the API key
   * header, enforces the timeout, and maps status codes to typed errors.
   */
  async request(path, init) {
    const url = `${this.baseUrl}${this.versionPrefix}${path}`;
    const headers = new Headers(init?.headers);
    headers.set("x-api-key", this.apiKey);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
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
  async readErrorBody(response) {
    let message = response.statusText;
    let retryAfterMs = 0;
    try {
      const data = await response.json();
      if (typeof data?.error === "string") message = data.error;
      else if (typeof data?.message === "string") message = data.message;
      if (typeof data?.retryAfterMs === "number") retryAfterMs = data.retryAfterMs;
    } catch {
    }
    return { message, retryAfterMs };
  }
};
export {
  AuthError,
  RateLimitError,
  ScaleClient,
  ScaleError,
  ServerError,
  TimeoutError,
  ValidationError
};
