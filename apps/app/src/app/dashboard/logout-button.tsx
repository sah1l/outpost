"use client";

import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export function LogoutButton() {
  async function onClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      await signOut(clientAuth());
    } catch {
      // ignore
    }
    window.location.href = "/";
  }
  return (
    <button onClick={onClick} className="btn-ghost">
      Sign out
    </button>
  );
}
