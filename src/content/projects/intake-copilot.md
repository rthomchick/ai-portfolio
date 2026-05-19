---
title: "Intake Copilot"
description: "Conversational AI that replaces form-based feature request intake with an adaptive chatbot, bridging the gap between messy stakeholder input and structured specs."
status: deployed
weekBuilt: 12
tags: ["conversational-ai", "intake", "multi-agent", "supabase", "streamlit"]
problemSolved: "Stakeholders submit incomplete, unstructured feature requests through rigid forms. The copilot meets them where they are — extracting structured data through natural conversation instead of punishing incomplete knowledge with required fields."
architecturePattern: "Five-stage service blueprint: Intake → Classification → Gap-Filling → Summary → PM Review"
techStack: ["Python", "Streamlit", "Anthropic API", "Supabase (PostgreSQL)"]
deployUrl: "https://safe-feature-system.streamlit.app"
sortOrder: 1
journalSlug: "week-12-feature-intake-copilot"
---

## What it does

A conversational intake system that transforms the front end of the feature spec pipeline. Instead of a form with required fields, stakeholders talk to an AI copilot that adapts its questioning strategy based on what they know.

**Stakeholder Intake** — Natural conversation that extracts structured data (12 weighted fields across 3 tiers) without the stakeholder needing to know the data model. The copilot reads signal density from early answers and adapts: extraction mode for information-rich stakeholders, gap-filling for those with partial context, reverse extraction for deeply technical inputs that need PM translation.

**Two-Gate Architecture** — The copilot gate is conversational and never blocks submission (stakeholders can submit anytime). The PM review gate is where quality decisions happen: feature type confirmation, boost input editing, and accept/reject with full visibility into readiness scores.

**Pipeline Bridge** — Maps copilot output to the existing Generator pipeline, skipping the Router (PM confirmed the type) and Draft Answerer (copilot already extracted structured answers). The spec generation pipeline receives cleaner, more complete inputs than it ever got from forms.

**Supabase Persistence** — Requests persist in PostgreSQL so stakeholders and PMs operate in separate sessions. A stakeholder submits on Monday; the PM reviews on Wednesday. No session state coupling.

## Architecture decisions

The two-call split was the critical technical insight: Call 1 generates the conversation (no tools, forces real text), Call 2 extracts structured data (forced tool call). Attempting both in a single call produced a persistent bug where the model would emit a tool call and skip the conversational response entirely. Separating the concerns solved it cleanly.

The Anthropic Advisor tool (Opus advising Sonnet) handles classification ambiguity. When the copilot isn't confident about feature type, it escalates to Opus for a second opinion rather than guessing. But confidence-based triggers missed confidently wrong classifications — a design gap documented for future iteration.

## What I learned

Conversations and pipelines are fundamentally different products. Pipelines optimize for throughput and quality. Conversations must also optimize for the experience of the person talking. "I don't know" is the most informative answer a stakeholder can give — it reveals their knowledge boundary, which is data for the PM, not a failure state.

Forms punish incomplete knowledge; conversations accommodate it. The copilot's ability to say "that's totally fine, the product team can figure that part out" is something a required field can never do.
