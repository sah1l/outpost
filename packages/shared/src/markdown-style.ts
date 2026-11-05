// The page around rendered Markdown. Shared so the editor's preview looks like the published doc.
export const MARKDOWN_PAGE_CSS = `
  :root {
    color-scheme: light dark;
    --fg: #15181e; --muted: #5b6472; --line: #e4e7ec; --code-bg: #f4f5f7; --link: #1f45f5; --bg: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8eaef; --muted: #9aa1ad; --line: #2a2e37; --code-bg: #1b1e25; --link: #8ea6ff; --bg: #15181e; }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0 auto; max-width: 72ch; padding: 3rem 1.5rem 5rem;
    background: var(--bg); color: var(--fg);
    font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow-wrap: break-word;
  }
  h1, h2, h3, h4 { line-height: 1.25; font-weight: 600; letter-spacing: -0.012em; margin: 2em 0 0.6em; text-wrap: balance; }
  h1 { font-size: 2rem; margin-top: 0; }
  h2 { font-size: 1.4rem; padding-bottom: 0.35em; border-bottom: 1px solid var(--line); }
  h3 { font-size: 1.15rem; }
  h4 { font-size: 1rem; }
  p, ul, ol, table, pre, blockquote { margin: 0 0 1.1em; }
  li { margin: 0.25em 0; }
  li > ul, li > ol { margin-bottom: 0; }
  a { color: var(--link); text-underline-offset: 2px; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2.5em 0; }
  code { font: 0.875em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--code-bg); padding: 0.15em 0.35em; border-radius: 4px; }
  pre { background: var(--code-bg); padding: 0.9em 1em; border-radius: 8px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; font-size: 0.85em; }
  pre.mermaid { background: transparent; padding: 0; text-align: center; }
  table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 0.95em; }
  th, td { border: 1px solid var(--line); padding: 0.45em 0.75em; text-align: left; }
  th { font-weight: 600; background: var(--code-bg); }
  blockquote { border-left: 3px solid var(--line); padding-left: 1em; color: var(--muted); }
`;
