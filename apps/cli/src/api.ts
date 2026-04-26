import type {
  CliDeviceStartResponse,
  CliDeviceTokenError,
  CliDeviceTokenSuccess,
  CliUploadResponse,
  CliUploadFormat,
} from "@offsprint/shared";
import { getApiBase, readAuth } from "./config.js";

class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export async function startDeviceFlow(): Promise<CliDeviceStartResponse> {
  const res = await fetch(`${getApiBase()}/api/cli/device`, { method: "POST" });
  const body = await parseJson(res);
  if (!res.ok) throw new ApiError(res.status, `device start failed: ${res.status}`, body);
  return body as CliDeviceStartResponse;
}

export interface PollResult {
  status: "pending" | "approved" | "denied" | "expired" | "error";
  token?: CliDeviceTokenSuccess;
  error?: CliDeviceTokenError | string;
}

export async function pollForToken(deviceCode: string): Promise<PollResult> {
  const res = await fetch(`${getApiBase()}/api/cli/device/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceCode }),
  });
  const body = (await parseJson(res)) as { error?: CliDeviceTokenError } & CliDeviceTokenSuccess;
  if (res.ok) return { status: "approved", token: body as CliDeviceTokenSuccess };
  const err = body?.error;
  if (err === "authorization_pending" || err === "slow_down") return { status: "pending", error: err };
  if (err === "expired_token") return { status: "expired", error: err };
  if (err === "denied") return { status: "denied", error: err };
  return { status: "error", error: err || `http ${res.status}` };
}

export interface UploadOptions {
  title?: string;
  isPublic?: boolean;
}

async function authedHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const auth = await readAuth();
  if (!auth) throw new Error("Not authenticated. Run `outpost login` first.");
  return { authorization: `Bearer ${auth.accessToken}`, ...extra };
}

export async function uploadText(
  text: string,
  format: CliUploadFormat,
  opts: UploadOptions = {},
): Promise<CliUploadResponse> {
  const headers = await authedHeaders({ "content-type": "application/json" });
  const res = await fetch(`${getApiBase()}/api/cli/upload`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, format, title: opts.title, isPublic: opts.isPublic ?? false }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new ApiError(res.status, uploadErrorMessage(res.status, body), body);
  return body as CliUploadResponse;
}

export async function uploadFile(
  filename: string,
  buffer: Buffer,
  contentType: string,
  opts: UploadOptions = {},
): Promise<CliUploadResponse> {
  const headers = await authedHeaders();
  const form = new FormData();
  // BlobPart requires an ArrayBuffer-backed view (TS rejects SharedArrayBuffer-
  // backed Buffers), so copy into a fresh Uint8Array.
  const view = new Uint8Array(buffer.byteLength);
  view.set(buffer);
  form.append("file", new Blob([view], { type: contentType }), filename);
  if (opts.title) form.append("title", opts.title);
  if (opts.isPublic) form.append("isPublic", "true");
  const res = await fetch(`${getApiBase()}/api/cli/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  const body = await parseJson(res);
  if (!res.ok) throw new ApiError(res.status, uploadErrorMessage(res.status, body), body);
  return body as CliUploadResponse;
}

function uploadErrorMessage(status: number, body: unknown): string {
  const err = (body as { error?: string } | null)?.error;
  if (status === 401) return "Not authenticated (token may have expired). Run `outpost login` again.";
  if (status === 413) return "File too large.";
  return err ? `Upload failed: ${err}` : `Upload failed: HTTP ${status}`;
}

export async function whoami(): Promise<{ uid: string; email: string; tokenExpiresAt: number } | null> {
  const auth = await readAuth();
  if (!auth) return null;
  const res = await fetch(`${getApiBase()}/api/cli/whoami`, {
    headers: { authorization: `Bearer ${auth.accessToken}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`whoami failed: HTTP ${res.status}`);
  return (await res.json()) as { uid: string; email: string; tokenExpiresAt: number };
}
