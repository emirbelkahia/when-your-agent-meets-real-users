# When your Agent meets Real Users: A Brand Survival Checklist

Demo material and pre-launch checklist for the Algolia DevCon 2026 talk of the same name.

You are about to ship an AI agent to your customers. This repo contains the runnable version of
what goes wrong when you do it without a threat model, and the three fixes shown in the talk —
each one replayed against **the same question, word for word**.

## What's here

| | |
|---|---|
| `THREAT-MODEL.md` | Why untrusted text reaches a retrieval index in real stacks, and who puts it there. Read this first — it is the argument the demo rests on. |
| `CHECKLIST.md` | The pre-launch checklist promised at the end of the talk. |
| `catalog/` | A toy catalog for a fictional shop. Nothing here belongs to any real company. |
| `scripts/` | Build the catalog, index it, configure the agent, then harden it. |
| `shop/` | The smallest thing that reads like a storefront with a chat widget. |

## The demo in one paragraph

A shopper asks a normal question about a product. The agent answers with a delivery promise the
shop does not offer, and prints internal merchandising fields in the process. Nobody typed
"ignore your instructions". Two of the three failures need no attacker at all — just a
retrieval scope nobody narrowed.

Then the same question is asked twice more:

1. **With an output guardrail.** The invented promise is blocked. The internal fields are still
   in the context, and still reachable.
2. **With the data out of scope.** The fields are no longer retrievable, so there is nothing to
   leak. The offending record is still sitting in the catalog — it is not removed, and that
   matters.

The point being made: **a guardrail lowers a probability. Removing the data eliminates the
class of risk.** Both are worth doing. Only one of them is a guarantee.

## Running it

You need an Algolia application you own — a scratch app, never a customer's — with Agent Studio
enabled and an LLM provider configured in the dashboard.

```bash
cp .env.example .env    # your own app ID and admin key
npm install
npm run catalog:build   # generate the toy catalog
npm run index           # push it to your app
npm run shop            # storefront on http://localhost:4173
```

Then the three acts. Ask the question from `catalog/attack.md` after each one, unchanged:

```bash
npm run agent:setup     # act 1 — over-scoped, no guardrail (also resets to this state)
npm run agent:guardrail # act 2 — output guardrail on, scope untouched
npm run agent:harden    # act 3 — retrieval narrowed, guardrail left on
```

Each step patches the **same** agent in place and clears its response cache, so the replays
are honest. `npm run probe` runs the whole question suite in `catalog/probes.json` and reports
which internal values reached the wire.

Two things about Agent Studio that will bite you if you build this yourself, both documented
in `RESULTS.md`: completions are **cached by default** (every request here passes
`cache=false`), and an output guardrail's verdict arrives *after* the text has streamed, so
the client has to honour the violation event or the blocked answer still reaches the customer.

## A word on responsible use

Everything here runs against a fictional catalog in an application you own. The point is to make
a class of failure visible so it can be designed out before real customers arrive. Do not point
these scripts at data or applications that are not yours.

## Licence

MIT. Take the checklist, take the scripts, use them on your own agent before your users do.
