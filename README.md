# Offsprint Share

Share HTML and Markdown publicly. Next.js on Cloud Run, GCS for files, Firestore for metadata.

## Structure

- `apps/app` — main app at `share.offsprint.xyz`
- `apps/usercontent` — sandboxed user content at `usercontent.offsprint.xyz`
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
