---
title: "SAFe Feature Spec System"
description: "Multi-agent pipeline that classifies, interviews, generates, and evaluates SAFe feature specifications."
status: deployed
weekBuilt: 8
tags: ["multi-agent", "evaluation", "prompt-engineering", "streamlit"]
problemSolved: "The original Feature Spec Generator worked but couldn't handle different feature types or improve its own output. This system adds classification, context-gathering, and self-evaluation."
architecturePattern: "Router → Interviewer → Generator → Evaluator"
techStack: ["Python", "Streamlit", "Anthropic API", "SQLite"]
sortOrder: 0
---

## What it does

Accepts raw stakeholder requests and produces polished SAFe feature specifications through a multi-stage pipeline. A Router classifies the request type (capability, webpage, experience), an Interviewer gathers missing context, a Generator produces the spec, and an Evaluator scores it against type-specific rubrics.

## Architecture decisions

The multi-agent approach was justified here because the subtasks are genuinely different: classification requires pattern matching, interviewing requires conversational skill, generation requires structured output, and evaluation requires critical judgment. Each agent uses a specialized system prompt optimized for its task.

The Router uses Claude Haiku (fast, cheap) while the Generator and Evaluator use Claude Sonnet (higher quality where it matters). This is the Optimization Trilemma in practice — allocating quality budget where it has the most impact.

## What I learned

The biggest lesson was about evaluation infrastructure. You can't improve what you can't measure. Building the golden test set and baseline scoring system before attempting improvements meant every change had a clear before/after comparison. Without that discipline, I would have been guessing whether my prompt changes were actually helping.
