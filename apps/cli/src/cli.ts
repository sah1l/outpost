import { parseArgs } from "./args.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { updateCommand } from "./commands/update.js";
import { uploadCommand } from "./commands/upload.js";
import { whoamiCommand } from "./commands/whoami.js";

const VERSION = "0.2.0";

const HELP = `outpost ${VERSION}

Usage:
  outpost <command> [options]

Commands:
  login        Authorize this CLI with your Outpost account
  logout       Remove the saved access token
  whoami       Show the currently signed-in user
  upload       Upload an HTML or Markdown document
  update       Replace the contents of an existing document

Run \`outpost upload --help\` or \`outpost update --help\` for command options.
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = parseArgs(argv.slice(1));

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v" || cmd === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  switch (cmd) {
    case "login":
      return loginCommand();
    case "logout":
      return logoutCommand();
    case "whoami":
      return whoamiCommand();
    case "upload":
      return uploadCommand(rest);
    case "update":
      return updateCommand(rest);
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
  });
