import { whoami } from "../api.js";

export async function whoamiCommand(): Promise<number> {
  const me = await whoami();
  if (!me) {
    process.stderr.write("Not signed in. Run `outpost login`.\n");
    return 1;
  }
  process.stdout.write(`${me.email} (uid ${me.uid})\n`);
  process.stdout.write(`Token expires: ${new Date(me.tokenExpiresAt).toISOString()}\n`);
  return 0;
}
