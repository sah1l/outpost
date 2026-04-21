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

/** Picks up to `maxChars` of representative text from HTML/MD source. */
function sampleContent(source: string): string {
  const noScripts = source.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = noScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.slice(0, 1200);
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

  const prompt =
    "Suggest a short URL slug for the document below. " +
    "Use 2-4 lowercase words joined by single hyphens. " +
    "Only letters, digits, and hyphens. No punctuation, no quotes, no explanation. " +
    "Output the slug on a single line, nothing else.\n\n" +
    context;
  const raw = await minimaxChat(prompt, 256);
  if (!raw) {
    console.warn("[slug] minimax returned null — falling back to random");
    return allocateSlug();
  }
  // Reasoning models may emit thinking before the final answer. Try the last
  // non-empty line first, then fall back to the first.
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = [lines[lines.length - 1] ?? "", lines[0] ?? ""];
  let base: string | null = null;
  for (const c of candidates) {
    const cleaned = sanitizeSlug(c);
    if (cleaned) {
      base = cleaned;
      break;
    }
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
