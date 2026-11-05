"use client";

import {
  Check,
  Ellipsis,
  ExternalLink,
  Link2,
  PenLine,
  Search,
  Trash2,
  Type,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { canEditDoc, type DocRole, type DocType } from "@offsprint/shared";
import { ShareDialog } from "@/components/share/share-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLink, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { errorMessage, sendJson } from "@/lib/api-client";
import { formatBytes, formatDate } from "@/lib/format";
import { AccessLabel, DocTypeIcon, RoleLabel } from "./doc-labels";

// Only what this table shows. The rest of a doc record, like who else
// it's shared with, belongs to its owner and stays off the page.
export interface DocRow {
  slug: string;
  title: string;
  type: DocType;
  isPublic: boolean;
  updatedAt: number;
  role: DocRole;
  sizeBytes?: number;
  shareCount?: number;
}

const SEARCH_FROM = 6;

export function DocTable({
  docs: initialDocs,
  showSize = false,
  compact = false,
}: {
  docs: DocRow[];
  showSize?: boolean;
  // For a narrow column: gives the hover buttons' space to the title. Everything is still in the menu.
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [docs, setDocs] = useState(initialDocs);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  const sharingDoc = docs.find((d) => d.slug === sharing);
  const deletingDoc = docs.find((d) => d.slug === deleting);
  const needle = query.trim().toLowerCase();
  const visible = needle ? docs.filter((d) => d.title.toLowerCase().includes(needle)) : docs;

  async function rename(slug: string, title: string) {
    try {
      const updated = await sendJson<{ title: string }>(`/api/docs/${slug}`, "PATCH", { title });
      setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, title: updated.title } : d)));
      toast("Renamed");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
    setRenaming(null);
  }

  async function remove(slug: string) {
    await sendJson(`/api/docs/${slug}`, "DELETE");
    setDocs((prev) => prev.filter((d) => d.slug !== slug));
    setDeleting(null);
    toast("Doc deleted");
    router.refresh(); // The storage meter in the sidebar just changed.
  }

  return (
    <>
      {docs.length >= SEARCH_FROM && (
        <div className="relative mb-3 max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title"
            aria-label="Filter by title"
            className="field pl-9"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-panel border border-line">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-line bg-canvas text-[12px] font-medium text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="hidden w-36 px-3 py-2 font-medium sm:table-cell">Access</th>
              <th scope="col" className="hidden w-32 px-3 py-2 font-medium md:table-cell">Updated</th>
              {showSize && <th scope="col" className="hidden w-20 px-3 py-2 font-medium lg:table-cell">Size</th>}
              <th scope="col" className={`w-12 px-3 py-2 ${compact ? "" : "md:w-40"}`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((doc) => (
              <Row
                key={doc.slug}
                doc={doc}
                showSize={showSize}
                compact={compact}
                renaming={renaming === doc.slug}
                onRenameStart={() => setRenaming(doc.slug)}
                onRenameCancel={() => setRenaming(null)}
                onRename={(title) => void rename(doc.slug, title)}
                onShare={() => setSharing(doc.slug)}
                onDelete={() => setDeleting(doc.slug)}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[14px] text-ink-2">
                  No docs match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sharingDoc && (
        <ShareDialog
          slug={sharingDoc.slug}
          title={sharingDoc.title}
          isPublic={sharingDoc.isPublic}
          onClose={() => {
            setSharing(null);
            // In a workspace, the doc may have just been moved out of it.
            router.refresh();
          }}
          onChange={({ shares, isPublic }) =>
            setDocs((prev) =>
              prev.map((d) =>
                d.slug === sharingDoc.slug ? { ...d, shareCount: shares.length, isPublic } : d,
              ),
            )
          }
        />
      )}

      {deletingDoc && (
        <ConfirmDialog
          title={`Delete “${deletingDoc.title}”?`}
          description="The doc and its link stop working for everyone. This can't be undone."
          confirmLabel="Delete doc"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={() => remove(deletingDoc.slug)}
        />
      )}
    </>
  );
}

function Row({
  doc,
  showSize,
  compact,
  renaming,
  onRenameStart,
  onRenameCancel,
  onRename,
  onShare,
  onDelete,
}: {
  doc: DocRow;
  showSize: boolean;
  compact: boolean;
  renaming: boolean;
  onRenameStart: () => void;
  onRenameCancel: () => void;
  onRename: (title: string) => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const isOwner = doc.role === "owner";
  const canEdit = canEditDoc(doc.role);
  const access = isOwner ? (
    <AccessLabel isPublic={doc.isPublic} shareCount={doc.shareCount} />
  ) : (
    <RoleLabel role={doc.role} />
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${doc.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast(doc.isPublic ? "Link copied" : "Link copied. Only people with access can open it");
    } catch {
      toast("Your browser blocked copying. Copy the link from the address bar instead.", "error");
    }
  }

  return (
    <tr className="group border-b border-line transition-colors last:border-b-0 hover:bg-canvas">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <DocTypeIcon type={doc.type} />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <RenameField initial={doc.title} onCancel={onRenameCancel} onSave={onRename} />
            ) : (
              <>
                <Link
                  href={`/s/${doc.slug}`}
                  className="block truncate text-[14px] font-medium text-ink hover:text-link"
                  title={doc.title}
                >
                  {doc.title}
                </Link>
                <div className="truncate text-[12px] text-ink-3">/s/{doc.slug}</div>
                <div className="mt-1 sm:hidden">{access}</div>
              </>
            )}
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-2.5 sm:table-cell">{access}</td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-2 md:table-cell">
        {formatDate(doc.updatedAt)}
      </td>
      {showSize && (
        <td className="hidden whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-ink-2 lg:table-cell">
          {doc.sizeBytes === undefined ? "" : formatBytes(doc.sizeBytes)}
        </td>
      )}
      <td className="px-2 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {/* Mouse users get the two common actions on hover. Everything is also in the menu. */}
          <div
            className={`items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
              compact ? "hidden" : "hidden md:flex"
            }`}
          >
            {isOwner && (
              <Button size="sm" onClick={onShare}>
                Share
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label={`Copy link to ${doc.title}`}
              title="Copy link"
              onClick={() => void copyLink()}
            >
              {copied ? <Check size={16} className="text-ok" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            </Button>
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="sm" icon aria-label={`More actions for ${doc.title}`}>
                <Ellipsis size={16} aria-hidden="true" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLink href={`/s/${doc.slug}`} newTab icon={<ExternalLink aria-hidden="true" />}>
                Open in new tab
              </MenuLink>
              <MenuItem icon={<Link2 aria-hidden="true" />} onSelect={() => void copyLink()}>
                Copy link
              </MenuItem>
              {canEdit && doc.type !== "zip" && (
                <MenuLink href={`/editor/${doc.slug}`} icon={<PenLine aria-hidden="true" />}>
                  Edit
                </MenuLink>
              )}
              {isOwner && (
                <MenuItem icon={<UserPlus aria-hidden="true" />} onSelect={onShare}>
                  Share
                </MenuItem>
              )}
              {canEdit && (
                <MenuItem icon={<Type aria-hidden="true" />} onSelect={onRenameStart}>
                  Rename
                </MenuItem>
              )}
              {isOwner && (
                <>
                  <MenuSeparator />
                  <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={onDelete}>
                    Delete
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </td>
    </tr>
  );
}

function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Radix hands focus back to the menu button as the menu closes, so take it after that.
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const next = value.trim();
        if (next && next !== initial) onSave(next);
        else onCancel();
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        value={value}
        maxLength={200}
        aria-label="Title"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className="field h-8 min-w-0 flex-1 text-[14px]"
      />
      <Button type="submit" variant="primary" size="sm">
        Save
      </Button>
      <Button size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
