"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";

export function CodeMirrorEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (next: string) => void;
  language: "html" | "md";
}) {
  const extensions = useMemo(() => (language === "md" ? [markdown()] : [html()]), [language]);
  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        autocompletion: true,
      }}
      style={{ height: "100%", fontSize: 13 }}
    />
  );
}
