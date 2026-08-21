/**
 * Renders the failure-rate card: what went wrong, what caused it, and how often.
 *
 * This is the slide that keeps the talk honest. One filmed take proves a failure is
 * possible and proves nothing about how often — and the honest answer is that some of
 * these fire on every single run and some fire in one run out of four. A language model
 * samples; the same question takes a different path on every call. The argument the card
 * makes lives at the bottom of the column: the low-rate row is the one a demo misses, a
 * launch survives, and production finds in front of a customer.
 *
 * Scores stored transcripts rather than calling the API, so a detector fix re-renders
 * the numbers for free. That matters — the cart detector has been widened twice, and
 * both times the published rate was wrong until the transcripts were scored again.
 *
 *   node scripts/failure-rates.mjs                       newest run in measurements/
 *   node scripts/failure-rates.mjs cold-open-x.json      a specific run
 *   open shop/failure-rates.html                         screenshot the card at 1600×900
 */

import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "./lib/agent.mjs";
import { failures, score } from "./lib/score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEASUREMENTS = resolve(HERE, "../measurements");
const OUT = resolve(HERE, "../shop/failure-rates.html");

const arg = process.argv[2];
const file = arg
  ? resolve(MEASUREMENTS, basename(arg))
  : readdirSync(MEASUREMENTS)
      .filter((f) => f.endsWith(".json"))
      .map((f) => resolve(MEASUREMENTS, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const run = JSON.parse(readFileSync(file, "utf-8"));
const turns = run.turns;
const scored = run.results.map((r) => score(r.answers, turns, catalog));
const n = scored.length;

const CAUSE_CLASS = {
  "Seller poisoning": "poison",
  "Over-broad retrieval": "scope",
  Invention: "invent",
};

const rows = failures(catalog)
  .map((f) => ({ ...f, hits: scored.filter((s) => s[f.id]).length }))
  .sort((a, b) => b.hits - a.hits)
  .map((f) => {
    const pct = Math.round((100 * f.hits) / n);
    return `        <tr>
          <td class="what"><span class="label">${f.label}</span><span class="note">${f.note}</span></td>
          <td class="cause"><span class="chip ${CAUSE_CLASS[f.cause]}">${f.cause}</span></td>
          <td class="count">${f.hits}/${n}</td>
          <td class="bar">
            <div class="track"><div class="fill ${CAUSE_CLASS[f.cause]}" style="width:${pct}%"></div></div>
            <span class="pct">${pct}%</span>
          </td>
        </tr>`;
  })
  .join("\n");

const lowest = failures(catalog)
  .map((f) => Math.round((100 * scored.filter((s) => s[f.id]).length) / n))
  .sort((a, b) => a - b)[0];
const always = failures(catalog).filter(
  (f) => scored.filter((s) => s[f.id]).length === n
).length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Failure rates — ${n} runs</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink:    #141D61;
    --title:  #000011;
    --muted:  #5A6191;
    --line:   #E4E4EE;
    --poison: #FC976B;
    --poison-bg: #FFF1E9;
    --scope:  #4342FB;
    --scope-bg: #ECECFE;
    --invent: #C15BD8;
    --invent-bg: #FBEDFE;
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
  .card { width: 1600px; height: 900px; padding: 60px 76px 52px; display: flex; flex-direction: column; }
  h1 {
    font-family: "Roboto Mono", ui-monospace, monospace;
    font-weight: 700;
    font-size: 46px;
    line-height: 1.1;
    letter-spacing: -0.5px;
    color: var(--title);
    margin: 0 0 12px;
  }
  .sub { font-size: 21px; color: var(--muted); margin: 0 0 30px; max-width: 1180px; line-height: 1.45; }
  .sub b { font-weight: 600; color: var(--ink); }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: 0 0 12px;
    border-bottom: 2px solid var(--line);
  }
  thead th.count, thead th.bar { text-align: right; }
  tbody td { padding: 13px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  .what { padding-right: 40px; }
  .label { display: block; font-size: 21px; font-weight: 600; color: var(--ink); }
  .note { display: block; font-size: 15px; color: var(--muted); margin-top: 4px; }
  .cause { width: 208px; }
  .chip {
    display: inline-block;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .chip.poison { background: var(--poison-bg); color: #B4552A; }
  .chip.scope  { background: var(--scope-bg);  color: #2A29C4; }
  .chip.invent { background: var(--invent-bg); color: #8B2FA6; }
  .count {
    width: 108px;
    text-align: right;
    padding-right: 28px;
    font-family: "Roboto Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 19px;
    color: var(--muted);
  }
  .bar { width: 360px; }
  .track { display: inline-block; width: 262px; height: 14px; border-radius: 999px; background: #F1F1F6; vertical-align: middle; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; }
  .fill.poison { background: var(--poison); }
  .fill.scope  { background: var(--scope); }
  .fill.invent { background: var(--invent); }
  .pct {
    display: inline-block;
    width: 84px;
    text-align: right;
    font-family: "Roboto Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 25px;
    color: var(--ink);
    vertical-align: middle;
  }
  .foot { margin-top: auto; padding-top: 26px; padding-right: 140px; border-top: 2px solid var(--line); font-size: 20px; color: var(--ink); line-height: 1.5; }
  .foot b { font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <h1>${n} runs, the same two conversations</h1>
  <p class="sub">
    Identical questions, identical agent, identical index, ${n} fresh conversations.
    ${always} of these failures fired on <b>every single run</b>. The rest did not — the
    lowest came up in <b>${lowest}%</b> of them.
  </p>
  <table>
    <thead>
      <tr>
        <th>What the assistant did</th>
        <th>Cause</th>
        <th class="count">Runs</th>
        <th class="bar">Rate</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p class="foot">
    A language model samples its next token, so the same question takes a different path
    on every call. <b>The rows at the bottom of this table are the dangerous ones:</b> a
    failure at ${lowest}% passes your demo, passes your launch, and arrives in front of a
    customer in week three.
  </p>
</div>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`Scored ${basename(file)} — ${n} conversations`);
failures(catalog).forEach((f) => {
  const hits = scored.filter((s) => s[f.id]).length;
  console.log(`  ${f.id.padEnd(12)} ${String(hits).padStart(2)}/${n}  ${String(Math.round((100 * hits) / n)).padStart(3)}%  ${f.cause}`);
});
console.log(`Wrote shop/failure-rates.html — screenshot the card at 1600×900`);
