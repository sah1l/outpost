# Outpost

Share HTML and Markdown publicly. Next.js on Cloud Run, GCS for files, Firestore for metadata.

Live demo: **https://outpost.offsprint.xyz**

## Structure

- `apps/app` — main app at [outpost.offsprint.xyz](https://outpost.offsprint.xyz)
- `apps/usercontent` — sandboxed user content at [usercontent.offsprint.xyz](https://usercontent.offsprint.xyz)
- `apps/cli` — **Outpost**, the `outpost` CLI for uploading from terminals and AI agents — see [`apps/cli/README.md`](./apps/cli/README.md) for usage and local development
- `packages/shared` — shared types and constants
- `skills/` — Agent Skills that teach AI coding agents how to use the CLI — see [`skills/README.md`](./skills/README.md)
- `infra/` — Firestore rules/indexes, GCS lifecycle

## Dev

```powershell
pnpm install
Copy-Item .env.example apps/app/.env.local
Copy-Item .env.example apps/usercontent/.env.local
pnpm dev:app
pnpm dev:usercontent
```

To work on the CLI alongside the app, see
[`apps/cli/README.md` → Local development](./apps/cli/README.md#local-development).

## Agent Skill

The `outpost` Agent Skill teaches AI coding agents (Claude Code, Copilot CLI,
Cursor, Codex, Gemini CLI, Antigravity) to upload `.html` / `.md` files via the
CLI and return a shareable URL.

With `gh` 2.90+:

```sh
gh skill install sah1l/outpost outpost
```

For manual install (or other agent hosts), see [`skills/README.md`](./skills/README.md).

## Using Outpost in your AI coding agent (e.g. Claude Code)

Once set up, you can ask your agent to share a local `.html` or `.md` file and
get back a public link without leaving the chat.

1. **Update `gh` to the latest version.** Skill install from public repos
   landed in `gh` 2.90+. If you installed via Chocolatey:

   ```powershell
   choco upgrade gh
   ```

   Otherwise, follow the upgrade path for your installer (Homebrew, winget,
   the GitHub release, etc.).

2. **Install the Outpost skill:**

   ```sh
   gh skill install sah1l/outpost outpost
   ```

3. **Log in once to get a CLI token** (used by the skill to upload on your
   behalf):

   ```sh
   npx @offsprint/outpost login
   ```

   This opens a browser window for device-flow auth and stores the token
   locally.

4. **Ask your agent to share a doc.** In your Claude Code (or other agent)
   session, prompt something like:

   > share `xyz.md` as md and give me a public link

   or

   > share `report.html` as html and give me a public link

   Make sure to ask for a **public link** — otherwise the agent will only
   upload the file and you'll have to flip it to public manually from the
   dashboard. If the agent doesn't pick up on the first try, mention
   "**share to outpost**" explicitly:

   > share this to outpost as md and give me a public link
