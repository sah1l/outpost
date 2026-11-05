export type DocType = "html" | "md" | "zip";

// What someone else can be granted on a doc or workspace.
export type ShareRole = "viewer" | "editor";
export type DocRole = "owner" | ShareRole;
export type WorkspaceRole = "owner" | ShareRole;

export interface DocShare {
  // Always normalized (see normalizeEmail) and matched only against verified emails.
  email: string;
  role: ShareRole;
  addedBy: string;
  addedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceMember {
  workspaceId: string;
  email: string;
  role: ShareRole;
  addedBy: string;
  addedAt: number;
}

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
  // Sharing. All optional because docs created before sharing don't have them.
  workspaceId?: string | null;
  shares?: DocShare[];
  // Same emails as `shares`, kept alongside so "shared with me" can be queried.
  sharedWithEmails?: string[];
  // Set whenever the file changes, unlike updatedAt which also moves on renames.
  // Lets the editor detect that someone else saved first.
  contentUpdatedAt?: number;
}

export interface UserRecord {
  uid: string;
  email: string;
  emailVerified?: boolean;
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

export interface CliUpdateTextRequest {
  slug: string;
  text?: string;
  format?: CliUploadFormat;
  title?: string;
  isPublic?: boolean;
}

// ---------- CLI delete ----------

export interface CliDeleteRequest {
  slug: string;
}

export interface CliDeleteResponse {
  slug: string;
  ok: true;
}
