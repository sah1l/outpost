import { clearAuth } from "../config.js";

export async function logoutCommand(): Promise<number> {
  await clearAuth();
  process.stdout.write("Signed out.\n");
  return 0;
}
