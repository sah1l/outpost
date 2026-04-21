"use client";

import Link from "next/link";
import { useState } from "react";
import type { DocRecord } from "@offsprint/shared";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocList({ initialDocs }: { initialDocs: DocRecord[] }) {
  const [docs, setDocs] = useState(initialDocs);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  function shareUrl(slug: string): string {
    if (typeof window === "undefined") return `/s/${slug}`;
    return `${window.location.origin}/s/${slug}`;
  }

  async function patch(slug: string, body: { isPublic?: boolean; title?: string }) {
    setBusy(slug);
    try {
      const res = await fetch(`/api/docs/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      const updated = (await res.json()) as DocRecord;
      setDocs((prev) => prev.map((d) => (d.slug === slug ? updated : d)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(slug: string) {
    if (!confirm("Delete this share? This cannot be undone.")) return;
    setBusy(slug);
    try {
      const res = await fetch(`/api/docs/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      setDocs((prev) => prev.filter((d) => d.slug !== slug));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function onCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(slug));
      showToast("Link copied");
    } catch {
      showToast("Copy failed");
    }
  }

  return (
    <>
      <div className="border-y border-[var(--ink)]">
        <div className="hidden grid-cols-12 items-center gap-4 border-b border-[var(--ink)]/25 bg-[var(--paper-2)] px-4 py-2 smallcaps md:grid">
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <ul>
          {docs.map((doc, i) => (
            <li
              key={doc.slug}
              className="group relative border-b border-[var(--ink)]/20 px-4 py-4 last:border-b-0 transition-colors hover:bg-[var(--paper-2)]/60"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center md:gap-4">
                <div className="md:col-span-5 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] tabular-nums text-[var(--ink-4)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {editing === doc.slug ? (
                      <RenameField
                        initial={doc.title}
                        onCancel={() => setEditing(null)}
                        onSave={async (title) => {
                          await patch(doc.slug, { title });
                          setEditing(null);
                        }}
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-display text-lg text-[var(--ink)]">
                            {doc.title}
                          </span>
                          {doc.isPublic ? (
                            <span
                              className="smallcaps border border-[var(--accent)] px-1.5 py-0.5"
                              style={{ color: "var(--accent)" }}
                            >
                              Public
                            </span>
                          ) : (
                            <span className="smallcaps border border-[var(--ink)]/40 px-1.5 py-0.5 text-[var(--ink-3)]">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--ink-3)]">
                          /s/{doc.slug} · {formatDate(doc.updatedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <span className="smallcaps text-[var(--ink-3)]">{doc.type}</span>
                </div>

                <div className="md:col-span-2 font-mono text-[12px] text-[var(--ink-2)]">
                  {formatSize(doc.sizeBytes)}
                </div>

                <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-2">
                  <label
                    className="flex items-center gap-1.5"
                    title={doc.isPublic ? "Public" : "Private"}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={doc.isPublic}
                      disabled={busy === doc.slug}
                      onClick={() => patch(doc.slug, { isPublic: !doc.isPublic })}
                      className="pub-switch"
                      data-on={doc.isPublic}
                    />
                  </label>
                  <button
                    onClick={() => onCopy(doc.slug)}
                    disabled={!doc.isPublic}
                    title={doc.isPublic ? "Copy share link" : "Make public to share"}
                    className="smallcaps border border-[var(--ink)] px-2 py-1 transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--ink)]"
                  >
                    Copy
                  </button>
                  {doc.type !== "zip" && (
                    <Link
                      href={`/editor/${doc.slug}`}
                      className="smallcaps border border-[var(--ink)] px-2 py-1 transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
                    >
                      Edit
                    </Link>
                  )}
                  <button
                    onClick={() => setEditing(doc.slug)}
                    className="smallcaps border border-[var(--ink)] px-2 py-1 transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onDelete(doc.slug)}
                    disabled={busy === doc.slug}
                    className="smallcaps border border-[var(--red)] px-2 py-1 text-[var(--red)] transition-colors hover:bg-[var(--red)] hover:text-[var(--paper)] disabled:opacity-50"
                  >
                    {busy === doc.slug ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 smallcaps text-[var(--paper)] shadow-[4px_4px_0_0_var(--accent)]">
          {toast}
        </div>
      )}
    </>
  );
}

function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (title: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
      className="flex min-w-0 flex-1 items-center gap-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input-field py-1 text-[14px]"
      />
      <button type="submit" className="smallcaps border border-[var(--accent)] px-2 py-1 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--paper)]">
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="smallcaps text-[var(--ink-3)] hover:text-[var(--ink)]"
      >
        Cancel
      </button>
    </form>
  );
}
