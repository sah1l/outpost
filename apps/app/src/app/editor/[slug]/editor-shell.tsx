"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocType } from "@offsprint/shared";
import { marked } from "marked";

const CodeMirrorEditor = dynamic(
  () => import("@/components/editor/code-mirror-editor").then((m) => m.CodeMirrorEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center smallcaps text-[var(--ink-3)]">
        Loading editor…
      </div>
    ),
  },
);

type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";
type ViewMode = "split" | "source" | "preview";

export function EditorShell({
  slug,
  docType,
  title,
  initialIsPublic,
}: {
  slug: string;
  docType: DocType;
  title: string;
  initialIsPublic: boolean;
}) {
  const [source, setSource] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pubBusy, setPubBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("split");
  const [origin, setOrigin] = useState("");
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/docs/${slug}/content`);
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const text = await res.text();
        if (cancelled) return;
        setSource(text);
        lastSavedRef.current = text;
        setLoaded(true);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const save = useCallback(async () => {
    if (source === lastSavedRef.current) {
      setSaveState("clean");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/docs/${slug}/content`, {
        method: "PUT",
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: source,
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      lastSavedRef.current = source;
      setSaveState("saved");
      setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "clean" : s));
      }, 1500);
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "save failed");
    }
  }, [slug, source]);

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

  function onChange(next: string) {
    setSource(next);
    setSaveState(next === lastSavedRef.current ? "clean" : "dirty");
  }

  async function togglePublic() {
    const next = !isPublic;
    setPubBusy(true);
    const prev = isPublic;
    setIsPublic(next);
    try {
      const res = await fetch(`/api/docs/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      showToast(next ? "Now public" : "Now private");
    } catch (e) {
      setIsPublic(prev);
      showToast(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setPubBusy(false);
    }
  }

  async function copyLink() {
    if (!isPublic) {
      showToast("Make it public first");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${origin}/s/${slug}`);
      showToast("Link copied");
    } catch {
      showToast("Copy failed");
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="max-w-md border border-[var(--red)] bg-[var(--paper)] p-6">
          <div className="smallcaps mb-2" style={{ color: "var(--red)" }}>
            Load error
          </div>
          <p className="font-mono text-[12px] text-[var(--ink)]">{loadError}</p>
        </div>
      </div>
    );
  }

  const shareUrl = `${origin}/s/${slug}`;

  return (
    <>
      <div className="relative z-[5] flex flex-col border-b border-[var(--ink)] bg-[var(--paper)]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-6 items-center border border-[var(--ink)] bg-[var(--paper-2)] px-1.5 smallcaps"
              style={{ letterSpacing: "0.18em" }}
            >
              {docType}
            </span>
            <h1 className="truncate font-display text-xl text-[var(--ink)]">
              {title}
            </h1>
          </div>

          <div className="hidden h-5 w-px bg-[var(--ink)]/25 md:block" />

          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--ink-3)]">
            <span className="smallcaps">URL</span>
            <span className="max-w-[220px] truncate text-[var(--ink)]">
              /s/{slug}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <SaveIndicator state={saveState} error={saveError} />

            <ViewTabs value={view} onChange={setView} />

            <button
              onClick={copyLink}
              disabled={!isPublic}
              className="btn-ghost"
              title={isPublic ? "Copy share link" : "Make public to share"}
            >
              <span className="smallcaps" style={{ color: "inherit" }}>
                Copy link
              </span>
            </button>

            <div
              className="flex items-center gap-2 border border-[var(--ink)] bg-[var(--paper)] px-2.5 py-1.5"
              title={isPublic ? shareUrl : "Private — only you can see this"}
            >
              <span
                className={`smallcaps ${isPublic ? "text-[var(--accent)]" : "text-[var(--ink-3)]"}`}
              >
                {isPublic ? "Public" : "Private"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={togglePublic}
                disabled={pubBusy}
                className="pub-switch"
                data-on={isPublic}
              />
            </div>

            <button
              onClick={() => void save()}
              disabled={saveState === "saving" || saveState === "clean"}
              className="btn-accent"
            >
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`relative z-[1] grid min-h-0 flex-1 ${
          view === "split"
            ? "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
            : "grid-cols-1 grid-rows-1"
        }`}
      >
        {view !== "preview" && (
          <div
            className={`relative min-h-0 ${view === "split" ? "border-b border-[var(--ink)]/30 md:border-b-0 md:border-r" : ""}`}
            onBlur={() => void save()}
          >
            <PaneLabel label={`Source · ${docType}`} />
            {loaded ? (
              <CodeMirrorEditor
                value={source}
                onChange={onChange}
                language={docType === "md" ? "md" : "html"}
              />
            ) : (
              <div className="flex h-full items-center justify-center smallcaps text-[var(--ink-3)]">
                Loading…
              </div>
            )}
          </div>
        )}
        {view !== "source" && (
          <div className="relative min-h-0">
            <PaneLabel label="Preview" align="right" />
            <PreviewPane source={source} docType={docType} />
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 smallcaps text-[var(--paper)] shadow-[4px_4px_0_0_var(--accent)]">
          {toast}
        </div>
      )}
    </>
  );
}

function ViewTabs({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "source", label: "Src" },
    { id: "split", label: "Split" },
    { id: "preview", label: "View" },
  ];
  return (
    <div className="hidden border border-[var(--ink)] md:flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          data-active={value === t.id}
          className="smallcaps px-2.5 py-1.5 transition-colors data-[active=true]:bg-[var(--ink)] data-[active=true]:text-[var(--paper)]"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PaneLabel({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`pointer-events-none absolute top-2 z-[2] smallcaps bg-[var(--paper)]/80 px-2 py-0.5 ${
        align === "right" ? "right-3" : "left-3"
      }`}
    >
      {label}
    </div>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  const base =
    "flex items-center gap-1.5 smallcaps tabular-nums";
  if (state === "error")
    return (
      <span className={base} style={{ color: "var(--red)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--red)]" />
        {error ?? "Error"}
      </span>
    );
  if (state === "saving")
    return (
      <span className={base} style={{ color: "var(--ink-3)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-3)] animate-pulse" />
        Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className={base} style={{ color: "var(--green)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
        Saved
      </span>
    );
  if (state === "dirty")
    return (
      <span className={base} style={{ color: "var(--accent)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        Unsaved
      </span>
    );
  return (
    <span className={base} style={{ color: "var(--ink-4)" }}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-4)]" />
      Up to date
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
        return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:760px;margin:1.5rem auto;padding:0 1rem;line-height:1.6}pre,code{background:#f5f5f5;border-radius:4px}pre{padding:.6rem;overflow:auto}code{padding:.1rem .3rem}pre code{background:transparent;padding:0}img{max-width:100%}</style></head><body>${body}</body></html>`;
      } catch {
        return "<p>Markdown error</p>";
      }
    }
    return debounced;
  }, [debounced, docType]);

  return (
    <iframe
      title="Preview"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcdoc}
      className="h-full w-full bg-white"
    />
  );
}
