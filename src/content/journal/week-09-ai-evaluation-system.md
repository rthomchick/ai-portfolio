---
title: "Week 9 Journal: AI Evaluation System"
headline: "Week 9 Journal: AI Evaluation System"
week: 9
date: 2026-02-24
summary: "Built a complete evaluation pipeline for the SAFe Feature Spec System — SQLite persistence, prompt versioning, a six-case golden set, a 5-tab Streamlit dashboard, and an AI-powered improvement suggester — turning prompt engineering from guesswork into measurement."
tags:
  - evaluation
  - llm-as-judge
  - sqlite
  - streamlit
  - prompt-engineering
  - a-b-testing
  - python
  - claude-code
  - safe
  - prompt-versioning
keyInsights:
  - "Even at temperature 0.0, there's enough non-determinism in the inference process (floating point arithmetic, batching, hardware state) that the same evaluation produces different scores on consecutive runs. A score of 78 doesn't mean 78. It means somewhere in the low-to-mid 70s, probably."
  - "The bare/boosted spread tells me exactly which sections the intake form needs to extract information for. It's a roadmap for the product, derived from evaluation data."
  - "Multiple runs revealed the flakiness. v1 classified EXPERIENCE correctly maybe 5 out of 6 times. Not terrible, but not consistently reliable. Intermittent bugs are worse than consistent bugs because they're harder to reproduce."
  - "The cost tracker revealed that the Generator consumes 67% of total pipeline cost. If cost optimization becomes important, the Generator is the first target, and I now have real data that shows why."
  - "The Improvement Suggester proposes. I decide whether to apply. That's the human-in-the-loop pattern from Week 8, applied to prompt optimization instead of spec improvement."
toolsBuilt:
  - "Evaluation pipeline (eval_db.py, token_tracker.py, prompt_registry.py, result_store.py, eval_runner.py)"
  - "Golden set — 6 test cases (3 feature types × bare/boosted variants)"
  - "Router A/B test script (ab_test_router.py)"
  - "5-tab Streamlit dashboard (Run Evaluation, Compare Runs, Quality Dashboard, Cost Tracker, Suggest Improvements)"
  - "AI-powered Improvement Suggester"
  - "Router v2 prompt (data-driven A/B promotion)"
status: published
---

*Goal: Build evaluation infrastructure that turns prompt engineering from guesswork into measurement. Use the SAFe Feature Spec System as the test case.*

---

# What I Built

An evaluation pipeline, a prompt versioning system, a golden set, a five-tab Streamlit dashboard, and an AI-powered improvement suggester. Together, they form a closed loop: run tests automatically, store results in SQLite, compare prompt versions with real data, visualize trends, and get Claude's suggestions for what to fix next.

## Day 1: SQLite Foundations + Token Instrumentation

Monday was all plumbing. Claude Code built four modules in `safe-feature-system/evaluation/`:

**`eval_db.py`** creates a SQLite database with three core tables: `prompts` (content-addressed via SHA-256 prefix), `eval_runs` (one row per pipeline execution), and `token_usage` (one row per LLM call). Content-addressed hashing was Claude Code's design choice, not mine, and I was skeptical at first. But the idempotency argument won me over: registering the same prompt twice returns the same ID instead of creating a duplicate. Same principle as Pinecone's idempotent upsert from Week 7, applied to prompt management.

**`token_tracker.py`** provides a shared `llm_call()` wrapper that intercepts every API call, records `response.usage.input_tokens` and `response.usage.output_tokens`, and passes through the result. The `tracker=None` default means existing code works without changes. No agent function signatures had to change their return types.

**`prompt_registry.py`** and **`result_store.py`** round out the storage layer: version control for prompts and structured persistence for evaluation results.

In the evening block, I wired `llm_call()` into all six SAFe agents (Router, Clarifier, Generator, Reviewer, Improver, Polisher). Every agent now records its token usage, but the instrumentation is invisible unless you pass a tracker. Backward compatible by default.

## Day 2: Eval Runner + Golden Set + Baseline

The golden set was the hardest part of the week. Not technically, but in terms of the discipline required to write good test cases. Six cases covering all three feature types (CAPABILITY, EXPERIENCE, WEBPAGE), each in two variants:

- **Bare**: minimal input notes, simulating the starting inputs a PM or stakeholder might use to initiate a feature request; contains intentional information gaps
- **Boosted**: inputs added between Review and Improvement stages, simulating context and clarifications a PM might provide to improve feature readiness (e.g., KPI targets, technical constraints, compliance details)

That bare/boosted pairing turned out to be one of the most useful design decisions of the week.

`eval_runner.py` feeds each test case through the full SAFe pipeline (classify → generate → review), stores the scorecard in SQLite with timestamps and prompt version IDs, and records token usage along the way. CLI flags let me run a single case (`--case cap_001_bare`) or the full set, with either Router version (`--router v1|v2`).

### V1 Baseline Results

| Case | Type | Score | Pass | Routing | Cost |
|---|---|---|---|---|---|
| cap_001_bare | CAPABILITY | 78 | ✅ | ✅ | $0.23 |
| cap_001_boosted | CAPABILITY | 92 | ✅ | ✅ | $0.26 |
| web_001_bare | WEBPAGE | 62 | ❌ | ✅ | $0.26 |
| web_001_boosted | WEBPAGE | 87 | ✅ | ✅ | $0.27 |
| exp_001_bare | EXPERIENCE | 78 | ✅ | →CAPABILITY | $0.27 |
| exp_001_boosted | EXPERIENCE | 93 | ✅ | →CAPABILITY | $0.27 |

**Total: 5/6 passed | $1.56 | ~20 min runtime**

Two things jumped out immediately. First, both EXPERIENCE cases routed to CAPABILITY. This was the intermittent routing bug from Week 8, now visible in data instead of hidden behind a single manual test. Second, the bare→boosted spread was massive and consistent: +14 (CAP), +25 (WEB), +15 (EXP).

## Day 3: Router A/B Test

The EXPERIENCE misclassification gave me a clear target for my first A/B test. Claude Code built a v2 Router prompt with explicit signal words per feature type ("form component" + "Arc Design System" → EXPERIENCE) and removed a subtle CAPABILITY fallback bias from v1. I also got a lightweight routing-only A/B test script (`ab_test_router.py`) that runs all 6 classifications against both prompts: 12 Haiku calls, total cost about half a cent.

**Run 1:** v1 misfires on `exp_001_bare` (→CAPABILITY), v2 gets all 6 correct.  
**Run 2:** Both v1 and v2 get 6/6 correct.

This is the pattern that made the whole evaluation pipeline worth building. If I'd only tested once and gotten the right answer from v1, I would have assumed routing was fine. Multiple runs revealed the flakiness. v1 classified EXPERIENCE correctly maybe 5 out of 6 times. Not terrible, but not consistently reliable.

I ran a full pipeline evaluation with Router v2. All 6 cases passed, all routing correct, $1.45 total. The downstream score impact was modest (+3 on EXPERIENCE bare, +1 on boosted) because the generator was robust enough to produce reasonable output even with the wrong question bank. But eliminating an intermittent failure matters more than the score delta suggests. Intermittent bugs are worse than consistent bugs because they're harder to reproduce.

Router v2 promoted. My first data-driven prompt change.

## Day 4: Dashboard

Thursday was light. I built a dashboard with five tabs via Claude Code in a single session:

**Tab 1: Run Evaluation** lets me select a router version, pick a case or run the full set, and see results with expandable per-case scorecards. Color-coded sections and recommendations.

**Tab 2: Compare Runs** does side-by-side comparison of any two runs with section-level deltas. Shows router version, reviewer version, classification, and score.

**Tab 3: Quality Dashboard** has a score-over-time line chart with all 6 golden set cases color-coded, a per-section score trend with dropdown selector, and a historical runs table.

**Tab 4: Cost Tracker** shows summary metrics (total spend, avg cost/run, total runs), a cost-per-run bar chart, and a cost-by-agent breakdown table. This is where the Generator's cost dominance became visible (more on that below).

**Tab 5: Suggest Improvements** was a placeholder for Day 5.

## Day 5: Improvement Suggester

As many a manager has said, "Come to me with solutions, not just problems." The Improvement Suggester does just that. It loads all stored runs for a golden set case, aggregates section scores and reviewer feedback, identifies the weakest sections, and calls Claude Sonnet at temperature 0.2 to analyze the patterns and propose specific prompt edits. Each suggestion includes: a quote from the current prompt, a diagnosis, a suggested edit, and a rationale.

The key design choice: the Suggester proposes. I decide whether to apply. It doesn't auto-modify prompts. That's the human-in-the-loop pattern from Week 8, applied to prompt optimization instead of spec improvement.

Dashboard Tab 5 wired up: case dropdown, sections-to-analyze input, expandable result cards with score badges and diff-formatted suggestions. The session state caches results keyed by (case_id, run_count) so they auto-invalidate when new runs are added.

# What I Learned

## LLM-as-Judge Variance Is Real (Even at Temperature 0.0)

The most counterintuitive finding of the week. I ran `cap_001_bare` three times with identical inputs, identical prompts, and temperature set to 0.0. The scores came back: 71, 78, 71.

My first reaction was that something was broken. Temperature 0.0 is supposed to be deterministic. Same input, same prompt, same model. The scores should be identical.

They're not. And they never will be.

Even at temperature 0.0, there's enough non-determinism in the inference process (floating point arithmetic, batching, hardware state) that the same evaluation produces different scores on consecutive runs. The variance I observed was roughly ±7 points on a 100-point scale.

This changes how I interpret every evaluation result. A score of 78 doesn't mean 78. It means somewhere in the low-to-mid 70s, probably. A single run is a data point, not a verdict. The PM analogy is obvious: one day's conversion rate doesn't tell you anything. A two-week trend does. I knew this from product analytics. I just hadn't internalized it for AI evaluation.

## The Bare/Boosted Spread Quantifies the Value of PM Input

The score spread between bare and boosted variants:

| Type | Bare | Boosted | Spread |
|---|---|---|---|
| CAPABILITY | 71-78 | 92 | +14 to +21 |
| WEBPAGE | 62-72 | 87 | +15 to +25 |
| EXPERIENCE | 78-81 | 93-94 | +13 to +15 |

The boost inputs aren't making the AI smarter. They're giving it information it literally doesn't have. When the bare WEBPAGE case scores 62, it's because the generator doesn't know the client's SEO requirements, the specific analytics platform, or the campaign taxonomy. It fills those gaps with reasonable industry defaults (LCP under 2.5 seconds, 44×44 pixel touch targets, GA4 event taxonomy). These aren't hallucinations. They're educated guesses. But they're not the client's actual requirements, and the reviewer correctly penalizes that.

This has direct product implications. The SAFe system's long-term vision is to transform vague intake form submissions into well-formed specs. The bare/boosted spread tells me exactly which sections the intake form needs to extract information for. It's a roadmap for the product, derived from evaluation data.

## Where the Money Goes

The cost tracker revealed that the Generator consumes 67% of total pipeline cost. Out of $3.74 spent across 15+ runs, $2.52 went to the Generator. This makes sense once you see it: the Generator produces the longest output (a complete SAFe Feature spec) from the longest input (all section answers plus the system prompt plus the preamble). The Router, running on Haiku instead of Sonnet, costs almost nothing. If cost optimization becomes important, the Generator is the first target, and I now have real data that shows why.

## The Claude Code Workflow Shift

This was my first full week using Claude Code for all implementation. The division of labor: Claude Code writes files, runs tests, handles merges. The conversational Claude (this project) reviews architecture, makes design decisions, handles Notion documentation.

What worked: the hybrid model let me focus on the "what" and "why" while Claude Code handled the "how." I spent my time reviewing design choices (like the content-addressed hashing) instead of debugging Python imports.

What felt uncomfortable: trusting code I hadn't written line by line. In earlier weeks, I understood every function because I'd built it or edited it myself (with a LOT of hand-holding from Claude). This week, I had to trust the smoke tests and integration tests instead of reading every line.

# What I Struggled With

Not many hiccups this week. I've got my CLI legs under me now. The infrastructure work was mostly clean because I had solid foundations from Week 8. SQLite is built into Python (no dependency issues for a change). The eval runner imports the existing SAFe pipeline and wraps it with measurement, so there wasn't a lot of new architecture to invent.

The score variance discovery was frustrating until I understood it was a feature of the problem space, not a bug in my code. And the improvement suggester's suggestions were sometimes too vague ("add more detail to this section") despite the prompt asking for specific edits. But those are tuning problems, not architectural ones.

The biggest "struggle" was resisting the urge to act on every suggestion the improvement suggester produced. It's tempting to implement all five edits at once. But the whole point of A/B testing is changing one variable at a time.

# The Week 9 Shift

Week 8's mental model was "AI that replaces a manual workflow end-to-end." Week 9 is "AI that measures and improves itself." The first is a product. The second is product infrastructure. The distinction maps to a career pattern I recognize: early-career PMs ship features, senior PMs build the systems (analytics, experimentation, quality monitoring) that make features better. The evaluation pipeline is the AI equivalent. No user will ever see the dashboard. But it's the thing that turns every future prompt change into a data-driven decision instead of a guess.

## Key Numbers

- 10 new Python modules in `safe-feature-system/evaluation/`
- 6 golden set test cases (3 types × bare/boosted)
- 15+ evaluation runs stored in SQLite
- 1 A/B test completed (Router v1 → v2 promoted)
- $3.74 total evaluation spend
- $1.45 per full golden set run
- $0.25 per individual case
- ±7 point LLM-as-judge variance at temperature 0.0
- 14-25 point bare/boosted spread across feature types
- 67% of pipeline cost concentrated in the Generator agent
- 5-tab Streamlit dashboard

## Looking Ahead

Next week I'll be learning how to layer Responsible AI on top of capability. The evaluation infrastructure is where things like bias detection, content safety checks, cost guardrails, and audit trails will plug in.

The improvement suggester already hints at what's next: it can identify when WEBPAGE specs consistently score lower than CAPABILITY specs on the same rubric criteria. Is that a legitimate quality gap (WEBPAGE inputs tend to be thinner), or is it rubric bias (the rubric unfairly penalizes WEBPAGE-specific sections)? Week 10 will answer that with data.

---

*Week 9 complete. Evaluation pipeline operational. Every prompt change is now an experiment with a measurable outcome.*
