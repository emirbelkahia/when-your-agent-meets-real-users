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
cp .env.example .env    # fill in your own app ID and keys
npm install
npm run catalog:build   # generate the toy catalog
npm run index           # push it to your app
npm run agent:setup     # create the agent, deliberately over-scoped
npm run shop            # serve the storefront on localhost
```

Ask the question in `catalog/attack.md`. Then:

```bash
npm run agent:harden    # restrict retrieval to public attributes
```

and ask it again, unchanged.

The output guardrail (category + scope + fallback response) is configured in the Algolia
dashboard under Agent Studio safety controls. There is no public API for it at the time of
writing, which is fine for the talk — that screen is worth showing.

## A word on responsible use

Everything here runs against a fictional catalog in an application you own. The point is to make
a class of failure visible so it can be designed out before real customers arrive. Do not point
these scripts at data or applications that are not yours.

## Licence

MIT. Take the checklist, take the scripts, use them on your own agent before your users do.
