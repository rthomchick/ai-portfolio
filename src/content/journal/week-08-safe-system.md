---
title: "Week 8: SAFe Feature Spec System"
headline: "Parse, edit, reassemble"
week: 8
date: 2026-03-14
summary: "Built a multi-agent system that turns stakeholder requests into structured SAFe feature specs, and learned hard lessons about string surgery on structured outputs."
tags: ["multi-agent", "structured-output", "prompt-engineering", "evaluation"]
keyInsights:
  - "Positional string surgery on structured outputs causes downstream corruption"
  - "Parse → Edit → Reassemble is the reliable pattern for modifying structured text"
  - "Two-tier improvement pipelines (improve + polish) break through score ceilings"
  - "Feature-type-aware rubric interpretation prevents penalizing the wrong artifact"
toolsBuilt: ["SAFe Feature Spec System"]
status: published
---

This was the week that taught me the most about production AI architecture. The goal was straightforward: build a system that takes vague stakeholder requests and produces structured SAFe feature specifications. The implementation taught me lessons I couldn't have learned from documentation.

## The architecture

The system uses a multi-agent pipeline: a Router classifies incoming requests by type, an Interviewer gathers missing context through structured questions, and a Generator produces the spec. Simple enough on paper.

## Where it broke

The interesting part was the improvement pipeline. After generating a spec, I wanted to automatically improve it based on scoring rubrics. My first approach — find the weak section in the output string and replace it in place — caused cascading corruption. Change one section and the surrounding context shifts, scores drift, and you end up with a worse spec than you started with.

## The fix

The reliable pattern is Parse → Edit → Reassemble. Parse the structured output into discrete sections, improve the target section in isolation, then reassemble the full document. This prevents score drift on untouched sections and gives you clean before/after comparisons.

This is the kind of lesson that only comes from building. No tutorial would have taught me that positional string surgery on LLM outputs is fundamentally fragile.
