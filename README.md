# Outpost

Share HTML and Markdown publicly. Next.js on Cloud Run, GCS for files, Firestore for metadata.

- Live demo: **https://outpost.offsprint.xyz**
- Demo doc (made with Outpost): **https://outpost.offsprint.xyz/s/outpost-three-ways**

## Use Outpost from your AI coding agent (Claude Code & friends)

The fastest way to start using Outpost is from the AI agent you're already
chatting with. Install the Outpost Agent Skill once and you can ask your
agent to share a local `.html` or `.md` file and get back a public link
without leaving the chat. Works with Claude Code, Copilot CLI, Cursor, Codex,
Gemini CLI, and Antigravity.

1. **Update `gh` to the latest version.** Skill install from public repos
   landed in `gh` 2.90+. If you installed via Chocolatey:

   ```powershell
   choco upgrade gh
   ```

   Otherwise use the upgrade path for your installer (Homebrew, winget, the
   GitHub release, etc.).

2. **Install the Outpost skill:**

   ```sh
   gh skill install sah1l/outpost outpost
   ```

3. **Log in once to get a CLI token** (used by the skill to upload on your
   behalf):

   ```sh
   npx @offsprint/outpost login
   ```

   This opens a browser for device-flow auth and stores the token locally.

4. **Ask your agent to share a doc.** In your Claude Code (or other agent)
   session, prompt something like:

   > share `xyz.md` as md and give me a public link

   or

   > share `report.html` as html and give me a public link

   Ask for a **public link** explicitly — otherwise the agent uploads the
   file as private and you have to flip it from the dashboard. If the agent
   doesn't pick up on the first try, mention "**share to outpost**":

   > share this to outpost as md and give me a public link

For manual install or other agent hosts, see
[`skills/README.md`](./skills/README.md).

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
