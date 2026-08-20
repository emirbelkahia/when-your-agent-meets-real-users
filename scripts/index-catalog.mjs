/**
 * Pushes the toy catalog into Algolia and configures the index the way a normal
 * storefront index is configured.
 *
 * Note what this script deliberately does NOT do: it does not hide the internal
 * attributes. They are indexed and retrievable, exactly as they would be in a
 * catalog index that was built for a storefront and later pointed at an agent.
 * That is the starting state of the demo, and it is not a straw man — inheriting
 * a keyword-search index is the default path onto an agent.
 *
 * The narrowing happens later, in scripts/harden-agent.mjs, at the agent's
 * retrieval scope rather than by rebuilding the index.
 *
 * Usage: node scripts/index-catalog.mjs
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { algoliasearch } from "algoliasearch";

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, "../catalog/products.json");

const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_API_KEY;
export const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "devcon_nordvik_catalog";

if (!APP_ID || !ADMIN_KEY) {
  console.error("Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY. Copy .env.example to .env.");
  process.exit(1);
}

const { records, shop } = JSON.parse(readFileSync(CATALOG, "utf-8"));
const client = algoliasearch(APP_ID, ADMIN_KEY);

console.log(`App:   ${APP_ID}`);
console.log(`Index: ${INDEX_NAME}`);
console.log(`Shop:  ${shop} (${records.length} records)`);

await client.setSettings({
  indexName: INDEX_NAME,
  indexSettings: {
    searchableAttributes: ["name", "brand", "unordered(spec)", "unordered(description)", "category", "seller_name"],
    attributesForFaceting: ["brand", "category", "seller_type", "searchable(seller_name)", "in_stock"],
    customRanking: ["desc(review_count)", "desc(rating)"],
    attributesToSnippet: ["description:40"],

    // A shopper types "ravnli cam lantern 600" and means the Ravnli Camp Lantern
    // 600. Two Algolia defaults stop that working, and both defaults are right for
    // a search box with query suggestions in front of it and wrong for an agent
    // typing a query on a customer's behalf:
    //
    //   minWordSizefor1Typo defaults to 4, so a three-letter word gets no typo
    //   tolerance at all and "cam" never reaches "camp".
    //
    //   removeWordsIfNoResults defaults to none, so every word has to match or
    //   the whole query returns nothing.
    //
    // This is the "agentic search needs different settings from keyword search"
    // point, met in the wild: the agent inherited a storefront configuration and
    // then could not find a product a human would have found.
    // Note the lowercase f. The API really does spell it minWordSizefor1Typo.
    minWordSizefor1Typo: 3,
    minWordSizefor2Typos: 7,
    removeWordsIfNoResults: "allOptional",
  },
});
console.log("Index settings applied.");

// saveObjects batches, so it hands back one response per batch.
const batches = await client.saveObjects({ indexName: INDEX_NAME, objects: records });
for (const { taskID } of batches) {
  await client.waitForTask({ indexName: INDEX_NAME, taskID });
}
console.log(`Indexed ${records.length} records in ${batches.length} batch(es).`);

// Prove the starting state out loud: the internal fields come back on a plain
// search. If this ever stops being true, the demo's first act is broken and the
// screencast would be showing something other than what it claims.
const probe = await client.searchSingleIndex({
  indexName: INDEX_NAME,
  searchParams: { query: "lantern", hitsPerPage: 1 },
});
const hit = probe.hits[0];
if (!hit) {
  console.error("Probe failed: no hit for 'lantern'.");
  process.exit(1);
}
const leaked = ["internal_cost_eur", "supplier_margin_pct", "merch_note", "vendor_contract_ref"].filter(
  (a) => hit[a] !== undefined
);
console.log(`\nProbe — search "lantern" returns ${hit.objectID}`);
console.log(`Internal attributes retrievable: ${leaked.length ? leaked.join(", ") : "none"}`);
if (leaked.length !== 4) {
  console.error("Expected all four internal attributes to be retrievable at this stage.");
  process.exit(1);
}
console.log("\nStarting state confirmed. Next: node scripts/setup-agent.mjs");
