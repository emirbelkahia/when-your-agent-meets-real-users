/**
 * The second fix: take the data out of the room.
 *
 * Narrows the agent's retrieval scope to the public attributes. Nothing else
 * changes — same agent, same instructions, same model, same index, and the
 * injected listing is still sitting in the catalogue. It is not deleted, and
 * that is the point worth saying on stage: the attack is unchanged and the
 * attacker's text is still there. There is simply nothing left for it to reach.
 *
 * Usage: node scripts/harden-agent.mjs
 */

import "dotenv/config";
import {
  PUBLIC_ATTRIBUTES,
  INTERNAL_ATTRIBUTES,
  MODEL,
  agentPayload,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
  readAgentId,
  currentScope,
} from "./lib/agent.mjs";

requireCredentials();

if (!readAgentId()) {
  console.error("No .agent-id found. Run scripts/setup-agent.mjs first.");
  process.exit(1);
}

const before = await currentScope(readAgentId());
const providerId = await resolveProviderId();

console.log(`Model: ${MODEL} (unchanged)`);
console.log(`Retrieval scope before: ${before ? before.length : "?"} attributes`);
console.log(`Retrieval scope after:  ${PUBLIC_ATTRIBUTES.length} attributes`);
console.log(`\nRemoved from the agent's context:`);
for (const a of INTERNAL_ATTRIBUTES) console.log(`  - ${a}`);

const agent = await upsertAgent(
  agentPayload({ attributesToRetrieve: PUBLIC_ATTRIBUTES, providerId })
);

const after = await currentScope(agent.id);
const stillThere = INTERNAL_ATTRIBUTES.filter((a) => after?.includes(a));
if (stillThere.length) {
  console.error(`\nFAILED — still retrievable: ${stillThere.join(", ")}`);
  process.exit(1);
}

console.log(`\nAgent ${agent.id} hardened. Internal attributes are out of the retrieval scope.`);
console.log("The injected listing is still in the catalogue. Ask the same question again.");
