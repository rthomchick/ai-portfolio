---
title: "Week 16 Journal: Marketing Claim Governance Service, Part 1 — Claim Registry and MCP Server"
headline: "Week 16 Journal: Marketing Claim Governance Service, Part 1 — Claim Registry and MCP Server"
week: 16
date: 2026-06-15
summary: Built the capability surface for Claims Desk — a 4-tool MCP server, Supabase-backed registry seeded with 12 test claims, and two Agent Skills, verified end-to-end across Claude Code and claude.ai.
goal: Establish foundation for an AI-native "Claims Desk" service that ensures compliance and reduces risk by checking marketing claims against a database registry of substantiated facts.
tags:
  - mcp
  - agent-skills
  - supabase
  - railway
  - python
  - claim-governance
  - llm
keyInsights:
  - "The ADR format is simple and straightforward, but a light bulb moment for me nonetheless, and a documentation practice I'll carry forward in every subsequent project."
  - "Before this week I understood MCP conceptually; now I've implemented the actual tool-registration pattern, chosen a transport, and shipped it to a public host — I now know what the SDK actually asks of you versus what the docs describe in the abstract."
  - "I hadn't built anything against the Agent Skills primitive before this week; now I have a working mental model for when something belongs in a skill vs. a tool."
  - "Designing a test specifically to prove shared state, and having a fallback plan for a known platform quirk, is a level-up for me."
  - "Question confidently stated LLM output — or at the very least, compare the outputs across multiple LLMs."
toolsBuilt:
  - Claims Desk MCP Server (4 tools, Railway deployment)
  - Claims Registry (Supabase, 3-table schema, 12 seed claims)
  - claim-review Agent Skill
  - claim-taxonomy Agent Skill
status: published
---

Every company makes claims. "40% faster deployment." "#1 rated on G2." "SOC 2 Type II certified." And every claim carries risk: legal exposure, analyst pushback, procurement scrutiny, the FTC. All too often, this is governed via spreadsheets and helter-skelter email threads between marketing and legal.

My latest learning project, the **Claims Desk** (aka "Marketing Claim Governance Service"), makes it a service instead: a registry of claims with substantiation status, evidence links, expiry dates, and risk classification, callable by any agent that drafts, reviews, or publishes marketing content. This is a four-part build with one shared registry and four different consumers:

- **Part 1 (this entry): Capability surface.** An MCP server exposing four tools, two Agent Skills, a Supabase-backed registry, seeded with claims built to test both success and failure.
- **Part 2: Substantiation Adversary.** Dynamic workflows with parallel evidence-gathering agents and an adversarial attacker, tested against every seed claim.
- **Part 3: Claims Review Agent.** Deployed on Managed Agents, with cross-session memory and an Outcomes rubric, reaching the same registry remotely over HTTPS.
- **Part 4: Product page and eval harness.** An agent-readable product page with manifest links to the registry, and a standalone false-premise evaluation harness in its own repo.

![Claims Desk full architecture diagram showing the four-part build with shared registry](/images/journal/week-16-claims-desk-full-architecture.svg)

## What I Built

This week (Week 16), I built the capability surface: 2 agent skills, 4 MCP tools, 12 test ("seed") claims, and a claims registry hosted on Supabase. I also tested calls to the Claims Desk from Claude Code and the Claude AI chat interface. In Week 18, I'll add Managed Agents to the mix and test server-side, autonomous agent runs with no human in the loop per call.

![Capability surface diagram showing MCP tools and Agent Skills with their connections](/images/journal/week-16-capability-surface-diagram.svg)

### Architectural Decisions

I got a little stressed out when I discovered that the latest MCP release candidate spec (`2026-07-28`) was nearing finalization around the same time I needed to build against it. I decided to learn the spec as it lands and reviewed Release Candidate (RC) documentation about MCP's new stateless core (no session handshake, every tool call self-contained), the Agent Skills three-tier progressive disclosure model, and about how Managed Agents reaches a remote MCP server.

That reading led me to five major architectural decisions, which I captured as an ADR (architectural decision record):

1. **Persistence: Supabase** (leveraging a "pooler-connection" pattern I developed several weeks ago).
2. **Hosting: Railway** (on `psycopg2-binary`, not the Supabase REST client).
3. **SDK version: MCP Python SDK v1.x stable** (not the RC-supporting v2 beta — the stateless-core advantage turned out not to matter once I chose Supabase for persistence).
4. **Taxonomy: four claim types** (Performance, Comparative, Compliance, Superlative), all grounded in the FTC (Federal Trade Commission) "reasonable basis" doctrine of 1984.
5. **The MCP/Skills split**: 3 of 4 tools landed on MCP (see capability assignment table below for details and assignment rationale).

**Capability-by-capability assignment**

| Capability | Assigned To | Rationale |
|---|---|---|
| `append_claim` — add a claim to the registry | MCP | Write to persistent state. Not contestable under the framework. |
| `get_claim_status` — read a claim's substantiation state | MCP | Read of persistent state. Not contestable under the framework. |
| `check_substantiation` — evaluate evidence against a claim's standard | MCP (thin + deterministic hygiene checks) | Data hygiene, not judgment. Follows logic/LLM split pattern established in Weeks 8-11. |
| `classify_claim_risk` — assign a risk class to a claim | MCP | Three different callers must all agree on what "high risk" means |
| How to conduct a claim review (procedural) | Skills | Judgment and sequencing knowledge, not an action with a side effect. |
| Claim-type taxonomy with evidence standards (reference) | Skills | What an agent needs to know, not something it does. |

### Build and Deployment

With these decisions in hand, the next step was to build and deploy the capability surface: the MCP server with its 4 tools, a 3-table Supabase schema, 12 seed claims spanning all 4 claim types, a live Railway deployment, and the two Agent Skills, all verified end to end.

**The server and registry.** Built against MCP Python SDK v1.x stable, with a Supabase schema (`claims`, `evidence_links`, `review_rulings`) in its own isolated project. Seeded twelve claims across Performance, Comparative, Compliance, and Superlative types — ten with real evidence, two deliberately unsubstantiated (a fabricated compliance claim, an unsourced superlative) to give next week's adversary something concrete to attack. Ran `classify_claim_risk` against all twelve: both intentionally-weak claims correctly classified `prohibited`, everything else `low`.

**Deployment.** Shipped to Railway on stateless Streamable HTTP, reachable over a public HTTPS domain. MCP Inspector confirmed all four tools live and correctly schema'd, independent of either Claude client.

**Cross-client verification.** Appended a test claim from Claude Code, read it back correctly from claude.ai web on the first try — genuine proof that both clients share the same live registry, not local or cached state. There's a known, documented bug where claude.ai shows a connector as "Connected" without ever actually calling its tools; I'd built the plan with Claude Desktop as an explicit fallback in case I hit it. Didn't need it.

**The two agent skills.** Authored `claim-review` (procedural: retrieve → check substantiation → hygiene check first → judge claim strength → decide or escalate) and `claim-taxonomy` (reference: the four claim types and their evidence standards), each pointing to the other rather than duplicating content. Verified progressive disclosure with a real five-step test, not an assertion: both skills confirmed inert on an unrelated query, then correctly activated on claim-review and claim-taxonomy queries respectively, with the review skill catching a claim's missing evidence and rejecting it before reaching for judgment it had no basis for.

#### Seed Claims for Testing

> **Note:** The term "Kalder" refers to an imaginary organization created for demo purposes.

| Claim ID | Product | Claim Type | Risk Class |
|---|---|---|---|
| 1 | Kalder Resolve | Performance | Low |
| 2 | Kalder Observe | Performance | Low |
| 3 | Kalder Agents | Performance | Low |
| 4 | Kalder Resolve | Comparative | Low |
| 5 | Kalder Defend | Comparative | Low |
| 6 | Kalder Predict | Comparative | Low |
| 7 | Kalder Govern | Compliance | Low |
| 8 | Kalder Asset | Compliance | Low |
| 9 | Kalder Vendor | Compliance | Prohibited |
| 10 | Kalder Observe | Superlative | Low |
| 11 | Kalder Insight | Superlative | Prohibited |
| 12 | Kalder Agents | Superlative | Low |

## What I Learned

### All About ADRs (Architectural Decision Records)

As someone who cares deeply about architecture, I considered ADRs to be a major blind spot. I've maintained several decision logs, but I didn't have a lot of exposure to ADRs specifically (in part because the tech leads I worked with were not in the habit of authoring or maintaining them). The ADR format is simple and straightforward, but a light bulb moment for me nonetheless, and a documentation practice I'll carry forward in every subsequent project.

### Building and Deploying an MCP Server

Before this week I understood MCP conceptually; now I've implemented the actual tool-registration pattern, chosen a transport (stateless Streamable HTTP), and shipped it to a public host. That's a different kind of knowledge than reading the spec — I now know what the SDK actually asks of you versus what the docs describe in the abstract.

### Authoring Agent Skills

I've authored agents and tools, but not skills. I hadn't built anything against this primitive before this week; now I have a working mental model for when something belongs in a skill vs. a tool. This project also gave me experience with two different types of agents (procedural vs. reference), each respecting the progressive-disclosure model rather than just declaring it.

### Verifying Cross-Client Behavior

Appending state from one Claude surface and reading it back from another isn't something I'd had reason to test before. Most of what I've built has had a single consuming client. Designing a test specifically to prove shared state, and having a fallback plan for a known platform quirk, is a level-up for me.

## Challenges

### A Regulatory Rabbit Hole, and a Correction

Building the claim taxonomy meant grounding it in something real, not invented evidence standards. FTC substantiation doctrine was the obvious anchor. The 1984 Policy Statement is still current, and its "reasonable basis" standard scales with how strongly a claim is worded, which turned out to be a genuinely useful design principle (a claim that says "tests prove" needs a different evidence tier than the same fact phrased as "up to X%").

Given the nature of my invented B2B software vendor, Kalder, I wondered if I should account for EU regulations, which I hypothesized might be stricter than the FTC doctrine. I chased that thread for a while in Claude before switching to Perplexity to get more grounded information. At the end of the day, I decided to descope international regulations regarding marketing claims, but the exercise was a reminder to question confidently stated LLM output (or at the very least, to compare the outputs across multiple LLMs).

### Suspected Prompt Injections

Somewhere in the middle of the build sequence, Claude Code flagged a potential prompt injection: a `git status` tool result came back with a fake `<system-reminder>` block appended to it, instructing the agent not to mention a (false) date change to me. This pattern appeared once in Claude Code's own transcript, and once reported secondhand by a sub-agent. Thankfully, it was correctly refused in both cases rather than acted on. Still spooky.

I spent real time chasing this down: checking the rest of the session for repeats (none), listing every MCP server in the toolchain and ruling them out as the carrier, checking for git hooks (clean). I still don't really know what happened. It's either some legitimate harness mechanism I don't have visibility into, or something else. I reported it to Anthropic and proceeded with the build after ensuring all my "Claudes" (desktop app, Code extension, CLI tool) were up to date.

## Final Thoughts

The capability surface I built this week has a lot of moving parts: four tools with a tested, defensible split between action and judgment, a registry seeded with claims built to fail in specific, useful ways, and two Skills that load only when they're needed. Ironically, all these parts didn't result in anything flashy. However, I did get momentary goosebumps when I successfully connected my custom Claims Desk to Claude.

![Screenshot of Claims Desk connected to Claude showing the MCP tools available in the interface](/images/journal/week-16-claims-desk-connected-to-claude.png)

The prompt injection incident was troubling. This is the second time in a month I've encountered it. Last week, it appeared in the Claude for Mac desktop app; this week, the Claude Code extension for Visual Studio Code. In most/all cases, I was copy-pasting inputs and outputs from one Claude session to another. The alleged injections were not something I could detect without Claude's own guardrails flagging the issue for me. Assuming it's not a false positive, the question is: where's the vulnerability? Claude? VS Code? Mac OS? The paradigmatic shift in attack vectors (prompt injection, hijacking, data poisoning, etc.) is at least as significant as the advent of virtual machines, containers, and cloud computing, if not more so.

Next up: Week 17 puts this registry under real pressure with a Substantiation Adversary that gets to challenge every claim I seeded, including the two built specifically to lose.

---

*Week 16 complete. The registry has a front door, a rulebook … and a security incident report.*
