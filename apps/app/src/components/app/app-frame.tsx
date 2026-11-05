"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import {
  ChevronsUpDown,
  FileCode2,
  FileText,
  FileUp,
  Files,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  MAX_WORKSPACE_NAME_LENGTH,
  STORAGE_QUOTA_BYTES,
  type WorkspaceRecord,
} from "@offsprint/shared";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Avatar, Banner } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuLink, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { errorMessage, sendJson } from "@/lib/api-client";
import { formatBytes } from "@/lib/format";
import { signOutAndLeave } from "@/lib/sign-out";

interface FrameProps {
  user: { email: string; displayName: string | null };
  storageUsed: number;
  workspaces: { id: string; name: string }[];
}

export function AppFrame({ children, ...props }: FrameProps & { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-canvas px-2 lg:hidden">
        <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <RadixDialog.Trigger asChild>
            <Button variant="ghost" size="sm" icon aria-label="Open navigation">
              <MenuIcon size={18} aria-hidden="true" />
            </Button>
          </RadixDialog.Trigger>
          <RadixDialog.Portal>
            <RadixDialog.Overlay className="dialog-overlay" />
            <RadixDialog.Content className="drawer-panel" aria-describedby={undefined}>
              <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
              <SidebarBody {...props} />
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
        <Link href="/dashboard" aria-label="Outpost, your docs">
          <Wordmark />
        </Link>
      </div>

      <aside className="hidden w-60 shrink-0 border-r border-line bg-canvas lg:block">
        <SidebarBody {...props} />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface">{children}</div>
    </div>
  );
}

function SidebarBody({ user, storageUsed, workspaces }: FrameProps) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" aria-label="Outpost, your docs" className="w-fit rounded-control px-2 pt-1">
        <Wordmark />
      </Link>

      <Menu>
        <MenuTrigger asChild>
          <Button variant="primary" className="w-full">
            <Plus size={16} aria-hidden="true" />
            New
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLink href="/editor/new?type=md" icon={<FileText aria-hidden="true" />}>
            Markdown doc
          </MenuLink>
          <MenuLink href="/editor/new?type=html" icon={<FileCode2 aria-hidden="true" />}>
            HTML page
          </MenuLink>
          <MenuSeparator />
          <MenuLink href="/upload" icon={<FileUp aria-hidden="true" />}>
            Upload a file
          </MenuLink>
        </MenuContent>
      </Menu>

      <nav aria-label="Docs" className="space-y-0.5">
        <NavItem href="/dashboard" active={pathname === "/dashboard"} icon={<Files size={16} aria-hidden="true" />}>
          Your docs
        </NavItem>
        <NavItem
          href="/dashboard/shared"
          active={pathname === "/dashboard/shared"}
          icon={<Users size={16} aria-hidden="true" />}
        >
          Shared with you
        </NavItem>
      </nav>

      <section aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between pl-2.5">
          <h2 className="text-[12px] font-medium text-ink-3">Workspaces</h2>
          <Button variant="ghost" size="sm" icon aria-label="New workspace" title="New workspace" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden="true" />
          </Button>
        </div>
        {workspaces.length === 0 ? (
          <p className="px-2.5 pt-0.5 text-[13px] leading-snug text-ink-3">
            Give a team access to a set of docs.
          </p>
        ) : (
          <div className="space-y-0.5">
            {workspaces.map((w) => (
              <NavItem
                key={w.id}
                href={`/workspaces/${w.id}`}
                active={pathname === `/workspaces/${w.id}`}
                icon={
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-hover text-[10px] font-semibold text-ink-2"
                  >
                    {w.name.trim()[0]?.toUpperCase()}
                  </span>
                }
              >
                {w.name}
              </NavItem>
            ))}
          </div>
        )}
      </section>

      <StorageMeter used={storageUsed} />

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-control p-1.5 text-left transition-colors hover:bg-hover"
          >
            <Avatar name={user.displayName || user.email} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
              {user.displayName || user.email}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" side="top">
          <MenuLabel>{user.email}</MenuLabel>
          <MenuSeparator />
          <MenuItem icon={<LogOut aria-hidden="true" />} onSelect={() => void signOutAndLeave()}>
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>

      {creating && <CreateWorkspaceDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NavItem({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors ${
        active ? "bg-link-tint text-link" : "text-ink-2 hover:bg-hover hover:text-ink"
      }`}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

function StorageMeter({ used }: { used: number }) {
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);
  return (
    <div className="px-2.5">
      <div className="text-[12px] text-ink-3">
        {formatBytes(used)} of {formatBytes(STORAGE_QUOTA_BYTES)} used
      </div>
      <div
        role="progressbar"
        aria-label="Storage used"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full ${pct > 90 ? "bg-warn" : "bg-ink-3"}`}
          style={{ width: `${used > 0 ? Math.max(1.5, pct) : 0}%` }}
        />
      </div>
    </div>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { workspace } = await sendJson<{ workspace: WorkspaceRecord }>("/api/workspaces", "POST", { name });
      router.push(`/workspaces/${workspace.id}`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New workspace"
      description="Members get access to every doc you add to it."
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <label htmlFor="workspace-name" className="mb-1.5 block text-[13px] font-medium text-ink">
          Name
        </label>
        <input
          id="workspace-name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_WORKSPACE_NAME_LENGTH}
          placeholder="Design team"
          className="field"
        />
        {error && <Banner className="mt-3">{error}</Banner>}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
