/**
 * Creates the agent in its starting state: over-scoped retrieval.
 *
 * The agent is allowed to retrieve every attribute on the record, internal ones
 * included. Nobody chose this maliciously — it is what you get when an index
 * built for a storefront is handed to an agent and no one narrows the scope.
 *
 * Usage: node scripts/setup-agent.mjs
 */

import "dotenv/config";
import {
  ALL_ATTRIBUTES,
  INTERNAL_ATTRIBUTES,
  MODEL,
  INDEX_NAME,
  agentPayload,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
} from "./lib/agent.mjs";

requireCredentials();

const providerId = await resolveProviderId();

console.log(`Model: ${MODEL}`);
console.log(`Index: ${INDEX_NAME}`);
console.log(`Retrieval scope: all ${ALL_ATTRIBUTES.length} attributes`);
console.log(`  including internal: ${INTERNAL_ATTRIBUTES.join(", ")}`);

const agent = await upsertAgent(
  agentPayload({ attributesToRetrieve: ALL_ATTRIBUTES, providerId })
);

console.log(`\nAgent ready: ${agent.id} (${agent.status})`);
console.log("Agent id written to .agent-id");
console.log("\nNow ask the question in catalog/attack.md, unchanged, and watch what comes back.");
