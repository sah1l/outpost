import { marked, Renderer } from "marked";

const MERMAID_VERSION = "11.4.0";

export async function renderMarkdown(source: string, title: string): Promise<string> {
  let hasMermaid = false;
  const renderer = new Renderer();
  const defaultCode = renderer.code.bind(renderer);
  renderer.code = function (code) {
    if (code.lang === "mermaid") {
      hasMermaid = true;
      return `<pre class="mermaid">${escapeHtml(code.text)}</pre>\n`;
    }
    return defaultCode(code);
  };

  const body = await marked.parse(source, { async: true, renderer });
  const mermaidScript = hasMermaid ? mermaidScriptTag() : "";

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
  pre.mermaid { background: transparent; padding: 0; text-align: center; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 1rem; color: #555; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    pre, code { background: #1e1e1e; }
    pre.mermaid { background: transparent; }
    blockquote { border-color: #444; color: #aaa; }
    th, td { border-color: #333; }
  }
</style>
</head>
<body>
${body}
${mermaidScript}
</body>
</html>`;
}

function mermaidScriptTag(): string {
  return `<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs";
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: true, theme: dark ? "dark" : "default", securityLevel: "strict" });
</script>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
