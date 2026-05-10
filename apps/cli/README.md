# Outpost

Command-line uploader for [outpost.offsprint.xyz](https://outpost.offsprint.xyz). Upload an
existing `.html` or `.md` file, pipe text in from your shell, or call it from
an AI agent — get back a shareable URL.

## Install

```sh
# one-off, no install
npx @offsprint/outpost login

# or install globally
npm i -g @offsprint/outpost
```

The binary is named `outpost`. Requires Node 18+.

## Authentication

```sh
outpost login
```

Opens a browser to approve the CLI on your Outpost account, then stores a
token in:

- macOS / Linux: `~/.config/outpost/auth.json`
- Windows: `%APPDATA%\outpost\auth.json`

Tokens last 90 days. Run `outpost logout` to remove the token, or
`outpost whoami` to confirm who you're signed in as.

## Upload

```sh
# A file (format inferred from extension)
outpost upload ./report.html
outpost upload ./notes.md --title "Sprint notes" --public

# Inline text
outpost upload --text "# Hello" --format md
outpost upload --text "<h1>Hi</h1>" --format html --title "Greeting"

# From stdin (use - or just pipe)
cat ./readme.md | outpost upload - --format md
echo "<p>quick</p>" | outpost upload --format html
```

### Options

| Flag                | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `--format html\|md` | Required for `--text` and stdin uploads; optional for files.      |
| `--title "..."`     | Display title in your dashboard. Defaults to the filename.        |
| `--public`          | Make the document publicly viewable (default: private).           |
| `--json`            | Print the result as JSON (`{slug, url, title, type}`) — easy to pipe. |

### Exit codes

- `0` — success
- `1` — runtime error (network, auth expired, server rejection)
- `2` — bad invocation (missing args, missing required flag)

## Update an existing document

Replace the contents (and optionally the title or visibility) of a document
you already own. The slug stays the same — the URL doesn't change.

```sh
# Replace contents from a file (must match the existing doc's type)
outpost update sprint-notes ./sprint-notes.md
outpost update https://outpost.offsprint.xyz/s/sprint-notes ./notes.md

# Replace contents inline
outpost update sprint-notes --text "# Updated notes" --format md

# From stdin
cat sprint-notes.md | outpost update sprint-notes - --format md

# Metadata only (no body change)
outpost update sprint-notes --title "Sprint 42 notes"
outpost update sprint-notes --public
outpost update sprint-notes --no-public
```

You can pass either the slug (`sprint-notes`) or the full share URL.

### Update flags

| Flag                | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `--text "..."`      | Replace contents with this string. Use instead of a file path.    |
| `--format html\|md` | Required for stdin uploads; validated against the doc's type.     |
| `--title "..."`     | Replace the title.                                                |
| `--public`          | Make the document public.                                         |
| `--no-public`       | Make the document private.                                        |
| `--json`            | Print the result as JSON.                                         |

Omit both `--public` and `--no-public` to leave visibility unchanged. The
existing doc's type (`html` or `md`) is fixed — to change formats, delete and
re-upload.

## Use from an AI agent

A drop-in [Agent Skill](https://agentskills.io/specification) lives at
[`skills/outpost/`](../../skills/outpost/) at the repo root. The fastest way to
install it is the GitHub CLI (`gh` 2.90+):

```sh
gh skill install sah1l/outpost outpost
```

This auto-detects your agent host (Claude Code, Copilot CLI, Cursor, Codex,
Gemini CLI, Antigravity) and writes the skill into the right directory. After
install, ask your agent something like *"Upload ./report.md and give me the
link"* and it will run `outpost upload` for you.

To install for a specific agent or scope, use `--agent` and `--scope`. See
`gh skill install --help` for the full list.

## Configuration

| Env var               | Default                  | Purpose                                |
| --------------------- | ------------------------ | -------------------------------------- |
| `OUTPOST_API`         | `https://outpost.offsprint.xyz` | API base. Override for self-hosting or local development. |
| `OUTPOST_CONFIG_DIR`  | platform default         | Where to store the auth token.         |

---

## Local development

This section is for contributors hacking on the CLI itself. End users should
follow the [Install](#install) instructions above.

### Prerequisites

- Node 20+ and pnpm 9 (matches the root `package.json` `engines`)
- The main app (`apps/app`) running locally — the CLI is a thin wrapper around
  its `/api/cli/*` endpoints
- Firebase project with at least one auth provider enabled (the CLI's `login`
  flow piggybacks on the same browser sign-in the web app uses)

### One-time setup

```powershell
# from the repo root
pnpm install
Copy-Item .env.example apps/app/.env.local
# fill in apps/app/.env.local — see root README for required vars
```

### Run the stack

You need two things running side-by-side: the Next app (which serves the
device-approval page and the API) and the CLI build (so your edits are
picked up).

Terminal 1 — main app on `http://localhost:3000`:

```powershell
pnpm dev:app
```

Terminal 2 — CLI build in watch mode:

```powershell
pnpm --filter @offsprint/outpost dev
```

### Point the CLI at your local API

By default the CLI talks to `https://outpost.offsprint.xyz`. Override with
`OUTPOST_API`, and use a separate config dir so your local token doesn't
clobber any production token you might have saved:

```powershell
$env:OUTPOST_API = "http://localhost:3000"
$env:OUTPOST_CONFIG_DIR = "$PWD\.cli-dev"
```

(Bash equivalent: `export OUTPOST_API=http://localhost:3000` and
`export OUTPOST_CONFIG_DIR="$PWD/.cli-dev"`.)

Add `.cli-dev/` to your local `.gitignore` if you keep it in the repo.

### Smoke test

```powershell
# 1. Sign in — opens browser to http://localhost:3000/cli/device?code=...
node apps/cli/dist/cli.js login

# 2. Confirm the token works
node apps/cli/dist/cli.js whoami

# 3. Upload a file
"# hello local" | Out-File -Encoding utf8 .\test.md
node apps/cli/dist/cli.js upload .\test.md --title "local test"

# 4. Upload inline text
node apps/cli/dist/cli.js upload --text "<h1>hi</h1>" --format html

# 5. Upload from stdin
Get-Content .\test.md | node apps/cli/dist/cli.js upload - --format md

# 6. Update an existing doc (use a slug from a prior upload)
"# updated" | Out-File -Encoding utf8 .\test.md
node apps/cli/dist/cli.js update <slug> .\test.md
node apps/cli/dist/cli.js update <slug> --text "# inline update" --format md
node apps/cli/dist/cli.js update <slug> --title "renamed" --public

# 7. Sign out (deletes ./.cli-dev/auth.json)
node apps/cli/dist/cli.js logout
```

After step 3, the CLI prints a URL like `http://localhost:3000/s/<slug>` —
open it to confirm the document rendered.

### Test the bin entry as `outpost`

To exercise the CLI under its installed name (instead of
`node apps/cli/dist/cli.js`), link it globally:

```powershell
pnpm --filter @offsprint/outpost build
pnpm --filter @offsprint/outpost link --global
outpost whoami
# when done:
pnpm --filter @offsprint/outpost unlink --global
```

### Test the agent skill

The canonical skill lives at [`skills/outpost/SKILL.md`](../../skills/outpost/SKILL.md)
(spec-compliant layout for `gh skill install`). To iterate on it locally, copy
the working copy into your Claude Code config:

```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills\outpost" | Out-Null
Copy-Item .\skills\outpost\SKILL.md "$HOME\.claude\skills\outpost\SKILL.md"
```

Then in Claude Code, ask: *"Upload `./test.md` and give me the link."* Make
sure `OUTPOST_API` is set in the shell Claude Code inherits — otherwise
the skill will hit production.

### Common gotchas

- **`device start failed: 500`** on `login` — check the app terminal; almost
  always missing Firebase admin credentials in `apps/app/.env.local`.
- **`Not authenticated` right after `login`** — your `OUTPOST_CONFIG_DIR`
  for `whoami` doesn't match the one used for `login`. Set it once in your
  shell profile when developing.
- **Browser opens to production instead of localhost** — `APP_BASE_URL` in
  `apps/app/.env.local` is wrong; it should be `http://localhost:3000`.
- **Firestore "needs an index"** error on first `login` poll — Firestore
  prints a one-click create link in the app terminal; click it and retry.
