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
      // dotenv sometimes preserves surrounding quotes — strip them
      .replace(/^"(.*)"$/s, "$1"),
  firestoreDatabaseId: () => process.env.FIRESTORE_DATABASE_ID || "(default)",

  publicFirebaseConfig: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  },

  publicMicrosoftTenant: process.env.NEXT_PUBLIC_MICROSOFT_TENANT ?? "",

  usercontentBaseUrl: () => required("USERCONTENT_BASE_URL"),
  appBaseUrl: () => required("APP_BASE_URL"),
  appBaseUrlNoTrailingSlash: () => required("APP_BASE_URL").replace(/\/$/, ""),

  minimaxApiKey: () => process.env.MINIMAX_API_KEY || "",
  minimaxModel: () => process.env.MINIMAX_MODEL || "MiniMax-M2",
};
