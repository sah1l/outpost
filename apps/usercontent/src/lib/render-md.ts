import { MARKDOWN_PAGE_CSS } from "@offsprint/shared";
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
<style>${MARKDOWN_PAGE_CSS}</style>
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
