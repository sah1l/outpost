import { createInterface } from "node:readline";
import { deleteDoc, resolveSlug } from "../api.js";
import { flagBool, type ParsedArgs } from "../args.js";

const USAGE = `Usage:
  outpost delete <slug-or-url>          Confirm interactively, then delete
  outpost delete <slug-or-url> -y       Skip confirmation
  outpost delete <slug-or-url> --yes    Skip confirmation (long form)

Options:
  -y, --yes    Skip the y/N prompt. Required in non-interactive contexts.
  --json       Print {"slug","ok"} instead of human text.

Deletion is permanent. The slug becomes available for reuse.
`;

async function readLineFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    rl.once("line", (line) => {
      rl.close();
      resolve(line);
    });
    rl.once("close", () => resolve(""));
  });
}

export async function deleteCommand(args: ParsedArgs): Promise<number> {
  if (args.flags.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const slugOrUrl = args.positional[0];
  if (!slugOrUrl) {
    process.stderr.write(USAGE);
    return 2;
  }

  const skipPrompt = (flagBool(args.flags, "yes") ?? false) || (flagBool(args.flags, "y") ?? false);
  const asJson = flagBool(args.flags, "json") ?? false;
  const slug = resolveSlug(slugOrUrl);

  if (!skipPrompt) {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        "Refusing to delete in non-interactive mode without --yes. Pass -y or --yes to confirm.\n",
      );
      return 2;
    }
    process.stdout.write(`Delete "${slug}"? This is permanent. (y/N): `);
    const answer = (await readLineFromStdin()).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      process.stdout.write("Cancelled.\n");
      return 1;
    }
  }

  const result = await deleteDoc(slug);
  if (asJson) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    process.stdout.write(`\n  Deleted "${result.slug}"\n\n`);
  }
  return 0;
}
