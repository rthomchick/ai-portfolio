---
title: "SAFe Feature Spec System"
description: "Six-agent pipeline that classifies, drafts, generates, reviews, improves, and polishes SAFe feature specifications with a 100-point rubric scoring system."
status: deployed
deployUrl: "https://safe-feature-system.streamlit.app"
repoUrl: "https://github.com/rthomchick/safe-feature-system"
weekBuilt: 8
tags: ["multi-agent", "evaluation", "prompt-engineering", "streamlit", "responsible-ai"]
problemSolved: "The original Feature Spec Generator worked but couldn't handle different feature types, improve its own output, or prove its quality. This system adds classification, self-evaluation, iterative improvement, and production governance."
architecturePattern: "Router → Draft Answerer → Generator → Reviewer → Improver → Polish (with conditional improvement loops)"
techStack: ["Python", "Streamlit", "Anthropic API", "PostgreSQL", "Supabase"]
sortOrder: 0
journalSlug: "week-08-safe-system"
---

## What it does

Accepts raw stakeholder feature requests and produces polished SAFe feature specifications through a six-agent pipeline. The system handles three feature types (CAPABILITY, EXPERIENCE, WEBPAGE) with type-specific rubric interpretation, scores output on a 100-point scale across 9 sections, and iteratively improves weak sections until quality targets are met.

**Router** (Haiku) — Classifies feature requests by type. Fast and cheap for a decision that gates the rest of the pipeline.

**Draft Answerer** (Sonnet) — Proposes structured answers from PM notes, extracting what's explicitly stated without inventing.

**Generator** (Sonnet) — Produces the full SAFe Feature spec. Consumes ~67% of pipeline cost — the most expensive but most value-creating agent.

**Reviewer** (Sonnet) — Scores the spec on a 100-point rubric across 9 sections. PM boost inputs (domain context) are injected here, post-generation but pre-improvement.

**Improver** (Sonnet) — Rewrites only the sections scoring below 75%. Uses Parse → Edit → Reassemble architecture to prevent structural corruption.

**Polish** (Sonnet) — Auto-triggers when the overall score lands in the 80-89 range, pushing specs past the 90-point threshold.

## Architecture decisions

The linear pipeline (not hub-and-spoke) reflects the actual dependency chain: you can't review what hasn't been generated, and you can't improve what hasn't been reviewed. Each agent's output is the next agent's input.

Two conditional loops define the quality system: the Reviewer → Improver loop fires for sections below 75%, and the Improver → Polish loop auto-triggers at 80-89 to break through score ceilings. Without the two-tier approach, specs reliably plateau in the mid-80s.

Section-isolated re-scoring prevents score drift — when the Improver rewrites Section 3, the Reviewer carries forward original scores for unchanged sections rather than re-evaluating the entire spec. This eliminates a class of bugs where untouched sections mysteriously change scores between runs.

The v3 upgrade (Week 11) added PostgreSQL migration for concurrent multi-surface access, a ConnectorInterface abstraction for swapping between local SQLite and Supabase backends, and full governance module integration (cost guardrails, grounding checks, audit trail, prompt governance) running inline during normal pipeline execution.

## What I learned

The biggest lesson: you can't improve what you can't measure. Building the golden test set and evaluation infrastructure (Week 9) before attempting improvements meant every prompt change had a clear before/after comparison. The ±7-point LLM-as-judge variance means single runs are unreliable — you need multiple runs across the full golden set to trust a comparison.

The Parse → Edit → Reassemble pattern was born from debugging structural corruption. Positional string surgery (find section header, splice in new content) causes downstream section corruption when section lengths change. Parsing the spec into a section dictionary, editing individual entries, and reassembling eliminates the entire class of bugs.
