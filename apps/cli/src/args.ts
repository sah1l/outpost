export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Lightweight arg parser.
 *  --key value      → flags.key = "value"
 *  --key=value      → flags.key = "value"
 *  --flag           → flags.flag = true
 *  --no-flag        → flags.flag = false
 *  -                → positional "-"  (used to mean stdin)
 *  Anything else    → positional[]
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 2) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

export function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

export function flagBool(flags: Record<string, string | boolean>, key: string): boolean | undefined {
  const v = flags[key];
  return typeof v === "boolean" ? v : undefined;
}
