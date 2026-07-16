---
title: "Week 17 Journal: Marketing Claims Governance Service, Part 2 — The Adversary"
headline: "Week 17 Journal: Marketing Claims Governance Service, Part 2 — The Adversary"
week: 17
date: 2026-07-14
summary: Built a multi-agent adversarial substantiation workflow that pressure-tests marketing claims through parallel evidence gathering and an attack-rebuttal loop, then measured the cost delta between plan-in-context and plan-in-script orchestration.
goal: "build an dynamic workflow that substantiates marketing claims by iteratively gathering and attacking supporting evidence. Then measure the cost."
tags:
  - dynamic-workflows
  - multi-agent
  - claims-governance
  - cost-analysis
  - mcp
keyInsights:
  - "Dynamic workflows must be triggered in a certain way. It's not enough to enable the feature and prompt Claude to use dynamic workflows. To see model-authored orchestration, you need a prompt that describes the goal without specifying how many agents, how many rounds, or what the phases look like. You have to take off the training wheels, withhold the structure, and let Claude decide all of that itself."
  - "The $4.38 API-equivalent cost sits at between 5% and 8% of what the same task would cost on Mechanical Turk rates — and roughly 1–2% of competitive knowledge-worker rates for someone who could actually evaluate FTC substantiation standards."
  - "The entire cost delta between plan-in-context and plan-in-script was due to coordination. Arm A paid 445K tokens to orchestrate what Arm B orchestrated for zero. Moving the plan out of the model's context window eliminated coordination overhead that scaled with the number of rounds."
  - "Dropping the verdict-stability condition and gating on attack-exhaustion alone is the right convergence rule. The defender's verdict oscillates on borderline claims; a separate synthesis step renders the actual final verdict and can override it anyway."
  - "The Claims Desk answers 'is this claim substantiated,' not 'is this company trustworthy' — similar to how SSL certificates validate a website is authentic and secure, but don't validate whether the company itself is trustworthy."
toolsBuilt:
  - Substantiation Adversary (dynamic multi-agent workflow with adversarial loop)
status: published
---

This is the second entry in a [4-part project](https://www.richardthomchick.com/journal/week-16-marketing-claim-governance-service-part-1) to build a claims governance service (aka the "Claims Desk"). For this part, I created a team of agents to fetch claims from the registry and MCP server I set up in Part 1, and substantiate the claims via an adversarial ("deep verification") loop.

## What I Built

This week, I built a dynamic workflow to run against my registry of marketing claims. The job it serves: pressure-testing marketing claims. Input a claim, and it outputs a verdict as to whether the claim can be sufficiently substantiated.

![Substantiation adversary workflow diagram showing parallel evidence-gathering agents feeding into an adversarial loop with convergence guard and final synthesis step](/images/journal/week-17-substantiation-adversary-diagram.png)

Under the hood, sub-agents gather supporting evidence (web search for public claims, supplied evidence documents for fictional ones) in parallel. The claim and its evidence then enter an adversarial loop in which an "adversary" agent attacks the gathered evidence and a "defender" attempts to handle the adversary's attacks. A "convergence guard" decides when attack surface is exhausted and exits the loop. Lastly, the system synthesizes the findings into a verdict with the surviving evidence and the attacks it withstood. Here's a rundown of the agents involved:

| Agent | Model | Purpose |
|---|---|---|
| Claim fetcher | Sonnet | Fetches claim from Claims Desk registry |
| Evidence (3 sub-agents per claim type) | Haiku | Gathers evidence based on claim type |
| Adversary | Opus | Attacks the evidence each round in loop |
| Defender | Haiku | Rebuts the attacks each round in loop |
| Synthesizer | Opus | Renders the final, authoritative verdict |

### Evidence-Gathering Agents

There are 12 evidence-gathering agents. **3 of those 12 are instantiated on any given run**, selected by a lookup on `claim_type` (comparative, compliance, performance, superlative).

| Agent | Claim Type | What It Does |
|---|---|---|
| evidence-benchmark_source | Comparative | Checks whether the cited head-to-head benchmark or comparison source is real |
| evidence-competitor_currency | Comparative | Checks whether the competitor's cited data is current relative to the claim date |
| evidence-comparison_basis | Comparative | Checks whether the comparison methodology is stated and fair |
| evidence-certificate_existence | Compliance | Checks whether the certification actually appears on the relevant official registry |
| evidence-authorization_scope | Compliance | Checks whether the certification covers the specific product and use case named in the claim |
| evidence-authorization_currency | Compliance | Checks whether the certification is still active, not expired or revoked |
| evidence-methodology | Performance | Checks whether study or test exists behind the claim, and whether methodology is disclosed |
| evidence-baseline | Performance | Checks what improvement is being measured, and whether baseline is named and consistent |
| evidence-sample_size | Performance | Checks sample size, population, and presence of control group or statistical significance testing |
| evidence-source_existence | Superlative | Checks whether the named ranking or recognition source actually exists and includes the claimant |
| evidence-recency_and_currency | Superlative | Checks whether ranking is current, per FTC rule that ranking claims require re-substantiation |
| evidence-competitive_landscape | Superlative | Checks whether the category itself is real and independently defined |

I started off with a small experiment running three evidence agents in parallel. To keep things simple, the agents were hardcoded to a single claim type with no connection to the MCP server or registry. The claim itself, *"Standing desks meaningfully reduce back pain compared to sitting desks for office workers,"* wasn't even from my registry. It was a throwaway public claim I picked specifically because it was arguable to ensure the adversarial loop would run more than one round. I ran the workflow twice and made a few observations about the mechanics:

| Data Point | Observation |
|---|---|
| Agents spawned per run | 9 (fixed sequence: 3 evidence agents → adversary/defender loop → 1 synthesis agent) |
| Orchestration structure | Fully specified by the prompt (agent count, round cap, phase sequence); not model-decided |
| Tool access origin | Only spawned agents called tools; the orchestration script itself had no tool access |
| Verdict | Not Substantiated, both runs |
| Adversary activity across rounds | Increased rather than tapered, confirming actual work each round, not idling |
| Total tokens (context volume) | ~360k |
| Hypothetical API-equivalent cost | ~$4.38 per run |

Feeling comfortable with the results, (but wincing a bit at the cost), the next step was to test the MCP connection by validating the registry-read path. I ran a single-subagent workflow whose only job was to call `get_claim_status` on a known claim in the registry. It succeeded on the first try (huzzah!): the subagent inherited the session's MCP tool permissions automatically, no special configuration required, and returned the claim data cleanly.

### The Adversarial Loop: Adversary, Defender, Convergence Guard

The adversarial loop is an exchange between two distinct agents:

- **Adversary agent.** Runs on Opus. Reads the claim's evidence and generates attacks against it, challenging details such as source quality, sample size, and methodology.
- **Defender agent.** Runs on Haiku. Receives those attacks and rebuts them, producing its own running verdict based on how much of the evidence survives.

The loop can last multiple rounds. Each round consists of one adversary turn, followed by one defender turn. Within that turn, the adversary generates as many attacks as it can find, all at once, structured as a list. The exchange is unidirectional: adversary attacks, defender rebuts, round closes. Both are genuinely agentic in a bounded sense; each decides its own reasoning about what to attack or how to rebut, but neither controls the loop's structure or repetition.

That decision belongs to the **convergence guard,** a piece of loop logic that decides whether to spawn the adversary again for another pass or exit the loop. Each round, it checks whether the adversary raised any new critical attacks that weren't already on the table. If the answer is yes, the loop starts over. If no, it stops the loop.

### Synthesizer

The synthesis agent is the final step in the process, and the only agent with access to the complete picture: the original claim, the evidence gathered across all three angles, and the full transcript of every attack and rebuttal across every round. Its job is to render the authoritative verdict (Substantiated, Partially Substantiated, or Not Substantiated) along with a rationale explaining which evidence survived and which attacks proved fatal.

### Final Build and Testing

Time to put all the pieces together. The production build itself was almost anticlimactic in that Claude executed it without much fuss. The test run proved more interesting. I pointed the adversary at a performance claim, "reduces incident resolution time by 40%," that passed all four of the hygiene checks I built into the system. Evidence link present, evidence date present, sample size present, baseline named. On paper, clean.

Final verdict: **Not Substantiated.**

And it was right. The hygiene checks validate that the metadata *fields are filled in*. They don't validate that the evidence is *real*. The adversary actually went and looked: the evidence URL was a fictional domain, the "baseline" was self-reported, and the 40% figure traced back through circular vendor citations to nothing verifiable. Every structured field said "present." The actual evidence said "nothing here." The value-add is easy to see.

The adversary agent was really good. Almost *too* good. Every claim I ran returned a valid verdict of Not Substantiated. To make sure the tool could clear a claim and not just condemn them, I registered one real, independently verifiable claim: Salesforce Government Cloud Plus, FedRAMP authorized at the High impact level.

The verdict: **Substantiated,** in a single round. The end-to-end workflow found the authorization on the primary-source registry, confirmed it was still active, threw five attacks at it that all bounced off, and stopped because it had nothing left. It even correctly handled a genuine currency gap (the annual re-assessments aren't public) by finding the OMB A-130 policy stating that FedRAMP authorizations don't have a fixed expiry. That's a level of performance far beyond "certificate exists, done."

## What I Learned

This week's work gave me valuable hands-on experience with dynamic workflows. For starters, I learned that dynamic workflows must be triggered in a certain way. It's not enough to enable the feature and prompt Claude to use dynamic workflows. If you hand Claude the blueprint, the model will simply transcribe, not design. To see model-authored orchestration, you need a prompt that describes the goal ("adversarially substantiate this claim") without specifying how many agents, how many rounds, or what the phases looked like. You have to take off the training wheels, withhold the structure, and let Claude decide all of that itself. Which takes a lot of trust!

### Cost Savings vs. Human Labor

That said, I spent much more time analyzing the cost structure than the workflow structure. I experienced a bit of sticker shock I saw that my initial trial run used >500k tokens and cost about **$4.38**. The price seems exorbitant, until I compared it to the cost of human labor.

On Mechanical Turk, the same experiment might cost $55-85 USD. That puts the $4.38 API-equivalent at between 5% and 8% of what human labor would cost for the same task, on Mechanical Turk rates, which are well below market rate for this kind of analytical work. At competitive knowledge-worker rates ($50-100/hour for someone who could actually evaluate FTC substantiation standards or methodological validity), the same task could run $200-400, making the AI version roughly 1-2% of the cost.

I'm not a proponent of layoffs, and there is a major caveat. I imagine many enterprises have done similar analyses on many job functions over the past 6-12 months. The real question is, can AI agents reliably do the work at scale? The verdict is still out on this one. As adept as my adversary agent was, the Claims Desk could put organizations in hot water if it produces a false positive that results in legal exposure. That's the risk with full autonomy. No human in the loop.

### Cost Savings vs. Static/Fixed Workflows

I also ran a head-to-head comparison of a fixed multi-agent chain vs. a dynamic workflow, and measured the cost per completed task. The setup: two "arms" running the identical adversarial procedure against the same claim, same models, and same convergence rule. The only thing that differs is *where the plan lives*.

- **Arm A, plan-in-context.** I orchestrate turn by turn, as I did in [Week 7](https://www.richardthomchick.com/journal/week-07-agentic-rag-mcp). Every evidence result, every attack, every rebuttal gets read back into the main context window.
- **Arm B, plan-in-script.** Claude writes the orchestration as JavaScript. Intermediate results live in script variables. Only the verdict returns.

Both arms did nearly identical work and produced the same verdict. But the dynamic workflow actually appeared to be faster and far less expensive than the fixed chain.

| Metric | Arm A (plan-in-context) | Arm B (plan-in-script) |
|---|---|---|
| Work tokens (subagents) | ~300K | ~305K |
| Coordination tokens | ~445K | 0 |
| Grand total | ~745K | ~322K |
| Relative cost | 2.3x | 1x |
| Wall-clock | 7 min 30s | 5m 47s |

**The entire cost delta was due to coordination.** Arm A paid 445K tokens to orchestrate what Arm B orchestrated for zero. The plan-in-context version of the same task cost 2.3x the plan-in-script version at single-claim scale. Whether this generalizes to other multi-agent workflows, or holds at different round counts, wasn't tested. But it provided me with direct visual proof of Anthropic's "no orchestration-token tax" claim. The tax isn't in the machinery; it's in the growing context window. Moving the orchestration plan out of the model's context window eliminated coordination overhead that scaled with the number of rounds.

## Challenges

### Exiting the Adversarial Loop

While the Synthesizer agent renders a final verdict, the original design also incorporated a verdict rendered by the Defender agent indicating whether they defended the evidence fully partially, or not at all. This decision turned out to be problematic and costly in borderline cases.

The adversarial loop is supposed to stop when the adversary ran out of new attacks *and* the verdict stopped changing. The problem: when I tested a borderline claims, the defender's verdict oscillated each round, so the "verdict stopped changing" condition never held. The loop ran to its cap, burning a full extra round (~66K tokens) that produced no new information.

The fix: dropping the verdict-stability condition and gating on attack-exhaustion alone. The defender's verdict is actually noise, since a separate synthesis step renders the actual final verdict and can override the defender anyway, so the loop's only real job is to know when the adversary is out of ammunition, not to track whether an intermediate label stopped moving.

### Managing Attack Scope

One scope decision I had to actually think about: should the adversary be allowed to attack the *claimant's* credibility, or only the *claim's* evidence? During testing, the adversary tried to bring in reputational context about the company behind a claim. Apparently there is a real company called Kalder and their CEO recently pled guilty to securities fraud charges. Yikes.

![Screenshot showing the adversary agent surfacing a real Kalder CEO securities fraud case when searching for evidence against a fictional Kalder claim](/images/journal/week-17-adversary-attack-scope-example.png)

To be fair, this was impressive sleuthing. I will likely use a different name in the future. But it went far beyond the scope of the system's job. The Claims Desk answers "is this claim substantiated," not "is this company trustworthy," similar to how SSL certificates validate that a website is authentic and secure, but does not validate whether the company itself is trustworthy.

### Working with Synthetic Data

For demo purposes, I invented an imaginary B2B software company called "Kalder" to use across my projects, similar to how Adobe uses "WKND" in their demos and training. Testing an AI tools against synthetic data and a fictional company surfaced a fundamental tension: the information is invented, but the agents are searching for real evidence. In the case of my Claims Desk, the adversary agent doesn't know Kalder is fictional, so it searches for a real website.

This became a concrete problem when the adversary's web search for "Kalder" surfaced a real, unrelated fintech company sharing the name, and briefly treated that company's public record as relevant to the claim under review. This name-collision artifact is exactly the kind Adobe's WKND demo universe would run into when a live agent goes looking for it.

The real-world Salesforce FedRAMP run solved this cleanly, but only by stepping outside the synthetic universe entirely, which isn't always an option. The more durable fix, and a genuine open design question for the Claims Desk, is whether a synthetic validation authority, a fake but genuinely fetchable registry that lists Kalder claims as authorized or expired or revoked on demand, could close the loop and let the adversary evaluate synthetic evidence on its merits rather than returning a verdict of absence every time.

## Next Up: Part 3 — Claims Review Agent

Next week, I'll be adding a Claims Review Agent: it takes a verdict as input and issues an official organizational ruling: Approved for Use, Rejected, or Approved With Conditions. While the adversary I built this week answers, "is this evidence sufficient?", the review agent answers "given that finding, what does the organization do with this claim?" Under the hood, I'll try out a new feature called Dreaming (currently available as a limited research preview), a cross-session memory primitive for Managed Agents.

---

*Week 17 complete. I now have a working example of dynamic workflows, and a better understanding of the underlying cost dynamics.*
