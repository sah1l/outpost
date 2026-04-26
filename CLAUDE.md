# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a pnpm workspace (`packageManager: pnpm@9.12.0`, `node >=20`). Run from the repo root.

```powershell
pnpm install
pnpm dev:app                              # @offsprint/app on :3000
pnpm dev:usercontent                      # @offsprint/usercontent on :3001
pnpm build                                # build all workspaces
pnpm lint                                 # next lint across workspaces
pnpm typecheck                            # tsc --noEmit across workspaces

# Per-workspace
pnpm --filter @offsprint/app dev          # also: build, lint, typecheck
pnpm --filter @offsprint/usercontent dev
pnpm --filter @offsprint/outpost dev      # tsup watch (CLI build)
pnpm --filter @offsprint/outpost build
```

There is no test suite. Lint = `next lint` (ESLint flat config via `eslint-config-next`).

Local dev requires `apps/app/.env.local` and `apps/usercontent/.env.local` populated from `.env.example` — both apps require Firebase Admin credentials and a GCS bucket to start (env vars are looked up lazily, so the dev server boots, but any request that touches Firestore/GCS will throw).

Deploy: `./scripts/deploy.ps1` (PowerShell 7+). Reads optional `scripts/deploy.config.ps1`, runs `gcloud builds submit --config infra/cloudbuild.yaml`, then re-pins Cloud Run services to `min-instances=0`. See `infra/DEPLOY.md` for the one-time GCP setup (APIs, service accounts, Secret Manager, Cloudflare DNS).

CLI smoke test against a local app: set `OUTPOST_API=http://localhost:3000` and `OUTPOST_CONFIG_DIR` to a throwaway path so the dev token doesn't clobber the production one — see `apps/cli/README.md` "Local development".

## Architecture

Two-domain split is the central design constraint, motivated by browser security:

- **`apps/app`** (`@offsprint/app`, served at `outpost.offsprint.xyz`) — the trusted origin. Hosts the marketing page, auth, dashboard, editor, all upload APIs, and the CLI device-flow endpoints. Owns the Firebase session cookie.
- **`apps/usercontent`** (`@offsprint/usercontent`, served at `usercontent.offsprint.xyz`) — an untrusted, content-only origin that streams uploaded HTML/MD/zip from GCS with a permissive CSP. **No auth happens here.** Public-doc requests on `app` (`/s/[slug]`) 302 to `usercontent` so user-uploaded JS can't read the session cookie or call privileged APIs. Don't add user-facing routes here that need auth.
- **`apps/cli`** (`@offsprint/outpost`) — standalone Node CLI published as `outpost` to npm. Talks to `apps/app`'s `/api/cli/*` endpoints via a bearer token obtained through device flow.
- **`packages/shared`** — types and constants shared across all three apps. Source-only (`main: ./src/index.ts`); both Next apps `transpilePackages: ["@offsprint/shared"]` so there's no build step.

Both Next apps use the App Router with `output: "standalone"` (Cloud Run friendly). Both run on Node runtime (not Edge) for `@google-cloud/storage` and `firebase-admin`.

### Data plane

- **Firestore** (Admin SDK only — `infra/firestore.rules` is deny-all). Three collections matter:
  - `docs/{slug}` — `DocRecord` (see `packages/shared/src/types.ts`). `expiresAt` is the Firestore TTL field for anonymous docs; production must have TTL enabled on `docs.expiresAt`.
  - `users/{uid}` — `UserRecord` plus `storageUsedBytes` running counter.
  - `cliDeviceCodes/{sha256(deviceCode)}`, `cliTokens/{sha256(token)}`, `anonQuotas/{day_ip}` — internal to `apps/app/src/lib/`.
- **GCS** — file storage. Path layout enforced by `gcsPrefixFor()` in `apps/app/src/lib/docs.ts`: `user/{uid}/{slug}/...` for signed-in users, `anon/{slug}/...` for anonymous uploads. `infra/gcs-lifecycle.json` deletes objects after 90 days as a safety backstop for orphaned anon files.
- **Slug allocation** is content-aware: `allocateContentAwareSlug()` in `apps/app/src/lib/slug.ts` calls MiniMax (if `MINIMAX_API_KEY` set) to pick a 2–4 word readable slug, falling back to a 10-char nanoid. Collisions retry with a `-xxxx` suffix.

### Auth

There are **two independent auth surfaces** that share `users/{uid}`:

1. **Web session** — Firebase Authentication (Google + Microsoft providers, optionally tenant-restricted via `NEXT_PUBLIC_MICROSOFT_TENANT`). The client signs in, posts the ID token to `/api/auth/session`, and the server mints a Firebase **session cookie** named `__session` (the cookie name is intentional — Firebase Hosting strips any cookie that isn't named exactly `__session`, see `packages/shared/src/constants.ts`). `getSessionUser()` in `apps/app/src/lib/auth.ts` is the only verifier. `apps/app/src/middleware.ts` gates `/dashboard`, `/editor`, `/cli` on cookie presence (full verification still happens in the page).
2. **CLI tokens** — OAuth-style **device flow** rooted at `/api/cli/device/start`, `/cli/device` (browser approval page), `/api/cli/device/approve`, `/api/cli/device/token`. Tokens are random 32-byte secrets stored hashed in Firestore (`cliTokens/{sha256(token)}`), 90-day TTL, sent as `Authorization: Bearer ...` on `/api/cli/upload` and `/api/cli/whoami`. See `apps/app/src/lib/cli-tokens.ts` and `apps/app/src/lib/cli-auth.ts`. `lastUsedAt` is throttled to one write/hour to keep chatty CLIs from amplifying Firestore load.

Anonymous uploads use a separate path (`apps/app/src/app/api/anon/upload`) gated by per-IP daily quota (`checkAndIncrementAnonUploadQuota` in `apps/app/src/lib/rate-limit.ts`, default 5 / day) and a 30-day Firestore TTL. The anonymous client is identified by an `offsprint_anon` cookie (also defined in `packages/shared/src/constants.ts`).

### Upload flows (three of them — pick the right one)

- **Browser, signed-in, large/zip uploads** — `/api/docs/init` returns a GCS V4 signed PUT URL, browser uploads directly to GCS, then `/api/docs/finalize` validates and creates the Firestore record. ZIP archives are extracted server-side at finalize via `apps/app/src/lib/zip.ts` (zip-slip checks, compression-ratio bomb checks, allowlisted extensions, must contain `index.html`).
- **Browser, anonymous** — `/api/anon/upload` accepts a multipart form directly (no signed URL dance), enforces `MAX_UPLOAD_BYTES_ANON = 2MB`, rate-limits per IP, sets `expiresAt = now + 30 days`.
- **CLI** — `/api/cli/upload` accepts JSON (`{text, format, title?, isPublic?}`) or multipart (`file` + `title?` + `isPublic?`). Bearer-auth only, no signed URL — bodies are limited to `MAX_UPLOAD_BYTES_USER = 10MB`. Always treats the upload as authored by the bearer's `uid`.

### Public viewing

`/s/[slug]` on `app` is a redirect router: if the doc is public it 302s to `usercontent.offsprint.xyz/view/[slug]`, otherwise it shows a "private" page (with an editor link if the viewer owns it). The actual content streaming lives in `apps/usercontent/src/app/view/[slug]/route.ts` (single-file: HTML, MD rendered to HTML, or single-asset zip entry) and `apps/usercontent/src/app/view/[slug]/[...path]/route.ts` (zip subpath assets). Every response goes through `securityHeaders()` in `apps/usercontent/src/lib/headers.ts` which sets `frame-ancestors 'self' <appOrigin>` so the editor preview iframe works.

For anonymous docs, `touchAnonExpiry` extends `expiresAt` on each view — keeps actively-used shares from getting TTL'd. The usercontent runtime SA needs `datastore.user` (read+write) for this; you can drop the call to fall back to a hard 30-day TTL.

## Conventions worth knowing

- **Path alias** `@/*` resolves to `src/*` in both Next apps (Next defaults). Cross-package imports use `@offsprint/shared`.
- **`runtime = "nodejs"`** is set explicitly on routes that touch GCS / `firebase-admin`. Don't move them to Edge.
- **All Firestore writes go through `firebase-admin`** — there is no client SDK Firestore code in this repo. The rules file is deny-all and intentional. If you need a new collection, add it to the appropriate lib helper.
- **Magic constants live in `packages/shared/src/constants.ts`** — don't redefine size/quota/cookie-name limits in app code; import them.
- **The CLI is published to npm** as `@offsprint/outpost`. When changing types/constants in `packages/shared`, the CLI re-bundles them at build time (it's a `devDependency` so consumers don't pull the workspace), but bumps to the wire format need a corresponding bump to `apps/app/src/app/api/cli/*` and a new CLI release.
- **Windows-first dev environment** — scripts and docs use PowerShell. The deploy script requires PowerShell 7+. Bash/Unix examples appear in CLI docs as a courtesy but are not the primary path.
- **Firebase auth-domain ≠ custom domain.** Azure redirect URI must be `https://<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>/__/auth/handler`, not the public `outpost.offsprint.xyz`. Custom domains go in Firebase's Authorized domains list.
