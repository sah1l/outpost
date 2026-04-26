#Requires -Version 7.0
<#
.SYNOPSIS
  Build and deploy Outpost (app + usercontent) to Google Cloud Run.

.DESCRIPTION
  Runs Cloud Build with the infra/cloudbuild.yaml config, then forces both
  Cloud Run services to min-instances=0 so idle time costs nothing.
  Config is loaded from scripts/deploy.config.ps1 if present (see
  deploy.config.example.ps1 for the schema); CLI parameters override config.

.PARAMETER ProjectId
  GCP project id. Required (param, config file, or GCP_PROJECT_ID env).

.PARAMETER Region
  Cloud Run region. Default: us-central1.

.PARAMETER Repo
  Artifact Registry repo name. Default: offsprint.

.PARAMETER AppService
  Cloud Run service name for the main app. Default: offsprint-app.

.PARAMETER UserService
  Cloud Run service name for the usercontent app. Default: offsprint-usercontent.

.PARAMETER Bucket
  GCS bucket name. Required.

.PARAMETER AppBaseUrl
  Public URL for the main app (e.g. https://outpost.example.com). Required.

.PARAMETER UsercontentBaseUrl
  Public URL for usercontent (e.g. https://usercontent.example.com). Required.

.PARAMETER FirebaseApiKey
  NEXT_PUBLIC_FIREBASE_API_KEY value. Required.

.PARAMETER FirebaseAppId
  NEXT_PUBLIC_FIREBASE_APP_ID value. Required.

.PARAMETER MinimaxModel
  MiniMax model name for slug generation (e.g. MiniMax-M2). Optional; defaults
  to MiniMax-M2 if unset. The MINIMAX_API_KEY is read from Secret Manager.

.PARAMETER MaxInstances
  Cloud Run max instance cap. Default: 5.

.PARAMETER SkipBuild
  Skip the Cloud Build step and only re-apply scaling / env config on existing revisions.

.EXAMPLE
  ./scripts/deploy.ps1 -ProjectId my-proj -Bucket my-docs `
    -AppBaseUrl https://outpost.example.com `
    -UsercontentBaseUrl https://usercontent.example.com `
    -FirebaseApiKey AIza... -FirebaseAppId 1:123:web:abc
#>

[CmdletBinding()]
param(
  [string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$Repo = "offsprint",
  [string]$AppService = "offsprint-app",
  [string]$UserService = "offsprint-usercontent",
  [string]$Bucket,
  [string]$AppBaseUrl,
  [string]$UsercontentBaseUrl,
  [string]$FirebaseApiKey,
  [string]$FirebaseAppId,
  [string]$MinimaxModel = "MiniMax-M2",
  [int]$MaxInstances = 5,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# Resolve repo root relative to this script, so the script can be invoked from anywhere.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -Path $repoRoot

function Write-Section($label) {
  Write-Host ""
  Write-Host "── $label ──" -ForegroundColor Cyan
}

function Require-Value($name, $value) {
  if (-not $value -or [string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $name (pass via -$name, config file, or env var)"
  }
}

# Optional config file: scripts/deploy.config.ps1. Dot-source it so it can set
# variables like $ProjectId, $Bucket, etc. CLI params take precedence since
# PowerShell populates bound parameters before this runs.
$configPath = Join-Path $PSScriptRoot "deploy.config.ps1"
if (Test-Path $configPath) {
  Write-Host "Loading config from scripts/deploy.config.ps1" -ForegroundColor DarkGray
  $configVars = @{}
  # Execute config in a sub-scope and capture any variables it sets.
  . $configPath
}

# Fall back to env vars for the critical ids.
if (-not $ProjectId) { $ProjectId = $env:GCP_PROJECT_ID }

Require-Value "ProjectId" $ProjectId
Require-Value "Bucket" $Bucket
Require-Value "AppBaseUrl" $AppBaseUrl
Require-Value "UsercontentBaseUrl" $UsercontentBaseUrl
Require-Value "FirebaseApiKey" $FirebaseApiKey
Require-Value "FirebaseAppId" $FirebaseAppId

Write-Section "Resolved configuration"
Write-Host "  Project            : $ProjectId"
Write-Host "  Region             : $Region"
Write-Host "  App service        : $AppService"
Write-Host "  Usercontent service: $UserService"
Write-Host "  Artifact repo      : $Repo"
Write-Host "  Bucket             : $Bucket"
Write-Host "  App URL            : $AppBaseUrl"
Write-Host "  Usercontent URL    : $UsercontentBaseUrl"
Write-Host "  Max instances      : $MaxInstances"

# Make sure apps/app/public exists — Dockerfile copies it.
$publicDir = Join-Path $repoRoot "apps/app/public"
if (-not (Test-Path $publicDir)) {
  Write-Host "Creating empty apps/app/public (Dockerfile expects it)" -ForegroundColor DarkGray
  New-Item -ItemType Directory -Path $publicDir | Out-Null
  New-Item -ItemType File -Path (Join-Path $publicDir ".gitkeep") | Out-Null
}

# Sanity-check that gcloud is authenticated against the target project.
Write-Section "Verifying gcloud context"
$currentProject = (gcloud config get-value project 2>$null).Trim()
if ($currentProject -ne $ProjectId) {
  Write-Host "Setting gcloud project: $ProjectId" -ForegroundColor Yellow
  gcloud config set project $ProjectId | Out-Null
}

$activeAccount = (gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null).Trim()
if (-not $activeAccount) {
  throw "No active gcloud account. Run: gcloud auth login"
}
Write-Host "  Active account: $activeAccount"

if (-not $SkipBuild) {
  Write-Section "Submitting Cloud Build"
  $subs = @(
    "_REGION=$Region",
    "_REPO=$Repo",
    "_APP_SERVICE=$AppService",
    "_USERCONTENT_SERVICE=$UserService",
    "_APP_BASE_URL=$AppBaseUrl",
    "_USERCONTENT_BASE_URL=$UsercontentBaseUrl",
    "_GCS_BUCKET=$Bucket",
    "_FIREBASE_API_KEY=$FirebaseApiKey",
    "_FIREBASE_APP_ID=$FirebaseAppId",
    "_MINIMAX_MODEL=$MinimaxModel"
  ) -join ","

  gcloud builds submit `
    --config infra/cloudbuild.yaml `
    --substitutions=$subs `
    --project=$ProjectId

  if ($LASTEXITCODE -ne 0) {
    throw "Cloud Build failed with exit code $LASTEXITCODE"
  }
} else {
  Write-Host "SkipBuild set — skipping gcloud builds submit" -ForegroundColor Yellow
}

Write-Section "Pinning both services to min-instances=0"
# Defense in depth: cloudbuild.yaml already sets these, but re-apply in case the
# service was modified via the console and someone bumped min-instances.
foreach ($svc in @($AppService, $UserService)) {
  Write-Host "  Updating $svc" -ForegroundColor DarkGray
  gcloud run services update $svc `
    --region=$Region `
    --project=$ProjectId `
    --min-instances=0 `
    --max-instances=$MaxInstances `
    --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to update scaling on $svc"
  }
}

Write-Section "Deployed service URLs"
foreach ($svc in @($AppService, $UserService)) {
  $url = gcloud run services describe $svc `
    --region=$Region `
    --project=$ProjectId `
    --format="value(status.url)" 2>$null
  Write-Host ("  {0,-28} {1}" -f $svc, $url)
}

Write-Host ""
Write-Host "Done. Cold starts will add ~1-2s on the first request after idle." -ForegroundColor Green
