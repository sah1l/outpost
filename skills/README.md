# Agent Skills

This directory holds [Agent Skills](https://agentskills.io/specification) —
portable instruction packages that teach AI coding agents (Claude Code,
Copilot CLI, Cursor, Codex, Gemini CLI, Antigravity) how to use this project's
tooling.

## Available skills

| Skill | What it does |
| ----- | ------------ |
| [`outpost`](./outpost/) | Uploads `.html` / `.md` files to outpost.offsprint.xyz via the `outpost` CLI and returns a shareable URL. |

## Install

The fastest path is the GitHub CLI (`gh` 2.90+):

```sh
gh skill install sah1l/share-html outpost
```

`gh skill` auto-detects your agent host and writes the skill into the right
directory. Use `--agent` and `--scope` to override.

## Manual install

If you don't have `gh` 2.90+, copy the skill folder into your agent's skills
directory by hand. For Claude Code:

```sh
# macOS / Linux
mkdir -p ~/.claude/skills/outpost
cp -r skills/outpost/* ~/.claude/skills/outpost/

# Windows (PowerShell)
New-Item -ItemType Directory -Force "$HOME\.claude\skills\outpost" | Out-Null
Copy-Item -Recurse .\skills\outpost\* "$HOME\.claude\skills\outpost\"
```

Restart your agent so it picks up the new skill.
