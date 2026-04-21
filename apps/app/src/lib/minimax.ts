import { env } from "@/env";

const ENDPOINT = "https://api.minimax.io/v1/text/chatcompletion_v2";

interface MiniMaxResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string; reasoning_content?: string };
  }>;
  base_resp?: { status_code?: number; status_msg?: string };
}

export async function minimaxChat(prompt: string, maxTokens = 40, timeoutMs = 10000): Promise<string | null> {
  const key = env.minimaxApiKey();
  if (!key) {
    console.warn("[minimax] MINIMAX_API_KEY not set — skipping");
    return null;
  }

  const model = env.minimaxModel();
  const started = Date.now();
  console.log(`[minimax] request model=${model} promptBytes=${prompt.length} maxTokens=${maxTokens}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: "You are a terse assistant. Output only what is asked, no prose or explanation." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const elapsed = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      console.warn(`[minimax] http ${res.status} after ${elapsed}ms body=${body.slice(0, 400)}`);
      return null;
    }
    const data = (await res.json()) as MiniMaxResponse;
    const statusCode = data.base_resp?.status_code;
    const statusMsg = data.base_resp?.status_msg;
    if (statusCode && statusCode !== 0) {
      console.warn(`[minimax] base_resp.status_code=${statusCode} msg=${statusMsg ?? ""} after ${elapsed}ms`);
      return null;
    }
    const choice = data.choices?.[0];
    const content = choice?.message?.content?.trim();
    const reasoning = choice?.message?.reasoning_content?.trim();
    // Reasoning models (e.g. MiniMax-M2.7) may burn the whole output budget on
    // internal reasoning and leave `content` empty. The final answer is
    // usually the last line of `reasoning_content`.
    const text =
      content || (reasoning ? (reasoning.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? null) : null);
    console.log(
      `[minimax] ok after ${elapsed}ms finish=${choice?.finish_reason ?? "?"} contentBytes=${content?.length ?? 0} reasoningBytes=${reasoning?.length ?? 0} preview=${JSON.stringify((text ?? "").slice(0, 120))}`,
    );
    return text || null;
  } catch (e) {
    const elapsed = Date.now() - started;
    if (e instanceof Error && e.name === "AbortError") {
      console.warn(`[minimax] timeout after ${elapsed}ms (limit ${timeoutMs}ms)`);
    } else {
      console.warn(`[minimax] fetch error after ${elapsed}ms: ${e instanceof Error ? e.message : String(e)}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
