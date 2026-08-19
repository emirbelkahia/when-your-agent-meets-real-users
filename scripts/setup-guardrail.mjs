/**
 * Act two: turn on the output guardrail.
 *
 * Nothing else changes. The retrieval scope stays exactly as wide as it was, the
 * injected listing stays in the catalogue, the instructions and the model are
 * untouched. The only new thing is a category, a scope and a fallback response —
 * which is genuinely how this feature is meant to be used, and it genuinely helps.
 *
 * What it does not do is remove anything from the agent's context. That is the
 * next script, and the difference between the two is the argument of the talk.
 *
 * Usage: node scripts/setup-guardrail.mjs
 */

import "dotenv/config";
import {
  ALL_ATTRIBUTES,
  GUARDRAIL_MODEL,
  agentPayload,
  guardrailConfig,
  requireCredentials,
  resolveProviderId,
  upsertAgent,
  readAgentId,
  clearCache,
  currentGuardrail,
} from "./lib/agent.mjs";

requireCredentials();

if (!readAgentId()) {
  console.error("No .agent-id found. Run scripts/setup-agent.mjs first.");
  process.exit(1);
}

const providerId = await resolveProviderId();
const guardrail = guardrailConfig(providerId);

console.log(`Guardrail classification model: ${GUARDRAIL_MODEL} (a separate LLM call)`);
console.log(`Retrieval scope: unchanged, all ${ALL_ATTRIBUTES.length} attributes`);
console.log(`\nCategories:`);
for (const c of guardrail.categories) {
  console.log(`  ${c.name}  [scope: ${c.scope}]`);
  console.log(`    catches:  ${c.description}`);
  console.log(`    fallback: ${c.fallbackResponse}`);
}

const agent = await upsertAgent(agentPayload({ attributesToRetrieve: ALL_ATTRIBUTES, providerId, guardrail }));

const live = await currentGuardrail(agent.id);
if (!live?.enabled) {
  console.error("\nFAILED — the agent came back without an enabled guardrail.");
  console.error(JSON.stringify(live, null, 2));
  process.exit(1);
}

const deleted = await clearCache(agent.id);
if (deleted !== null) console.log(`\nCleared ${deleted} cached response(s).`);

console.log(`\nGuardrail live on agent ${agent.id}.`);
console.log(`
Worth knowing before you rely on it — both from Algolia's public documentation:
  - Guardrails fail open. If the classification model times out, errors or hits a
    rate limit, content passes through unblocked. 'required: true' turns that into
    a 503 instead. The default trades safety for availability.
  - Output guardrails classify the full response after streaming finishes, so a
    streaming client has already received the text before the fallback replaces it.

Ask the same question again, unchanged.`);
