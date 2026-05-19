---
title: "Signal Definition App"
description: "Interactive reference tool for a 43-signal visitor classification system, with scoring simulator, signal explorer, and role profiles."
status: deployed
weekBuilt: 7
tags: ["streamlit", "domain-knowledge", "reference-tool"]
problemSolved: "A 30+ page Signal Definition Document is comprehensive but hard to navigate and impossible to interact with. This app makes the scoring algorithm explorable and the signal library searchable."
architecturePattern: "Single-page interactive reference (no AI inference)"
techStack: ["Python", "Streamlit"]
sortOrder: 5
journalSlug: "week-07-agentic-rag-mcp"
---

## What it does

Four-tab interactive application built from the Signal Definition Document v0.6.2:

**Visitor Classification Simulator** — Select signals and watch the scoring algorithm run in real time. Adjust confidence levels, see decay multipliers applied, and understand why a visitor gets classified as a specific role.

**Signal Explorer** — Browse all 43 signals across 7 categories. Filter by category, search by name, and see each signal's weight, decay rate, and classification impact.

**Role Profiles** — View the five buying group roles (Champion, Economic Buyer, Influencer, User, Ratifier) with their defining signal patterns and recommended engagement strategies.

**Reference Guide** — The full signal taxonomy in a searchable, sortable format with fallback cascade rules and confidence thresholds.

## Architecture decisions

This app deliberately does not use AI. The signal definitions, scoring weights, and classification rules are all deterministic — they're domain knowledge encoded as data, not generated content. Building it as a pure Streamlit data app kept it fast, free to run, and guaranteed accurate.

## What I learned

Not every tool needs an LLM. The Signal Definition App is the most-referenced tool on the team because it takes dense documentation and makes it interactive. The value isn't AI intelligence — it's accessibility. Sometimes the best product decision is knowing when not to add AI.
