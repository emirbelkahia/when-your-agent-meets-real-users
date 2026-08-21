/**
 * Renders the rating leaderboard as a slide asset.
 *
 * The talk puts a claim on screen — "the platform's highest-rated seller" — and then
 * answers it with the catalogue itself. That answer has to come from the data rather
 * than from a table somebody typed, because the catalogue changes: the shop's own camp
 * chair and camp table were added late, and every hand-written copy of this ranking in
 * the deck was wrong within the hour.
 *
 * So: one generator, sorted the way the storefront sorts, run it again after any
 * catalogue change and re-screenshot.
 *
 *   node scripts/leaderboard.mjs        writes shop/leaderboard.html
 *   open shop/leaderboard.html          screenshot the card at 1600×900
 *
 * Design follows the DevCon deck — white ground, near-black mono headline, navy body,
 * cyan for the shop's own camp furniture, coral for the seller doing the shilling.
 * Those two highlights are the whole argument: both of the shop's own items outrank
 * everything the marketplace seller lists.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, "../catalog/products.json");
const OUT = resolve(HERE, "../shop/leaderboard.html");

const catalog = JSON.parse(readFileSync(CATALOG, "utf-8"));

/** The seller whose injected listing copy claims to be highest-rated. */
const SHILL = "Ravnli Direct";

/** The shop's own answer to the question the shopper actually asked. */
const CONTESTED = ["nvk-bramme-camp-chair", "nvk-torvald-camp-table"];

// Rating first, then review count. Ties on 4.6 are common in a catalogue this size,
// and breaking them by volume is what a storefront would do.
const ranked = [...catalog.records].sort(
  (a, b) => b.rating - a.rating || b.review_count - a.review_count
);

const row = (r, i) => {
  const cls =
    r.seller_name === SHILL ? "shill" : CONTESTED.includes(r.objectID) ? "ours" : "";
  return `        <tr class="${cls}">
          <td class="rank">${i + 1}</td>
          <td class="rating">${r.rating.toFixed(1)}</td>
          <td class="reviews">${r.review_count}</td>
          <td class="name">${r.name}</td>
          <td class="seller">${r.seller_name}</td>
        </tr>`;
};

/**
 * Two columns rather than one long list. Twenty-three rows do not fit a 16:9 frame at a
 * size a back row can read, and the alternative — an ellipsis in the middle — hides the
 * part of the table that is doing the arguing.
 */
const half = Math.ceil(ranked.length / 2);
const column = (slice, offset) => `      <table>
        <thead>
          <tr><th>#</th><th>Rating</th><th>Reviews</th><th>Product</th><th>Sold by</th></tr>
        </thead>
        <tbody>
${slice.map((r, i) => row(r, offset + i)).join("\n")}
        </tbody>
      </table>`;
const columns = [
  column(ranked.slice(0, half), 0),
  column(ranked.slice(half), half),
].join("\n");

const shillBest = ranked.findIndex((r) => r.seller_name === SHILL) + 1;
const top = ranked[0];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Rating leaderboard — ${catalog.shop}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink:    #141D61;
    --title:  #000011;
    --muted:  #5A6191;
    --line:   #E4E4EE;
    --cyan:   #29C7C4;
    --cyan-bg:#E9FAFA;
    --coral:  #FC976B;
    --coral-bg:#FFF1E9;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #FFFFFF;
    color: var(--ink);
    font-family: "Sora", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* Sized for a 1600×900 screenshot dropped straight onto a 16:9 slide. */
  .card { width: 1600px; height: 900px; padding: 56px 72px 48px; display: flex; flex-direction: column; }
  h1 {
    font-family: "Roboto Mono", ui-monospace, monospace;
    font-weight: 700;
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: -0.5px;
    color: var(--title);
    margin: 0 0 10px;
  }
  .sub { font-size: 20px; font-weight: 400; color: var(--muted); margin: 0 0 26px; max-width: 1300px; }
  .sub b { font-weight: 600; color: var(--ink); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 56px; }
  table { width: 100%; border-collapse: collapse; font-size: 19px; }
  thead th {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: 0 14px 10px;
    border-bottom: 2px solid var(--line);
  }
  tbody td { padding: 12px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }
  .rank, .rating, .reviews {
    font-family: "Roboto Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }
  .rank { width: 44px; color: var(--muted); font-weight: 500; text-align: right; }
  .rating { width: 56px; font-weight: 700; }
  .reviews { width: 58px; color: var(--muted); font-weight: 500; text-align: right; }
  .name { font-weight: 400; }
  .seller { width: 152px; color: var(--muted); text-align: right; }
  /* The two rows the shopper asked for, and the shop owns both. */
  tr.ours td { background: var(--cyan-bg); font-weight: 600; }
  tr.ours .seller { color: var(--ink); font-weight: 600; }
  tr.ours td:first-child { box-shadow: inset 4px 0 0 var(--cyan); }
  /* The seller claiming to be the highest-rated on the platform. */
  tr.shill td { background: var(--coral-bg); }
  tr.shill .seller { color: #B4552A; font-weight: 600; }
  tr.shill td:first-child { box-shadow: inset 4px 0 0 var(--coral); }
  .legend { margin-top: auto; padding-top: 20px; display: flex; gap: 34px; font-size: 17px; color: var(--muted); }
  .legend span { display: flex; align-items: center; gap: 10px; }
  .swatch { width: 14px; height: 14px; border-radius: 3px; }
</style>
</head>
<body>
<div class="card">
  <h1>"the platform's highest-rated seller"</h1>
  <p class="sub">
    Every record in the index, sorted by rating. ${SHILL}'s best listing ranks
    <b>${shillBest}${ordinal(shillBest)}</b> — ${ranked[shillBest - 1].rating.toFixed(1)} against
    <b>${top.rating.toFixed(1)}</b> at the top. The shopper asked for a camp chair and a camp table,
    and ${catalog.shop} stocks both, rated higher than either of theirs.
  </p>
  <div class="grid">
${columns}
  </div>
  <div class="legend">
    <span><i class="swatch" style="background:var(--cyan)"></i> ${catalog.shop}'s own camp furniture — what the agent should have recommended</span>
    <span><i class="swatch" style="background:var(--coral)"></i> ${SHILL} — the seller whose listing copy claims to be highest-rated</span>
  </div>
</div>
</body>
</html>
`;

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
}

writeFileSync(OUT, html);
console.log(`Wrote shop/leaderboard.html — ${ranked.length} records`);
console.log(`  ${SHILL}'s best listing: #${shillBest} (${ranked[shillBest - 1].name}, ${ranked[shillBest - 1].rating})`);
CONTESTED.forEach((id) => {
  const i = ranked.findIndex((r) => r.objectID === id);
  console.log(`  own stock: #${i + 1} (${ranked[i].name}, ${ranked[i].rating})`);
});
console.log(`  open shop/leaderboard.html and screenshot the card at 1600×900`);
