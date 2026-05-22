import { customAlphabet } from "nanoid";
import { SLUG_LENGTH } from "@offsprint/shared";
import { adminFirestore } from "./firebase-admin";
import { minimaxChat } from "./minimax";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, SLUG_LENGTH);

const suffixAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const shortSuffix = customAlphabet(suffixAlphabet, 4);

const MAX_SLUG_LENGTH = 40;
const MIN_SLUG_LENGTH = 3;
// Cap the source we feed to the HTML/MD stripper. The output sample is far
// smaller, so anything past this is wasted work on multi-MB uploads.
const MAX_SOURCE_CHARS = 64 * 1024;
const MAX_SAMPLE_CHARS = 5000;
const MAX_HEADINGS = 5;

/**
 * Accept either a bare slug or a full /s/{slug} URL (with or without
 * trailing slash, query, or fragment) and return the slug. Mirrored in
 * apps/cli/src/api.ts because the CLI is a separate published package.
 */
export function resolveSlug(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const match = /\/s\/([^/?#]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).trim();
}

export async function allocateSlug(maxAttempts = 5): Promise<string> {
  const docs = adminFirestore().collection("docs");
  for (let i = 0; i < maxAttempts; i++) {
    const slug = generate();
    const snap = await docs.doc(slug).get();
    if (!snap.exists) return slug;
  }
  throw new Error("failed to allocate slug after retries");
}

function sanitizeSlug(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/[`"']/g, "")
    .replace(/[^a-z0-9\-\s_]/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, "");
  if (cleaned.length < MIN_SLUG_LENGTH) return null;
  return cleaned;
}

function sampleContent(source: string): string {
  const head = source.slice(0, MAX_SOURCE_CHARS);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const htmlHeadings = Array.from(head.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .slice(0, MAX_HEADINGS)
    .map((m) => m[1]!);
  const mdHeadings = Array.from(head.matchAll(/^#{1,3}\s+(.+)$/gm))
    .slice(0, MAX_HEADINGS)
    .map((m) => m[1]!);
  const structural = [titleMatch?.[1], ...htmlHeadings, ...mdHeadings]
    .filter((s): s is string => Boolean(s))
    .map((s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const noScripts = head.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = noScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const headings = structural.length ? "Headings: " + structural.join(" / ") + "\n\n" : "";
  return (headings + stripped).slice(0, MAX_SAMPLE_CHARS);
}

// Words pulled straight from the prompt — if the model echoes the instruction
// instead of reading the doc, the resulting "slug" lands here. Keep this in
// sync with the prompt below.
const INSTRUCTION_LEAK_WORDS = new Set([
  "slug",
  "slugs",
  "output",
  "single",
  "line",
  "lowercase",
  "hyphen",
  "hyphens",
  "explanation",
  "rules",
  "instruction",
  "instructions",
]);

function looksLikeInstructionLeak(slug: string): boolean {
  let hits = 0;
  for (const w of slug.split("-")) if (INSTRUCTION_LEAK_WORDS.has(w)) hits++;
  return hits >= 2;
}

/**
 * Suggests a human-readable slug based on doc content via MiniMax,
 * with collision handling against Firestore. Falls back to random nanoid
 * if MiniMax is unavailable or can't produce a clean suggestion.
 */
export async function allocateContentAwareSlug(opts: {
  title?: string;
  content?: string;
  maxAttempts?: number;
}): Promise<string> {
  const docs = adminFirestore().collection("docs");
  const max = opts.maxAttempts ?? 3;

  const context = [opts.title?.trim(), opts.content ? sampleContent(opts.content) : null].filter(Boolean).join("\n\n");
  console.log(
    `[slug] allocateContentAwareSlug titleBytes=${opts.title?.length ?? 0} contentBytes=${opts.content?.length ?? 0} contextBytes=${context.length}`,
  );

  if (!context) {
    console.warn("[slug] empty context — falling back to random");
    return allocateSlug();
  }

  const prompt = `You generate short, human-readable URL slugs for shared documents.

Rules:
- 2-4 lowercase words joined by single hyphens.
- Only letters, digits, and hyphens. No quotes, no punctuation, no explanation.
- Pick words describing what the document is ABOUT (its topic), not generic filler like "document", "page", "untitled", "readme", "draft", "notes", or "test".
- Prefer concrete nouns from the title and headings over verbs from body copy.
- Skip stop words ("the", "a", "and", "of", "for") and dates/versions unless essential to the topic.
- If the document is empty, unreadable, or you cannot determine a topic, output exactly: UNKNOWN
- Output ONLY the slug on a single line. Nothing else.

Examples:
Title: "Q3 Marketing Launch Plan"
Slug: q3-marketing-launch

Title: "How React Server Actions Work"
Slug: react-server-actions

Title: "Untitled" — body discusses a chess opening trap called the Englund Gambit
Slug: englund-gambit-trap

Title: "" — body is a postmortem of a Stripe webhook outage
Slug: stripe-webhook-postmortem

Document (between the markers):
<<<DOC
${context}
DOC>>>`;
  const raw = await minimaxChat(prompt, 1024);
  if (!raw) {
    console.warn("[slug] minimax returned null — falling back to random");
    return allocateSlug();
  }
  // Reasoning models may emit thinking before the final answer. Try the last
  // non-empty line first, then fall back to the first.
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = Array.from(new Set([lines[lines.length - 1] ?? "", lines[0] ?? ""]));
  if (candidates.some((c) => c.toUpperCase() === "UNKNOWN")) {
    console.warn("[slug] minimax returned UNKNOWN — falling back to random");
    return allocateSlug();
  }
  let base: string | null = null;
  for (const c of candidates) {
    const cleaned = sanitizeSlug(c);
    if (!cleaned) continue;
    if (looksLikeInstructionLeak(cleaned)) {
      console.warn(`[slug] rejecting instruction-leak candidate "${cleaned}"`);
      continue;
    }
    base = cleaned;
    break;
  }
  if (!base) {
    console.warn(`[slug] sanitize rejected minimax output ${JSON.stringify(raw.slice(0, 200))} — falling back`);
    return allocateSlug();
  }
  console.log(`[slug] candidate base="${base}"`);

  for (let i = 0; i < max; i++) {
    const candidate = i === 0 ? base : `${base}-${shortSuffix()}`;
    const snap = await docs.doc(candidate).get();
    if (!snap.exists) {
      console.log(`[slug] claimed "${candidate}" (attempt ${i + 1}/${max})`);
      return candidate;
    }
    console.log(`[slug] collision on "${candidate}" (attempt ${i + 1}/${max})`);
  }

  console.warn(`[slug] exhausted ${max} attempts for base="${base}" — falling back to random`);
  return allocateSlug();
}
