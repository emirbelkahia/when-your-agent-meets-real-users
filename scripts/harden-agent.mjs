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
  AGENT_ATTRIBUTES,
  INTERNAL_ATTRIBUTES,
  UNTRUSTED_ATTRIBUTES,
  MODEL,
  agentPayload,
  guardrailConfig,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
  readAgentId,
  currentScope,
  currentGuardrail,
  clearCache,
} from "./lib/agent.mjs";

requireCredentials();

if (!readAgentId()) {
  console.error("No .agent-id found. Run scripts/setup-agent.mjs first.");
  process.exit(1);
}

const before = await currentScope(readAgentId());
const guardrailWasOn = (await currentGuardrail(readAgentId()))?.enabled === true;
const providerId = await resolveProviderId();

// Act three is additive. If the guardrail was on, it stays on — the talk argues
// for doing both, in this order, not for swapping one out for the other.
const guardrail = guardrailWasOn ? guardrailConfig(providerId) : null;
console.log(`Guardrail: ${guardrailWasOn ? "left on" : "not configured"}`);

console.log(`Model: ${MODEL} (unchanged)`);
console.log(`Retrieval scope before: ${before ? before.length : "?"} attributes`);
console.log(`Retrieval scope after:  ${AGENT_ATTRIBUTES.length} attributes`);
console.log(`\nRemoved from the agent's context — internal, never public:`);
for (const a of INTERNAL_ATTRIBUTES) console.log(`  - ${a}`);
console.log(`\nRemoved from the agent's context — public to shoppers, untrusted:`);
for (const a of UNTRUSTED_ATTRIBUTES) console.log(`  - ${a}   (still shown on the page)`);

const agent = await upsertAgent(
  agentPayload({ attributesToRetrieve: AGENT_ATTRIBUTES, providerId, guardrail })
);

const after = await currentScope(agent.id);
const stillThere = [...INTERNAL_ATTRIBUTES, ...UNTRUSTED_ATTRIBUTES].filter((a) => after?.includes(a));
if (stillThere.length) {
  console.error(`\nFAILED — still retrievable: ${stillThere.join(", ")}`);
  process.exit(1);
}

const deleted = await clearCache(agent.id);
if (deleted !== null) console.log(`\nCleared ${deleted} cached response(s).`);

console.log(`\nAgent ${agent.id} hardened. Internal attributes are out of the retrieval scope.`);
console.log("The injected listing is still in the catalogue. Ask the same question again.");
