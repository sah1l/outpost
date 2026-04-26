# Offsprint Share

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
gh skill install sah1l/share-html outpost
```

For manual install (or other agent hosts), see [`skills/README.md`](./skills/README.md).
