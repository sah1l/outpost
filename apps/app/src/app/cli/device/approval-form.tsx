"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";

type Status = "idle" | "submitting" | "approved" | "denied" | "error";

export function DeviceApprovalForm({ initialCode }: { initialCode: string }) {
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
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `The request failed (error ${res.status}). Try again.`);
      }
      setStatus(action === "approve" ? "approved" : "denied");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "The request failed. Try again.");
    }
  }

  if (status === "approved") {
    return (
      <div role="status" className="flex items-start gap-2.5 rounded-control bg-ok-tint px-3 py-2.5 text-[13px] leading-relaxed text-ink">
        <CircleCheck size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
        <span>CLI connected. Go back to your terminal, it will carry on by itself in a few seconds.</span>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <p role="status" className="rounded-control bg-hover px-3 py-2.5 text-[13px] text-ink">
        Request denied. The CLI wasn&apos;t given access.
      </p>
    );
  }

  const incomplete = status === "submitting" || code.replace("-", "").length < 8;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="device-code" className="mb-1.5 block text-[13px] font-medium text-ink">
          Code
        </label>
        <input
          id="device-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          maxLength={9}
          autoComplete="off"
          spellCheck={false}
          className="field h-11 text-center font-mono text-[18px] tracking-[0.15em]"
        />
      </div>

      {error && <Banner>{error}</Banner>}

      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => void submit("approve")} disabled={incomplete}>
          Approve
        </Button>
        <Button onClick={() => void submit("deny")} disabled={incomplete}>
          Deny
        </Button>
      </div>
    </div>
  );
}
