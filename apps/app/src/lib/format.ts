// Fixed locale and timezone, because this runs on the server and again in the browser, and
// React treats any difference between the two as an error and throws away the rendered page.
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatBytes(bytes: number): string {
  const short = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${short(bytes / 1024)} KB`;
  return `${short(bytes / 1024 / 1024)} MB`;
}
