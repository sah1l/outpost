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

Local dev requires `apps/app/.env.local` and `apps/usercontent/.env.local` populated from `.env.example` — both apps require Firebase Admin credentials and a GCS bucket to start (env vars are looked up lazily, so the dev server boots, but any request that touches Firestore/GCS will throw). `CONTENT_TOKEN_SECRET` must be the same in both, or private docs 404 in the viewer.

Deploy: `./scripts/deploy.ps1` (PowerShell 7+). Reads optional `scripts/deploy.config.ps1`, runs `gcloud builds submit --config infra/cloudbuild.yaml`, then re-pins Cloud Run services to `min-instances=0`. See `infra/DEPLOY.md` for the one-time GCP setup (APIs, service accounts, Secret Manager, Cloudflare DNS). **Pushing to `master` also deploys to production:** `.github/workflows/deploy-infra.yml` runs on changes to either app, `packages/shared`, `infra/cloudbuild.yaml` or the lockfile, and doesn't wait for CI.

CLI smoke test against a local app: set `OUTPOST_API=http://localhost:3000` and `OUTPOST_CONFIG_DIR` to a throwaway path so the dev token doesn't clobber the production one — see `apps/cli/README.md` "Local development".

## Architecture

Two-domain split is the central design constraint, motivated by browser security:

- **`apps/app`** (`@offsprint/app`, served at `outpost.offsprint.xyz`) — the trusted origin. Hosts the marketing page, auth, dashboard, editor, all upload APIs, and the CLI device-flow endpoints. Owns the Firebase session cookie.
- **`apps/usercontent`** (`@offsprint/usercontent`, served at `usercontent.offsprint.xyz`) — an untrusted, content-only origin that streams uploaded HTML/MD/zip from GCS. Every response is sandboxed with CSP `sandbox` (no `allow-same-origin`), so uploaded JS runs with an opaque origin and can't read cookies or call privileged APIs. **It never reads a session cookie.** Public docs need nothing; private docs need a signed token in the path, minted by `app` after it checks the session (see Viewing below). Don't add routes here that read a cookie.
- **`apps/cli`** (`@offsprint/outpost`) — standalone Node CLI published as `outpost` to npm. Talks to `apps/app`'s `/api/cli/*` endpoints via a bearer token obtained through device flow.
- **`packages/shared`** — types and constants shared across all three apps. Source-only (`main: ./src/index.ts`); both Next apps `transpilePackages: ["@offsprint/shared"]` so there's no build step.

Both Next apps use the App Router with `output: "standalone"` (Cloud Run friendly). Both run on Node runtime (not Edge) for `@google-cloud/storage` and `firebase-admin`.

### Data plane

- **Firestore** (Admin SDK only — `infra/firestore.rules` is deny-all). The collections that matter:
  - `docs/{slug}` — `DocRecord` (see `packages/shared/src/types.ts`). `expiresAt` is the Firestore TTL field for anonymous docs; production must have TTL enabled on `docs.expiresAt`. Sharing lives here too: `shares` is the source of truth and `sharedWithEmails` is the same emails kept alongside for the "shared with me" query, so always write them together (`upsertDocShare`/`removeDocShare` in `apps/app/src/lib/docs.ts`).
  - `users/{uid}` — `UserRecord` plus `storageUsedBytes` running counter. `emailVerified` decides whether email grants match; usercontent and the CLI read it from here because they can't see the session.
  - `workspaces/{id}` and `workspaceMembers/{workspaceId__encodedEmail}`: see `apps/app/src/lib/workspaces.ts`. A doc joins a workspace through `docs.workspaceId`.
  - `cliDeviceCodes/{sha256(deviceCode)}`, `cliTokens/{sha256(token)}`, `anonQuotas/{day_ip}` — internal to `apps/app/src/lib/`.
- **GCS** — file storage. Path layout enforced by `gcsPrefixFor()` in `apps/app/src/lib/docs.ts`: `user/{uid}/{slug}/...` for signed-in users, `anon/{slug}/...` for anonymous uploads. `infra/gcs-lifecycle.json` deletes objects after 90 days as a safety backstop for orphaned anon files.
- **Slug allocation** is content-aware: `allocateContentAwareSlug()` in `apps/app/src/lib/slug.ts` calls MiniMax (if `MINIMAX_API_KEY` set) to pick a 2–4 word readable slug, falling back to a 10-char nanoid. Collisions retry with a `-xxxx` suffix.

### Auth

There are **two independent auth surfaces** that share `users/{uid}`:

1. **Web session** — Firebase Authentication (Google + Microsoft providers, optionally tenant-restricted via `NEXT_PUBLIC_MICROSOFT_TENANT`). The client signs in, posts the ID token to `/api/auth/session`, and the server mints a Firebase **session cookie** named `__session` (the cookie name is intentional — Firebase Hosting strips any cookie that isn't named exactly `__session`, see `packages/shared/src/constants.ts`). `getSessionUser()` in `apps/app/src/lib/auth.ts` is the only verifier. `apps/app/src/middleware.ts` gates `/dashboard`, `/editor`, `/cli`, `/workspaces` on cookie presence (full verification still happens in the page). It's also the CSRF guard: every POST/PUT/PATCH/DELETE under `/api` must come from this origin or carry a bearer token. `usercontent` counts as same-site, so the Lax cookie alone doesn't protect these routes. New write routes are covered automatically; only add to `COOKIELESS_WRITES` if the route reads no cookie.
2. **CLI tokens** — OAuth-style **device flow** rooted at `/api/cli/device/start`, `/cli/device` (browser approval page), `/api/cli/device/approve`, `/api/cli/device/token`. Tokens are random 32-byte secrets stored hashed in Firestore (`cliTokens/{sha256(token)}`), 90-day TTL, sent as `Authorization: Bearer ...` on `/api/cli/upload` and `/api/cli/whoami`. See `apps/app/src/lib/cli-tokens.ts` and `apps/app/src/lib/cli-auth.ts`. `lastUsedAt` is throttled to one write/hour to keep chatty CLIs from amplifying Firestore load.

Anonymous uploads use a separate path (`apps/app/src/app/api/anon/upload`) gated by per-IP daily quota (`checkAndIncrementAnonUploadQuota` in `apps/app/src/lib/rate-limit.ts`, default 5 / day) and a 30-day Firestore TTL. The anonymous client is identified by an `offsprint_anon` cookie (also defined in `packages/shared/src/constants.ts`).

### Upload flows (three of them — pick the right one)

- **Browser, signed-in, large/zip uploads** — `/api/docs/init` returns a GCS V4 signed PUT URL, browser uploads directly to GCS, then `/api/docs/finalize` validates and creates the Firestore record. ZIP archives are extracted server-side at finalize via `apps/app/src/lib/zip.ts` (zip-slip checks, compression-ratio bomb checks, allowlisted extensions, must contain `index.html`).
- **Browser, anonymous** — `/api/anon/upload` accepts a multipart form directly (no signed URL dance), enforces `MAX_UPLOAD_BYTES_ANON = 2MB`, rate-limits per IP, sets `expiresAt = now + 30 days`.
- **CLI** — `/api/cli/upload` accepts JSON (`{text, format, title?, isPublic?}`) or multipart (`file` + `title?` + `isPublic?`). Bearer-auth only, no signed URL — bodies are limited to `MAX_UPLOAD_BYTES_USER = 10MB`. Always treats the upload as authored by the bearer's `uid`.

A doc can also start empty: `/editor/new?type=md|html` holds a draft in the browser and the first save calls `/api/docs/create`, so nothing exists until then. Drafts don't save on blur, because clicking the title field to name one would create it.

### Sharing and permissions

`packages/shared/src/access.ts` is the one place that decides who can do what, and both apps call it. A doc role is `owner`, `editor` or `viewer`, the stronger of a direct share and the doc's workspace role. Workspace owners and editors both map to doc `editor`: only a doc's owner can delete it, publish it, move it or change its shares.

Grants are keyed by email and only match a **verified** address (`email_verified === true`). Microsoft sign-ins can carry an address the person didn't prove they own, so never relax this. Nobody is emailed about a share. There is no version history, so editors overwrite in place; `claimContentSave` only stops a stale tab overwriting a newer save (409).

### Viewing

`/s/[slug]` on `app` routes by access:

- **Public:** 302 to `usercontent/view/[slug]` (a zip goes straight to its `index.html`, so relative links resolve).
- **Private, viewer has a role:** renders a slim viewer bar above a sandboxed iframe of `usercontent/view/[slug]/~<token>/...`.
- **Signed out:** redirect to login, whether or not the doc exists.
- **Signed in, no role or missing doc:** the same "You can't open this doc" page, so a link can't reveal whether a doc exists.

The token (`packages/shared/src/content-token.ts`) is an HMAC over uid, slug and a 12-hour expiry, using `CONTENT_TOKEN_SECRET`. It sits in the path rather than the query so a zip site's relative links keep carrying it. It only says who is asking: usercontent rechecks the role on every request, so removing someone locks them out immediately.

The content streaming lives in `apps/usercontent/src/app/view/[slug]/route.ts` (public entry) and `apps/usercontent/src/app/view/[slug]/[...path]/route.ts` (zip subpaths and every token request), both through `serveDocFile()` in `apps/usercontent/src/lib/serve.ts`. Every response goes through `securityHeaders()` in `apps/usercontent/src/lib/headers.ts`, which sets the CSP `sandbox`, `frame-ancestors 'self' <appOrigin>`, and `Access-Control-Allow-Origin: *` because a sandboxed page's own `fetch`, module scripts and fonts count as cross-origin. A sandboxed page has no real `localStorage`, `sessionStorage` or cookies, so HTML gets the in-memory stand-ins from `injectSandboxShim()` in `packages/shared/src/sandbox.ts`.

Public views are cacheable: `servePublicDocFile()` sends `s-maxage=60` and an ETag from `publicViewHeaders()`, and answers 304. Token requests stay `private, no-store`, and 404s are `no-store`. Bump `SERVE_VERSION` when what's served for an unchanged doc changes (the shim, the Markdown CSS), or old copies survive through 304s. A public doc made private can stay at the edge for up to a minute.

For anonymous docs, `touchAnonExpiry` extends `expiresAt` on each view — keeps actively-used shares from getting TTL'd. The usercontent runtime SA needs `datastore.user` (read+write) for this; you can drop the call to fall back to a hard 30-day TTL.

## Conventions worth knowing

- **Path alias** `@/*` resolves to `src/*` in both Next apps (Next defaults). Cross-package imports use `@offsprint/shared`.
- **`runtime = "nodejs"`** is set explicitly on routes that touch GCS / `firebase-admin`. Don't move them to Edge.
- **All Firestore writes go through `firebase-admin`** — there is no client SDK Firestore code in this repo. The rules file is deny-all and intentional. If you need a new collection, add it to the appropriate lib helper.
- **Magic constants live in `packages/shared/src/constants.ts`** — don't redefine size/quota/cookie-name limits in app code; import them.
- **The CLI is published to npm** as `@offsprint/outpost`. When changing types/constants in `packages/shared`, the CLI re-bundles them at build time (it's a `devDependency` so consumers don't pull the workspace), but bumps to the wire format need a corresponding bump to `apps/app/src/app/api/cli/*` and a new CLI release.
- **UI system.** Colors live as CSS variables in `apps/app/src/app/globals.css`, surfaced through `tailwind.config.ts`, and dark mode follows the system. Reusable pieces are in `components/ui`. Blue means a link or where you are, never decoration; primary buttons are ink. Only overlays get shadows.
- **Tailwind only keeps classes it can see whole.** A template string like `btn-${variant}` loses its CSS with no error, so write class names out in full.
- **`loading.tsx` breaks status codes below it.** It starts streaming a 200 before the page runs, so `notFound()` can't send a 404. `workspaces/[id]` has none for that reason.
- **Windows-first dev environment** — scripts and docs use PowerShell. The deploy script requires PowerShell 7+. Bash/Unix examples appear in CLI docs as a courtesy but are not the primary path.
- **Firebase auth-domain ≠ custom domain.** Azure redirect URI must be `https://<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>/__/auth/handler`, not the public `outpost.offsprint.xyz`. Custom domains go in Firebase's Authorized domains list.
