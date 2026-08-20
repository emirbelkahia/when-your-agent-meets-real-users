# The pre-launch checklist

The questions to answer before real customers reach your agent. Framing that makes it useful:
these are the questions a team typically cannot answer in week one. Not being able to answer one
is the finding.

---

## 1. Scoping — what the agent can and cannot do

- [ ] **Write the list of people and systems that can put text into the agent's context.**
      Merchandisers, PIM syncs, supplier feeds, marketplace sellers, customer reviews, crawled
      pages, help-centre authors, agencies. That list is your threat model. Most teams have
      never written it down, and it is longer than they expect.
- [ ] **The agent is read-only at launch**, unless there is an authenticated, confirmed flow
      built for the exception. "Read-only" includes the language it uses: an agent that says it
      added something to the basket has performed a write in the customer's mind.
- [ ] **Every tool the agent holds has an authorisation check that does not come from the
      conversation.** If asking about "my order" is enough to fetch an order, identity is being
      inferred from text.
- [ ] **Rate limits and cost ceilings per session and per IP.** An agent with an LLM behind it is
      a billable endpoint pointed at the public internet.
- [ ] **Write down what the agent can and cannot do, and put it in the prompt explicitly.** An
      agent with no stated boundary invents one. "I have added it to your cart" needs no attacker
      and no injected content — it is a capability the model assumed it had.
- [ ] **Keep enriching that list from real conversations.** Your analytics already hold it: every
      request the agent could not serve is a line you are missing, and every claimed action is a
      boundary you failed to state.
- [ ] **Version the prompt like code.** Reviewed, with a history, and every capability line in it
      traceable to something you observed. It is the part of the system most likely to change under
      you, and usually the only part with no version history at all. Treat prompt changes the way
      you treat schema changes.
- [ ] **Write down what the agent is explicitly not for**, and give it somewhere to send those
      requests.

## 2. Grounding — the data it is allowed to see

- [ ] **"Public" and "safe for the agent" are different sets. Maintain both.** Text a shopper
      should see is not automatically text an agent should be fed — a third-party seller's own
      listing copy is public, and it is also an outsider writing into your prompt. Show it on
      the page; keep it out of the retrieval scope.
- [ ] **For every attribute, one question: does the agent need this to answer?** If not, it never
      enters the context. Cost, margin, merchandising notes, contract references, internal
      owners, supplier terms — none of it belongs in a customer-facing retrieval scope.
- [ ] **Narrow the retrieval scope explicitly** rather than inheriting the storefront's index
      configuration. An index built for keyword search optimises for different things than an
      agent does, and inheriting it is the default path to over-exposure.
- [ ] **Treat retrieved content as untrusted input.** Same posture as a form field. It arrives in
      the same context window as the instructions, in the same format, and the model cannot tell
      them apart.
- [ ] **Mandatory filters live outside the model.** Not "please only show in-stock items" in the
      prompt — a hard filter the model cannot negotiate away.
- [ ] **Never accept seller or supplier copy as-is into the agent's retrieval scope.** Anyone who
      can write a listing can write to your prompt. Review it, normalise it into structured
      attributes you control, or keep it in a field the agent never reads — the storefront can
      still show it to humans.
- [ ] **Telling the agent not to trust a field is weaker than not giving it the field.** Both are
      worth doing and only one is a guarantee: a prompt instruction is evaluated by a model, every
      request, about data that is still in the context. Absence is a property of the system.
- [ ] **Decide what happens to third-party and user-generated text** before it is indexed:
      reviewed, stripped, sandboxed into an attribute the agent never retrieves, or accepted as
      untrusted with the consequences understood.
- [ ] **Only what survives the scoping decision is worth writing a guardrail for.** The ordering
      is the point.

## 3. Refusal and escalation — how it says no

- [ ] **An explicit refusal, not a generic error.** A customer reads an error as an outage and
      comes back; they read a stated limit as a limit and go to the right place.
- [ ] **Every refusal has a destination.** Name the official source, or hand off to a human.
- [ ] **Policy questions answer from an approved source or not at all.** Returns windows,
      warranties, delivery terms, price matching. This is the category that invents most
      confidently, because plausible text is easy and the truth is a lookup.
- [ ] **Guardrails have a category, a scope, and a fallback response** — and the fallback is
      written by someone who cares how it reads.
- [ ] **Know whether your guardrails fail open or fail closed, and choose it on purpose.** The
      default in Agent Studio is fail-open: if the classification model times out or gets rate
      limited, content passes through unblocked. `required: true` returns a 503 instead. Either
      is defensible; inheriting the choice is not.
- [ ] **Your client has to honour the violation event.** An output guardrail classifies the
      finished response, so the text is already on the wire when the verdict arrives. If your
      integration does not discard the streamed content and show the fallback, the customer
      reads the answer the guardrail rejected.
- [ ] **Keep the category count under eight.** Past that, classification accuracy drops —
      consolidate rather than adding.
- [ ] **An agent that claims an action it cannot perform needs its own fix.** Narrowing what it
      can read does nothing about what it says it did. "I have added it to your basket" survives
      every data-scoping change you make.
- [ ] **Output is treated as untrusted too.** Link schemes on an allowlist, no raw HTML, no
      `javascript:` URLs reaching the renderer.
- [ ] **Test every refusal in at least three phrasings.** A refusal that holds on the first
      wording is not a refusal that holds. Reworded requests routinely produce different
      outcomes, and the third one is often the one that lands.

## 4. Continuous evaluation — after it is live

- [ ] **The attacks you know about are test cases, not anecdotes.** Anything that once worked
      goes into a regression suite that runs on every change.
- [ ] **Changing the model invalidates your red-team report.** So does a new tool, a new index,
      a rewritten prompt. Evals are a regression suite, not a launch gate.
- [ ] **Read the refusals and the blocked conversations.** Weekly at launch, monthly after. This
      is where you find out what the agent cannot do that customers keep asking for — the most
      valuable dataset the agent produces, and the one nobody looks at.
- [ ] **Know what a bad week looks like before you have one.** Alert on refusal-rate spikes,
      guardrail trigger volume, cost per conversation, and repeated near-identical sessions.
- [ ] **Model choice is a lever with a price.** A stronger model is measurably harder to talk
      into following instructions it found in retrieved content. It also costs more and adds
      latency. Price the trade-off rather than defaulting on cost alone.

---

## The one-line version

The public judges your agent on its worst answer.

A guardrail lowers a probability. Removing the data eliminates the class. Do both, in that
order, and know which one is the guarantee.
