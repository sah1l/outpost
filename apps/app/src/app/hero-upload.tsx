"use client";

import { Check, ExternalLink, FileUp, Globe, Link2, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ANON_DOC_TTL_DAYS,
  CONTENT_SANDBOX_FLAGS,
  MAX_UPLOAD_BYTES_ANON,
  MAX_UPLOAD_BYTES_USER,
} from "@offsprint/shared";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import {
  ACCEPTED_FILE_TYPES,
  fileProblem,
  uploadAnonymous,
  uploadSignedIn,
} from "@/lib/upload-client";
import { errorMessage } from "@/lib/api-client";

// Outpost names links after what's in the doc, so the example shows one of those.
const EXAMPLE_SLUG = "q3-launch-plan";
const TYPE_DELAY_MS = 55;

// The home page's one real moment: a browser window that's actually the uploader.
// Before a file, its address bar shows the kind of link you'll get. After, it's yours.
export function HeroUpload({ baseUrl, signedIn }: { baseUrl: string; signedIn: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const maxBytes = signedIn ? MAX_UPLOAD_BYTES_USER : MAX_UPLOAD_BYTES_ANON;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(EXAMPLE_SLUG);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    function next() {
      i += 1;
      setTyped(EXAMPLE_SLUG.slice(0, i));
      if (i < EXAMPLE_SLUG.length) timer = setTimeout(next, TYPE_DELAY_MS);
    }
    timer = setTimeout(next, 500);
    return () => clearTimeout(timer);
  }, []);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    const problem = fileProblem(file, maxBytes);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      if (signedIn) {
        const { slug: newSlug, type } = await uploadSignedIn(file, "", setStep);
        router.push(type === "zip" ? "/dashboard" : `/editor/${newSlug}`);
      } else {
        setStep("Uploading");
        const { slug: newSlug } = await uploadAnonymous(file, "");
        setSlug(newSlug);
        setStep(null);
      }
    } catch (e) {
      setStep(null);
      setError(errorMessage(e, "The upload failed. Try again."));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Your browser blocked copying. Select the link above and copy it instead.");
    }
  }

  function reset() {
    setSlug(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownSlug = slug ?? typed;
  const typing = !slug && typed.length < EXAMPLE_SLUG.length;

  return (
    <div>
      <div className="overflow-hidden rounded-[14px] border border-line-strong bg-surface">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex min-w-0 flex-1 basis-72 items-center gap-2.5">
            {slug ? (
              <Globe size={18} className="shrink-0 text-link" aria-hidden="true" />
            ) : (
              <Lock size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
            )}
            <div
              className="min-w-0 truncate text-[17px] font-medium tracking-[-0.01em] sm:text-[23px]"
              style={{ fontStretch: "105%" }}
              aria-label={slug ? `Your link: ${host}/s/${slug}` : `Example link: ${host}/s/${EXAMPLE_SLUG}`}
            >
              <span className="text-ink-3">{host}/s/</span>
              <span className="text-link">{shownSlug}</span>
              {typing && (
                <span className="type-caret ml-px inline-block h-[0.95em] w-[2px] translate-y-[0.14em] bg-link" aria-hidden="true" />
              )}
            </div>
          </div>
          {slug && (
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => void copyLink()}>
                {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <a href={`/s/${slug}`} target="_blank" rel="noreferrer" className={buttonClass()}>
                <ExternalLink size={15} aria-hidden="true" />
                Open
              </a>
            </div>
          )}
        </div>

        {slug ? (
          <iframe
            title="Your uploaded page"
            src={`/s/${slug}`}
            sandbox={CONTENT_SANDBOX_FLAGS}
            referrerPolicy="no-referrer"
            className="block h-[340px] w-full bg-white sm:h-[420px]"
          />
        ) : (
          <div
            className={`flex h-[300px] cursor-pointer flex-col items-center justify-center px-6 text-center transition-colors sm:h-[360px] ${
              dragging ? "bg-link-tint" : "bg-surface hover:bg-canvas"
            }`}
            onClick={() => {
              if (!step) inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!step) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!step) void handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              aria-label="Choose a file to upload"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              className="sr-only"
            />
            {step ? (
              <div role="status" className="flex items-center gap-2.5 text-[16px] font-medium text-ink">
                <Loader2 size={18} className="animate-spin text-ink-3" aria-hidden="true" />
                {step}
              </div>
            ) : (
              <>
                <FileUp size={26} strokeWidth={1.5} className="text-ink-3" aria-hidden="true" />
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-ink">
                  Drop a file to get its link
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="text-link mt-1 rounded-control text-[15px] font-medium"
                >
                  or choose one
                </button>
                <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-2">
                  {signedIn
                    ? `HTML, Markdown or ZIP, up to ${maxBytes / 1024 / 1024} MB. Private until you share it.`
                    : `HTML, Markdown or ZIP, up to ${maxBytes / 1024 / 1024} MB. No account needed. Anyone with the link can open it, and it stays up for at least ${ANON_DOC_TTL_DAYS} days.`}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <Banner className="mt-3">{error}</Banner>}

      {slug && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[14px] text-ink-2">
          <span>
            Your page is live. <a href="/login" className="text-link font-medium">Sign in</a> to edit your
            docs and choose who can open them.
          </span>
          <Button onClick={reset}>Upload another</Button>
        </div>
      )}
    </div>
  );
}
