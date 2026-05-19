---
title: "Week 11 Journal: Anthropic Advisor Tool Experiment"
headline: "Week 11 Journal: Anthropic Advisor Tool Experiment"
week: 11
date: 2026-05-11
summary: "Took the SAFe Feature Spec System from prototype to production by wiring in governance, migrating from SQLite to PostgreSQL, building a ConnectorInterface abstraction, and deploying the full v3 system to Streamlit Cloud."
tags:
  - advisor-tool
  - postgresql
  - streamlit
  - python
  - safe
  - evaluation
  - production-deployment
  - connector-pattern
  - governance
  - anthropic-api
  - supabase
keyInsights:
  - "The advisor averaged -2.2 points at 4.3× the cost ($4.98 vs $1.17). The Day 1 result was an outlier, not a trend."
  - "I built the integration, designed the A/B test, ran the golden set, and let the data override my initial optimism. That's the most valuable thing I shipped all week."
  - "The governance modules passed their smoke tests in Week 10. They were also completely disconnected from the live pipeline. Wiring them in was mechanical, but it touched every stage of app.py."
  - "Without a flush guard, the token data writes to the database every time the final stage re-renders. Small bug, easy fix, only surfaces in production."
  - "Building a direct integration to one tool creates a hard dependency. The solution was a ConnectorInterface that normalizes any intake source into a FeatureRequest object. The pipeline doesn't know or care where requests come from."
  - "The PostgreSQL migration was the least visible deliverable and probably the most important — it unlocked concurrent access from multiple surfaces: the eval runner, the request queue, and the live pipeline all hitting the same database."
toolsBuilt:
  - "llm_call_with_advisor() — parallel wrapper to llm_call() with advisor_20260301 beta tool, mixed content block handling, and per-model token tracking"
  - "Governance wiring — AuditTrail, CostGuard, and TokenTracker connected to the live pipeline in app.py, with _tracker_flushed guard against Streamlit rerun duplicates"
  - "PostgreSQL migration — SQLite replaced with Supabase PostgreSQL across all six tables, dual-mode connection logic for local dev vs. production"
  - "ConnectorInterface abstract base class with FeatureRequest dataclass — PostgreSQL as first implementation, Notion/Jira/Asana as stubs"
  - "Request Queue Streamlit page — create, process, and completed-request views feeding into the existing pipeline"
  - "SAFe Feature Spec System v3 — deployed to Streamlit Cloud with end-to-end verification"
status: published
---

*Goal: Upgrade the SAFe Feature Spec System from prototype to production in Streamlit Cloud. Add Anthropic's new Advisor Tool and measure the impact.*

---

## What I Built

Last month, Anthropic released the [advisor tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool) that lets a faster, lower-cost **executor model** consult a higher-intelligence **advisor model** mid-generation for strategic guidance. Basically, a way for Sonnet to consult Opus mid-generation without a full model swap. My SAFe Feature Spec System seemed like a natural candidate, so I started there and built outward into the infrastructure work the system needed to go production on Streamlit Cloud.

### 1. Advisor Tool Integration

First, I added Anthropic's `advisor_20260301` beta tool to the Reviewer and Improver stages of my SAFe Feature Spec System. Sonnet executes the task end-to-end; when it hits a decision it can't confidently resolve, it consults Opus. Built `llm_call_with_advisor()` as a parallel function to the existing `llm_call()` wrapper — handles mixed response content blocks (text, server_tool_use, advisor_tool_result), records executor and advisor tokens separately, and degrades gracefully when Opus is overloaded. Controlled via a sidebar checkbox in Streamlit and a `--advisor` CLI flag on the eval runner, defaulting to OFF.

![Just a manual checkbox for now…](/images/journal/week-11-advisor-checkbox.png)

### 2. Governance Wiring

The AuditTrail, CostGuard, and TokenTracker modules existed since Weeks 9–10, but weren't connected to the production pipeline. So I wired all three into `app.py`. Every agent call is token-tracked, every stage transition logs an audit event, every expensive call checks cost limits before proceeding. A "Run Details" expander on the final stage shows per-agent token breakdown, total cost, and a timestamped event trace. I also added a `_tracker_flushed` guard to prevent duplicate database inserts on Streamlit reruns.

![Token breakdown per agent in the Run Details expander](/images/journal/week-11-governance-tokens.png)

![Timestamped audit trail in the Run Details expander](/images/journal/week-11-governance-audit.png)

### 3. PostgreSQL Migration

Next, I replaced SQLite with PostgreSQL (Supabase) across the entire evaluation infrastructure so I could deploy the app to Streamlit Cloud. I used a dual-mode connection logic: PostgreSQL via `DATABASE_URL` environment variable, SQLite fallback when unset. Six tables: `prompts`, `eval_runs`, `token_usage`, `audit_trail`, `prompt_promotions`, `feature_requests`. Production uses PostgreSQL, local dev and smoke tests use SQLite.

### 4. Connector Interface and Request Queue

After that, I built a `ConnectorInterface` abstract base class with a `FeatureRequest` dataclass that represents the standardized format all connectors produce. PostgreSQL is the first implementation. Notion, Jira, and Asana are stubs showing the pattern for future connectors. New "Request Queue" Streamlit page with create, process, and completed-request views. The pipeline stages are untouched. The queue is an alternative entry point that feeds into the same pipeline. The UX so far is just OK. I'd need to make significant improvements in order for an average tech marketing manager to use it successfully.

![This will be replaced with a conversational interface next week….](/images/journal/week-11-request-queue.png)

### 5. Streamlit Cloud Deployment

After building everything out, I deployed the full v3 system to Streamlit Cloud. End-to-end verification on the live URL: created a request in the queue, processed it through the pipeline with boost inputs, confirmed governance data in Run Details (cost, tokens, audit trail), verified write-back to PostgreSQL. Score: 76 → 85 with boost inputs, $0.72 total cost, 27 LLM calls across 5 agents.

## What I Learned

### Verdict on Advisor Tool: The Data Said No (At Least for My Use Cases)

The advisor tool sounded great on paper, but it didn't add value to my app. Day 1, a single test case showed +9 points (72 → 81) and looked like a clear win. Then I ran the full golden set.

| Case | Baseline | Advisor | Delta |
|---|---|---|---|
| cap_001_bare | 74 | 72 | -2 |
| cap_001_boosted | 83 | 82 | -1 |
| web_001_bare | 74 | 74 | 0 |
| web_001_boosted | 82 | 79 | -3 |
| exp_001_bare | 79 | 71 | -8 |
| exp_001_boosted | 88 | 89 | +1 |
| **Average** | **80.0** | **77.8** | **-2.2** |

The advisor averaged -2.2 points at 4.3× the cost ($4.98 vs $1.17). The Day 1 result was an outlier, not a trend.

The Reviewer's job is structured rubric scoring — evaluate a spec against 9 sections with specific criteria and return a JSON scorecard. Sonnet handles this effectively without Opus consultation. The advisor adds reasoning depth, but for a well-defined task that depth manifests as overthinking borderline cases, not better judgment.

The advisor tool is designed for tasks where the executor genuinely needs help with ambiguous reasoning. The Intake Copilot (Week 12), where the model decides what questions to ask based on messy stakeholder input, is a much better fit. The toggle stays in the UI, but the default recommendation is advisor OFF. I built the integration, designed the A/B test, ran the golden set, and let the data override my initial optimism. That's the most valuable thing I shipped all week.

### Building Guardrails Is Half the Work

The governance modules passed their smoke tests in Week 10. They were also completely disconnected from the live pipeline. Wiring them in was mechanical, but it touched every stage of `app.py`. The Streamlit rerun model added a wrinkle: without a flush guard, the token data writes to the database every time the final stage re-renders. Small bug, easy fix, only surfaces in production.

### Don't Build for One Integration

The original plan had Notion as the intake surface via MCP. I killed it on Day 3. When I dug into the implementation, the problems started stacking up: Notion's hosted MCP server requires OAuth (no headless auth for automated pipelines), the local MCP server runs on stdio (not compatible with the API-level MCP connector), and running a bridge process locally works for dev but not for Streamlit Cloud.

I probably could have hacked around each issue, but instead I took a step back and reviewed the architecture. Different teams use different tools. Building a direct integration to one tool creates a hard dependency. The solution was a `ConnectorInterface` that normalizes any intake source into a `FeatureRequest` object. The pipeline doesn't know or care where requests come from. PostgreSQL is the default; adding Notion (or Jira, or Asana) in the future will (hopefully) be a single file implementing the same interface.

### Infrastructure Work Is Invisible and Essential

The PostgreSQL migration was the least visible deliverable and probably the most important. Same schema, mechanical code changes (`?` to `%s`, `conn.commit()`, dict cursor). But it unlocked concurrent access from multiple surfaces: the eval runner, the request queue, and the live pipeline all hitting the same database. The connection string saga (IPv6 routing failure, pooler workaround, password exposure and rotation) was its own adventure in production infrastructure.

## Final Thoughts

This week was not glamorous. My noble experiment with the advisor tool failed, and the rest was infrastructure engineering. But the advisor tool seems better suited for cases where the executor genuinely doesn't know the right answer and needs help with ambiguous, open-ended reasoning — which is exactly what the Intake Copilot needs to do. So I'm bringing it back next week in a context where it should actually shine.

---

*Week 11 complete. SAFe v3 deployed with PostgreSQL, governance, and a connector abstraction. The advisor tool's best result was proving it wasn't needed. Next: Intake Copilot.*
