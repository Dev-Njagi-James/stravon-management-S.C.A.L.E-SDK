/** Function used to make authenticated backend requests. Injected by ScaleClient. */
export type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

/** Storage namespace exposing the five storage methods plus the upload() convenience. */
export class StorageNamespace {
  /** Injected request function (ScaleClient's request(), bound). Prefixes /v1 itself. */
  private readonly requestFn: RequestFn;

  constructor(requestFn: RequestFn) {
    this.requestFn = requestFn;
  }

  /** POST /storage/files — create a new storage file. */
  async create(params: { filename: string; contentType: string; fileSize?: number }) {
    const response = await this.requestFn("/storage/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await response.json()) as { uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string };
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
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`);
    return (await response.json()) as { downloadUrl: string; publicUrl: string; key: string; filename: string };
  }

  /** PATCH /storage/files?key= — in-place replace of file metadata. */
  async modify(params: { key: string; contentType: string; fileSize?: number }) {
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: params.contentType, fileSize: params.fileSize }),
    });
    return (await response.json()) as { uploadUrl: string; publicUrl: string; key: string; uuid: string; filename: string };
  }

  /** DELETE /storage/files?key= — delete a storage file. */
  async delete(params: { key: string }) {
    const response = await this.requestFn(`/storage/files?key=${encodeURIComponent(params.key)}`, {
      method: "DELETE",
    });
    return (await response.json()) as { success: boolean; key: string };
  }

  /** Upload convenience: create -> PUT to uploadUrl -> complete. No retry on PUT. */
  async upload(params: { filename: string; contentType: string; body: BodyInit }) {
    const created = await this.create({ filename: params.filename, contentType: params.contentType });

    const putResponse = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: params.body,
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
      bytes: completed.bytes,
    };
  }
}