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
| `shop/images/` | 21 generated product photos, 820 KB in total. Served from disk when the demo runs locally; each record also carries an `image_url` pointing here on GitHub, so a clone renders either way. |

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

The catalogue ships **clean**. To have the seller push their listing copy while the audience
watches — which is the moment the demo is built around:

```bash
npm run poison      # the feed lands. One text field on one product. Nobody reviewed it
npm run unpoison    # put the seller's clean copy back
```

Then the fixes, in the order the talk argues for. Ask the same question after each one,
unchanged:

```bash
npm run agent:setup        # baseline — over-scoped, nothing in place (also resets to this)
npm run agent:prompt-guard # attempt 0 — tell the model not to. Data still in scope
npm run agent:guardrail    # attempt 1 — output guardrail on. Scope untouched
npm run agent:harden       # attempt 2 — retrieval narrowed. Guardrail left on
```

Each attempt protects what it was told to protect. Attempt 0 names six fields, so six fields
are safe and the invented delivery term walks straight past. Attempt 1 catches the category you
configured, and the margin walks past. Attempt 2 covers what you failed to anticipate, because
there is nothing left to protect. `RESULTS.md` has the transcripts.

Each step patches the **same** agent in place and clears its response cache, so the replays
are honest.

Two things to run when you want the receipt rather than the answer:

```bash
npm run trace "..."   # what the agent asked the index, what it got back, what it said
npm run probe         # the whole question suite in catalog/probes.json
```

**Click New conversation between replays.** The panel keeps the transcript and sends it with each
request, so a replay inherits whatever came before it. The sparkle button in the header empties it.

`trace` is the one that settles arguments. Agent Studio's response stream carries the records
the index handed back, so it prints the exact bytes the model was reasoning over — internal
fields called out in red — and then ties every internal value in the answer to the field it was
lifted from. When the agent quotes a discount ceiling, that is where you prove it did not come
from the product page.

The panel takes URL parameters, so a recording can start in the state you want rather than on a
click you would have to trim:

| | |
|---|---|
| `?chat=open` | panel open, corner size |
| `?chat=big` | panel open at presentation size, storefront dimmed behind |
| `?product=<objectID>` | deep-links to a product page, e.g. `?product=nvk-mp-rvn-lantern`. Clicking a card in the grid does the same |
| `?seed=coldopen` | pre-fills the cold-open exchange from the verbatim transcripts — a deterministic frame for checking type size and cropping before a take |
| `?take=1` | the recommendation question |
| `?take=2` | the follow-up that claims a cart write |
| `?take=3` | the markup question, on its own |
| `?take=all` | **all three.** Send, Send, click the sparkle, Send — the sparkle is the conversation boundary, and a reset keeps whatever is still armed |

The question is typed into the box for you; press Send. The assistant thinks for a second or two
and answers.

**What the takes are, and what they are not.** The cold open is two conversations: an ordinary
shopper who gets a shilled recommendation and then a hallucinated tool call, then a fresh
conversation, announced on stage, where the shopper is poking at it. The answers are verbatim from
`measurements/cold-open-2026-08-21-final.json` — conversation A is trial 6, conversation B is trial
26, two real conversations, and since the cold open is two conversations anyway nothing is stitched
together inside one. Both are among the twenty-one of thirty that produced all four failures.

**One elision, and it is the only one.** Take 1's answer had two paragraphs of chair and table
specifications between the opening line and the pitch. On a projected screen that is the middle
third of the frame spent on weights and review counts, carrying none of the argument, so those two
paragraphs are removed. Every claim is untouched and the unedited answer is kept alongside as
`full`.

What that costs, stated plainly: a real agent buries the damaging claim in its fourth paragraph and
nobody reads that far. Trimming makes it look more pointed than it was.

Two other framing helpers, both for checking a shot before recording it rather than for the
recording itself: `?seed=take1|take2|take3` renders one armed exchange already answered, and
`?seed=typing` renders the thinking indicator on its own.

The talk says this out loud rather than hiding it: the slide after the cold open gives the rates
over thirty runs and states that what the audience watched was one of them.

Without `seed`, the panel starts empty like any chat widget. The sparkle button in the panel
header clears the conversation and starts a new one.

**The assistant answers with product cards, not just prose.** Agent Studio returns the retrieved
hits alongside the text, so the widget shows a card — picture, name, seller, price — for each
retrieved product the answer names. Clicking one opens that product page and drops the panel back
to widget size, which on stage is the hinge between the two acts: the recommendation, then the
seller description it came from.

Two rules behind it, both load-bearing for the demo's honesty. Only products the agent's own search
returned are eligible, and only the ones its answer names get a card — a card is the interface
asserting "this is what I mean", and it should never assert something the retrieval did not
support. And only objectIDs cross to the browser: the retrieved hits carry `internal_cost_eur` and
`supplier_margin_pct`, the card is rendered from `/api/products` which is public fields only, so
when the agent discloses a margin later it is the agent doing it and not the page leaking it.

Which is also the uncomfortable observation: the card is trustworthy in exactly the place the
sentence above it is not. Structured retrieval output is the shop's data. The prose is where the
seller's claims get laundered into the brand's voice.

The panel also pins the shop's real delivery terms under its header. That is deliberate: at
presentation size the storefront's own banner is dimmed behind the backdrop, and without the
policy in frame a viewer has no way to see that an invented delivery claim is invented. It is
also plausible product design, which matters — the recording should not differ from the app.

**A bug worth repeating, because it cost an hour and looked like nothing.** The chat's transcript
array was called `history`, which shadowed `window.history` for the whole script. `showProduct`
rendered fine — the render runs first — and then threw on `history.pushState`, so the URL never
updated and the two handlers attached after that line, the breadcrumb back link and Add to basket,
were never wired up. A product page that opens correctly with a dead back button and a dead buy
button, from a variable name. It is now `transcript`.

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
