// A sandboxed page has no origin of its own, so localStorage, sessionStorage and
// document.cookie throw. Plenty of generated pages use them without a try/catch and
// would die on the first line, so these stand-ins keep them running. State lasts only
// until the page reloads.
//
// In a frame, a plain link to another site would try to load inside the frame and most
// sites refuse that, so those open in a new tab instead.
//
// Everything here runs with the page's own privileges and the page can undo any of it,
// so this is for compatibility, not security.
const SANDBOX_SHIM = `(function () {
  function memoryStorage() {
    var items = new Map();
    return {
      get length() { return items.size; },
      key: function (i) { var k = Array.from(items.keys())[i]; return k === undefined ? null : k; },
      getItem: function (k) { k = String(k); return items.has(k) ? items.get(k) : null; },
      setItem: function (k, v) { items.set(String(k), String(v)); },
      removeItem: function (k) { items.delete(String(k)); },
      clear: function () { items.clear(); }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { if (window[name]) return; } catch (e) {}
    try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }); } catch (e) {}
  });
  try { void document.cookie; } catch (e) {
    try {
      Object.defineProperty(document, "cookie", {
        get: function () { return ""; },
        set: function () {},
        configurable: true
      });
    } catch (e2) {}
  }
  if (window.self !== window.top) {
    document.addEventListener("click", function (event) {
      var link = event.target && event.target.closest && event.target.closest("a[href]");
      if (!link || link.target) return;
      try {
        var url = new URL(link.href);
        if (/^https?:$/.test(url.protocol) && url.origin !== location.origin) link.target = "_blank";
      } catch (e) {}
    }, true);
  }
})();`;

const LEADING_DOCTYPE = /^﻿?\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i;

// Goes right after the doctype, not before it, which would flip the page into quirks mode.
export function injectSandboxShim(html: string): string {
  const tag = `<script>${SANDBOX_SHIM}</script>`;
  const doctype = LEADING_DOCTYPE.exec(html);
  if (!doctype) return tag + html;
  return html.slice(0, doctype[0].length) + tag + html.slice(doctype[0].length);
}
