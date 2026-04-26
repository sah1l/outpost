import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, chmod, unlink } from "node:fs/promises";

export const DEFAULT_API_BASE = "https://outpost.offsprint.xyz";

export interface AuthConfig {
  apiBase: string;
  accessToken: string;
  user: { uid: string; email: string };
  savedAt: number;
}

function configDir(): string {
  // Honor XDG when set, else ~/.config/outpost (or %APPDATA% on Windows).
  if (process.env.OUTPOST_CONFIG_DIR) return process.env.OUTPOST_CONFIG_DIR;
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appdata, "outpost");
  }
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdg, "outpost");
}

function authFile(): string {
  return join(configDir(), "auth.json");
}

export function getApiBase(): string {
  return process.env.OUTPOST_API || DEFAULT_API_BASE;
}

export async function readAuth(): Promise<AuthConfig | null> {
  try {
    const raw = await readFile(authFile(), "utf8");
    return JSON.parse(raw) as AuthConfig;
  } catch {
    return null;
  }
}

export async function writeAuth(cfg: AuthConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  const path = authFile();
  await writeFile(path, JSON.stringify(cfg, null, 2), "utf8");
  if (process.platform !== "win32") {
    try {
      await chmod(path, 0o600);
    } catch {
      // best-effort
    }
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await unlink(authFile());
  } catch {
    // ignore
  }
}
