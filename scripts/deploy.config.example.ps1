# Copy this file to scripts/deploy.config.ps1 and fill in real values.
# deploy.config.ps1 is git-ignored. CLI parameters to deploy.ps1 override these.

$ProjectId          = "your-gcp-project-id"
$Region             = "us-central1"
$Repo               = "offsprint"
$AppService         = "offsprint-app"
$UserService        = "offsprint-usercontent"
$Bucket             = "your-docs-bucket"
$AppBaseUrl         = "https://outpost.example.com"
$UsercontentBaseUrl = "https://usercontent.example.com"
$FirebaseApiKey     = "AIza..."          # NEXT_PUBLIC_FIREBASE_API_KEY
$FirebaseAppId      = "1:123:web:abc"    # NEXT_PUBLIC_FIREBASE_APP_ID
$MinimaxModel       = "MiniMax-M2"       # MINIMAX_API_KEY is read from Secret Manager
$MaxInstances       = 5
