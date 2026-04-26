---
name: outpost
description: Upload an existing HTML or Markdown document to outpost.offsprint.xyz via the `outpost` CLI and return a shareable URL. Use when the user asks to "share", "publish", "upload", or "post" a local .html / .md file, or when they ask for a link to a document they already have. Do NOT generate new documents to upload — only share what the user already has on disk or in the conversation.
license: MIT
compatibility: Requires Node.js 18+ and network access. The `outpost` CLI is published on npm as `@offsprint/outpost`; if not installed globally, invoke via `npx @offsprint/outpost`.
metadata:
  homepage: https://outpost.offsprint.xyz
  repository: https://github.com/sah1l/share-html
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

**Do not** invoke this skill to publish content you generated in the
conversation. If the user asks you to first write a document and then share it,
save the document locally with their confirmation first, then use this skill.

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

### Machine-readable output

Append `--json` to get `{slug, url, title, type}` so the URL can be parsed out
of stdout reliably.

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
