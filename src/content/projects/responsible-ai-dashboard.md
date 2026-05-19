---
title: "Responsible AI Dashboard"
description: "Nine governance modules covering cost guardrails, grounding verification, content safety, bias detection, audit trails, and prompt promotion rules for production AI pipelines."
status: built
weekBuilt: 10
tags: ["responsible-ai", "governance", "evaluation", "cost-management", "streamlit"]
problemSolved: "A working AI pipeline isn't a trustworthy one. This dashboard answers: Is the output grounded? Is there bias across feature types? Are costs under control? Can we trace every decision?"
architecturePattern: "Modular governance layer integrated into existing evaluation pipeline"
techStack: ["Python", "Streamlit", "Anthropic API", "SQLite"]
sortOrder: 2
---

## What it does

Nine evaluation modules that transform the SAFe Feature Spec System from "it works" to "it's ready for production":

**Cost Guardrails** — CostGuard enforcer with configurable limits ($0.50/run, $0.25/improvement, $5/day, max 3 iterations). Drop-in `llm_call_guarded()` replacement with Teams webhook alerts on threshold breaches.

**Grounding Checker** — LLM-as-judge that verifies generated spec content traces back to PM inputs. Classifies unsupported claims as EXTRAPOLATION, INVENTION, or CONTRADICTION. Server-side verdict recomputation enforces business rules in Python after getting structured data from Claude.

**Content Safety** — Deterministic regex checks for PII leakage, fabricated metrics, and scope creep. No LLM calls — fast and predictable.

**Bias Detector** — Cross-category score analysis (mean, standard deviation, gap detection). Compares performance across CAPABILITY, EXPERIENCE, and WEBPAGE feature types and measures boost effectiveness.

**Audit Trail** — Logs every pipeline decision (ROUTE, DRAFT, GENERATE, GROUND_CHECK, REVIEW, IMPROVE, COST_CHECK) to a SQLite table. CLI trace viewer for debugging.

**Prompt Governance** — Version promotion rules requiring A/B test evidence, minimum golden set runs, improvement thresholds, and no category regressions before a prompt change can be promoted.

**Dashboard** — Four-section Streamlit tab: Fairness (score distributions by type), Reliability (grounding results), Content Safety (deterministic check results), Cost Governance (spend tracking and agent breakdown).

## Architecture decisions

Responsible AI is a quality layer, not a separate product. Every module integrates into the existing pipeline rather than running alongside it. This means governance checks happen automatically during normal pipeline execution — they're not an optional second step someone has to remember to run.

The grounding checker uses a server-side verdict recomputation pattern: Claude provides structured classification data, but Python enforces the business rules about what counts as a pass or fail. This is important because LLM-as-judge has variance — you want deterministic business logic making the final call.

## What I learned

The most important finding: boost inputs eliminate hallucinations. Across the entire golden set, every boosted case had zero inventions. This is quantitative proof that richer PM context produces grounded outputs — and it directly motivated the intake copilot built in Week 12.

Different tools need different risk profiles. Grounding checks make no sense for a calculator tool (ROI Analyzer) but are critical for generative tools (Knowledge Assistant, Feature Spec System). One-size-fits-all governance is wrong.
