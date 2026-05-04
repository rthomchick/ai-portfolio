---
title: "Week 10 Journal: Responsible AI"
headline: "Week 10 Journal: Responsible AI"
week: 10
date: 2026-03-03
summary: "Built nine responsible AI modules — cost guardrails, grounding checks, content safety, bias detection, audit trails, and prompt governance — that turn the SAFe Feature Spec System from a working pipeline into one that can be interrogated and trusted in production."
tags:
  - responsible-ai
  - guardrails
  - grounding
  - content-safety
  - bias-detection
  - audit-trail
  - cost-governance
  - prompt-governance
  - streamlit
  - sqlite
  - python
  - claude-code
keyInsights:
  - "Responsible AI isn't a set of abstract principles to endorse, it's a set of checks to integrate into the production path. The moment you treat responsible AI as a separate workstream, it becomes something you do once instead of something built into how you ship."
  - "The LLM does not decide whether something PASSes or FAILs. Code does that. You can change the threshold without touching the prompt, and the verdict logic is auditable — it's in Python, not buried in a prompt where it can drift between versions."
  - "One-size-fits-all governance would either under-govern the SAFe system or misfire on the ROI Analyzer. Risk profiles need to match the tool's actual failure modes."
  - "Starting conservative means the limit will trigger during testing if something goes wrong. It also means I have real data to work from when I relax the limits later. It's easier to explain a raised limit than an unexpected bill."
  - "A multi-agent pipeline has six or more stages where something can go wrong. Without an audit trail, debugging a low-scoring spec means re-running the whole thing with verbose logging and hoping to catch the failure. With the audit trail, I query by run ID and see exactly which stage introduced the problem."
toolsBuilt:
  - "responsible_ai_checklist.py — 25-guideline checker across 6 categories (fairness, reliability, transparency, cost governance, safety, versioning)"
  - "infrastructure_audit.py — database-driven infrastructure report"
  - "CostGuard — llm_call_guarded() drop-in with 4 configurable cost limits"
  - "audit_trail.py — 7-event pipeline audit trail with CLI trace viewer"
  - "Grounding Checker — claim classification (grounded / extrapolation / invention / contradiction) with server-side verdict logic"
  - "content_safety.py — PII detection, fabricated metrics check, scope creep heuristic (no LLM calls)"
  - "bias_detector.py — cross-category score gap analysis with section-level drill-down"
  - "Responsible AI dashboard — 4-section Streamlit dashboard (Fairness, Reliability, Content Safety, Cost Governance)"
  - "prompt_governance.py — version promotion rules engine with audit logging"
  - "responsible_ai_template.py — reusable ResponsibleAIConfig data class with pre-built tool profiles"
status: published
---

*Goal: Build responsible AI guardrails, safety checks, and production-quality monitoring into the SAFe Feature Spec System, then generalize the patterns.*

---

# What I Built

I've spent a good deal of time reading up on responsible AI. But I wanted to understand it from a product and engineering perspective, not just policy. I insisted on doing a basic responsible AI build this week. The Claude abides.

Together, we created 9 new evaluation modules, a 4-section Responsible AI dashboard, and a reusable governance template that I can apply to other tools. The general process I followed was to audit what I had, fill the gaps, validate with data, generalize the patterns.

## Day 1: Responsible AI Foundations

While I had a framework for evaluating whether my SAFe Feature System was producing good scores, I had no structured way to see if it was behaving responsibly (or mitigate bad behavior). So, I built a couple of auditing scripts to start poking at my product.

#### Responsible AI Checker

The first build was `responsible_ai_checklist.py`, which performs "checks" against a set of 25 guidelines in six categories (fairness, reliability, transparency, cost governance, safety, and versioning), and reports the status of each category (full, partial, missing). Here's an example of checks from the Safety category:

- Output schema validation ensures required spec sections are present
- Grounding check: verify that factual claims in the spec are entailed by the input
- Hallucination detection: flag outputs that introduce named metrics or systems absent from input
- Human review gate for any output flagged by grounding or hallucination checks

When I ran it against my SAFe Feature System, it passed 12 of 25 checks. The gaps were clustered in cost governance, audit trails, content safety, and regression baselines. 48% coverage overall. Not great. But something to learn from.

#### Infrastructure Auditor

The second deliverable was `infrastructure_audit.py`, which queries the eval database and produces a structured report. The audit surfaced a detail I hadn't noticed: the Reviewer agent consumes roughly 80% of total pipeline input tokens. Not the Generator, even though it produces the longest output. I realized the reason is because Reviewer gets the longest input: the full spec plus the full rubric plus the system prompt.

## Day 2: Cost Guardrails + Audit Trails

After that token "reveal" on Monday, cost governance went to the top of Tuesday's agenda. Claude taught me how to implement basic cost guardrails via a `CostGuard` "enforcer" (sounds ominous, like something out of TRON) with four configurable limits.

```python
COST_LIMITS: dict[str, float | int] = {
    # Maximum USD cost for a single complete pipeline run
    "per_run_max": 0.50,
    # Maximum USD cost for a single improvement-pass sub-run
    "per_improvement_max": 0.25,
    # Maximum cumulative USD cost across all runs recorded today (UTC)
    "daily_max": 5.00,
    # Maximum number of improvement iterations before the loop is force-stopped
    "improvement_iterations_max": 3,
}
```

The design is a `llm_call_guarded()` drop-in for `llm_call()`, so existing agents don't need their signatures changed. A `guard=None` default preserves backward compatibility.

#### Claude Code Improvements

The original design included a `improvement_iterations_max` setting to catch the edge case where each improvement pass is cheap but the loop logic itself is broken, preventing "runaway" loops. What the original design didn't prevent was a *single expensive pass*. The original design specified two caps, but no mechanism to select between them at call time.

The CostGuard needs to enforce different caps at different moments. Using the same limit for a full run vs. a single improvement pass would mean either:

- setting the improvement cap too loose, or
- setting the run cap too tight.

Claude Code detected this issue during implementation and added a `limit_key` that lets the caller specify, on a per-call basis, which configured cap is the relevant ceiling for this particular API call. `limit_key` enforces per-pass cost discipline that the original directive's two-cap config implied but didn't operationalize. It was fascinating to watch Claude Code proactively improving on design work from Claude AI.

#### Audit Trail

Not to be overlooked, I also worked on an audit trail script, `audit_trail.py`, that records every pipeline decision to a new `audit_trail` table in the eval database. It includes 7 event types: ROUTE, DRAFT, GENERATE, GROUND_CHECK, REVIEW, IMPROVE, COST_CHECK. Each event has a run ID, timestamp, event type, and a `details_dict` carrying event-specific context.

The CLI trace viewer (`--run-id`) was more useful than I expected during Days 3 and 4, when I needed to debug grounding checker behavior. Being able to run see the full decision trace in the terminal saved real time. Three observability objects now thread through pipeline: TokenTracker, CostGuard, AuditTrail. All optional, all backward-compatible.

## Day 3: Grounding Checks + Content Safety

Wednesday was the most technically interesting day of the week. First, I created a Grounding Checker (bullshit detector?) to verify whether the Generator output traces back to the original human input. It works by classifying Generator "claims" into one of 4 categories:

- **Grounded** (explicitly stated in inputs)
- **Extrapolation** (reasonable inference)
- **Invention** (plausible but unsupported detail)
- **Contradiction** (conflicts with stated inputs)

The distinction between extrapolation and invention is where things get interesting. When a Generator fills in a performance target with "LCP under 2.5 seconds", that's an industry standard. It's not in the PM's inputs, but it's not fabricated either. The classification matters because extrapolation is acceptable (the Generator is being helpful), while invention is problematic (the Generator is making things up that should come from the product manager).

The verdict logic runs server-side in Python, not in the LLM call:

- a PASS requires 90%+ grounded claims with zero contradictions
- WARN is 75-89%; anything below is FAIL
- A single contradiction forces FAIL regardless of the overall rate

I ran the same 6 cases from Week 9 and recorded a Golden Set of grounding check results:

| Case | Verdict | Grounded | EXT | INV | CON | Cost |
|---|---|---|---|---|---|---|
| cap_001_bare | PASS | 94.2% | 3 | 5 | 0 | $0.16 |
| cap_001_boosted | PASS | 98.5% | 3 | 0 | 0 | $0.23 |
| web_001_bare | PASS | 92.3% | 0 | 12 | 0 | $0.22 |
| web_001_boosted | PASS | 98.5% | 3 | 0 | 0 | $0.21 |
| exp_001_bare | PASS | 98.5% | 4 | 0 | 0 | $0.24 |
| exp_001_boosted | PASS | 98.5% | 3 | 0 | 0 | $0.21 |

**Total cost: ~$1.27**

The most useful finding came from `web_001_bare`. The batch run classified 12 of the Generator's claims as Inventions. A drill-down run on the same case reclassified them as extrapolations. Same content, different verdicts on consecutive runs.

But regardless of classification, the Generator was filling `[NEEDS INPUT]` placeholders with industry-standard defaults (LCP under 2.5 seconds, 44×44 pixel touch targets, Lighthouse score of 90 or above). These aren't true hallucinations. They're more like defaults from the training set, applied in the absence of client-specific requirements.

The boost finding from the grounding results deserves its own callout: every boosted case returned 0 inventions. Every bare case had at least one. This is the clearest quantitative signal the program has surfaced so far for why PM context matters.

#### Content Safety Checker

`content_safety.py` runs before the grounding checker and includes:

- `check_no_pii()` — 5 regex patterns (email, phone, SSN, internal URLs, ServiceNow admin paths); suppresses PM-owned data
- `check_no_fabricated_metrics()` — 10 pattern families with allowlists (P0-P4, Fibonacci points, comparison operators stripped before matching)
- `check_no_scope_creep()` — keyword overlap heuristic; flags < 60% overlap; suppresses SAFe boilerplate; confidence MEDIUM
- `run_all_safety_checks()` — runs all three, flat findings list + per-check results

No LLM calls.

All nine smoke test assertions passed, including a deliberate edge case where `≤500ms` should be caught but a PM-provided `200ms` target should be allowed through.

## Day 4: Bias Detection + Responsible AI Dashboard

Thursday's focus was on looking at patterns in the data I'd been generating for two weeks. I worked on a `bias_detector.py` script that groups eval runs by feature type, computes per-category statistics, and flags gaps exceeding a configurable threshold (default: 10 points). Section-level analysis goes deeper, flagging any section where a given feature type scores more than 15% below the cross-type average.

The live findings: no formal bias detection. The WEBPAGE mean sits at 77.0, versus 86.6 for EXPERIENCE. A 9.6-point gap, 0.4 points below the threshold. Worth watching, but not really actionable yet.

The section-level drill-down connected back to the grounding findings in a satisfying way. WEBPAGE's worst-performing sections are Campaigns (-21% below average), Studio/Design (-18%), and SEO/Analytics (-17%). These are the content-publishing sections where thin inputs produce the most `[NEEDS INPUT]` gaps. The Generator fills those gaps with reasonable defaults. The Reviewer scores those defaults lower than PM-specified requirements. The output is a lower score, not bias in the usual sense.

To cap off the day, I created a Responsible AI dashboard with four sections:

1. Fairness (score distribution by feature type, max gap callout, section flags, boost effectiveness table)
2. Reliability (coefficient of variation by type, score trend chart)
3. Content Safety (static reference to the full golden set grounding run: 6/6 PASS, 0 contradictions)
4. Cost Governance (daily and all-time spend, agent cost breakdown, infrastructure audit checklist)

## Day 5: Prompt Governance + Responsible AI Template

Friday tied together the week's infrastructure into something reusable.

`prompt_governance.py` was the first build of the day. Its job is to enforce version promotion rules: an A/B test result must exist, a minimum of two golden set runs must have completed, the improvement must exceed a configurable threshold (default: 2 points), and no category can regress below a configurable floor (default: -3 points). Promotion decisions write to a `prompt_promotions` table for audit logging.

I ran the Router v2 agent prompt to check it against these rules. Result: approved! +4.48 points overall, with per-category improvements across all three feature types (CAPABILITY +5.0, WEBPAGE +5.0, EXPERIENCE +1.83) and no regressions. This is the same promotion I made in Week 9 based on a manual comparison. Running it through the governance module produces the same answer, but with an audit record and a structured justification.

`responsible_ai_template.py` is the week's closing artifact. The `ResponsibleAIConfig` data class defines which checks are active for a given tool, with pre-built configs for each deployed tool in my portfolio:

- SAFe Feature Spec System (all checks on)
- Knowledge Assistant (tighter fairness threshold at 8 points, grounding at 95%)
- ROI Analyzer (grounding disabled, since it's calculating from inputs, not generating from context)
- Feature Spec Generator (lightweight subset)

The `assess_tool()` function runs active checks and returns HEALTHY, DEGRADED, or UNHEALTHY. But…. when I ran it against the SAFe system, one finding came back: the audit trail is empty. Not because the module is broken, but because I haven't wired AuditTrail, CostGuard, and TokenTracker into the live `app.py` pipeline. The modules exist. The pipeline doesn't use them yet. That gap is now documented and named. I added it to my backlog and decided to call it a week.

# What I Learned

## Responsible AI Is a Quality Layer, Not a Product Category

The framing shift that made the week productive: responsible AI isn't a set of abstract principles to endorse, it's a set of checks to integrate into the production path. Every module I built this week plugs into infrastructure that already existed. The grounding checker slots between Generate and Review. The cost guardrails wrap `llm_call()`. The audit trail adds a table to the eval database.

The PM equivalent: accessibility isn't a separate product. It's a quality standard applied to every feature. The moment you treat responsible AI as a separate workstream, it becomes something you do once instead of something built into how you ship.

## Server-Side Verdict Re-computation Is the Correct Pattern

The grounding checker and the SAFe Reviewer use the same design: the LLM returns structured data (percentages, counts, classifications), and Python enforces the business rule. The LLM does not decide whether something PASSes or FAILs. Code does that.

This matters for two reasons. First, you can change the threshold without touching the prompt. If the team decides 85% grounded is the bar instead of 90%, that's a config change, not a prompt rewrite. Second, the threshold is auditable. The verdict logic is in Python, not buried in a prompt, where it can drift between versions.

This pattern will show up in every evaluation system I build from here.

## Different Tools Need Different Risk Profiles

The `ResponsibleAIConfig` was the week's most direct product application. The ROI Analyzer and the SAFe Feature Spec System are both AI tools, but they need completely different governance configurations.

The ROI Analyzer takes structured inputs and performs calculations. Grounding checks would produce false positives because the outputs are derived, not generated. The SAFe system takes vague inputs and produces structured narratives. Grounding is essential.

One-size-fits-all governance would either under-govern the SAFe system or misfire on the ROI Analyzer. Risk profiles need to match the tool's actual failure modes.

## Cost Guardrails Should Start Conservative

The $0.50/run and $5.00/day limits are deliberately tight. My actual average run cost is $0.25, so the per-run limit gives 2× headroom, not 10×. Starting conservative means the limit will trigger during testing if something goes wrong. It also means I have real data to work from when I relax the limits later. The alternative (setting generous limits and tightening after an incident) is the wrong direction. It's easier to explain a raised limit than an unexpected bill.

## The Audit Trail Is a Debugging Superpower

I didn't fully believe this claim when I wrote it into the syllabus. After using the CLI trace viewer on Day 3 to debug grounding classifier behavior, I do now. A multi-agent pipeline has six or more stages where something can go wrong. Without an audit trail, debugging a low-scoring spec means re-running the whole thing with verbose logging and hoping to catch the failure. With the audit trail, I query by run ID and see exactly which stage introduced the problem. This would have saved hours in Week 8.

# What I Struggled With

The run-to-run variance in the grounding classifier was genuinely frustrating until I recognized the pattern. The same content classified as INVENTION in the batch run and EXTRAPOLATION in the drill-down wasn't a bug. It was the same phenomenon as LLM-as-judge score variance from Week 9, showing up in a classification task instead of a scoring task. The classifier is a useful signal at this threshold. It's not a binary truth machine.

The infrastructure audit's "48% checklist coverage" framing was both useful and slightly misleading. The number implies 52% of the infrastructure is unbuilt. The more accurate framing: 52% of the checklist couldn't be auto-confirmed from database queries. Some of those gaps are real (audit trail not wired in). Others are real but the evidence lives in code, not database records (prompt versioning is implemented; the checker just doesn't query source files). Good infrastructure audits need to know what they can and can't see.

The biggest deferred item: AuditTrail, CostGuard, and TokenTracker are built and tested. They are not wired into the production `app.py` pipeline. Every module this week was built in the evaluation layer and tested against the eval runner. The live Streamlit app still runs the Week 8 pipeline. Wiring the observability layer into production is the right next step, and it's been explicitly deferred to the backlog.

# The Week 10 Shift

The mental model progression this week was from AI that measures and improves itself to **AI I can trust in production.** Basically, from QA to governance. I certainly don't feel like a Responsible AI expert, but I now know there is far more to it than just preventing AI from destroying humanity and taking over the planet.

---

*Week 10 complete. The system doesn't just work. It can be interrogated. By enforcers.*
