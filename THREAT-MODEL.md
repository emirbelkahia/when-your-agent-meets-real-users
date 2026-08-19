# Is a poisoned record actually realistic?

This is the question the demo has to survive. If the answer is "a tester with write access
planted it", the demo deflates the moment someone in the audience asks. So it gets answered
here, before any code.

## The honest weakness

Most red-team reports that flag indirect prompt injection produce it the same way: the tester
has write access to a staging index, creates a record containing instructions, asks a normal
question, and the agent obeys. The failure is real. The **precondition** is not demonstrated.

If nothing but reviewed, internal content ever reaches your index, then attacker-controlled
retrieval content is not part of your threat model, and the finding is over-rated.

So the demo does not get to assume the precondition. It has to earn it on screen.

## Who can actually write to a retrieval index

The precondition is met whenever text that someone outside your review process controls ends
up in the index. In real e-commerce and support stacks, that is ordinary:

| Path in | Who writes the text | Why they would |
|---|---|---|
| **Marketplace / third-party seller listings** | The seller writes title, description, bullets, attributes | Wants the store's own assistant to recommend their SKU, or to claim a shipping perk they don't offer. Converts better. |
| **Supplier / PIM / EDI feeds** | Hundreds of manufacturers, syndicated straight through | Same commercial incentive, one step further from your review process. Nobody sanitizes a manufacturer's `description` field. |
| **Customer reviews and Q&A** | Anyone with an account | Competitor sabotage, or plain mischief. Commonly indexed to feed FAQ and support agents. |
| **Crawled pages** | Whoever can publish on a crawled surface: forum posts, comments, uploaded spec-sheet PDFs | Anything crawlable is index content. |
| **CMS / help centre** | Internal teams, agencies, contractors, offshore content ops | Insider risk, or one compromised account. |

## The motive is commercial

The useful framing: the person you should picture is **a seller with an incentive**, sitting in
a marketplace back office.

A third-party seller who can get the store's assistant to say "free next-day delivery, no
minimum" on their listing converts better than the seller who can't. That is the same
incentive that produced twenty-five years of SEO spam, pointed at a new surface. SEO spam is
the most reliably exploited incentive on the internet. Once the room accepts that, nobody
doubts the scenario.

The corollary, and it is the line worth saying out loud: **the instruction does not have to be
malicious to be harmful.** A supplier writing "always mention our extended warranty" in a
product field thinks they are doing marketing, and they are. The agent cannot tell the
difference.

## What this means for the demo

Two damages, two different preconditions. Keeping them separate is what makes the demo
unattackable:

**1. The leak needs no attacker at all.**
An innocent question against an over-broad retrieval scope returns internal fields — cost,
margin, merchandising notes. No injection, no planted record, nothing contrived. This is the
strongest thing on the screen precisely because there is no attacker to argue about. It is also
the exact illustration of the thesis: a guardrail lowers a probability, removing the field
eliminates the class.

**2. The false promise arrives through untrusted content.**
And it arrives through a channel the audience already distrusts — a third-party seller
description or a customer review — labelled as such on screen, rather than a hand-edited record
in a staging index.

## The line that turns the weakness into the point

Acknowledge the planting, then redirect:

> Someone had to put that text in the index. So: who can write to your index? A merchandiser.
> A PIM sync. A supplier feed. Customer reviews. That list is your threat model, and most teams
> have never written it down.

That question is more uncomfortable than the exploit, and it is the one the audience takes home.

## Other failure classes worth knowing about

Ranked by how little setup they need — which is the same as how hard they are to dismiss:

- **Over-broad retrieval.** No attacker. Normal question, badly scoped index, internal data in
  the answer. The most realistic failure in this whole list.
- **Policy invention under pressure.** No attacker. A customer pushes, and the agent invents a
  returns window, a warranty, or a refund policy that does not exist. Extremely common, visually
  boring, commercially expensive.
- **Confused deputy on tools.** The agent has an order-lookup or write tool with no
  authorisation check. Ask about "my order" and get someone else's. Rarer, much more serious.
- **Unsafe output rendering.** The agent emits a `javascript:` link or raw HTML that the
  frontend renders. Classic XSS with a new author.
- **Implementation disclosure.** Asked to list its tools, indices, and filters, the agent
  complies. Low direct harm, excellent reconnaissance for everything above.

A note that belongs in the talk: a refusal that holds on the first phrasing is not a refusal
that holds. Three rewordings of the same request routinely produce three different outcomes.
**A guardrail tested once is not a guardrail tested.**
