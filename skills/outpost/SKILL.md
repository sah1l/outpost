---
name: outpost
description: Upload or update an existing HTML or Markdown document on outpost.offsprint.xyz via the `outpost` CLI and return a shareable URL. Use when the user asks to "share", "publish", "upload", "post", "update", "replace", or "edit" a local .html / .md file, or when they ask for a link to a document they already have. Do NOT generate new documents to upload — only share what the user already has on disk or in the conversation.
license: MIT
compatibility: Requires Node.js 18+ and network access. The `outpost` CLI is published on npm as `@offsprint/outpost`; if not installed globally, invoke via `npx @offsprint/outpost`.
metadata:
  homepage: https://outpost.offsprint.xyz
  repository: https://github.com/sah1l/outpost
  package: "@offsprint/outpost"
allowed-tools: Bash
---

# outpost

Upload an existing HTML or Markdown document to outpost.offsprint.xyz via the
`outpost` CLI. The CLI handles auth and file transfer; your job is to pick the
right invocation and surface the resulting URL.

## When to use this skill

Use it when the user says things like:

- "share this file"
- "give me a public link to this report"
- "upload my notes"
- "publish this HTML"
- "update the doc I just shared"
- "replace the contents of <outpost URL>"
- "edit my published notes"

**Do not** invoke this skill to publish content you generated in the
conversation. If the user asks you to first write a document and then share it,
save the document locally with their confirmation first, then use this skill.

For **updates**, only act when the user supplies the slug or URL of a doc they
already own — never guess slugs from conversational context.

## Prerequisites

The `outpost` CLI must be available. Two ways to invoke it:

- Globally installed: `outpost ...`
- One-off via npx: `npx @offsprint/outpost ...`

Prefer the global form if it's on PATH. If `outpost` is missing, fall back to
`npx @offsprint/outpost` — it pulls into the npm cache on first use, so later
invocations are fast.

If a command fails with "Not authenticated", tell the user to run:

```
outpost login
```

Do not attempt to authenticate on the user's behalf — `login` opens a browser
for device-code approval and requires the user.

## Invocation patterns

### Uploading an existing file

```bash
outpost upload <path> [--title "..."] [--public]
```

Format (`html` / `md`) is inferred from the extension. Use `--public` only when
the user explicitly asks for a public link.

### Uploading inline text

`--format` must come **before** `--text` because of how the CLI's arg parser
consumes the next token after `--text`:

```bash
outpost upload --format md   --text "# Notes"          --title "Notes"
outpost upload --format html --text "<h1>Hello</h1>"   --title "Greeting"
```

### Uploading from a multi-line block

For anything longer than a one-liner, write the content to a tempfile and
upload that file — shell quoting becomes unreliable for long inputs.

### Stdin

```bash
cat note.md | outpost upload - --format md
```

`--format` is required because there's no filename to infer from.

### Updating an existing document

Use `update` when the user wants to replace the contents of a doc they already
shared. The slug stays the same — the URL doesn't change, so don't re-publish
it as if it's new.

```bash
# From a file
outpost update <slug-or-url> <path>

# Inline text — --format must come before --text
outpost update <slug-or-url> --format md --text "# Updated"

# Stdin
cat note.md | outpost update <slug-or-url> - --format md

# Metadata only — no body change
outpost update <slug-or-url> --title "New title"
outpost update <slug-or-url> --public          # make public
outpost update <slug-or-url> --no-public       # make private
```

The user may pass either a bare slug (`sprint-notes`) or the full share URL
(`https://outpost.offsprint.xyz/s/sprint-notes`); both work.

The doc's type is fixed: an `md` doc must be updated with `md` content, and
`html` with `html`. To change formats, ask the user to delete and re-upload.

Visibility is **tri-state**: omit both flags to leave it as-is. Only pass
`--public` or `--no-public` if the user explicitly asks to change it.

Common update failures: `403` (the user doesn't own that doc), `404` (slug
doesn't exist — suggest `outpost upload` to create a new one), `400 format
mismatch` (file extension doesn't match the existing doc's type).

### Machine-readable output

Append `--json` to get `{slug, url, title, type}` so the URL can be parsed out
of stdout reliably.

## Tracking the slug for later updates

To make later `update` calls painless, record the slug in the source file
itself as an HTML comment. HTML comments render invisibly in both `.html`
and `.md` (Markdown passes them through), so this is safe for both formats.

**Marker format** — must be on its own line, ideally at the top of the file:

```html
<!-- outpost-slug: <slug> -->
```

### When to write the marker

Write or update the marker any time you have authoritative slug information
for a local file:

1. **After a successful `outpost upload`** — ask the user once if you may
   record the slug in the file (e.g. *"I can add `<!-- outpost-slug:
   sprint-notes -->` to the top of `./notes.md` so future updates know which
   doc to replace. OK?"*). On a yes, insert the marker as the first line.
   If the file already has a marker, replace it.

2. **Whenever the user gives you a slug or URL for a local file** — even if
   they're not asking you to update it right now. Example: *"this notes.md
   is at outpost.offsprint.xyz/s/sprint-notes"* — offer to add the marker
   so it's there next time.

3. **After a successful `outpost update`** — only if the file is missing
   the marker or has a stale one. Don't rewrite it on every update.

Always confirm before editing the user's file. Don't add the marker silently.

### When to read the marker

When the user asks to update *this file* without giving a slug, look at the
top of the file for the marker. If you find one, use that slug — but
**confirm with the user first** before running `outpost update`, e.g.
*"Found `outpost-slug: sprint-notes` in the file — update that one?"*.

The marker is a hint, not a contract: it can be wrong if the file was copied
from someone else, restored from a backup, or if the doc was deleted on the
server. If `outpost update` returns 403 or 404, the marker is stale —
remove or correct it after talking to the user.

### When NOT to use the marker

- If the user explicitly passes a slug/URL on this turn, prefer what they
  said over the marker.
- If the file has no marker, don't guess. Ask the user.
- Never invent a marker for a file you didn't just upload — only record
  slugs the user authorized or that came from a real upload.

## Reporting results to the user

After a successful upload, surface the URL plainly. Do not paraphrase the title
or summarize the document — the user already knows what they shared.

Example response:

> Uploaded "Sprint notes" → https://outpost.offsprint.xyz/s/sprint-notes

If the upload fails, show the CLI's stderr verbatim. Common causes: not signed
in, file too large (10 MB user limit), unsupported file type (only `.html` and
`.md` are accepted via this CLI).

## Boundaries

- Never generate document content just to upload it.
- Never use `--public` unless the user asked for a public link.
- Never run `outpost login` on the user's behalf — it requires browser
  interaction.
- Never store, log, or echo the auth token from `~/.outpost/config.json`.
