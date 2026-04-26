import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { CliUploadFormat } from "@offsprint/shared";
import { uploadFile, uploadText } from "../api.js";
import { flagBool, flagString, type ParsedArgs } from "../args.js";

const USAGE = `Usage:
  outpost upload <file>            Upload a .html or .md file
  outpost upload --text "..."      Upload inline text (requires --format)
  cat note.md | outpost upload -   Upload from stdin (requires --format)

Options:
  --format html|md     Required when uploading text or stdin
  --title "..."        Title shown in your dashboard (defaults to filename)
  --public             Make the document public (default: private)
  --json               Print machine-readable JSON output
`;

function detectFormatFromFilename(name: string): CliUploadFormat | null {
  const ext = extname(name).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".html" || ext === ".htm") return "html";
  return null;
}

function contentTypeFor(format: CliUploadFormat): string {
  return format === "md" ? "text/markdown" : "text/html";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function requireFormat(
  formatFlag: CliUploadFormat | undefined,
  source: "--text" | "stdin",
): formatFlag is CliUploadFormat {
  if (formatFlag) return true;
  process.stderr.write(`--format is required with ${source} (use 'html' or 'md').\n`);
  return false;
}

export async function uploadCommand(args: ParsedArgs): Promise<number> {
  if (args.flags.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const title = flagString(args.flags, "title");
  const isPublic = flagBool(args.flags, "public") ?? false;
  const asJson = flagBool(args.flags, "json") ?? false;
  const formatFlag = flagString(args.flags, "format") as CliUploadFormat | undefined;
  const inlineText = flagString(args.flags, "text");
  const target = args.positional[0];

  // Mode 1: --text "..."
  if (inlineText !== undefined) {
    if (!requireFormat(formatFlag, "--text")) return 2;
    const result = await uploadText(inlineText, formatFlag, { title, isPublic });
    printResult(result, asJson);
    return 0;
  }

  // Mode 2: stdin (either '-' positional, or no positional and stdin is piped)
  const stdinPiped = !process.stdin.isTTY;
  if (target === "-" || (!target && stdinPiped)) {
    if (!requireFormat(formatFlag, "stdin")) return 2;
    const text = await readStdin();
    if (!text.trim()) {
      process.stderr.write("Empty input on stdin.\n");
      return 2;
    }
    const result = await uploadText(text, formatFlag, { title, isPublic });
    printResult(result, asJson);
    return 0;
  }

  // Mode 3: file path
  if (!target) {
    process.stderr.write(USAGE);
    return 2;
  }
  const fmt = formatFlag ?? detectFormatFromFilename(target);
  if (!fmt) {
    process.stderr.write(`Could not infer format from "${target}". Pass --format html|md.\n`);
    return 2;
  }
  const buf = await readFile(target);
  const filename = basename(target);
  const result = await uploadFile(filename, buf, contentTypeFor(fmt), {
    title: title ?? filename,
    isPublic,
  });
  printResult(result, asJson);
  return 0;
}

function printResult(result: { slug: string; url: string; title: string }, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  process.stdout.write(`\n  Uploaded "${result.title}"\n`);
  process.stdout.write(`  ${result.url}\n\n`);
}
