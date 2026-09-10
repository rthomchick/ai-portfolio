---
title: "Week 18 Journal: Marketing Claim Governance Service, Part 3 — The Claims Review Agent"
headline: "Week 18 Journal: Marketing Claim Governance Service, Part 3 — The Claims Review Agent"
week: 18
date: 2026-07-21
summary: Tested whether a Managed Agent with cross-session Memory produces more consistent claim rulings than a fresh-context agent, fixed several validity bugs in the process, and found the hypothesis refuted.
goal: "Test the case for using Managed Agents by running an experiment to see whether an agent with cross-session Memory produces more consistent verdicts than a fresh-context agent."
tags:
  - managed-agents
  - memory
  - claims-governance
  - mcp
  - ab-testing
keyInsights:
  - "A platform boundary described as 'isolated' actually only isolated reasoning, not tool access — several decisions made earlier in the week turned out to be the same fix, applied at different points."
  - "Memory did not change whether the agent's two rulings agreed: without memory, substantiated then partially; with memory, substantiated then partially — identical disagreement in both arms, citing an identical evidence standard."
  - "Requiring the agent to say which of missing, empty, or never-looked it had actually seen turned a dead end into a diagnosis, after earlier attempts had failed with the same eight words every time."
  - "An agent that agreed with itself on the sibling claim would have been anchoring, which the hypothesis itself names as the failure mode — instead it read a substantiated prior, ruled partially, and stated why."
  - "Memory works across sessions but did not improve consistency; the hypothesis is refuted on its stated threshold, though the threshold itself was wrong for the pair it was tested on."
toolsBuilt:
  - Claims Review Agent (Managed Agent with cross-session Memory, Outcomes grading, and a per-run trace log)
status: published
---

## Motivation

So far, I've built the [MCP server](https://www.richardthomchick.com/journal/week-16-marketing-claim-governance-service-part-1) with a registry of claims and a [multi-agent loop](https://www.richardthomchick.com/journal/week-17-substantiation-adversary) to substantiate each claim. This week, I tested whether an agent with cross-session Memory produces more consistent verdicts than a fresh-context agent. My hope was that I could build the rest of the Claims Desk arc on Managed Agents' Memory primitive rather than hand-rolled session state.

## Hypothesis

#### An agent with cross-session Memory produces more consistent rulings on repeat or similar claim types than an agent with no memory (fresh context each session)

*Threshold: Across 2+ sessions reviewing similar claim types, the memory-equipped agent's rulings must agree with each other (same verdict, same cited evidence standard) more often than a no-memory control run on the same claims.*

*Falsifies if: No measurable difference in consistency, or memory-equipped is worse (anchors on a stale prior ruling instead of evaluating fresh).*

*Level of test: A/B design, memory on vs. off, same claim set. This isolates the variable that matters rather than conflating it with claim difficulty or model variance.*

## Methodology

#### Setup

Anthropic Managed Agents (`managed-agents-2026-04-01`), Claude Sonnet, Outcomes (`user.define_outcome`, `max_iterations: 3`), Memory. Claims Desk MCP server on Railway (six tools after Day 1). SDK `anthropic==1.1.0`; `mcp<2` pinned Day 4. Supabase registry, pooler port 6543.

#### Test design

The original design was a 14-run batch: seven claims, each reviewed twice. That batch could not test the hypothesis. Every memory-enabled run found nothing to recall, for reasons covered in Findings. The test that actually ran is four runs on a purpose-built pair of claims sharing a product and a claim type, so the second review has something from the first to find. Control arm first, then the memory arm in fixed order.

**Held constant:** Rubric text, the six MCP tools, the ruling format, the iteration cap, the claim set, and everything in the agent's instructions outside the memory-specific block.

**What varies:** Memory presence or absence. **Known residual asymmetry:** the memory arm receives an extra instruction message the control arm does not. See the last decision below.

## Key Decisions

#### Use a deterministic pre-gate to catch prohibited tool calls

The launcher inspects the tool-call history; any call to `append_claim`, `delete_claim`, or `classify_claim_risk` fails the run before grading.

*Why: The grader had already passed a ruling whose own explanation admitted a rule violation. A rubric criterion would inherit that unreliability; whether a tool was called is binary.*

*Tradeoff: Catches only three named tools; an unforeseen workaround passes.*

*Why safe: Fails closed; unit-testable without a live session.*

#### Remove the agent's Memory write access

Access is set to `read_only`. The launcher writes after `status_idle`, only when grading returns `satisfied`.

*Why: The same failure had now happened in two places, an explicit written instruction ignored with nothing structural preventing it. The pre-gate covered registry writes; the Memory channel had only the instruction, and broke the same way.*

*Tradeoff: Removes the agent's judgment about what is worth remembering, which Day 1's mapping named as the genuinely new capability over the session-state manager. The hypothesis narrows from "does an agent managing its own memory improve consistency" to "does recall of a prior ruling improve consistency." A real scope reduction, accepted because an untestable broad question is worth less than a testable narrow one.*

*Why safe: Additive and reversible.*

#### Use a single persistent Memory store, identified by stable ID

The `CLAIMS_REVIEW_MEMORY_STORE_ID` goes in `.env`; missing or unresolvable raises and exits non-zero with no fallback-create.

*Why: A new store was being created on every run, which made recall structurally impossible. Addressed by ID rather than name because the seven stores from the failed batch share one name, and any rule for picking among duplicates is a silent failure waiting to happen.*

*Tradeoff: Shared mutable state; a bad write is now durable and cross-contaminating.*

*Why safe: Starts empty; the earlier rulings deliberately not migrated (written while the agent still had write permission, one of them after a failed grading). Failing loudly means a stopped run rather than silent reversion to isolation.*

#### Persist a per-run trace

Every run writes `runs/{timestamp}-{claim_slug}-{variant}.log` with session and agent ids, the ordered tool-call trace with arguments, the full `files.list` response, messages, the ruling, grading, the Memory write decision, and any exception with traceback. Incremental with flush.

*Why: One anomaly is permanently unexplainable because nothing survived the process. The tool-call events existed and were discarded; the session id existed and was never printed; both output files existed with no handle to fetch them; the agent's own messages arrived in the stream and were never read.*

*Tradeoff: Logs accumulate with no rotation or size bound and contain full ruling text plus tool arguments. Harmless against a synthetic registry, wrong against a real one, and this decision establishes no discipline for that. Incremental writes also mean a logging failure could affect a run that would otherwise succeed.*

*Why safe: Additive, observational; a logging defect can lose a trace but cannot corrupt a ruling.*

#### Name the claim under review in the injected message

The injected message carries the target claim alongside the memory path, instructs the agent to take no action until the outcome definition arrives, and states the single expected output path.

*Why: The run log showed the agent listing the registry, picking a claim itself, and writing a complete ruling on the wrong one before the target was named. Its own disclaimer: "produced earlier in the session before the target claim was specified." Given an instruction to review claims and no claim, it picked one, which is reasonable under the constraint rather than a targeting defect. This is a side effect of the earlier decision to inject the memory path: the injected message is a turn the agent acts on.*

*Tradeoff: Claim identity now lives in two places with nothing enforcing agreement; divergence would mean an agent reviewing one claim while graded against another. Both derive from the same argument, which is a convention rather than a constraint.*

*Known arm asymmetry, flagged not fixed: the control arm receives no injected message, so it never had the early-action gap. Both arms now share the property that the agent knows its target before acting, reached by different routes. But the memory arm gets an extra turn with additional framing, so a consistency difference cannot be cleanly attributed to memory alone. Belongs in Limitations.*

*Why safe: Additive; failure surfaces as the agent still starting early, which the run log records.*

## Results and Findings

The test was simple in theory: review the same two claims twice, once with the agent able to read its own prior rulings and once without, then see whether memory made its two judgments agree more often. But the first attempt produced nothing usable. Every memory-enabled run reported finding no prior ruling. Every run got a brand new memory store. Nothing could read what anything else wrote. With a bit of work, I fixed it, then the test ran. The results were identical. Hypothesis refuted.

| Claim | Without memory | With memory |
|---|---|---|
| SOC 2 certification claim | substantiated | substantiated |
| Sibling claim, narrower evidence scope | partially | partially |

#### The agent found its own prior ruling and quoted it back

Reviewing a real FedRAMP compliance claim from Salesforce with memory turned on, the agent located the file, named its exact path, and quoted the earlier ruling verbatim. The grader checked the quote against the stored file independently and confirmed it matched. The review passed on the first attempt, and the new ruling replaced the old one in place.

*Lesson: earlier attempts had failed with the same eight words every time, whether the file was missing, the folder was empty, or the agent simply never looked. Requiring it to say which of the three it had actually seen turned a dead end into a diagnosis.*

#### Memory did not change whether the agent's two rulings agreed

*Evidence: Without memory: substantiated, then partially. With memory: substantiated, then partially. Identical disagreement in both arms, citing an identical evidence standard. Four runs, all passing on the first attempt.*

#### On one pair, agreement could not distinguish success from failure

*Evidence: The second claim was written so its correct verdict differs from the first; narrower evidence, broader assertion. An agent that agreed with itself here would be anchoring, which the hypothesis itself names as the failure mode. Reading a substantiated prior, the agent ruled partially and stated why, exactly as the rubric requires. A correct outcome, scored as nothing.*

## What Broke

#### The agent violated a rule, concealed it, and the grader passed it anyway

*Class: validity · Severity: existential · Resolution: fixed*

Two independent bugs produced this. The grading pass reported having no filesystem read access, so the grader's tools were not reliably matching the writer's. Separately, no rubric criterion checks *how* a ruling was produced, only what it says. The fix covers three named tools, so the residual scope stays open.

#### The grader had its own tool access and graded a stale registry row while returning a pass

*Class: validity · Severity: existential · Resolution: fixed*

The agent, with no way to output its ruling, had written it into the claims registry as a fabricated claim. A guardrail was added and the run repeated. The grader passed it again, this time grading a different leftover row from an earlier debugging session. The cause is design: the grader runs with the same tools as the writer. "Isolated" means isolated reasoning, and no setting restricts it.

#### A single session, given a single claim, produced rulings for two claims

*Class: validity · Severity: existential · Resolution: fixed*

The agent started with no target. The message it received first carried only the memory path; the claim arrived afterward. Told to review claims with none named, it listed the registry, picked one, and ruled on it. Its own note on the stray file read: "produced earlier in the session before the target claim was specified." The control arm was clean because it receives no such message. The first occurrence can never be reconstructed, for the reason below.

#### Nothing survives a run, so there is no way to tell what a session did

*Class: validity · Severity: existential · Resolution: open*

Tool-call events were collected for a safety check and then discarded. The session ID was never printed, so there was no handle to query server-side history. The server keeps no request log, and claim records carry no attribution field. This was graded minor until a run produced behavior nobody predicted, and the gap turned out to be the entire reason it could not be investigated.

#### The agent wrote to memory after failing its grading

*Class: validity · Severity: blocker · Resolution: fixed*

Six runs passed, so six should have written to memory. But there were seven. The extra one failed its grading and wrote anyway. The rule said don't, but nothing enforced it.

## Interpretation

Two of the week's findings turned out to share one root cause: a platform boundary described as "isolated" actually only isolated reasoning, not tool access. Once that was understood, several decisions made earlier in the week were all really the same fix, applied at different points.

Two more findings are a smaller version of the same underlying failure, at different severities: the grader accepted something merely adjacent to the real signal as if it were the real thing. On the other hand, under real pressure from repeated iterations, the agent's failure mode was escalation, not making things up. That's a positive result, but it also shows that even good agent behavior can still be undermined by the grading layer around it.

## Limitations

The refutation rests on one claim pair, one run per arm, one claim type, and the memory arm got an extra instruction the control arm did not. Nothing here is a rate. Three to five runs per arm would be needed to make it one.

Technically, Anthropic's documented claim held: the agent carried context across sessions, confirmed directly. The consistency benefit did not appear, but in fairness, the documentation never promised it.

Last but not least: the preponderance of synthetic data. Of thirteen original claims, one is real: Salesforce's FedRAMP compliance. I leaned on it heavily, because it was the only claim where evidence could actually be found and weighed rather than simply be absent.

## Verdict

**Iterate.** The hypothesis is refuted on its stated threshold and the threshold was wrong for the pair it was tested on. Memory does what Anthropic says it does; whether that helps with this particular use case is still open. Next week's retest will decide it. If the answer is no, the approach ends.

---

*Memory works across sessions but did not improve consistency. Week 19 will retest under a different metric.*
