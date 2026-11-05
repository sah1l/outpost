"use client";

import { Check, ExternalLink, FileUp, Link2, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  ANON_DOC_TTL_DAYS,
  MAX_UPLOAD_BYTES_ANON,
  MAX_UPLOAD_BYTES_USER,
} from "@offsprint/shared";
import { DocTypeIcon } from "@/components/docs/doc-labels";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api-client";
import { formatBytes } from "@/lib/format";
import {
  ACCEPTED_FILE_TYPES,
  detectDocType,
  fileProblem,
  uploadAnonymous,
  uploadSignedIn,
} from "@/lib/upload-client";

export function UploadForm({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = loggedIn ? MAX_UPLOAD_BYTES_USER : MAX_UPLOAD_BYTES_ANON;
  const maxMb = maxBytes / 1024 / 1024;
  const fileType = file ? detectDocType(file.name) : null;

  function pickFile(next: File | null | undefined) {
    setError(null);
    setResultSlug(null);
    if (!next) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const problem = fileProblem(next, maxBytes);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      if (loggedIn) {
        const { slug, type } = await uploadSignedIn(file, title, setStep);
        setStep("Opening");
        // HTML and Markdown go straight to the editor. A ZIP is a site, with nothing to edit.
        router.push(type === "zip" ? "/dashboard" : `/editor/${slug}`);
      } else {
        setStep("Uploading");
        const { slug } = await uploadAnonymous(file, title);
        setResultSlug(slug);
        setStep(null);
      }
    } catch (err) {
      setStep(null);
      setError(errorMessage(err, "The upload failed. Try again."));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${resultSlug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Your browser blocked copying. Select the link and copy it instead.");
    }
  }

  if (resultSlug) {
    const path = `/s/${resultSlug}`;
    return (
      <div className="rounded-panel border border-line p-5">
        <h2 className="text-[16px] font-semibold text-ink">Your page is live</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          Anyone with this link can open it, for at least {ANON_DOC_TTL_DAYS} days.
        </p>
        <a href={path} target="_blank" rel="noreferrer" className="text-link mt-4 block break-all text-[16px] font-medium">
          {typeof window === "undefined" ? path : `${window.location.host}${path}`}
        </a>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void copyLink()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a href={path} target="_blank" rel="noreferrer" className={buttonClass()}>
            <ExternalLink size={15} aria-hidden="true" />
            Open
          </a>
          <Button
            onClick={() => {
              setTitle("");
              pickFile(null);
            }}
          >
            Upload another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        aria-label="Choose a file to upload"
        onChange={(e) => pickFile(e.target.files?.[0])}
        className="sr-only"
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-panel border border-line px-4 py-3">
          {fileType && <DocTypeIcon type={fileType} size={22} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-ink" title={file.name}>
              {file.name}
            </div>
            <div className="text-[13px] text-ink-3">{formatBytes(file.size)}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon
            aria-label="Remove file"
            title="Remove file"
            disabled={Boolean(step)}
            onClick={() => pickFile(null)}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div
          className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-link bg-link-tint" : "border-line-strong hover:bg-canvas"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
        >
          <FileUp size={24} strokeWidth={1.5} className="text-ink-3" aria-hidden="true" />
          <p className="mt-3 text-[15px] font-medium text-ink">Drop a file here</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="text-link mt-0.5 rounded-control text-[14px] font-medium"
          >
            or choose one
          </button>
          <p className="mt-3 text-[13px] text-ink-3">HTML, Markdown or ZIP, up to {maxMb} MB</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="mb-1.5 block text-[13px] font-medium text-ink">
          Title <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={file?.name ?? "Uses the file name if you leave it blank"}
          className="field"
        />
      </div>

      {error && <Banner>{error}</Banner>}

      <Button type="submit" variant="primary" disabled={Boolean(step) || !file}>
        {step && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        {step ?? "Upload"}
      </Button>
    </form>
  );
}
