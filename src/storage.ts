import { ValidationError } from "./errors";

/** Function used to make authenticated backend requests. Injected by ScaleClient. */
export type RequestFn = (
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
) => Promise<Response>;

export type UsageLevel = "ok" | "warn80" | "upgrade90" | "overage";

/** Usage state returned alongside create() and modify(). */
export interface UsageSnapshot {
  usedBytes: number;
  quotaBytes: number;
  ceilingBytes: number;
  percent: number;
  level: UsageLevel;
  overageBytes: number;
}

/** Response of GET /v1/storage/usage. */
export interface StorageUsageReport extends UsageSnapshot {
  tier: string;
  billingInterval: "monthly" | "annual";
  subscriptionStatus: "active" | "expired";
  currentPeriodEnd: string | null;
  fileCount: number;
  maxFileBytes: number;
}

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  uuid: string;
  filename: string;
  usage: UsageSnapshot;
}

/** Byte size of a body, or undefined when it cannot be known up front (streams, FormData). */
function resolveBodySize(body: BodyInit): number | undefined {
  if (typeof body === "string")
    return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return undefined;
}

/** Storage namespace exposing the storage methods, usage(), and the upload() convenience. */
export class StorageNamespace {
  /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
  private readonly requestFn: RequestFn;

  constructor(requestFn: RequestFn) {
    this.requestFn = requestFn;
  }

  /** POST /storage/files — create a new storage file. fileSize (bytes) is required. */
  async create(params: {
    filename: string;
    contentType: string;
    fileSize: number;
  }) {
    const response = await this.requestFn("/storage/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await response.json()) as PresignedUpload;
  }

  /** POST /storage/files/complete — mark an upload complete. */
  async complete(params: { key: string }) {
    const response = await this.requestFn("/storage/files/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await response.json()) as { verified: boolean; bytes: number };
  }

  /** GET /storage/files?key= — fetch file metadata. */
  async read(params: { key: string }) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      undefined,
      20000,
    );
    return (await response.json()) as {
      downloadUrl: string;
      publicUrl: string;
      key: string;
      filename: string;
    };
  }

  /** POST /storage/files/batch-read — fetch metadata for up to 50 keys in one call. */
  async batchRead(params: { keys: string[] }) {
    const response = await this.requestFn("/storage/files/batch-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await response.json()) as {
      results: Array<
        | {
            key: string;
            downloadUrl: string;
            publicUrl: string;
            filename: string;
          }
        | { key: string; error: string }
      >;
      retryAfterMs?: number;
    };
  }

  /** PATCH /storage/files?key= — in-place replace. fileSize (bytes) of the new file is required. */
  async modify(params: { key: string; contentType: string; fileSize: number }) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: params.contentType,
          fileSize: params.fileSize,
        }),
      },
    );
    return (await response.json()) as PresignedUpload;
  }

  /** DELETE /storage/files?key= — delete a storage file. */
  async delete(params: { key: string }) {
    const response = await this.requestFn(
      `/storage/files?key=${encodeURIComponent(params.key)}`,
      {
        method: "DELETE",
      },
    );
    return (await response.json()) as { success: boolean; key: string };
  }

  /** GET /storage/usage — this project's storage usage against its tier quota. */
  async usage() {
    const response = await this.requestFn("/storage/usage");
    return (await response.json()) as StorageUsageReport;
  }

  /**
   * Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT.
   * fileSize is derived from the body (string, Blob/File, ArrayBuffer, typed array/Buffer).
   * For streams or FormData, pass fileSize explicitly.
   */
  async upload(params: {
    filename: string;
    contentType: string;
    body: BodyInit;
    fileSize?: number;
  }) {
    const fileSize = params.fileSize ?? resolveBodySize(params.body);
    if (
      fileSize === undefined ||
      !Number.isInteger(fileSize) ||
      fileSize <= 0
    ) {
      throw new ValidationError(
        "fileSize could not be determined from body; pass fileSize explicitly",
      );
    }

    const created = await this.create({
      filename: params.filename,
      contentType: params.contentType,
      fileSize,
    });

    const putResponse = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: params.body,
    });

    if (!putResponse.ok) {
      throw new Error(
        `Upload to storage failed with status ${putResponse.status}`,
      );
    }

    const completed = await this.complete({ key: created.key });

    return {
      key: created.key,
      uuid: created.uuid,
      filename: created.filename,
      verified: completed.verified,
      bytes: completed.bytes,
      usage: created.usage,
    };
  }
}
