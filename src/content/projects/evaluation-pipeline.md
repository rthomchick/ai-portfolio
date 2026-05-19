---
title: "Evaluation Pipeline & Dashboard"
description: "SQLite-backed evaluation infrastructure with prompt versioning, token tracking, a golden test set, and a 5-tab Streamlit dashboard for monitoring AI pipeline quality."
status: built
weekBuilt: 9
tags: ["evaluation", "llm-as-judge", "sqlite", "streamlit", "prompt-engineering"]
problemSolved: "Prompt engineering was guesswork — no way to measure whether changes helped or hurt. This pipeline turns subjective quality judgment into quantifiable, comparable data."
architecturePattern: "Golden set runner → SQLite storage → Dashboard visualization + AI-powered improvement suggestions"
techStack: ["Python", "Streamlit", "Anthropic API", "SQLite"]
sortOrder: 3
---

## What it does

A complete evaluation infrastructure for the SAFe Feature Spec System:

**Prompt Registry** — Content-addressed (SHA-256) prompt storage. Same prompt text always returns the same ID, enabling precise version tracking across runs.

**Token Tracker** — Wraps every LLM call with `llm_call()`, recording model, token counts, and cost per agent. Backward compatible: `tracker=None` skips recording.

**Golden Set Runner** — Six test cases (3 feature types × bare/boosted variants) run through the full pipeline with section-level scoring. CLI flags for router version selection, case filtering, and verbose output.

**5-Tab Dashboard** — Quality Scores (score-over-time with case color coding), Score Trends (moving averages), Cost Tracking (per-agent breakdown showing Generator at ~67%), Improvement Suggester (Claude-powered analysis of weak sections with specific prompt edit proposals), and Run Details (drill into any individual run).

## Architecture decisions

SQLite was the right persistence choice at this scale. The three-table schema (`prompts`, `eval_runs`, `token_usage`) is simple, queryable, and file-portable. Content-addressed prompt storage means duplicate registration is impossible — a valuable invariant when running dozens of eval iterations.

The Improvement Suggester uses Claude to analyze score patterns and propose specific prompt edits. This is meta — using AI to improve the prompts that control other AI. The suggestions are starting points for human judgment, not auto-applied changes.

## What I learned

LLM-as-judge has meaningful variance even at temperature 0.0 — expect ±7 points on the same input. This means golden sets need multiple runs to establish reliable baselines, and single-run comparisons can be misleading.

The bare/boosted spread (14-25 points across test cases) quantifies the concrete value of PM-provided context. This gap became a design target: the intake system should maximize the information gathered from stakeholders to close it.
