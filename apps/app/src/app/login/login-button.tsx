"use client";

import { useState } from "react";
import { type AuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import {
  clientAuth,
  googleProvider,
  microsoftProvider,
} from "@/lib/firebase-client";

type ProviderId = "google" | "microsoft";

function friendlyError(e: unknown): string | null {
  const code = (e as { code?: string } | null)?.code;
  // Closing the window is a choice, not a failure, so there's nothing to report.
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/popup-blocked") {
    return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "This email is already linked to your other sign-in option. Use that one instead.";
  }
  if (code === "auth/network-request-failed") {
    return "Sign-in couldn't reach the network. Check your connection and try again.";
  }
  return "Sign-in didn't work. Try again.";
}

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
      console.error("sign-in failed", e);
      setError(friendlyError(e));
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-col gap-2.5">
      <Button className="h-10 w-full" onClick={() => void signIn("google", googleProvider)} disabled={busy}>
        <GoogleMark />
        {pending === "google" ? "Signing in" : "Continue with Google"}
      </Button>
      <Button className="h-10 w-full" onClick={() => void signIn("microsoft", microsoftProvider())} disabled={busy}>
        <MicrosoftMark />
        {pending === "microsoft" ? "Signing in" : "Continue with Microsoft"}
      </Button>
      {error && <Banner className="mt-1">{error}</Banner>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
