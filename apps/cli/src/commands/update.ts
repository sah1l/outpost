import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { CliUploadFormat } from "@offsprint/shared";
import { updateFile, updateText, type UpdateOptions } from "../api.js";
import { flagBool, flagString, type ParsedArgs } from "../args.js";
import { printResult } from "./_print.js";

const USAGE = `Usage:
  outpost update <slug-or-url> <file>     Replace contents from a file
  outpost update <slug-or-url> --text "..." [--format html|md]
  cat note.md | outpost update <slug-or-url> - [--format html|md]
  outpost update <slug-or-url> --title "..." [--public|--no-public]

Updates an existing document you own. The slug/URL is required.

Options:
  --format html|md   Required for stdin; for --text and files, server validates
                     against the existing doc's type.
  --title "..."      Replace the title shown in your dashboard.
  --public           Make the document public.
  --no-public        Make the document private.
                     Omit both to leave visibility unchanged.
  --json             Print machine-readable JSON output.

At least one of: file, --text, --title, --public/--no-public must be provided.
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

export async function updateCommand(args: ParsedArgs): Promise<number> {
  if (args.flags.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const slugOrUrl = args.positional[0];
  if (!slugOrUrl) {
    process.stderr.write(USAGE);
    return 2;
  }

  const target = args.positional[1];
  const title = flagString(args.flags, "title");
  const isPublic = flagBool(args.flags, "public");
  const asJson = flagBool(args.flags, "json") ?? false;
  const formatFlag = flagString(args.flags, "format") as CliUploadFormat | undefined;
  const inlineText = flagString(args.flags, "text");

  const opts: UpdateOptions = { title, isPublic };

  // Mode 1: --text "..."
  if (inlineText !== undefined) {
    const result = await updateText(slugOrUrl, inlineText, formatFlag, opts);
    printResult(result, asJson, "Updated");
    return 0;
  }

  // Mode 2: stdin (explicit "-")
  if (target === "-") {
    if (!formatFlag) {
      process.stderr.write("--format is required with stdin (use 'html' or 'md').\n");
      return 2;
    }
    const text = await readStdin();
    if (!text.trim()) {
      process.stderr.write("Empty input on stdin.\n");
      return 2;
    }
    const result = await updateText(slugOrUrl, text, formatFlag, opts);
    printResult(result, asJson, "Updated");
    return 0;
  }

  // Mode 3: file path
  if (target) {
    const fmt = formatFlag ?? detectFormatFromFilename(target);
    if (!fmt) {
      process.stderr.write(`Could not infer format from "${target}". Pass --format html|md.\n`);
      return 2;
    }
    const buf = await readFile(target);
    const filename = basename(target);
    const result = await updateFile(slugOrUrl, filename, buf, contentTypeFor(fmt), opts);
    printResult(result, asJson, "Updated");
    return 0;
  }

  // Mode 4: metadata-only update (title/visibility, no body)
  if (title !== undefined || isPublic !== undefined) {
    const result = await updateText(slugOrUrl, undefined, undefined, opts);
    printResult(result, asJson, "Updated");
    return 0;
  }

  process.stderr.write("Nothing to update. Provide a file, --text, --title, or --public/--no-public.\n\n");
  process.stderr.write(USAGE);
  return 2;
}
