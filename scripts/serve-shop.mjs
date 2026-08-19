/**
 * Serves the storefront and proxies the assistant.
 *
 * The proxy exists so that no API key ever reaches the browser — which is also
 * how you would build this for real. Everything the chat widget knows, it learns
 * from this server.
 *
 * /api/products  returns the public fields only. The storefront has no business
 *                seeing cost or margin either, and building it that way keeps the
 *                demo honest: when the agent leaks those fields later, it is not
 *                because the page handed them over.
 * /api/chat      forwards one message to the Agent Studio agent and returns the
 *                answer. No conversation history is kept: every replay starts
 *                clean, so nothing can carry over between them.
 *
 * Usage: node scripts/serve-shop.mjs   →  http://localhost:4173
 */

import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = resolve(HERE, "../shop/index.html");
const CATALOG = resolve(HERE, "../catalog/products.json");
const AGENT_ID_FILE = resolve(HERE, "../.agent-id");

const PORT = Number(process.env.PORT || 4173);
const APP_ID = process.env.ALGOLIA_APP_ID;
const API_KEY = process.env.ALGOLIA_SEARCH_API_KEY || process.env.ALGOLIA_ADMIN_API_KEY;

if (!APP_ID || !API_KEY) {
  console.error("Missing ALGOLIA_APP_ID and a key. Copy .env.example to .env.");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG, "utf-8"));
const HUMAN = catalog.human_attributes;

const publicProducts = catalog.records.map((r) =>
  Object.fromEntries(Object.entries(r).filter(([k]) => HUMAN.includes(k)))
);

function agentId() {
  try {
    return readFileSync(AGENT_ID_FILE, "utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Agent Studio returns an assistant message; the exact envelope has varied
 * between compatibility modes, so pull the text out defensively rather than
 * betting the demo on one shape.
 */
function extractAnswer(payload) {
  if (typeof payload === "string") return payload;
  const candidates = [
    payload?.message?.content,
    payload?.content,
    payload?.answer,
    payload?.text,
    payload?.choices?.[0]?.message?.content,
    payload?.messages?.at(-1)?.content,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
    if (Array.isArray(c)) {
      const joined = c
        .map((part) => (typeof part === "string" ? part : part?.text))
        .filter(Boolean)
        .join("");
      if (joined.trim()) return joined;
    }
  }
  return null;
}

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    const html = readFileSync(INDEX_HTML);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(html);
  }

  if (req.url === "/api/products") {
    return json(res, 200, { shop: catalog.shop, products: publicProducts });
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    const id = agentId();
    if (!id) return json(res, 500, { error: "No agent configured. Run: npm run agent:setup" });

    let body = "";
    for await (const chunk of req) body += chunk;

    let message;
    try {
      message = JSON.parse(body).message;
    } catch {
      return json(res, 400, { error: "Bad request body." });
    }
    if (!message) return json(res, 400, { error: "Empty message." });

    const url = `https://${APP_ID}.algolia.net/agent-studio/1/agents/${id}/completions?streaming=false`;

    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "x-algolia-application-id": APP_ID,
          "x-algolia-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: message }] }),
      });

      const raw = await upstream.text();
      if (!upstream.ok) {
        console.error(`Agent error ${upstream.status}: ${raw.slice(0, 400)}`);
        return json(res, 502, { error: `Assistant unavailable (${upstream.status}).` });
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }

      const answer = extractAnswer(parsed);
      if (!answer) {
        console.error("Could not find the answer in the response envelope:");
        console.error(raw.slice(0, 800));
        return json(res, 502, { error: "Could not read the assistant's answer." });
      }

      console.log(`\nQ: ${message}\nA: ${answer.replace(/\n/g, "\n   ")}\n`);
      return json(res, 200, { answer });
    } catch (err) {
      console.error(err);
      return json(res, 502, { error: "Could not reach the assistant." });
    }
  }

  res.writeHead(404).end("Not found");
});

server.listen(PORT, () => {
  console.log(`Nordvik Market   http://localhost:${PORT}`);
  console.log(`Agent            ${agentId() || "(not configured — run npm run agent:setup)"}`);
  console.log(`\nEvery question and answer is logged here, so the screencast and the`);
  console.log(`transcript can be checked against each other afterwards.`);
});
