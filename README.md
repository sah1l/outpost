# Offsprint Share

Share HTML and Markdown publicly. Next.js on Cloud Run, GCS for files, Firestore for metadata.

## Structure

- `apps/app` — main app at `outpost.offsprint.xyz`
- `apps/usercontent` — sandboxed user content at `usercontent.offsprint.xyz`
- `apps/cli` — **Outpost**, the `outpost` CLI for uploading from terminals and AI agents — see [`apps/cli/README.md`](./apps/cli/README.md) for usage and local development
- `packages/shared` — shared types and constants
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
