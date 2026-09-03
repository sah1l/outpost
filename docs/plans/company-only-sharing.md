# Plan: company-only sharing (same email domain)

Goal: let a signed-in owner mark a doc as visible to anyone who signs in with an
email on the owner's domain (e.g. `@acme.com`), in addition to the existing
Private / Public states. Anonymous docs are never eligible.

## 1. The hard part: usercontent has no auth

Every doc is served from `usercontent.offsprint.xyz`, which deliberately has
no session cookie (user JS runs there). Today the check is a single
`doc.isPublic` read on the usercontent side. For a domain-restricted doc we
need the *trusted* origin (`app`) to make the decision and the untrusted origin
to only *verify* it.

Options considered:

| Option | Verdict |
| --- | --- |
| Serve restricted docs from `app` (has the session) | Rejected. User JS on the trusted origin can call `/api/docs/*` with the viewer's cookie. Breaks the core design constraint in `CLAUDE.md`. |
| Share the `__session` cookie across `*.offsprint.xyz` | Rejected, same reason. |
| `app` sets a per-doc cookie on usercontent | Rejected. All docs are same-origin on usercontent; a malicious public doc could `fetch('/view/<slug>')` with the cookie and exfiltrate a restricted doc. |
| **`app` mints a short-lived signed grant and embeds it in the usercontent URL** | **Chosen.** Stateless, no cookies, a malicious doc cannot obtain a grant it was not handed. Same trust model as a GCS signed URL. |

### Grant token

- Payload: `{ s: slug, e: expiresAtMs }`, base64url JSON, plus `.` plus
  base64url HMAC-SHA256 over the payload. Secret: new env `VIEW_GRANT_SECRET`
  (32 random bytes) shared by both services. Verification with
  `crypto.timingSafeEqual`, fail closed if the secret is unset.
- TTL: 15 minutes (`VIEW_GRANT_TTL_MS` in `packages/shared/src/constants.ts`).
  The canonical link people share stays `outpost.offsprint.xyz/s/<slug>`, which
  re-checks and re-mints on every visit, so the short TTL is invisible in
  normal use.
- The grant is bound to the slug only, not the viewer. Forwarding the
  usercontent URL within 15 minutes leaks the doc to the recipient. Accepted;
  documented. Binding to the viewer would require the viewer to be
  identifiable on usercontent, which is exactly what we are avoiding.
- Revocation is immediate: usercontent re-reads the doc on every request and
  refuses the grant unless the doc is still `domain` (or `public`).

New module `packages/shared/src/grant.ts` (pure Node `crypto`, no deps) with
`signViewGrant()` / `verifyViewGrant()` used by both apps.

### URL shape on usercontent

`/g/<grant>/<entryFile>` and `/g/<grant>/<...path>` for zip assets, i.e.
`/g/<grant>/index.html`, `/g/<grant>/assets/app.js`. Putting the entry file
name in the URL keeps relative asset references resolving under the grant
prefix. Responses carry `Cache-Control: private, no-store` on top of
`securityHeaders()` so Cloudflare never caches restricted bytes. Expired or
invalid grants 302 back to `<APP_BASE_URL>/s/<slug>` when the slug is still
readable from the payload, otherwise 404.

## 2. Data model

Add to `DocRecord` in `packages/shared/src/types.ts`:

```ts
export type DocVisibility = "private" | "domain" | "public";
visibility?: DocVisibility;   // absent on old records
sharedDomain?: string | null; // lowercase owner domain, set when visibility === "domain"
```

Keep `isPublic` and write it in lockstep (`isPublic = visibility === "public"`)
so nothing needs a migration and old readers (usercontent during a rolling
deploy, old CLI builds) keep their exact semantics. Add a shared helper
`visibilityOf(doc)` that returns `visibility` when present and otherwise
`isPublic ? "public" : "private"`. All reads go through it; no direct
`doc.isPublic` checks remain except the compatibility write.

`sharedDomain` is a snapshot taken from the owner's session email when the
owner picks `domain`. Snapshotting avoids a second Firestore read on every view
and makes the rule explicit in the record.

No new Firestore index for v1 (the dashboard query is unchanged).

## 3. Domain eligibility rules (server-side only)

`packages/shared/src/domains.ts`:

- `emailDomain(email)` returns the lowercased part after `@`, or `null`.
- `PUBLIC_EMAIL_DOMAINS` denylist: `gmail.com`, `googlemail.com`,
  `outlook.com`, `hotmail.com`, `live.com`, `msn.com`, `yahoo.com`,
  `icloud.com`, `me.com`, `proton.me`, `protonmail.com`, `aol.com`, and so on.
  "Company" sharing from a consumer mailbox would mean "every Gmail user", so
  the option is disabled for these owners with an explanation.
- `canShareWithDomain(email)` = domain present and not in the denylist.

Viewer check in `app`: `emailDomain(viewer.email) === doc.sharedDomain`, or
viewer is the owner. Exact match only; `eng.acme.com` does not match
`acme.com` in v1.

Email trust: `getSessionUser()` should also surface `emailVerified` from the
session cookie claims and domain access should require it. Google sign-in
always sets it. Microsoft via Firebase may report `email_verified: false`
for some tenants; verify on staging before launch. If it is false for the
configured tenant, fall back to trusting the email when
`NEXT_PUBLIC_MICROSOFT_TENANT` is set (the tenant restriction already scopes
who can sign in). Hardening for later: store the Google `hd` claim and
Microsoft `tid` on `users/{uid}` and match on those instead of the string
after `@`.

## 4. Changes by surface

### `apps/app`

- `src/lib/auth.ts`: add `emailVerified: boolean` to `SessionUser`.
- `src/lib/docs.ts`: `setVisibility(slug, visibility, owner)` that validates
  eligibility, writes `visibility`, `sharedDomain`, and the mirrored
  `isPublic` in one `updateDoc` call. All write paths call this instead of
  patching `isPublic` directly.
- `src/lib/view-grant.ts`: thin wrapper around the shared signer reading
  `VIEW_GRANT_SECRET` from `src/env.ts`; builds the usercontent URL.
- `src/app/s/[slug]/page.tsx` becomes the access router:
  1. `public` -> 302 to `usercontent/view/<slug>` (unchanged).
  2. `domain`, no session -> render a "Sign in to view" page whose button goes
     to `/login?next=/s/<slug>`. Do not 302 straight to login; the page should
     say the share is limited to the owner's organization.
  3. `domain`, session, domain matches or viewer is owner -> mint grant, 302 to
     `usercontent/g/<grant>/<entryFile>`.
  4. `domain`, session, mismatch -> "Not available" page saying it is limited
     to the owner's organization and which account you are signed in as, with
     a "switch account" link (logout then login with `next`).
  5. `private` -> unchanged.
- `src/app/api/docs/[slug]/route.ts` PATCH: accept `visibility` (preferred)
  or `isPublic` (compat). Reject `domain` with 400 and a message when
  `canShareWithDomain(user.email)` is false. GET: include `visibility` and
  `sharedDomain` (already returned since it returns the record).
- `src/app/api/docs/finalize/route.ts`: write `visibility: "private"` and
  `sharedDomain: null` on new records.
- `src/app/api/anon/upload/route.ts`: write `visibility` mirrored from
  `isPublic`; never `domain`.
- `src/app/api/cli/upload/route.ts` and `cli/update/route.ts`: accept
  `visibility` in JSON and as a multipart field; precedence `visibility` over
  `isPublic`. Same eligibility check as the PATCH route, returning 400 with a
  clear message the CLI can print.
- `src/app/api/cli/whoami/route.ts`: add `emailDomain` and
  `canShareWithDomain` so the CLI can explain a refusal before uploading.
- Dashboard `doc-list.tsx` and editor `editor-shell.tsx`: replace the on/off
  switch with a three-way segmented control Private / Company / Public.
  Company shows the domain (`Company · @acme.com`) and is disabled with a
  tooltip when the owner is on a consumer domain (server passes
  `canShareWithDomain` and `emailDomain` down from the page). Copy link is
  enabled for Company and Public. Badge in the list shows the state.
- `src/app/page.tsx` marketing copy: mention the third state.

### `apps/usercontent`

- `src/env.ts`: `viewGrantSecret()`.
- `src/app/g/[grant]/[...path]/route.ts`: verify grant, load doc, require
  `visibilityOf(doc)` to be `domain` or `public`, then serve exactly like
  `view/[slug]/[...path]` for zips and like `view/[slug]` for the entry file
  (HTML raw, MD rendered). Extract the shared streaming logic out of the two
  existing routes into `src/lib/serve.ts` so the three routes share one code
  path. Add `Cache-Control: private, no-store`.
- Existing `/view/[slug]` routes: switch `doc.isPublic` to
  `visibilityOf(doc) === "public"`. Domain docs stay 404 here.
- `touchAnonExpiry` is irrelevant for domain docs (they always have an owner).

### `apps/cli`

- Flags: `--visibility private|company|public` on `upload` and `update`.
  Keep `--public` / `--no-public` as aliases. `company` maps to `domain` on
  the wire.
- `api.ts`: send `visibility` when given; keep sending `isPublic` when only
  the legacy flags are used so an older server still works.
- `whoami`: print the domain and whether company sharing is available.
- Bump to 0.4.0, update `apps/cli/README.md` and `skills/outpost/SKILL.md`
  ("use `--visibility company` when the user asks to share with their team or
  company; never `--public` unless they ask for a public link").

### `packages/shared`

- `types.ts`: `DocVisibility`, new optional fields, `visibility?` on the CLI
  request types, `emailDomain`/`canShareWithDomain` on the whoami response.
- `constants.ts`: `VIEW_GRANT_TTL_MS`, `PUBLIC_EMAIL_DOMAINS`.
- `grant.ts`, `domains.ts`, `visibility.ts` helpers as described.

### Infra

- Create secret `VIEW_GRANT_SECRET` in Secret Manager and grant
  `secretAccessor` to both runtime service accounts. Add it to both
  `--set-secrets` lists in `infra/cloudbuild.yaml` (and
  `cloudbuild.usercontent.yaml`). Document in `infra/DEPLOY.md` next to the
  Firebase secrets, and in both `.env.example` files.
- Rotation: rotate the secret, redeploy both services; in-flight grants (max
  15 minutes) fail and the user re-clicks the `/s/` link.

## 5. Delivery order

1. Shared package: types, constants, helpers, grant signer. Typecheck.
2. Server write paths in `app` (PATCH, finalize, anon, CLI upload/update) plus
   `visibilityOf` in every read. Nothing user-visible changes yet.
3. Grant issue in `/s/[slug]` and grant verify route in usercontent. Deploy
   with the secret. Test the four `/s/` branches with two accounts on
   different domains plus a Gmail account.
4. Dashboard and editor UI.
5. CLI flags, whoami, docs, skill, version bump, npm publish.

Steps 1 to 3 can ship without the UI; the CLI can exercise them via
`--visibility company` against a local app.

## 6. Test checklist (no test suite exists; manual)

- Owner on `acme.com` sets Company; viewer on `acme.com` sees the doc via
  `/s/`, viewer on `other.com` sees "Not available", signed-out viewer sees
  the sign-in page and lands on the doc after login.
- Gmail owner: Company option disabled in UI; PATCH and CLI return 400.
- Grant URL pasted into a private window works until expiry, then bounces
  back to `/s/<slug>`.
- Flip Company -> Private while a grant is live: next asset request 404s.
- Zip doc under `/g/`: relative assets load; `..` traversal still rejected.
- Old CLI (0.3.0) `--public` and `--no-public` still work against the new
  server; old server ignores `visibility` from the new CLI gracefully
  (documented, not guaranteed).
- `pnpm typecheck` and `pnpm lint` clean.

## 7. Follow-ups (not in v1)

- "Company library" page listing every doc shared to your domain. Needs a
  composite index `sharedDomain ASC, updatedAt DESC` in
  `infra/firestore.indexes.json`.
- Share with specific emails. The grant mechanism already supports it; only
  the decision in `/s/[slug]` and a new `allowedEmails` field change.
- Match on Google `hd` / Microsoft `tid` instead of the email string.
- Subdomain matching via an owner-configured list of sibling domains.
