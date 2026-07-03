---
title: "Buying Group Personalization Advisor"
description: "AI-powered advisory tool for enterprise marketing teams running buying group personalization programs, built on a synthetic B2B SaaS corpus with three interaction modes and a live website experience simulator."
status: built
repoUrl: "https://github.com/rthomchick/buying-group-personalization-advisor"
weekBuilt: 15
tags: ["rag", "multi-agent", "next-js", "pinecone", "anthropic", "buying-group", "personalization", "b2b", "martech"]
problemSolved: "Enterprise marketing teams running account-based personalization programs lack a fast, grounded way to answer configuration questions, diagnose program problems, or walk through operational workflows without hunting across multiple strategy documents."
architecturePattern: "Next.js monorepo with three-mode advisor interface (Build 1), decisioning simulator (Build 2), and stack integration specification (Build 3); Python/FastAPI scoring engine sidecar; two-store Pinecone retrieval; FLAG/HOLD workflow state machine"
techStack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 4", "Anthropic Claude API", "Pinecone", "OpenAI Embeddings", "Python", "FastAPI", "Vercel"]
sortOrder: 17
journalSlug: "week-15-advisor-application-layer"
---

## What it does

The Buying Group Personalization Advisor is a four-module product built for three personas: Marketing Operations Engineers, Demand Generation Managers, and Content Strategists. Each mode solves a different problem the same user encounters at different points in their week.

Reference Mode handles the day-to-day configuration questions — "what's the confidence threshold for a Level 1 experience?" or "what signals qualify a contact as a Champion?" It searches a nine-document corpus and returns precise, grounded answers with source citations. Answers that fall below the retrieval confidence threshold are labeled as such rather than quietly returned as if they were confident. Advisory Mode is for program-level diagnosis. You describe a problem — forty percent of target accounts stuck at unknown confidence for six weeks — and the Advisor reasons across the full strategic framework to produce a diagnosis and a recommended next step. It's scoped to three MVP problem types: classification state diagnosis, cohort performance diagnosis, and sales escalation readiness. Guided Workflow Mode walks users step by step through three predefined operational processes: onboarding a new account (18 steps), commissioning content before it goes live (12 steps), and running a signal-monitoring check (8 steps).

The Website Experience Simulator is the "show, don't tell" piece. Feed it a visitor state — buying group role, confidence level, solution category, buying stage — and it renders what that visitor would see on the website, with a decisioning trace panel showing every rule that fired to produce that experience. Comparison mode puts two visitor states side by side so you can watch the same page structure produce two different experiences and see, in the trace, exactly why. This is the demonstration vehicle for the full personalization program without requiring a live martech stack.

## Architecture decisions

The retrieval layer uses two distinct stores rather than a single vector index. A Pinecone vector index handles corpus prose — the nine strategy documents that define the buying group program. A structured JSON index handles data model records: JTBD codes, confidence tiers, decay multipliers, cross-role weights, scoring rules. Prose and tabular data have fundamentally different retrieval signatures, and a single vector store handles one well and the other poorly. The similarity threshold was calibrated empirically to 0.38 against observed Pinecone score distributions — not from a pre-index spec value. The first guess was 0.75, set before the index existed. The correct answer was a query that scored 0.40 on the right document, which was below threshold. That's how you learn the right number.

Advisory Mode builds its system prompt at runtime from three layers: a base instruction layer, corpus sections relevant to the question, and the user's current session context. It distinguishes two kinds of confidence — classification confidence (how sure the model is about a visitor's role) and diagnostic confidence (how sure the Advisor is about its own reasoning) — and surfaces both explicitly, including two first-class program states (differential_insufficient and pending_solution_fallback) rather than silently eliding edge cases. Guided Workflow Mode uses a FLAG/HOLD interrupt system with workflow-scoped step ID dispatch to prevent cross-workflow collision. HOLD is an integrity interrupt: non-bypassable, blocks advancement. FLAG is an advisory interrupt: requires acknowledgment after all HOLDs clear. The evaluator was tested against a 20-step collision table covering all three workflows before shipping.

The full project lives in a Next.js monorepo (build1-advisor, build2-simulator, build3-spec) with a shared TypeScript types package and a Python/FastAPI scoring engine sidecar. Build 2 implements the full 8-step Document 5 decisioning sequence, including three-axis interaction evaluation (role x confidence x stage), correct holdback group override behavior, and progressive disclosure state management across all 11 module slots.

## What I learned

Retrieval tuning is an empirical practice, not a configuration step. You set a threshold against observed score distributions from real queries hitting a real index — not against a number that sounded reasonable before the index existed. The two-store architecture was the direct engineering answer to a lesson from Week 14: distributed definitions across prose and structured data require different retrieval strategies, and discovering that after you've built a single-store system is expensive.

Verifying an agentic build is its own skill, distinct from doing the build. The Build 2 simulator had five commit messages claiming passing test suites — 50/50, 54/54, 27/27 — with zero test files on disk at the time. The numbers were real in some terminal session and were never committed. When I rebuilt the missing test suite (189 assertions total), writing the tests found a genuine source defect: the decisioning engine's Step 7 was missing a trace entry on its fall-through path, contradicting the file's own documented contract. A one-line fix. That's the payoff for writing tests: not just coverage, but a defect that nothing else had caught. The gap between "the agent said it's done" and "it's actually done" doesn't close itself.

The UX critique at the end of the week produced a finding that's worth naming separately from the engineering work: the build was architecturally correct and a first-time user still couldn't pick it up and use it. PT taxonomy codes (PT-1, PT-2, PT-5) were exposed directly in the UI as user-facing labels. "Corpus" appeared as unrecoverable jargon. The three Guided Workflows were grouped by implementation pattern rather than by client journey position, burying Onboarding as a peer option alongside tools a user might never need on day one. No orientation layer anywhere. Correct and usable are two different bars. An engineering-first development process will consistently hit the first one and miss the second unless you explicitly build in a pressure-testing step.

## Domain context

The corpus is synthetic, built to represent Kalder — a fictional $8B ARR AI-native enterprise platform company. The buying group personalization program modeled in the corpus reflects real enterprise martech architecture: AEP (Real-Time CDP B2B Edition) for unified profile management, Adobe Target for decisioning, Snowflake for the buying group classification model, and a nine-document strategy corpus covering role architecture, signal definition, audience segmentation, content modeling, decisioning rules, journey convergence, measurement, operations, and privacy. The architecture and domain expertise are genuine; the company is synthetic.

The full data model is a canonical Python file (~7,000 lines, v0.2.0) that all nine corpus documents derive from. Week 15's verification pass was the first real integration test of whether five derived documents had stayed in sync with a changed canonical. Three of them hadn't. A spec-driven document corpus doesn't maintain its own coherence — explicit resync passes triggered by any canonical change are part of the cost of the architecture.
