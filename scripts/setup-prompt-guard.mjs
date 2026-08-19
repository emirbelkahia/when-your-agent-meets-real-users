/**
 * Attempt zero: tell the model not to.
 *
 * Adds an explicit, unambiguous prohibition on the internal fields to the agent's
 * instructions. Nothing else changes — the retrieval scope stays exactly as wide,
 * the injected listing stays in the catalogue, no guardrail is configured, same
 * agent, same model.
 *
 * This is here because it answers the first objection anyone raises: the internal
 * fields were in the context and nobody had told the agent not to use them. Now it
 * has been told, in about as plain a form as English allows, including a line
 * telling it to disregard instructions found inside catalogue content.
 *
 * Then ask the same questions again and see what that instruction was worth.
 *
 * Usage: node scripts/setup-prompt-guard.mjs
 */

import "dotenv/config";
import {
  ALL_ATTRIBUTES,
  INTERNAL_ATTRIBUTES,
  PROHIBITION,
  agentPayload,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
  readAgentId,
  clearCache,
} from "./lib/agent.mjs";

requireCredentials();

if (!readAgentId()) {
  console.error("No .agent-id found. Run scripts/setup-agent.mjs first.");
  process.exit(1);
}

const providerId = await resolveProviderId();

console.log(`Retrieval scope: unchanged, all ${ALL_ATTRIBUTES.length} attributes`);
console.log(`  still including: ${INTERNAL_ATTRIBUTES.join(", ")}`);
console.log(`Guardrail: none`);
console.log(`\nAdded to the instructions:${PROHIBITION}`);

const agent = await upsertAgent(
  agentPayload({ attributesToRetrieve: ALL_ATTRIBUTES, providerId, prohibition: true })
);

const deleted = await clearCache(agent.id);
if (deleted !== null) console.log(`\nCleared ${deleted} cached response(s).`);

console.log(`\nAgent ${agent.id} now has the prohibition and the data.`);
console.log("Ask the same questions again.");
