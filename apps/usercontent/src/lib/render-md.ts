import { marked } from "marked";

export async function renderMarkdown(source: string, title: string): Promise<string> {
  const body = await marked.parse(source, { async: true });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1.25rem; line-height: 1.6; }
  pre { background: #f5f5f5; padding: 0.75rem; border-radius: 6px; overflow: auto; }
  code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
  pre code { background: transparent; padding: 0; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 1rem; color: #555; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    pre, code { background: #1e1e1e; }
    blockquote { border-color: #444; color: #aaa; }
    th, td { border-color: #333; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
