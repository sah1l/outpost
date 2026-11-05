import type { DocRole, DocType } from "@offsprint/shared";
import { FileCode2, FileText, FolderArchive, Globe, Lock, Pencil, Eye, Users } from "lucide-react";

const TYPE_INFO = {
  html: { icon: FileCode2, label: "HTML page" },
  md: { icon: FileText, label: "Markdown doc" },
  zip: { icon: FolderArchive, label: "Site from a ZIP" },
} as const;

export function DocTypeIcon({ type, size = 18 }: { type: DocType; size?: number }) {
  const { icon: Icon, label } = TYPE_INFO[type];
  return (
    <span title={label} className="inline-flex shrink-0 text-ink-3">
      <Icon size={size} strokeWidth={1.75} aria-label={label} />
    </span>
  );
}

function Label({ icon, tone = "muted", children }: { icon: React.ReactNode; tone?: "muted" | "link"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${tone === "link" ? "text-link" : "text-ink-2"}`}>
      {icon}
      {children}
    </span>
  );
}

// Who can open this doc. The first thing an owner wants to know about it.
export function AccessLabel({ isPublic, shareCount = 0 }: { isPublic: boolean; shareCount?: number }) {
  if (isPublic) {
    return (
      <Label tone="link" icon={<Globe size={14} aria-hidden="true" />}>
        Public
      </Label>
    );
  }
  if (shareCount > 0) {
    return (
      <Label icon={<Users size={14} aria-hidden="true" />}>
        Shared with {shareCount}
      </Label>
    );
  }
  return (
    <Label icon={<Lock size={14} aria-hidden="true" />}>
      Private
    </Label>
  );
}

// What this person can do with someone else's doc.
export function RoleLabel({ role }: { role: DocRole }) {
  if (role === "owner") {
    return <Label icon={<Lock size={14} aria-hidden="true" />}>Owner</Label>;
  }
  return role === "editor" ? (
    <Label icon={<Pencil size={14} aria-hidden="true" />}>Can edit</Label>
  ) : (
    <Label icon={<Eye size={14} aria-hidden="true" />}>Can view</Label>
  );
}
