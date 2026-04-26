"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "approved" | "denied" | "error";

export function DeviceApprovalForm({ initialCode, email }: { initialCode: string; email: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "approve" | "deny") {
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/cli/device/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userCode: code.trim().toUpperCase(), action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `request failed: ${res.status}`);
      }
      setStatus(action === "approve" ? "approved" : "denied");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "request failed");
    }
  }

  if (status === "approved") {
    return (
      <div className="space-y-4">
        <p className="border border-[var(--green,#1a7f37)] bg-[var(--paper)] px-4 py-3 text-[14px]">
          CLI authorized. You can return to your terminal — the CLI will pick up the
          token within a few seconds.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <p className="border border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-[14px]">
        Request denied.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="smallcaps mb-2 block">Verification code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          maxLength={9}
          autoComplete="off"
          className="w-full border border-[var(--ink)] bg-[var(--paper)] px-3 py-2 font-mono text-[18px] tracking-widest"
        />
      </div>

      <p className="text-[13px] text-[var(--ink-3)]">
        Approving as <span className="font-mono">{email}</span>.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => submit("approve")}
          disabled={status === "submitting" || code.replace("-", "").length < 8}
          className="btn-accent"
        >
          {status === "submitting" ? "Working…" : "Approve"}
        </button>
        <button
          onClick={() => submit("deny")}
          disabled={status === "submitting" || code.replace("-", "").length < 8}
          className="btn-ghost"
        >
          Deny
        </button>
      </div>

      {error && (
        <p className="border border-[var(--red)] bg-[var(--paper)] px-3 py-2 text-[13px] text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}
