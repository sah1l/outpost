// Browser side: sends JSON and turns a failed response into an Error carrying the server's message.
export async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? `request failed: ${res.status}`);
  return data as T;
}

export function errorMessage(e: unknown, fallback = "something went wrong"): string {
  return e instanceof Error ? e.message : fallback;
}
