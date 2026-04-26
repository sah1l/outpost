import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: false,
  minify: false,
  // Bundle the workspace shared types so consumers don't need it.
  noExternal: ["@offsprint/shared"],
  banner: { js: "#!/usr/bin/env node" },
});
