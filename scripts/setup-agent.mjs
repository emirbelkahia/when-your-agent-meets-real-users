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
  UNTRUSTED_ATTRIBUTES,
  MODEL,
  INDEX_NAME,
  agentPayload,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
  clearCache,
  currentGuardrail,
} from "./lib/agent.mjs";

requireCredentials();

const providerId = await resolveProviderId();

console.log(`Model: ${MODEL}`);
console.log(`Index: ${INDEX_NAME}`);
console.log(`Retrieval scope: all ${ALL_ATTRIBUTES.length} attributes`);
console.log(`  including internal:  ${INTERNAL_ATTRIBUTES.join(", ")}`);
console.log(`  including untrusted: ${UNTRUSTED_ATTRIBUTES.join(", ")}`);
console.log(`Guardrail: off`);

const agent = await upsertAgent(
  agentPayload({ attributesToRetrieve: ALL_ATTRIBUTES, providerId })
);

// Re-running this script is how you reset to act one, so make sure it really
// resets: the guardrail has to be gone and the cache has to be empty, or the
// next replay is not starting from where it claims to.
const guardrail = await currentGuardrail(agent.id);
if (guardrail?.enabled) {
  console.error("\nFAILED — the agent still has an enabled guardrail. Not a clean act one.");
  process.exit(1);
}

const deleted = await clearCache(agent.id);
if (deleted !== null) console.log(`Cleared ${deleted} cached response(s).`);

console.log(`\nAgent ready: ${agent.id} (${agent.status})`);
console.log("Agent id written to .agent-id");
console.log("\nNow ask the question in catalog/attack.md, unchanged, and watch what comes back.");
