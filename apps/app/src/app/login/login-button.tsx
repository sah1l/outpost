"use client";

import { useState } from "react";
import { type AuthProvider, signInWithPopup } from "firebase/auth";
import {
  clientAuth,
  googleProvider,
  microsoftProvider,
} from "@/lib/firebase-client";

type ProviderId = "google" | "microsoft";

export function LoginButton({ redirectTo }: { redirectTo: string }) {
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: ProviderId, provider: AuthProvider) {
    setPending(id);
    setError(null);
    try {
      const cred = await signInWithPopup(clientAuth(), provider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error(`session exchange failed: ${res.status}`);
      window.location.href = redirectTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign in failed");
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => signIn("google", googleProvider)}
        disabled={busy}
        className="btn-accent"
      >
        <GoogleMark />
        <span>
          {pending === "google" ? "Signing in…" : "Continue with Google"}
        </span>
      </button>
      <button
        onClick={() => signIn("microsoft", microsoftProvider())}
        disabled={busy}
        className="btn-accent"
      >
        <MicrosoftMark />
        <span>
          {pending === "microsoft" ? "Signing in…" : "Continue with Microsoft"}
        </span>
      </button>
      {error && (
        <p className="mt-1 border border-[var(--red)] bg-[var(--paper)] px-3 py-2 text-[13px] text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="currentColor"
        d="M44.5 20H24v8.5h11.8C34.7 33 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
