#!/usr/bin/env node
// Standalone probe for the MiniMax API. Reads MINIMAX_API_KEY and
// MINIMAX_MODEL from apps/app/.env.local (same file the app uses).
//
// Usage: node scripts/probe-minimax.mjs [maxTokens] [model]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "..", "apps", "app", ".env.local");

function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`Could not read ${path}: ${e.message}`);
    process.exit(1);
  }
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv(envPath);
const key = env.MINIMAX_API_KEY;
const argModel = process.argv[3];
const model = argModel || env.MINIMAX_MODEL || "MiniMax-M2";
const maxTokens = Number(process.argv[2] ?? 256);

if (!key) {
  console.error("MINIMAX_API_KEY missing in", envPath);
  process.exit(1);
}

const ENDPOINT = "https://api.minimax.io/v1/text/chatcompletion_v2";

// Representative prompt — roughly what the app sends.
const sample =
  "This is a demo document about the weather in Prague during spring. " +
  "It talks about rain, cherry blossoms, and tourists in the Old Town Square. " +
  "The author recommends visiting in April or May for mild temperatures.";

const prompt =
  "Suggest a short URL slug for the document below. " +
  "Use 2-4 lowercase words joined by single hyphens. " +
  "Only letters, digits, and hyphens. No punctuation, no quotes, no explanation. " +
  "Output the slug on a single line, nothing else.\n\n" +
  `Spring in Prague\n\n${sample}`;

const body = {
  model,
  max_tokens: maxTokens,
  temperature: 0.7,
  messages: [
    { role: "system", content: "You are a terse assistant. Output only what is asked, no prose or explanation." },
    { role: "user", content: prompt },
  ],
};

console.log(`→ POST ${ENDPOINT}`);
console.log(`  model=${model} maxTokens=${maxTokens}`);
console.log(`  prompt bytes=${prompt.length}`);
console.log();

const started = Date.now();
let res;
try {
  res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
} catch (e) {
  console.error(`fetch failed: ${e.message}`);
  process.exit(1);
}
const elapsed = Date.now() - started;
console.log(`← HTTP ${res.status} ${res.statusText} after ${elapsed}ms`);
const text = await res.text();
console.log();
console.log("RAW BODY:");
console.log(text);
console.log();

let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  console.error("Response was not JSON.");
  process.exit(1);
}

console.log("STRUCTURED:");
console.dir(parsed, { depth: 6, colors: true });
console.log();
if (parsed.base_resp) {
  console.log(`base_resp.status_code = ${parsed.base_resp.status_code}`);
  console.log(`base_resp.status_msg  = ${parsed.base_resp.status_msg ?? "(empty)"}`);
}
const content = parsed?.choices?.[0]?.message?.content;
console.log(`choices[0].message.content = ${JSON.stringify(content ?? null)}`);
if (parsed?.choices?.[0]?.message) {
  console.log("message keys:", Object.keys(parsed.choices[0].message));
}
if (parsed?.choices?.[0]) {
  console.log("choice keys:", Object.keys(parsed.choices[0]));
  if (parsed.choices[0].finish_reason) {
    console.log(`finish_reason = ${parsed.choices[0].finish_reason}`);
  }
}
if (parsed.usage) {
  console.log("usage:", parsed.usage);
}
