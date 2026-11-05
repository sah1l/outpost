// Loaded on demand so every signed-in page doesn't carry the Firebase client for one menu item.
export async function signOutAndLeave(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  try {
    const [{ signOut }, { clientAuth }] = await Promise.all([
      import("firebase/auth"),
      import("@/lib/firebase-client"),
    ]);
    await signOut(clientAuth());
  } catch {
    // The session cookie is already gone, which is what matters.
  }
  window.location.href = "/";
}
