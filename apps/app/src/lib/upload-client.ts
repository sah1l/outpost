// Browser side of the two upload paths, shared by the upload page and the home page.
import type { DocType, InitUploadResponse } from "@offsprint/shared";

export const ACCEPTED_FILE_TYPES = ".html,.htm,.md,.markdown,.zip";

export function detectDocType(filename: string): DocType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return null;
}

// What's wrong with this file, in words to show the person, or null if it's fine.
export function fileProblem(file: File, maxBytes: number): string | null {
  if (!detectDocType(file.name)) return "Outpost takes HTML, Markdown and ZIP files. Choose one of those.";
  if (file.size === 0) return "This file is empty. Choose one with something in it.";
  if (file.size > maxBytes) {
    return `This file is over the ${Math.round(maxBytes / 1024 / 1024)} MB limit. Choose a smaller one.`;
  }
  return null;
}

async function failureMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    return (JSON.parse(text) as { error?: string }).error ?? fallback;
  } catch {
    return text || fallback;
  }
}

const CONTENT_TYPES: Record<DocType, string> = {
  zip: "application/zip",
  md: "text/markdown",
  html: "text/html",
};

export async function uploadSignedIn(
  file: File,
  title: string,
  onStep: (step: string) => void,
): Promise<{ slug: string; type: DocType }> {
  const type = detectDocType(file.name);
  if (!type) throw new Error("Outpost takes HTML, Markdown and ZIP files.");

  onStep("Preparing");
  const initRes = await fetch("/api/docs/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: CONTENT_TYPES[type],
      sizeBytes: file.size,
      title: title || file.name,
    }),
  });
  if (!initRes.ok) throw new Error(await failureMessage(initRes, "The upload couldn't start. Try again."));
  const init = (await initRes.json()) as InitUploadResponse;

  onStep("Uploading");
  const putRes = await fetch(init.signedUrl, {
    method: "PUT",
    headers: init.requiredHeaders,
    body: file,
  });
  if (!putRes.ok) throw new Error("The upload didn't finish. Try again.");

  onStep("Finishing");
  const finRes = await fetch("/api/docs/finalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: init.slug,
      type,
      filename: file.name,
      title: title || file.name,
    }),
  });
  if (!finRes.ok) throw new Error(await failureMessage(finRes, "The upload couldn't be finished. Try again."));
  const { slug } = (await finRes.json()) as { slug: string };
  return { slug, type };
}

const ANON_SESSION_KEY = "offsprint_anon_session";

function anonSessionId(): string {
  let id = window.sessionStorage.getItem(ANON_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(ANON_SESSION_KEY, id);
  }
  return id;
}

// Always public. Nobody owns an anonymous doc, so a private one could never be opened by anyone.
export async function uploadAnonymous(file: File, title: string): Promise<{ slug: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("title", title || file.name);
  form.set("sessionId", anonSessionId());
  form.set("makePublic", "true");
  const res = await fetch("/api/anon/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await failureMessage(res, "The upload failed. Try again."));
  const { slug } = (await res.json()) as { slug: string };
  return { slug };
}
