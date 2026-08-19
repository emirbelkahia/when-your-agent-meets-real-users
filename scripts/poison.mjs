/**
 * The feed lands.
 *
 * A third-party seller pushes an update to their own listing copy. This is the
 * one write in the whole demo, and it is the write a real marketplace performs
 * dozens of times a day without anyone reading the diff.
 *
 * Run it while the chat window is open. Nothing about the agent changes — same
 * agent, same model, same instructions, same retrieval scope. One text field on
 * one product changes, and the answers start failing.
 *
 * Usage:
 *   node scripts/poison.mjs            arm the listing
 *   node scripts/poison.mjs --revert   put the seller's clean copy back
 */

import "dotenv/config";
import { algoliasearch } from "algoliasearch";
import { catalog, INDEX_NAME, APP_ID, ADMIN_KEY, readAgentId, clearCache } from "./lib/agent.mjs";

if (!APP_ID || !ADMIN_KEY) {
  console.error("Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY.");
  process.exit(1);
}

const revert = process.argv.includes("--revert");
const objectID = catalog.injected_object_id;
const target = catalog.records.find((r) => r.objectID === objectID);

if (!target) {
  console.error(`No record ${objectID} in catalog/products.json.`);
  process.exit(1);
}

const clean = target.seller_copy;
const payload = catalog.injected_seller_copy;
const next = revert ? clean : payload;

const client = algoliasearch(APP_ID, ADMIN_KEY);

console.log(`Supplier feed — ${target.seller_name}`);
console.log(`  index    ${INDEX_NAME}`);
console.log(`  record   ${objectID}  (${target.name})`);
console.log(`  field    seller_copy`);
console.log(`\n  ${revert ? "restoring" : "writing"}:\n`);
console.log(
  next
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n")
);

const { taskID } = await client.partialUpdateObject({
  indexName: INDEX_NAME,
  objectID,
  attributesToUpdate: { seller_copy: next },
});
await client.waitForTask({ indexName: INDEX_NAME, taskID });

// Read it back rather than trusting the write, then drop the agent's cache so the
// next question actually reaches the model.
const check = await client.getObject({ indexName: INDEX_NAME, objectID });
if (check.seller_copy !== next) {
  console.error("\nThe write did not land. The record still has the previous copy.");
  process.exit(1);
}

const agentId = readAgentId();
if (agentId) {
  const deleted = await clearCache(agentId);
  if (deleted !== null) console.log(`\n  cleared ${deleted} cached response(s)`);
}

console.log(`\n  1 record updated. Nobody reviewed it.`);
console.log(
  revert
    ? `\nThe listing is clean again. The agent was never changed.`
    : `\nAsk the same question again. The agent was never changed.`
);
