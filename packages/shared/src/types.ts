export type DocType = "html" | "md" | "zip";

export interface DocRecord {
  slug: string;
  ownerId: string | null;
  anonSessionId: string | null;
  type: DocType;
  gcsPath: string;
  entryFile: string;
  title: string;
  isPublic: boolean;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  storageUsedBytes: number;
  createdAt: number;
}

export interface InitUploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
  title: string;
}

export interface InitUploadResponse {
  slug: string;
  signedUrl: string;
  gcsPath: string;
  requiredHeaders: Record<string, string>;
}

export interface FinalizeUploadRequest {
  slug: string;
  type: DocType;
}

// ---------- CLI / device-flow auth ----------

export interface CliDeviceStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
  interval: number;
}

export type CliDeviceTokenError =
  | "authorization_pending"
  | "slow_down"
  | "expired_token"
  | "denied"
  | "invalid_request";

export interface CliDeviceTokenSuccess {
  accessToken: string;
  tokenType: "Bearer";
  user: { uid: string; email: string };
}

export interface CliDeviceTokenErrorResponse {
  error: CliDeviceTokenError;
}

// ---------- CLI upload (text or file) ----------

export type CliUploadFormat = "html" | "md";

export interface CliUploadTextRequest {
  text: string;
  format: CliUploadFormat;
  title?: string;
  isPublic?: boolean;
}

export interface CliUploadResponse {
  slug: string;
  url: string;
  title: string;
  type: DocType;
}
