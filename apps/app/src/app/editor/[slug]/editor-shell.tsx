"use client";

import { ArrowLeft, Columns2, Code2, Eye, ExternalLink, Link2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { injectSandboxShim, MARKDOWN_PAGE_CSS, type DocType } from "@offsprint/shared";
import { marked } from "marked";
import { AccessLabel, DocTypeIcon } from "@/components/docs/doc-labels";
import { ShareDialog } from "@/components/share/share-dialog";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { errorMessage, sendJson } from "@/lib/api-client";

const CodeMirrorEditor = dynamic(
  () => import("@/components/editor/code-mirror-editor").then((m) => m.CodeMirrorEditor),
  { ssr: false, loading: () => <EditorPlaceholder /> },
);

type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";
type ViewMode = "split" | "source" | "preview";

export type EditorShellProps =
  | {
      mode: "edit";
      slug: string;
      docType: DocType;
      title: string;
      initialIsPublic: boolean;
      initialShareCount: number;
      // Owners only: editors can change the content but not who sees it.
      canManage: boolean;
    }
  | {
      // Not created yet. The first save creates it, so leaving the page leaves nothing behind.
      mode: "draft";
      docType: DocType;
    };

export function EditorShell(props: EditorShellProps) {
  const router = useRouter();
  const toast = useToast();
  const { docType } = props;
  const slug = props.mode === "edit" ? props.slug : null;
  const isDraft = props.mode === "draft";
  const canManage = props.mode === "edit" && props.canManage;

  const [source, setSource] = useState("");
  const [loaded, setLoaded] = useState(isDraft);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [title, setTitle] = useState(props.mode === "edit" ? props.title : "");
  const [isPublic, setIsPublic] = useState(props.mode === "edit" && props.initialIsPublic);
  const [shareCount, setShareCount] = useState(props.mode === "edit" ? props.initialShareCount : 0);
  const [view, setView] = useState<ViewMode>("split");
  const [sharing, setSharing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const lastSavedRef = useRef("");
  const latestSourceRef = useRef("");
  const savedTitleRef = useRef(props.mode === "edit" ? props.title : "");
  const revRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/docs/${slug}/content`);
        if (!res.ok) throw new Error(`This doc couldn't be loaded (error ${res.status}). Reload to try again.`);
        const text = await res.text();
        if (cancelled) return;
        setSource(text);
        lastSavedRef.current = text;
        latestSourceRef.current = text;
        revRef.current = res.headers.get("x-content-rev");
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const saveExisting = useCallback(async () => {
    // One at a time: Ctrl+S and leaving the pane can both fire, and a second save sent before
    // the first returns would carry an old revision and look like someone else got in first.
    if (conflict || savingRef.current) return;
    if (source === lastSavedRef.current) {
      setSaveState("clean");
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/docs/${slug}/content`, {
        method: "PUT",
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...(revRef.current ? { "x-expected-rev": revRef.current } : {}),
        },
        body: source,
      });
      if (res.status === 409) {
        setConflict(true);
        setSaveState("error");
        setSaveError("Not saved");
        return;
      }
      if (res.status === 413) throw new Error("Too large to save");
      if (!res.ok) throw new Error("Not saved");
      const { rev } = (await res.json()) as { rev: number };
      revRef.current = String(rev);
      lastSavedRef.current = source;
      if (latestSourceRef.current !== source) {
        setSaveState("dirty");
        return;
      }
      setSaveState("saved");
      setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "clean" : s));
      }, 1500);
    } catch (e) {
      setSaveState("error");
      setSaveError(errorMessage(e, "Not saved"));
    } finally {
      savingRef.current = false;
    }
  }, [slug, source, conflict]);

  const createFromDraft = useCallback(async () => {
    // The guard matters more here: a second request would create a second doc.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const { slug: newSlug } = await sendJson<{ slug: string }>("/api/docs/create", "POST", {
        type: docType,
        title,
        content: source,
      });
      leavingRef.current = true;
      setSaveState("saved");
      toast("Doc created. Only you can open it until you share it");
      router.replace(`/editor/${newSlug}`);
    } catch (e) {
      setSaveState("error");
      setSaveError(errorMessage(e, "Not created"));
      savingRef.current = false;
    }
  }, [docType, title, source, router, toast]);

  const save = isDraft ? createFromDraft : saveExisting;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn before closing the tab on work that hasn't been saved.
  const hasUnsavedWork = isDraft ? source.trim().length > 0 : saveState === "dirty" || conflict;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWork]);

  function onChange(next: string) {
    setSource(next);
    latestSourceRef.current = next;
    if (isDraft) setSaveState(next.trim() ? "dirty" : "clean");
    else if (!conflict) setSaveState(next === lastSavedRef.current ? "clean" : "dirty");
  }

  // Saved docs save when you click away. A draft doesn't: clicking the title field to
  // name it would create the doc as "Untitled" and navigate away mid-thought.
  function onPaneBlur() {
    if (!isDraft) void saveExisting();
  }

  async function saveTitle() {
    if (!slug) return;
    const next = title.trim();
    if (!next) {
      setTitle(savedTitleRef.current);
      return;
    }
    if (next === savedTitleRef.current) return;
    try {
      const updated = await sendJson<{ title: string }>(`/api/docs/${slug}`, "PATCH", { title: next });
      savedTitleRef.current = updated.title;
      setTitle(updated.title);
      toast("Renamed");
    } catch (e) {
      setTitle(savedTitleRef.current);
      toast(errorMessage(e), "error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      toast(isPublic ? "Link copied" : "Link copied. Only people with access can open it");
    } catch {
      toast("Your browser blocked copying. Copy the link from the address bar instead.", "error");
    }
  }

  if (loadError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface p-6">
        <div className="w-full max-w-md">
          <Banner>{loadError}</Banner>
          <Link href="/dashboard" className={buttonClass({ className: "mt-4" })}>
            Back to your docs
          </Link>
        </div>
      </div>
    );
  }

  const canSave = isDraft ? source.trim().length > 0 : saveState === "dirty" || saveState === "error";

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-surface">
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line px-2 py-2 sm:px-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-1.5">
          <Link
            href="/dashboard"
            aria-label="Back to your docs"
            title="Back to your docs"
            className={buttonClass({ variant: "ghost", size: "sm", icon: true, className: "shrink-0" })}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <DocTypeIcon type={docType} size={17} />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(savedTitleRef.current);
                e.currentTarget.blur();
              }
            }}
            placeholder="Untitled"
            maxLength={200}
            aria-label="Title"
            // As wide as the title, so what comes after it sits next to it.
            size={Math.min(Math.max(title.length + 2, 12), 48)}
            className="h-8 min-w-0 truncate rounded-control border border-transparent bg-transparent px-1.5 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-line focus:border-line-strong"
          />
          {slug && (
            <span className="hidden shrink-0 md:inline-flex">
              <AccessLabel isPublic={isPublic} shareCount={shareCount} />
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <SaveStatus state={saveState} error={saveError} isDraft={isDraft} />
          <ViewTabs value={view} onChange={setView} />
          {slug && (
            <>
              <a
                href={`/s/${slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in new tab"
                title="Open in new tab"
                className={buttonClass({ variant: "ghost", size: "sm", icon: true })}
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                icon
                aria-label="Copy link"
                title="Copy link"
                onClick={() => void copyLink()}
              >
                <Link2 size={16} aria-hidden="true" />
              </Button>
            </>
          )}
          {canManage && (
            <Button size="sm" onClick={() => setSharing(true)}>
              Share
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => void save()}
            disabled={conflict || saveState === "saving" || !canSave}
          >
            {isDraft ? "Create doc" : "Save"}
          </Button>
        </div>
      </header>

      {conflict && (
        <Banner
          className="rounded-none"
          action={
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          Someone else saved this doc after you opened it, so your changes weren&apos;t saved. Copy
          anything you want to keep, then reload to get the latest version.
        </Banner>
      )}

      <div
        className={`grid min-h-0 flex-1 ${
          view === "split"
            ? "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
            : "grid-cols-1 grid-rows-1"
        }`}
      >
        {view !== "preview" && (
          <div
            className={`min-h-0 overflow-hidden ${view === "split" ? "border-b border-line md:border-b-0 md:border-r" : ""}`}
            onBlur={onPaneBlur}
          >
            {loaded ? (
              <CodeMirrorEditor
                value={source}
                onChange={onChange}
                language={docType === "md" ? "md" : "html"}
                autoFocus={isDraft}
                placeholder={
                  isDraft
                    ? docType === "md"
                      ? "Write some Markdown, or paste what your AI wrote"
                      : "Write some HTML, or paste what your AI wrote"
                    : undefined
                }
              />
            ) : (
              <EditorPlaceholder />
            )}
          </div>
        )}
        {view !== "source" && (
          <div className="min-h-0">
            <PreviewPane source={source} docType={docType} />
          </div>
        )}
      </div>

      {sharing && slug && (
        <ShareDialog
          slug={slug}
          title={title}
          isPublic={isPublic}
          onClose={() => setSharing(false)}
          onChange={(change) => {
            setIsPublic(change.isPublic);
            setShareCount(change.shares.length);
          }}
        />
      )}
    </div>
  );
}

function EditorPlaceholder() {
  return (
    <div className="space-y-3 p-5" aria-label="Loading editor">
      <div className="skeleton h-3 w-2/3" />
      <div className="skeleton h-3 w-1/2" />
      <div className="skeleton h-3 w-3/5" />
    </div>
  );
}

function ViewTabs({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const tabs: { id: ViewMode; label: string; icon: ReactNode }[] = [
    { id: "source", label: "Source only", icon: <Code2 size={15} aria-hidden="true" /> },
    { id: "split", label: "Source and preview", icon: <Columns2 size={15} aria-hidden="true" /> },
    { id: "preview", label: "Preview only", icon: <Eye size={15} aria-hidden="true" /> },
  ];
  return (
    <div role="group" aria-label="Layout" className="flex rounded-control bg-hover p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={t.label}
          aria-pressed={value === t.id}
          title={t.label}
          onClick={() => onChange(t.id)}
          className={`flex h-7 w-7 items-center justify-center rounded-[5px] transition-colors ${
            value === t.id ? "bg-surface text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function SaveStatus({
  state,
  error,
  isDraft,
}: {
  state: SaveState;
  error: string | null;
  isDraft: boolean;
}) {
  const content: Record<SaveState, { text: string; tone: string }> = {
    clean: { text: isDraft ? "Not created yet" : "All changes saved", tone: "text-ink-3" },
    dirty: { text: isDraft ? "Not created yet" : "Unsaved changes", tone: "text-warn" },
    saving: { text: isDraft ? "Creating" : "Saving", tone: "text-ink-3" },
    saved: { text: "Saved", tone: "text-ok" },
    error: { text: error ?? "Not saved", tone: "text-danger" },
  };
  const { text, tone } = content[state];
  return (
    <span role="status" className={`mr-1 hidden whitespace-nowrap text-[13px] sm:inline ${tone}`}>
      {text}
    </span>
  );
}

function PreviewPane({ source, docType }: { source: string; docType: DocType }) {
  const [debounced, setDebounced] = useState(source);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(source), 250);
    return () => clearTimeout(t);
  }, [source]);

  const srcdoc = useMemo(() => {
    if (docType === "md") {
      try {
        const body = marked.parse(debounced) as string;
        return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${MARKDOWN_PAGE_CSS}</style></head><body>${body}</body></html>`;
      } catch {
        return "<p>This Markdown couldn't be previewed.</p>";
      }
    }
    // Same shim as the published page, so a page that crashes without storage looks the same here.
    return injectSandboxShim(debounced);
  }, [debounced, docType]);

  if (!debounced.trim()) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas px-6 text-center text-[13px] text-ink-3">
        Your preview shows up here.
      </div>
    );
  }

  return (
    <iframe
      title="Preview"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcdoc}
      className="h-full w-full bg-white"
    />
  );
}
