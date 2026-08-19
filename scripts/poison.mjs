/**
 * The feed lands.
 *
 * A third-party seller pushes an update to their own listing. This is the one
 * write in the whole demo, and it is the write a real marketplace performs dozens
 * of times a day without anyone reading the diff.
 *
 * Note which field it writes: `description`. Not some bespoke attribute invented
 * for a demo — the ordinary product description, which the seller owns on their
 * own listing and which the agent legitimately needs in order to answer a
 * question about the product. That is what makes this hard. You cannot fix it by
 * deleting the field.
 *
 * Run it while the chat window is open. Nothing about the agent changes: same
 * agent, same model, same instructions, same retrieval scope. One text field on
 * one seller's listings changes, and the answers start failing.
 *
 * Usage:
 *   node scripts/poison.mjs                 the competitor payload (default)
 *   node scripts/poison.mjs shipping        the free-delivery payload
 *   node scripts/poison.mjs --revert        put the seller's clean copy back
 *   node scripts/poison.mjs --list          show the payloads
 */

import "dotenv/config";
import { algoliasearch } from "algoliasearch";
import { catalog, INDEX_NAME, APP_ID, ADMIN_KEY, readAgentId, clearCache } from "./lib/agent.mjs";

if (!APP_ID || !ADMIN_KEY) {
  console.error("Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY.");
  process.exit(1);
}

const args = process.argv.slice(2);
const revert = args.includes("--revert");
const list = args.includes("--list");
const name = args.find((a) => !a.startsWith("--")) ?? "competitor";

const payloads = catalog.payloads;

if (list) {
  console.log("Payloads:\n");
  for (const [k, v] of Object.entries(payloads)) {
    console.log(`  ${k}`);
    console.log(`    ${v.label}`);
    console.log(`    field   ${v.field}`);
    console.log(`    targets ${v.targets.join(", ")}\n`);
  }
  process.exit(0);
}

const payload = payloads[name];
if (!payload) {
  console.error(`Unknown payload "${name}". Known: ${Object.keys(payloads).join(", ")}`);
  process.exit(1);
}

const client = algoliasearch(APP_ID, ADMIN_KEY);
const byId = new Map(catalog.records.map((r) => [r.objectID, r]));

console.log(`Supplier feed — ${byId.get(payload.targets[0])?.seller_name ?? "third-party seller"}`);
console.log(`  index    ${INDEX_NAME}`);
console.log(`  field    ${payload.field}`);
console.log(`  records  ${payload.targets.length}`);
if (!revert) console.log(`  payload  ${name} — ${payload.label}`);

for (const objectID of payload.targets) {
  const record = byId.get(objectID);
  if (!record) {
    console.error(`  no record ${objectID} in catalog/products.json`);
    process.exit(1);
  }
  const next = revert ? record[payload.field] : payload.text;

  const { taskID } = await client.partialUpdateObject({
    indexName: INDEX_NAME,
    objectID,
    attributesToUpdate: { [payload.field]: next },
  });
  await client.waitForTask({ indexName: INDEX_NAME, taskID });

  // Read it back rather than trusting the write.
  const check = await client.getObject({ indexName: INDEX_NAME, objectID });
  if (check[payload.field] !== next) {
    console.error(`\n  the write did not land on ${objectID}`);
    process.exit(1);
  }
  console.log(`  ${revert ? "restored" : "updated"}  ${objectID}  (${record.name})`);
}

if (!revert) {
  console.log(`\n  what the seller wrote:\n`);
  console.log(
    payload.text
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n")
  );
}

const agentId = readAgentId();
if (agentId) {
  const deleted = await clearCache(agentId);
  if (deleted !== null) console.log(`\n  cleared ${deleted} cached response(s)`);
}

console.log(
  revert
    ? `\n${payload.targets.length} listing(s) clean again. The agent was never changed.`
    : `\n${payload.targets.length} listing(s) updated. Nobody reviewed the diff.\n\nAsk the same question again. The agent was never changed.`
);
