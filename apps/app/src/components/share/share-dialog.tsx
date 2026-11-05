"use client";

import { Check, Link2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { DocShare, ShareRole } from "@offsprint/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Avatar, Banner } from "@/components/ui/feedback";
import { errorMessage, sendJson } from "@/lib/api-client";

interface WorkspaceOption {
  id: string;
  name: string;
}

interface SharesResponse {
  shares: DocShare[];
  workspaceId: string | null;
  workspaces: WorkspaceOption[];
}

export function ShareDialog({
  slug,
  title,
  isPublic: initialIsPublic,
  onClose,
  onChange,
}: {
  slug: string;
  title: string;
  isPublic: boolean;
  onClose: () => void;
  // Lets the page behind refresh whatever it shows about this doc.
  onChange?: (change: { shares: DocShare[]; workspaceId: string | null; isPublic: boolean }) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [shares, setShares] = useState<DocShare[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sendJson<SharesResponse>(`/api/docs/${slug}/shares`, "GET")
      .then((data) => {
        if (cancelled) return;
        setShares(data.shares);
        setWorkspaces(data.workspaces);
        setWorkspaceId(data.workspaceId);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e, "Sharing settings couldn't be loaded. Close this and try again."));
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function applyShares(next: DocShare[]) {
    setShares(next);
    onChange?.({ shares: next, workspaceId, isPublic });
  }

  function saveShare(shareEmail: string, shareRole: ShareRole) {
    return run(async () => {
      const data = await sendJson<{ shares: DocShare[] }>(`/api/docs/${slug}/shares`, "PUT", {
        email: shareEmail,
        role: shareRole,
      });
      applyShares(data.shares);
      setEmail("");
    });
  }

  function removeShare(shareEmail: string) {
    return run(async () => {
      const data = await sendJson<{ shares: DocShare[] }>(`/api/docs/${slug}/shares`, "DELETE", {
        email: shareEmail,
      });
      applyShares(data.shares);
    });
  }

  function moveToWorkspace(next: string | null) {
    return run(async () => {
      await sendJson(`/api/docs/${slug}`, "PATCH", { workspaceId: next });
      setWorkspaceId(next);
      onChange?.({ shares, workspaceId: next, isPublic });
    });
  }

  function setVisibility(next: boolean) {
    return run(async () => {
      await sendJson(`/api/docs/${slug}`, "PATCH", { isPublic: next });
      setIsPublic(next);
      onChange?.({ shares, workspaceId, isPublic: next });
    });
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) void saveShare(email, role);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Your browser blocked copying. Copy the link from the address bar instead.");
    }
  }

  // Someone who left a workspace can still take their own doc out of it.
  const workspaceOptions =
    workspaceId && !workspaces.some((w) => w.id === workspaceId)
      ? [...workspaces, { id: workspaceId, name: "A workspace you're no longer in" }]
      : workspaces;

  return (
    <Modal title={`Share “${title}”`} onClose={onClose} width="32rem">
      <form onSubmit={onAdd} className="flex flex-wrap gap-2">
        <input
          data-autofocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          aria-label="Email address"
          className="field min-w-0 basis-full sm:flex-1 sm:basis-48"
        />
        <RoleSelect value={role} onChange={setRole} disabled={busy} />
        <Button type="submit" variant="primary" className="flex-1 sm:flex-none" disabled={busy || !email.trim()}>
          Add
        </Button>
      </form>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
        Nobody gets an email. Send them the link, and they open it by signing in with this address.
      </p>

      {error && <Banner className="mt-3">{error}</Banner>}

      <ul className="mt-4 space-y-0.5" aria-label="People with access">
        {!loaded && !error && (
          <li className="flex items-center gap-3 py-1.5" aria-label="Loading">
            <span className="skeleton h-7 w-7 rounded-full" />
            <span className="skeleton h-3.5 w-48" />
          </li>
        )}
        {loaded && shares.length === 0 && (
          <li className="py-1.5 text-[13px] text-ink-2">No one else has been added yet.</li>
        )}
        {shares.map((share) => (
          <li key={share.email} className="flex items-center gap-2.5 py-1">
            <Avatar name={share.email} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={share.email}>
              {share.email}
            </span>
            <RoleSelect
              small
              value={share.role}
              onChange={(next) => void saveShare(share.email, next)}
              disabled={busy}
            />
            <Button
              variant="ghost"
              size="sm"
              icon
              disabled={busy}
              onClick={() => void removeShare(share.email)}
              aria-label={`Remove ${share.email}`}
              title="Remove"
            >
              <X size={15} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      {loaded && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <label htmlFor="share-visibility" className="min-w-0 flex-1 basis-52">
              <span className="block text-[13px] font-medium text-ink">Who can open the link</span>
              <span className="block text-[12px] leading-relaxed text-ink-2">
                {isPublic
                  ? "Anyone with the link can view it. No sign-in needed."
                  : "Only you and the people you've added."}
              </span>
            </label>
            <select
              id="share-visibility"
              value={isPublic ? "public" : "private"}
              disabled={busy}
              onChange={(e) => void setVisibility(e.target.value === "public")}
              className="field field-select field-sm"
            >
              <option value="private">Only people added</option>
              <option value="public">Anyone with the link</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <label htmlFor="share-workspace" className="min-w-0 flex-1 basis-52">
              <span className="block text-[13px] font-medium text-ink">Workspace</span>
              <span className="block text-[12px] leading-relaxed text-ink-2">
                {workspaceOptions.length === 0
                  ? "Create a workspace in the sidebar to share with a whole team."
                  : "Everyone in the workspace gets access to this doc."}
              </span>
            </label>
            {workspaceOptions.length > 0 && (
              <select
                id="share-workspace"
                value={workspaceId ?? ""}
                disabled={busy}
                onChange={(e) => void moveToWorkspace(e.target.value || null)}
                className="field field-select field-sm max-w-[13rem]"
              >
                <option value="">None</option>
                {workspaceOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-link">/s/{slug}</span>
        <Button className="shrink-0" onClick={() => void copyLink()}>
          {copied ? (
            <Check size={15} className="text-ok" aria-hidden="true" />
          ) : (
            <Link2 size={15} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Modal>
  );
}

export function RoleSelect({
  value,
  onChange,
  disabled,
  small,
}: {
  value: ShareRole;
  onChange: (role: ShareRole) => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Access level"
      onChange={(e) => onChange(e.target.value as ShareRole)}
      className={`field field-select shrink-0 ${small ? "field-sm" : ""}`}
    >
      <option value="viewer">Can view</option>
      <option value="editor">Can edit</option>
    </select>
  );
}
