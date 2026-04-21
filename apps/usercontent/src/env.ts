function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  gcpProjectId: () => required("GCP_PROJECT_ID"),
  gcsBucket: () => required("GCS_BUCKET"),
  firebaseProjectId: () => required("FIREBASE_PROJECT_ID"),
  firebaseClientEmail: () => required("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: () =>
    required("FIREBASE_PRIVATE_KEY")
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .trim()
      .replace(/^"(.*)"$/s, "$1"),
  firestoreDatabaseId: () => process.env.FIRESTORE_DATABASE_ID || "(default)",
  appBaseUrl: () => required("APP_BASE_URL"),
};
