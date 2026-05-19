---
title: "ROI Analyzer"
description: "Multi-agent tool that models personalization investment scenarios with validated conversion economics across conservative, moderate, and aggressive projections."
status: deployed
weekBuilt: 4
tags: ["multi-agent", "tool-use", "streamlit", "deployment"]
problemSolved: "Personalization investment decisions rely on gut instinct and vendor claims. This tool provides scenario-modeled ROI projections grounded in real conversion economics."
architecturePattern: "Supervisor + Specialists (Data Agent, Calculator Agent, Research Agent, Analyst Agent)"
techStack: ["Python", "Streamlit", "Anthropic API"]
sortOrder: 4
journalSlug: "week-04-multi-agent-systems"
---

## What it does

Accepts a personalization investment scenario and produces an executive-ready analysis across three projections (conservative, moderate, aggressive). Each scenario calculates conversion lift, revenue impact, ROI percentage, payback period, and a risk assessment. The Analyst agent synthesizes findings into a recommendation grounded in the data, not generic advice.

## Architecture decisions

This was my first multi-agent build using the Supervisor + Specialists pattern. Four specialist agents each own a single tool: Data Agent (servicenow_lookup), Calculator Agent (calculate), Research Agent (web_search), and Analyst Agent (synthesis). The Supervisor decomposes the user's question into sub-tasks and delegates.

The key design insight: matching each agent to a single tool kept the system predictable. When an agent has too many tools, it starts making questionable autonomous decisions about which to use. Constraining the tool surface area per agent gave cleaner, more reliable outputs.

## What I learned

The ROI Analyzer taught me to always sanity-check AI-generated numbers against domain knowledge. Claude confidently produces financial projections that look precise but may embed unrealistic assumptions. The tool is useful precisely because it structures the analysis — but the PM still owns the judgment call on whether the inputs and outputs make business sense.
