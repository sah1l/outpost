"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { env } from "@/env";

const config = env.publicFirebaseConfig;

export function clientApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

export function clientAuth() {
  return getAuth(clientApp());
}

export const googleProvider = new GoogleAuthProvider();
