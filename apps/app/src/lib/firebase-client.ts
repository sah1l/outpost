"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, OAuthProvider, getAuth } from "firebase/auth";
import { env } from "@/env";

const config = env.publicFirebaseConfig;

export function clientApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

export function clientAuth() {
  return getAuth(clientApp());
}

export const googleProvider = new GoogleAuthProvider();

export function microsoftProvider() {
  const provider = new OAuthProvider("microsoft.com");
  const tenant = env.publicMicrosoftTenant;
  if (tenant) provider.setCustomParameters({ tenant });
  return provider;
}
