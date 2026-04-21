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
$APP_BASE_URL = "https://share.offsprint.xyz"
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
2. Enable **Authentication** > **Google** sign-in provider.
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

## 7. DNS via Cloudflare (domain at GoDaddy)

1. In Cloudflare dashboard, add `offsprint.xyz` as a site (free plan is fine).
2. Cloudflare gives you two nameservers. In GoDaddy, change the domain's nameservers to the Cloudflare ones. Wait for propagation (~15 min).
3. In Cloudflare > DNS:
   - `share` CNAME → `ghs.googlehosted.com` (proxied: **DNS-only** initially, then switch to proxied after verification)
   - `usercontent` CNAME → `ghs.googlehosted.com` (same pattern)

   Cloudflare proxying to Cloud Run requires **domain mapping** on the Cloud Run side to produce the `ghs.googlehosted.com` target. Run:
   ```powershell
   gcloud beta run domain-mappings create --service=$APP_SERVICE --domain=share.offsprint.xyz --region=$REGION
   gcloud beta run domain-mappings create --service=$USER_SERVICE --domain=usercontent.offsprint.xyz --region=$REGION
   ```
   The command prints the required DNS records — use exactly those values in Cloudflare (CNAME target, often `ghs.googlehosted.com`, plus a domain ownership TXT record if prompted).

4. Once Cloud Run shows the mappings as "Ready", flip the Cloudflare proxy icon to orange (proxied). Verify HTTPS works on both subdomains.

5. Update `APP_BASE_URL` / `USERCONTENT_BASE_URL` env vars on both services if they were set to `run.app` URLs initially.

## 8. Post-deploy sanity check

- `https://share.offsprint.xyz` → landing page loads.
- Google sign-in completes, writes `users/{uid}`.
- Upload HTML → finalize succeeds → doc in `docs/{slug}` with `isPublic=false`.
- Toggle public, visit `/s/{slug}` → 302 to `usercontent.offsprint.xyz/view/{slug}` → content served with CSP headers (inspect with DevTools > Network).
- Editor at `/editor/{slug}` loads, save button writes back to GCS.
- Anonymous upload in a fresh private window → returns public link immediately.
- 6th anon upload from same IP → 429.

## Known follow-ups

- GCS object cleanup for expired anon docs: Firestore TTL removes the metadata doc at `expiresAt`, but GCS objects live until the 90-day lifecycle rule fires. A short Cloud Run Job that lists anon Firestore docs and deletes GCS prefixes for anything missing is the precise fix. Not shipped yet — the lifecycle rule is the safety backstop.
