"use client";

import { Ellipsis, LogOut, Trash2, Type, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  canEditWorkspaceDocs,
  MAX_WORKSPACE_NAME_LENGTH,
  type ShareRole,
  type WorkspaceRole,
} from "@offsprint/shared";
import { DocTable, type DocRow } from "@/components/docs/doc-table";
import { RoleSelect } from "@/components/share/share-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Avatar, Banner, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { errorMessage, sendJson } from "@/lib/api-client";

interface MemberRow {
  email: string;
  role: ShareRole;
}

export function WorkspaceShell({
  id,
  initialName,
  ownerEmail,
  role,
  viewerEmail,
  docs,
  initialMembers,
}: {
  id: string;
  initialName: string;
  ownerEmail: string;
  role: WorkspaceRole;
  viewerEmail: string | null;
  docs: DocRow[];
  initialMembers: MemberRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<ShareRole>("viewer");
  const [confirming, setConfirming] = useState<"delete" | "leave" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "owner";
  const canAddDocs = canEditWorkspaceDocs(role);

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

  function saveMember(memberEmail: string, memberRole: ShareRole) {
    return run(async () => {
      const data = await sendJson<{ members: MemberRow[] }>(`/api/workspaces/${id}/members`, "PUT", {
        email: memberEmail,
        role: memberRole,
      });
      setMembers(data.members);
      setEmail("");
    });
  }

  function removeMember(memberEmail: string) {
    return run(async () => {
      const data = await sendJson<{ members: MemberRow[] }>(`/api/workspaces/${id}/members`, "DELETE", {
        email: memberEmail,
      });
      setMembers(data.members);
    });
  }

  function onAddMember(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) void saveMember(email, newRole);
  }

  async function onRename(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const data = await sendJson<{ name: string }>(`/api/workspaces/${id}`, "PATCH", { name: draftName });
      setName(data.name);
      setRenaming(false);
      router.refresh(); // The sidebar shows this name too.
    });
  }

  return (
    <>
      {renaming ? (
        <form onSubmit={onRename} className="mb-6 flex max-w-lg flex-wrap items-center gap-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setRenaming(false);
            }}
            maxLength={MAX_WORKSPACE_NAME_LENGTH}
            aria-label="Workspace name"
            className="field min-w-0 flex-1 basis-56"
          />
          <Button type="submit" variant="primary" disabled={busy || !draftName.trim()}>
            Save
          </Button>
          <Button onClick={() => setRenaming(false)}>Cancel</Button>
        </form>
      ) : (
        <PageHeader
          title={name}
          actions={
            (isOwner || viewerEmail) && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="sm" icon aria-label="Workspace actions">
                    <Ellipsis size={16} aria-hidden="true" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {isOwner ? (
                    <>
                      <MenuItem
                        icon={<Type aria-hidden="true" />}
                        onSelect={() => {
                          setDraftName(name);
                          setRenaming(true);
                        }}
                      >
                        Rename
                      </MenuItem>
                      <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => setConfirming("delete")}>
                        Delete workspace
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem icon={<LogOut aria-hidden="true" />} onSelect={() => setConfirming("leave")}>
                      Leave workspace
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            )
          }
        />
      )}

      {error && <Banner className="mb-5">{error}</Banner>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Docs in this workspace" className="min-w-0">
          {docs.length === 0 ? (
            <EmptyState title="No docs in this workspace yet">
              {canAddDocs ? (
                <>
                  Open{" "}
                  <Link href="/dashboard" className="text-link font-medium">
                    your docs
                  </Link>
                  , choose Share on one, and pick this workspace.
                </>
              ) : (
                "Docs show up here when an editor adds them."
              )}
            </EmptyState>
          ) : (
            <DocTable docs={docs} compact />
          )}
        </section>

        <section aria-labelledby="members-heading" className="min-w-0">
          <h2 id="members-heading" className="text-[14px] font-semibold text-ink">
            Members
          </h2>
          <ul className="mt-2 space-y-0.5">
            <li className="flex items-center gap-2.5 py-1.5">
              <Avatar name={ownerEmail} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={ownerEmail}>
                {ownerEmail}
              </span>
              <span className="text-[13px] text-ink-3">Owner</span>
            </li>
            {members.map((member) => (
              <li key={member.email} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1">
                <Avatar name={member.email} />
                <span className="min-w-0 flex-1 basis-32 truncate text-[13px] text-ink" title={member.email}>
                  {member.email}
                </span>
                {isOwner ? (
                  <div className="ml-auto flex items-center gap-1">
                    <RoleSelect
                      small
                      value={member.role}
                      onChange={(next) => void saveMember(member.email, next)}
                      disabled={busy}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      disabled={busy}
                      onClick={() => void removeMember(member.email)}
                      aria-label={`Remove ${member.email}`}
                      title="Remove"
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-[13px] text-ink-3">
                    {member.role === "editor" ? "Can edit" : "Can view"}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <form onSubmit={onAddMember} className="mt-4 border-t border-line pt-4">
              <label htmlFor="member-email" className="mb-1.5 block text-[13px] font-medium text-ink">
                Add someone
              </label>
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                aria-label="Member email"
                className="field"
              />
              <div className="mt-2 flex items-center gap-2">
                <RoleSelect value={newRole} onChange={setNewRole} disabled={busy} />
                <Button type="submit" className="flex-1" disabled={busy || !email.trim()}>
                  Add
                </Button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                Nobody gets an email. Tell them to sign in with this address, and the workspace shows
                up in their sidebar.
              </p>
            </form>
          )}
        </section>
      </div>

      {confirming === "delete" && (
        <ConfirmDialog
          title={`Delete “${name}”?`}
          description="The docs stay with their owners, but members lose the access they had through this workspace."
          confirmLabel="Delete workspace"
          destructive
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            await sendJson(`/api/workspaces/${id}`, "DELETE");
            window.location.href = "/dashboard";
          }}
        />
      )}

      {confirming === "leave" && viewerEmail && (
        <ConfirmDialog
          title={`Leave “${name}”?`}
          description="You lose access to its docs unless someone shares them with you directly."
          confirmLabel="Leave workspace"
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            await sendJson(`/api/workspaces/${id}/members`, "DELETE", { email: viewerEmail });
            window.location.href = "/dashboard";
          }}
        />
      )}
    </>
  );
}
