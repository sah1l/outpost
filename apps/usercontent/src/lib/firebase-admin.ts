import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "@/env";

let adminApp: App | undefined;

function getApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return existing;
  }
  const hasInlineCreds = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
  adminApp = initializeApp({
    credential: hasInlineCreds
      ? cert({
          projectId: env.firebaseProjectId(),
          clientEmail: env.firebaseClientEmail(),
          privateKey: env.firebasePrivateKey(),
        })
      : applicationDefault(),
    projectId: env.firebaseProjectId(),
  });
  return adminApp;
}

export function adminFirestore() {
  return getFirestore(getApp(), env.firestoreDatabaseId());
}
