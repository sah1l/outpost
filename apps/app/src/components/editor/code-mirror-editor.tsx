"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Colors come from globals.css, so the editor follows dark mode with the rest of the app.
const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--surface)", color: "var(--ink)", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono), ui-monospace, monospace", lineHeight: "22px" },
  ".cm-content": { caretColor: "var(--ink)", padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "var(--surface)", color: "var(--ink-3)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px" },
  ".cm-activeLine": { backgroundColor: "var(--canvas)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--link-tint)",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--hover)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--hover)", border: "none", color: "var(--ink-2)" },
  ".cm-tooltip": {
    backgroundColor: "var(--raised)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-overlay)",
  },
  ".cm-panels": { backgroundColor: "var(--canvas)", color: "var(--ink)" },
  ".cm-placeholder": { color: "var(--ink-3)" },
});

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.processingInstruction, tags.contentSeparator], color: "var(--code-keyword)" },
  { tag: [tags.tagName, tags.angleBracket], color: "var(--code-tag)" },
  { tag: [tags.attributeName, tags.propertyName], color: "var(--code-attr)" },
  { tag: [tags.string, tags.attributeValue, tags.url, tags.link], color: "var(--code-string)" },
  { tag: [tags.comment, tags.quote], color: "var(--code-comment)" },
  { tag: tags.heading, color: "var(--code-heading)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.monospace, color: "var(--code-attr)" },
]);

export function CodeMirrorEditor({
  value,
  onChange,
  language,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  language: "html" | "md";
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const extensions = useMemo(
    () => [
      editorTheme,
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      language === "md" ? markdown() : html(),
    ],
    [language],
  );
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme="none"
      autoFocus={autoFocus}
      placeholder={placeholder}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        autocompletion: true,
      }}
      style={{ height: "100%" }}
    />
  );
}
