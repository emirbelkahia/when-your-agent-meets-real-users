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
const IMAGES = resolve(HERE, "../shop/images");
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
 * Agent Studio replies in AI SDK stream frames even when streaming is off, so the
 * text arrives as a sequence of `text-delta` events rather than one JSON field.
 * A guardrail violation arrives as its own frame, and it is worth surfacing
 * separately: on stage, seeing that the answer was *blocked* rather than merely
 * different is the whole point of act two.
 */
function parseAgentStream(raw) {
  const frames = raw
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const text = frames
    .filter((f) => f.type === "text-delta")
    .map((f) => f.delta ?? f.text ?? "")
    .join("")
    .trim();

  const violation = frames.find(
    (f) => f.type === "data-guardrail-violation" || f.type === "guardrailViolation"
  );

  return { text, violation: violation?.data ?? violation ?? null };
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

  // Product photos. Served locally on purpose: a screencast must never wait on a CDN.
  if (req.url?.startsWith("/images/")) {
    const name = req.url.slice("/images/".length);
    if (!/^[a-z0-9-]+\.jpg$/.test(name)) return res.writeHead(404).end("Not found");
    try {
      const file = readFileSync(resolve(IMAGES, name));
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
      return res.end(file);
    } catch {
      return res.writeHead(404).end("Not found");
    }
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

    // cache=false so what the audience sees is what the agent just decided, not a
    // response cached before the fix was applied.
    const url =
      `https://${APP_ID}.algolia.net/agent-studio/1/agents/${id}` +
      `/completions?streaming=false&compatibilityMode=ai-sdk-5&cache=false`;

    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "x-algolia-application-id": APP_ID,
          "x-algolia-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [{ role: "user", parts: [{ type: "text", text: message }] }] }),
      });

      const raw = await upstream.text();
      if (!upstream.ok) {
        console.error(`Agent error ${upstream.status}: ${raw.slice(0, 400)}`);
        return json(res, 502, { error: `Assistant unavailable (${upstream.status}).` });
      }

      const { text, violation } = parseAgentStream(raw);

      if (violation) {
        const fallback =
          violation.fallbackResponse || "I cannot provide this response.";
        console.log(`\nQ: ${message}\nBLOCKED by guardrail [${violation.category ?? "?"}]\nA: ${fallback}\n`);
        return json(res, 200, { answer: fallback, blocked: true, category: violation.category });
      }

      if (!text) {
        console.error("No text frames in the response:");
        console.error(raw.slice(0, 800));
        return json(res, 502, { error: "Could not read the assistant's answer." });
      }

      console.log(`\nQ: ${message}\nA: ${text.replace(/\n/g, "\n   ")}\n`);
      return json(res, 200, { answer: text });
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
