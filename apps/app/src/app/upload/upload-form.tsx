"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MAX_UPLOAD_BYTES_USER,
  MAX_UPLOAD_BYTES_ANON,
  type DocType,
  type InitUploadResponse,
} from "@offsprint/shared";

function detectType(filename: string): DocType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return null;
}

function contentTypeFor(type: DocType): string {
  if (type === "zip") return "application/zip";
  if (type === "md") return "text/markdown";
  return "text/html";
}

const ANON_SESSION_KEY = "offsprint_anon_session";

function getAnonSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(ANON_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(ANON_SESSION_KEY, id);
  }
  return id;
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function UploadForm({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [makePublic, setMakePublic] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; isPublic: boolean } | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const maxBytes = loggedIn ? MAX_UPLOAD_BYTES_USER : MAX_UPLOAD_BYTES_ANON;
  const detectedType = file ? detectType(file.name) : null;

  function pickFile(f: File | null) {
    setError(null);
    setResult(null);
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`File too large. Max ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    const type = detectType(file.name);
    if (!type) {
      setError("Only .html, .md, or .zip files are supported.");
      return;
    }

    try {
      if (loggedIn) {
        const slug = await uploadLoggedIn(file, type, title);
        setStatus("Opening editor...");
        // Editor is only available for html/md. ZIPs go to dashboard.
        if (type === "zip") {
          router.push("/dashboard");
        } else {
          router.push(`/editor/${slug}`);
        }
      } else {
        await uploadAnon(file, title, makePublic);
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "upload failed");
    }
  }

  async function uploadLoggedIn(f: File, type: DocType, t: string): Promise<string> {
    setStatus("Preparing upload...");
    const contentType = contentTypeFor(type);
    const initRes = await fetch("/api/docs/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: f.name,
        contentType,
        sizeBytes: f.size,
        title: t || f.name,
      }),
    });
    if (!initRes.ok) throw new Error(`init failed: ${await initRes.text()}`);
    const init = (await initRes.json()) as InitUploadResponse;

    setStatus("Uploading...");
    const putRes = await fetch(init.signedUrl, {
      method: "PUT",
      headers: init.requiredHeaders,
      body: f,
    });
    if (!putRes.ok) throw new Error(`upload failed: ${putRes.status}`);

    setStatus("Finalizing...");
    const finRes = await fetch("/api/docs/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: init.slug,
        type,
        filename: f.name,
        title: t || f.name,
      }),
    });
    if (!finRes.ok) throw new Error(`finalize failed: ${await finRes.text()}`);
    const fin = (await finRes.json()) as { slug: string };
    return fin.slug;
  }

  async function uploadAnon(f: File, t: string, pub: boolean) {
    setStatus("Uploading...");
    const form = new FormData();
    form.set("file", f);
    form.set("title", t || f.name);
    form.set("sessionId", getAnonSessionId());
    form.set("makePublic", pub ? "true" : "false");
    const res = await fetch("/api/anon/upload", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `upload failed: ${res.status}`);
    }
    const data = (await res.json()) as { slug: string; isPublic: boolean };
    setStatus(null);
    setResult(data);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="relative">
        <div className="smallcaps absolute -top-3 left-3 bg-[var(--paper)] px-2">
          File
        </div>
        <div
          className="drop-zone relative flex min-h-[180px] flex-col items-center justify-center gap-3 p-8 text-center"
          data-drag={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) pickFile(dropped);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".html,.htm,.md,.markdown,.zip"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <div className="font-display text-2xl text-[var(--ink)]">{file.name}</div>
              <div className="font-mono text-[12px] text-[var(--ink-3)]">
                {prettyBytes(file.size)}
                {detectedType && (
                  <>
                    <span className="mx-2 text-[var(--ink-4)]">·</span>
                    <span className="uppercase">{detectedType}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pickFile(null);
                }}
                className="mt-2 smallcaps hover:text-[var(--accent)]"
              >
                × Replace file
              </button>
            </div>
          ) : (
            <>
              <div className="font-display text-xl text-[var(--ink)]">
                Drop a file here
              </div>
              <div className="font-mono text-[12px] text-[var(--ink-3)]">
                or click to browse — .html · .md · .zip
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="smallcaps block" htmlFor="title">
          Title — optional
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to the filename"
          className="input-field mt-1"
        />
      </div>

      {!loggedIn && (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--ink)]/20 pt-5">
          <div>
            <div className="smallcaps">Visibility</div>
            <div className="mt-1 font-display text-lg text-[var(--ink)]">
              {makePublic ? "Public" : "Private"}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              {makePublic
                ? "Anyone with the link can view."
                : "Link returned to you only."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={makePublic}
            onClick={() => setMakePublic((v) => !v)}
            className="pub-switch"
            data-on={makePublic}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--ink)]/20 pt-5">
        <button
          type="submit"
          disabled={Boolean(status) || !file}
          className="btn-accent"
        >
          <span>{status ?? (loggedIn ? "Upload & Edit" : "Upload")}</span>
          {!status && <span>→</span>}
        </button>
        <span className="font-mono text-[11px] text-[var(--ink-3)]">
          max {(maxBytes / 1024 / 1024).toFixed(0)} MB
        </span>
      </div>

      {error && (
        <div className="border border-[var(--red)] bg-[var(--paper)] px-4 py-3 text-[13px] text-[var(--red)]">
          <span className="smallcaps mr-2" style={{ color: "var(--red)" }}>
            Error
          </span>
          {error}
        </div>
      )}

      {result && !loggedIn && (
        <div className="relative border border-[var(--ink)] bg-[var(--paper-2)] p-5">
          <div className="smallcaps mb-2 flex items-center gap-2 text-[var(--accent)]">
            <span>● Uploaded</span>
          </div>
          {result.isPublic ? (
            <div>
              <div className="font-display text-xl text-[var(--ink)]">
                Your link is live.
              </div>
              <a
                href={`${origin}/s/${result.slug}`}
                className="mt-2 block break-all font-mono text-[13px] text-[var(--accent)] underline underline-offset-4"
              >
                {origin}/s/{result.slug}
              </a>
              <Link href="/upload" className="mt-4 inline-block smallcaps hover:text-[var(--accent)]">
                ↻ Upload another
              </Link>
            </div>
          ) : (
            <div>
              <div className="font-display text-xl text-[var(--ink)]">
                Stored privately.
              </div>
              <div className="mt-2 font-mono text-[12px] text-[var(--ink-3)]">
                Slug: <span className="text-[var(--ink)]">{result.slug}</span>
              </div>
              <div className="mt-2 text-[13px] text-[var(--ink-2)]">
                Sign in to edit or publish.
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
