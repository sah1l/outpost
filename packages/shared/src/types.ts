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
