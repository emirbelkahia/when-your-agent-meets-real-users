/**
 * Shows where the answer came from.
 *
 * "The seller allows a maximum discount of 10%" is a claim. This script is the
 * receipt. Agent Studio's response stream carries the tool call the agent made
 * and the records the index handed back, so the exact bytes the model was
 * reasoning over can be printed next to what it went on to say.
 *
 * Three sections, in the order that makes the argument:
 *   1. what the agent asked the index
 *   2. what the index gave it, with the internal and untrusted fields called out
 *   3. what it said, and which internal values ended up in there
 *
 * The last section is the one worth filming. It ties every number in the answer
 * back to the field it was lifted from, which turns "the agent leaked our margin"
 * from an accusation into a citation.
 *
 * Usage: node scripts/trace.mjs "your question"
 */

import "dotenv/config";
import {
  APP_ID,
  ADMIN_KEY,
  readAgentId,
  catalog,
  INTERNAL_ATTRIBUTES,
  UNTRUSTED_ATTRIBUTES,
} from "./lib/agent.mjs";
import { findLeaks, findFalseClaims } from "./ask.mjs";

const AGENT_ID = readAgentId();
if (!APP_ID || !ADMIN_KEY || !AGENT_ID) {
  console.error("Need ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY and a configured agent.");
  process.exit(1);
}

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: node scripts/trace.mjs "your question"');
  process.exit(1);
}

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c("31;1", s);
const amber = (s) => c("33;1", s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);
const rule = (label) => `\n${bold(label)}\n${dim("─".repeat(74))}`;

const res = await fetch(
  `https://${APP_ID}.algolia.net/agent-studio/1/agents/${AGENT_ID}` +
    `/completions?streaming=false&compatibilityMode=ai-sdk-5&cache=false`,
  {
    method: "POST",
    headers: {
      "x-algolia-application-id": APP_ID,
      "x-algolia-api-key": ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", parts: [{ type: "text", text: question }] }],
    }),
  }
);

const raw = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${raw.slice(0, 400)}`);
  process.exit(1);
}

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

const searches = frames.filter((f) => f.type === "tool-input-available");
const outputs = frames.filter((f) => f.type === "tool-output-available");
const violation =
  frames.find((f) => f.type === "data-guardrail-violation" || f.type === "guardrailViolation")
    ?.data ?? null;
const streamed = frames
  .filter((f) => f.type === "text-delta")
  .map((f) => f.delta ?? f.text ?? "")
  .join("")
  .trim();

console.log(rule("THE QUESTION"));
console.log(`  ${question}`);

console.log(rule("WHAT THE AGENT ASKED THE INDEX"));
if (!searches.length) console.log(dim("  no search was run"));
for (const s of searches) {
  const i = s.input ?? {};
  console.log(`  index   ${i.index ?? "?"}`);
  console.log(`  query   ${JSON.stringify(i.query ?? "")}`);
  if (i.facet_filters) console.log(`  facets  ${JSON.stringify(i.facet_filters)}`);
  if (i.filters) console.log(`  filters ${i.filters}`);
  console.log(`  asked for ${i.number_of_results ?? "?"} results`);
}

console.log(rule("WHAT THE INDEX HANDED BACK"));

const hits = outputs.flatMap((o) => o.output?.hits ?? []);
if (!hits.length) console.log(dim("  no hits"));

for (const hit of hits) {
  const fields = Object.entries(hit).filter(([k]) => !k.startsWith("_"));
  const isInternal = (k) => INTERNAL_ATTRIBUTES.includes(k);
  const isUntrusted = (k) => UNTRUSTED_ATTRIBUTES.includes(k);

  console.log(`\n  ${bold(hit.objectID ?? "(no objectID)")}   ${hit.name ?? ""}`);

  const show = (label, entries, paint) => {
    if (!entries.length) return;
    console.log(`\n    ${label}`);
    for (const [k, v] of entries) {
      const value = String(v).replace(/\s+/g, " ");
      const clipped = value.length > 150 ? `${value.slice(0, 150)}…` : value;
      console.log(`      ${paint(k.padEnd(22))} ${clipped}`);
    }
  };

  show(
    dim("public — fine for a shopper and fine for the agent"),
    fields.filter(([k]) => !isInternal(k) && !isUntrusted(k)),
    dim
  );
  show(
    amber("UNTRUSTED — public to shoppers, but an outsider wrote it"),
    fields.filter(([k]) => isUntrusted(k)),
    amber
  );
  show(
    red("INTERNAL — never meant to leave the building"),
    fields.filter(([k]) => isInternal(k)),
    red
  );
}

console.log(rule("WHAT THE AGENT SAID"));
if (violation) {
  console.log(`  ${red(`BLOCKED by guardrail [${violation.category}]`)}`);
  console.log(`\n  ${dim("shown to the customer by a correct client:")}`);
  console.log(`  ${violation.fallbackResponse}`);
  console.log(`\n  ${amber("streamed before the verdict arrived:")}`);
}
console.log(
  streamed
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n")
);

console.log(rule("PROVENANCE"));

const leaks = findLeaks(streamed, question);
if (!leaks.length) {
  console.log(`  ${dim("No internal value from those records appears in the answer.")}`);
} else {
  console.log(`  ${red("Internal values that made it into the answer:")}\n`);
  for (const { attribute, value } of leaks) {
    const source = hits.find((h) => h[attribute] !== undefined);
    const actual = source ? String(source[attribute]).replace(/\s+/g, " ") : "?";
    const clipped = actual.length > 80 ? `${actual.slice(0, 80)}…` : actual;
    console.log(`    ${red(attribute)}`);
    console.log(`      value in the record : ${clipped}`);
    console.log(`      matched in answer   : ${value}`);
    console.log(`      record              : ${source?.objectID ?? "?"}`);
  }
  console.log(
    `\n  ${dim("Nothing on the product page shows these. The only way into the answer")}`
  );
  console.log(`  ${dim("was the agent's retrieval scope.")}`);
}

const claims = findFalseClaims(streamed);
if (claims.length) {
  console.log(`\n  ${red("Terms it stated that the shop does not offer:")}\n`);
  for (const cl of claims) console.log(`    ${red(cl.id.padEnd(24))} ${cl.says}`);
  console.log(
    `\n  ${dim("These came from seller_copy, not from any field. Prohibiting named")}`
  );
  console.log(`  ${dim("fields does nothing about them.")}`);
}

// One last check the audience can verify for themselves.
const shopperVisible = catalog.human_attributes;
const leakedButNotShopperVisible = leaks.filter((l) => !shopperVisible.includes(l.attribute));
if (leakedButNotShopperVisible.length) {
  const n = leakedButNotShopperVisible.length;
  console.log(
    `\n  ${red(`${n} of ${n === 1 ? "these is" : "these are"} not rendered anywhere on the storefront.`)}`
  );
}
console.log("");
