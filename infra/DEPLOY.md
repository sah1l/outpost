# Deployment

One-time GCP setup, then build + deploy via Cloud Build. DNS via Cloudflare (proxied) in front of Cloud Run.

## 0. Fill in these values

Set these in your shell or replace inline:

```powershell
$PROJECT_ID = "your-gcp-project-id"
$REGION = "us-central1"
$REPO = "offsprint"
$APP_SERVICE = "offsprint-app"
$USER_SERVICE = "offsprint-usercontent"
$BUCKET = "offsprint-docs"
$APP_BASE_URL = "https://outpost.offsprint.xyz"
$USERCONTENT_BASE_URL = "https://usercontent.offsprint.xyz"
```

## 1. Enable APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  firestore.googleapis.com `
  firebase.googleapis.com `
  secretmanager.googleapis.com `
  storage.googleapis.com
```

## 2. Firebase + Firestore

1. In the Firebase console, add Firebase to this GCP project.
2. Enable **Authentication** sign-in providers — see [Auth providers](#auth-providers) below.
3. Enable **Firestore** in Native mode (single region matching `$REGION`).
4. Deploy Firestore rules + indexes:
   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID
   ```
   (Uses `infra/firestore.rules` and `infra/firestore.indexes.json`. Current rules are deny-all because all reads/writes happen via Admin SDK from Cloud Run. Do not relax without review.)
5. Enable TTL on `docs.expiresAt`:
   ```powershell
   gcloud firestore fields ttls update expiresAt --collection-group=docs --enable-ttl
   ```
6. Create a web app in Firebase console to get `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 3. GCS bucket

```powershell
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
gcloud storage buckets update gs://$BUCKET --cors-file=infra/gcs-cors.json
gcloud storage buckets update gs://$BUCKET --lifecycle-file=infra/gcs-lifecycle.json
```

Update `infra/gcs-cors.json` first so the `origin` list matches your real domains.

## 4. Service accounts

Two service accounts, minimum-permission each:

```powershell
# App SA: Firestore RW + GCS RW + Firebase Admin
gcloud iam service-accounts create offsprint-app --display-name="Offsprint app"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-app@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-app@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-app@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/iam.serviceAccountTokenCreator"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-app@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/firebaseauth.admin"

# Usercontent SA: Firestore read + GCS read, no auth creds needed
gcloud iam service-accounts create offsprint-usercontent --display-name="Offsprint user content"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-usercontent@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/datastore.viewer"
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-usercontent@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/storage.objectViewer"
```

For `touchAnonExpiry`, usercontent also needs `datastore.user` (read+write). Alternatively, remove the TTL refresh call and rely purely on the initial 30-day TTL. Default below keeps the refresh behavior:

```powershell
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:offsprint-usercontent@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/datastore.user"
```

### Firebase Admin private key in Secret Manager

Generate a service account key for Firebase Admin (separate from the runtime SA):

```powershell
gcloud iam service-accounts keys create firebase-admin-key.json `
  --iam-account=offsprint-app@$PROJECT_ID.iam.gserviceaccount.com
```

Extract `client_email` and `private_key` from the JSON and store each in Secret Manager:

```powershell
$key = Get-Content firebase-admin-key.json | ConvertFrom-Json
echo $key.client_email | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo $key.private_key | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Grant access to both runtime SAs:

```powershell
foreach ($sa in @("offsprint-app","offsprint-usercontent")) {
  gcloud secrets add-iam-policy-binding FIREBASE_CLIENT_EMAIL `
    --member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor"
  gcloud secrets add-iam-policy-binding FIREBASE_PRIVATE_KEY `
    --member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor"
}
```

Delete the local `firebase-admin-key.json` after uploading.

## 5. Artifact Registry

```powershell
gcloud artifacts repositories create $REPO `
  --repository-format=docker `
  --location=$REGION
```

## 6. Deploy via Cloud Build

```powershell
gcloud builds submit --config infra/cloudbuild.yaml `
  --substitutions=_REGION=$REGION,_REPO=$REPO,_APP_SERVICE=$APP_SERVICE,_USERCONTENT_SERVICE=$USER_SERVICE,_APP_BASE_URL=$APP_BASE_URL,_USERCONTENT_BASE_URL=$USERCONTENT_BASE_URL,_GCS_BUCKET=$BUCKET,_FIREBASE_API_KEY=...,_FIREBASE_APP_ID=...
```

After deploy, Cloud Run prints each service's `run.app` URL. Use these for DNS.

## 6a. (Optional) CI/CD via GitHub Actions

Three workflows live in `.github/workflows/`:

| File | Trigger | Purpose |
| ---- | ------- | ------- |
| `ci.yml` | PR to `master` and push to `master` | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build` — gates merges. |
| `deploy-infra.yml` | push to `master`, paths-filtered to `apps/app/**`, `apps/usercontent/**`, `packages/shared/**`, `infra/cloudbuild.yaml`, `pnpm-lock.yaml` | Authenticates to GCP via Workload Identity Federation and runs `gcloud builds submit --config infra/cloudbuild.yaml`. Cloud Build does the actual Docker builds and Cloud Run deploys. |
| `publish-cli.yml` | push to `master`, paths-filtered to `apps/cli/**`, `packages/shared/**`, `pnpm-lock.yaml` | Builds `@offsprint/outpost` and publishes to npm — but **only if `apps/cli/package.json#version` is not already on the registry**. Bump the version in the same PR you want released. |

Both deploy workflows use `concurrency.cancel-in-progress: false` so back-to-back merges queue rather than race or get cancelled.

### Workload Identity Federation (one-time GCP setup)

Avoids long-lived JSON SA keys in GitHub. Replace `<github-org>/<repo>` and `$PROJECT_NUMBER` (`gcloud projects describe $PROJECT_ID --format='value(projectNumber)'`).

```powershell
# Create deployer SA used by GitHub Actions
gcloud iam service-accounts create cicd-deployer --display-name="GitHub Actions deployer"
$DEPLOYER = "cicd-deployer@$PROJECT_ID.iam.gserviceaccount.com"

foreach ($role in @(
  "roles/cloudbuild.builds.editor",
  "roles/run.admin",
  "roles/iam.serviceAccountUser",
  "roles/artifactregistry.writer",
  "roles/storage.admin",
  "roles/secretmanager.secretAccessor",
  "roles/logging.viewer"
)) {
  gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$DEPLOYER" --role=$role
}

# Workload Identity Pool + provider
gcloud iam workload-identity-pools create github `
  --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-actions `
  --location=global --workload-identity-pool=github `
  --display-name="GitHub Actions OIDC" `
  --issuer-uri="https://token.actions.githubusercontent.com" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" `
  --attribute-condition="assertion.repository == '<github-org>/<repo>'"

# Allow this repo's master branch to impersonate the deployer SA
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER `
  --role=roles/iam.workloadIdentityUser `
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/<github-org>/<repo>"
```

Then grab the provider's full resource name:

```powershell
gcloud iam workload-identity-pools providers describe github-actions `
  --location=global --workload-identity-pool=github --format="value(name)"
# → projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-actions
```

### GitHub repo configuration

In **Settings → Secrets and variables → Actions**, add:

**Variables** (not secrets — values are non-sensitive build config; `NEXT_PUBLIC_*` ends up in the client bundle anyway):

| Variable | Example |
| -------- | ------- |
| `GCP_PROJECT_ID` | `your-gcp-project-id` |
| `GCP_REGION` | `us-central1` |
| `GCP_REPO` | `offsprint` |
| `GCP_WIF_PROVIDER` | `projects/123456/locations/global/workloadIdentityPools/github/providers/github-actions` |
| `GCP_DEPLOY_SA` | `cicd-deployer@your-gcp-project-id.iam.gserviceaccount.com` |
| `APP_SERVICE` | `offsprint-app` |
| `USERCONTENT_SERVICE` | `offsprint-usercontent` |
| `APP_BASE_URL` | `https://outpost.offsprint.xyz` |
| `USERCONTENT_BASE_URL` | `https://usercontent.offsprint.xyz` |
| `GCS_BUCKET` | `offsprint-docs` |
| `FIREBASE_API_KEY` | from Firebase web app config |
| `FIREBASE_APP_ID` | from Firebase web app config |
| `MINIMAX_MODEL` | `MiniMax-M2` |

**Secrets**:

| Secret | Notes |
| ------ | ----- |
| `NPM_TOKEN` | npm automation token with publish access to `@offsprint/outpost`. Used as `NODE_AUTH_TOKEN` by `actions/setup-node`. |

Firebase Admin / MiniMax credentials stay in GCP Secret Manager (read by Cloud Run at runtime); they never need to enter GitHub.

### Branch protection

Recommended on `master`: require `verify` (the CI job) to pass before merge, require linear history, and disallow direct pushes. `deploy-infra` and `publish-cli` then only run on reviewed merges.

## 7. DNS via Cloudflare (domain at GoDaddy)

1. In Cloudflare dashboard, add `offsprint.xyz` as a site (free plan is fine).
2. Cloudflare gives you two nameservers. In GoDaddy, change the domain's nameservers to the Cloudflare ones. Wait for propagation (~15 min).
3. In Cloudflare > DNS:
   - `outpost` CNAME → `ghs.googlehosted.com` (proxied: **DNS-only** initially, then switch to proxied after verification)
   - `usercontent` CNAME → `ghs.googlehosted.com` (same pattern)

   Cloudflare proxying to Cloud Run requires **domain mapping** on the Cloud Run side to produce the `ghs.googlehosted.com` target. Run:
   ```powershell
   gcloud beta run domain-mappings create --service=$APP_SERVICE --domain=outpost.offsprint.xyz --region=$REGION
   gcloud beta run domain-mappings create --service=$USER_SERVICE --domain=usercontent.offsprint.xyz --region=$REGION
   ```
   The command prints the required DNS records — use exactly those values in Cloudflare (CNAME target, often `ghs.googlehosted.com`, plus a domain ownership TXT record if prompted).

4. Once Cloud Run shows the mappings as "Ready", flip the Cloudflare proxy icon to orange (proxied). Verify HTTPS works on both subdomains.

5. Update `APP_BASE_URL` / `USERCONTENT_BASE_URL` env vars on both services if they were set to `run.app` URLs initially.

## 8. Post-deploy sanity check

- `https://outpost.offsprint.xyz` → landing page loads.
- Google sign-in completes, writes `users/{uid}`.
- Microsoft sign-in completes, writes `users/{uid}` (run only if Microsoft provider is enabled).
- Upload HTML → finalize succeeds → doc in `docs/{slug}` with `isPublic=false`.
- Toggle public, visit `/s/{slug}` → 302 to `usercontent.offsprint.xyz/view/{slug}` → content served with CSP headers (inspect with DevTools > Network).
- Editor at `/editor/{slug}` loads, save button writes back to GCS.
- Anonymous upload in a fresh private window → returns public link immediately.
- 6th anon upload from same IP → 429.

## Auth providers

The login page (`/login`) supports **Google** and **Microsoft** sign-in. Both flow through Firebase Authentication on the client, exchange an ID token at `/api/auth/session`, and produce the same session cookie — the server is provider-agnostic, so adding/removing a provider is purely a Firebase Console + Azure config task.

### Google

1. Firebase Console → **Authentication** → **Sign-in method** → enable **Google**.
2. Set the project's public-facing support email (Firebase requires one for Google).
3. No additional client/server config needed. The provider works on `localhost` and on any domain listed under **Authentication → Settings → Authorized domains** (Firebase auto-adds your `*.firebaseapp.com` and `*.web.app` domains; add `outpost.offsprint.xyz` and any custom domain you sign in from).

### Microsoft

Microsoft sign-in is OAuth via Azure AD / Microsoft Entra. You need an Azure app registration in addition to enabling the Firebase provider.

**1. Register an app in Azure**

   Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**:
   - Name: `offsprint` (or whatever).
   - Supported account types: pick based on who should be allowed to sign in
     - **Single tenant** — only your Azure AD tenant
     - **Multitenant** — any work/school account
     - **Multitenant + personal Microsoft accounts** — broadest (corresponds to `common` tenant)
   - Redirect URI: **Web** → `https://<your-firebase-auth-domain>/__/auth/handler`
     (e.g. `https://your-project-id.firebaseapp.com/__/auth/handler` — this is the value of `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, **not** your custom share domain).

   After creation, copy the **Application (client) ID** and the **Directory (tenant) ID** from the Overview page.

**2. Create a client secret**

   In the new app: **Certificates & secrets** → **Client secrets** → **New client secret**. Copy the **Value** immediately (it is shown only once).

**3. Enable Microsoft in Firebase**

   Firebase Console → **Authentication** → **Sign-in method** → **Add new provider** → **Microsoft**:
   - Application ID: paste the Azure client ID.
   - Application secret: paste the Azure client secret value.
   - Save. Firebase shows the redirect URI it expects — verify it matches what you registered in Azure.

**4. (Optional) Restrict to a single tenant**

   By default the Microsoft provider accepts whatever the Azure app registration allows. To force the popup to a specific tenant from the client side, set `NEXT_PUBLIC_MICROSOFT_TENANT` in the deployed env:

   - Tenant GUID (e.g. `11111111-2222-3333-4444-555555555555`) — only that org
   - `organizations` — any work/school account, no personal MSAs
   - `consumers` — personal Microsoft accounts only
   - `common` — anything (Firebase default if unset)

   This passes through to Firebase's `OAuthProvider("microsoft.com").setCustomParameters({ tenant })`. It complements the Azure-side restriction; Azure is still the source of truth for what's actually allowed.

**5. Authorized domains**

   Add every domain you sign in from to Firebase Console → **Authentication** → **Settings** → **Authorized domains** (e.g. `localhost`, `outpost.offsprint.xyz`). Firebase rejects the popup callback otherwise.

### Required env vars

| Var                                | Where set | Notes |
| ---------------------------------- | --------- | ----- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | build-time substitution → Cloud Run env | From Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Cloud Run env (`set-env-vars`) | `<project-id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Cloud Run env | Same as `$PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | build-time substitution → Cloud Run env | From Firebase web app config |
| `NEXT_PUBLIC_MICROSOFT_TENANT`     | Cloud Run env (optional) | Empty = Firebase default; otherwise tenant GUID or `common`/`organizations`/`consumers` |

`NEXT_PUBLIC_*` values are baked into the client bundle at build time. If you change `NEXT_PUBLIC_MICROSOFT_TENANT`, redeploy.

### Troubleshooting

- **`auth/unauthorized-domain`** — domain isn't in Firebase Authorized domains list.
- **`AADSTS50011: redirect URI mismatch`** — Azure app registration redirect URI doesn't match `https://<auth-domain>/__/auth/handler` exactly. The `auth-domain` is the Firebase one, not your custom domain.
- **`AADSTS700016: app not found in tenant`** — the user is signing in from a tenant the Azure app registration doesn't allow (single-tenant app + external user, or `NEXT_PUBLIC_MICROSOFT_TENANT` GUID points at the wrong org).
- **Popup closes immediately with no error** — usually a third-party cookie / cross-origin issue. Confirm `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` matches the Firebase project and the popup origin is on the authorized domains list.

## Known follow-ups

- GCS object cleanup for expired anon docs: Firestore TTL removes the metadata doc at `expiresAt`, but GCS objects live until the 90-day lifecycle rule fires. A short Cloud Run Job that lists anon Firestore docs and deletes GCS prefixes for anything missing is the precise fix. Not shipped yet — the lifecycle rule is the safety backstop.
