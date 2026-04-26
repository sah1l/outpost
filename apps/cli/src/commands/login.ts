import { exec } from "node:child_process";
import { startDeviceFlow, pollForToken } from "../api.js";
import { getApiBase, writeAuth } from "../config.js";

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  // Best-effort; ignore failures.
  exec(cmd, () => undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function loginCommand(): Promise<number> {
  const start = await startDeviceFlow();

  process.stdout.write(`\n  Authorize this CLI on ${getApiBase()}\n\n`);
  process.stdout.write(`  Visit:  ${start.verificationUrlComplete}\n`);
  process.stdout.write(`  Code:   ${start.userCode}\n\n`);
  process.stdout.write(`  Opening browser…\n`);
  openBrowser(start.verificationUrlComplete);

  let intervalMs = Math.max(1, start.interval) * 1000;
  const maxIntervalMs = 60_000;
  const deadline = Date.now() + start.expiresIn * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const result = await pollForToken(start.deviceCode);
    if (result.status === "approved" && result.token) {
      await writeAuth({
        apiBase: getApiBase(),
        accessToken: result.token.accessToken,
        user: result.token.user,
        savedAt: Date.now(),
      });
      process.stdout.write(`\n  Signed in as ${result.token.user.email}\n`);
      return 0;
    }
    if (result.status === "denied") {
      process.stderr.write(`\n  Request denied.\n`);
      return 1;
    }
    if (result.status === "expired") {
      process.stderr.write(`\n  Code expired. Run \`outpost login\` again.\n`);
      return 1;
    }
    if (result.status === "error") {
      process.stderr.write(`\n  Error during sign-in: ${result.error}\n`);
      return 1;
    }
    if (result.error === "slow_down") {
      intervalMs = Math.min(Math.floor(intervalMs * 1.5), maxIntervalMs);
    }
  }
  process.stderr.write(`\n  Timed out waiting for approval.\n`);
  return 1;
}
