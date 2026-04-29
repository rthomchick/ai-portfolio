---
title: "Week 8 Journal: Return of the Feature Spec Generator"
headline: "Week 8 Journal: Return of the Feature Spec Generator"
week: 8
date: 2026-02-17
summary: "Built a six-agent Streamlit system that automates the full SAFe feature spec workflow — from classification to scoring to polish — replacing a multi-session manual process with a consistent, 10-15 minute pipeline."
tags:
  - multi-agent
  - streamlit
  - safe
  - feature-spec
  - session-state
  - reflexive-architecture
  - llm-as-judge
  - workflow-automation
keyInsights:
  - "The system I built this week basically replaces me with Streamlit session state. Every st.session_state variable is a piece of context that used to live in my head or my clipboard."
  - "Boost inputs aren't optional polish; they're the mechanism that bridges the gap between 'competent AI output' and 'PM-quality specification.'"
  - "The insight that you cannot reliably instruct an LLM to leave text unchanged was expensive to learn, but it applies to every multi-agent pipeline, not just this one."
  - "The model cannot destroy what it's never asked to produce. (append-only output pattern)"
  - "Building AI products is mostly not about AI. It's about workflow design, structured data handling, error recovery, and knowing where the human adds irreplaceable value."
toolsBuilt:
  - "SAFe Feature Spec System (six-agent Streamlit application)"
status: published
---

*Goal: automate a multi-step product management workflow with quality-critical outputs.*

---

Week 8 was about utilizing all the things I'd learned so far to solve a real-world problem. I decided to revisit my Feature Spec Generator and re-imagine it as a multi-agent system.

# The Problem I Was Solving

Last year, my PM team created a shared prompt library to speed up the feature documentation process for our website. The prompts were very detailed and produced high-quality output, but the process still took hours or even days as each PM hunted down information from across the organization to answer 20-40 questions per feature.

I experimented with multiple chat sessions to speed things up:

- Session 1: Paste prompt → run Q&A interview (20-40 questions)
- Session 2: Help draft answers → copy back to Session 1 manually
- Session 1: Generate spec from answers
- Session 3: Paste spec into Review prompt → get 100-point scorecard → iterate by hand

That was the workflow. Three browser tabs, fragmented context, and me as the integration layer: a human clipboard, copying and pasting outputs between chat sessions. I was moving 2x faster, and my docs met the 90% scorecard threshold, but I could still only produce 2-3 docs a week. Not quick enough for leadership. They wanted 4-5 feature docs per week. All with 90+ scores.

I knew there must be a better way. And this week, I manifested it: an agentic AI system that can produce 4-5 feature docs per hour with a consistently high level of quality.

# What I Built

This week's build: a six-agent Streamlit application I call "SAFe Feature Spec System". The premise is simple; a PM describes the feature, pastes some notes, and the system handles (almost) everything else, including:

- Classifying the feature type (content, experience, capability)
- Drafting answers to clarifying questions
- Generating a full SAFe feature spec
- Scoring the spec against a 100-point rubric
- Improving the spec to meet quality thresholds
- Outputting a full spec with a score >= 90%

The system uses a reflexive (self-improving) architecture with six agents that have specific jobs.

| Agent | Model | Job |
|---|---|---|
| **Classifier** | Haiku | Reads the feature description and classifies it as a Capability, Experience, or Content request. This determines which question bank and which rubric interpretation to use. |
| **Clarifier** | Sonnet | Takes the PM's pasted notes and proposes answers to the interview questions, section by section. Where the notes don't cover something, it says so. **The PM reviews, edits, and fills gaps before the pipeline continues.** |
| **Spec Generator** | Sonnet | Takes all the answers and produces a full SAFe Feature spec with all required sections (e.g., strategy, scope, design dependencies, technical requirements), and user stories with acceptance criteria. |
| **Reviewer** | Sonnet | Scores the generated spec against a 100-point rubric, section by section. **The PM sees the scorecard and can paste boost inputs (additional domain context) for sections that scored below 75%.** |
| **Improver** | Sonnet | Takes sections that scored below 75% and rewrites them, targeting the specific rubric criteria that failed. |
| **Polisher** | Sonnet | A second-tier pass that auto-triggers when the overall score lands between 80-89%, pushing specs over the 90% threshold for leadership review. |

The whole pipeline runs in about 10-15 minutes per spec, costs roughly $0.15-0.25 in API calls, and consistently produces specs scoring 90+ out of 100. At 10 specs per week, that's about $100/year in API costs versus 10-20 hours per week of PM time recovered.

# What I Learned

## How to Replace Myself With Session State

The biggest insight of the week was realizing that my feature documentation workflow had turned me into the de facto supervisor or integration layer. Every piece of context that moved between the three sessions lived in my head or on my clipboard. The feature type? I knew it because I picked which prompt to paste. The interview answers? I copied them between tabs. The review scores? I read them, decided what to fix, and did the fixing by hand.

The system I built this week basically replaces me with Streamlit session state. Every `st.session_state` variable is a piece of context that used to live in my head or my clipboard. `st.session_state.feature_type` replaces my mental note of which prompt I chose. `st.session_state.answers` replaces the clipboard. `st.session_state.scorecard` replaces me reading the rubric and deciding what to fix.

This realization clarified the architecture. I wasn't building a "smarter prompt." I was making implicit PM workflow knowledge explicit and machine-readable. Each agent handoff needed to be defined precisely because the automated pipeline has none of the human flexibility I'd been relying on to bridge gaps.

## Boost Inputs and Two-Tier Improvement

Two design decisions combined to push specs from "decent" to "leadership-ready."

The first was **boost inputs**. After the Reviewer scores the spec, the PM sees the section-by-section scorecard and can paste additional domain context for sections that scored below 75%. Maybe the SEO section scored 50% because the original notes didn't mention canonical URLs or schema markup. The PM pastes those details as boost inputs, and the Improver incorporates them alongside the rubric feedback.

This is more than a UX feature. It's a philosophical choice about where the human belongs in the pipeline. The system generates, scores, and improves, but the PM still provides the domain knowledge that makes the difference between a generic spec and a grounded one. Boost inputs aren't optional polish; they're the mechanism that bridges the gap between "competent AI output" and "PM-quality specification."

The second was a **two-tier improvement threshold**. A single 75% threshold created a ceiling at 85-88. The Improver would fix the worst sections, but the spec would plateau just below the 90-point leadership review threshold. The fix: Tier 1 targets sections below 75% (fix the bad stuff). Tier 2 auto-triggers a polish pass if the overall score lands between 80-89 (push through to excellent). This mirrors how real PM revision works. First pass: fix what's broken. Second pass: elevate what's merely adequate.

Together, these two mechanisms produced consistent results across all three feature types:

| Case | Type | Original | Final | Delta | Grade |
|---|---|---|---|---|---|
| Realtime Decisioning | Capability | 71 | 93 | +22 | A |
| New Solution Web Page | Webpage | 71 | 94 | +23 | A |
| Progressive Profiling Form | Experience | 78 | 92 | +14 | A |

## Parse Once, Edit Independently, Reassemble

Early in the week, I tried positional string surgery to edit spec sections: find the offset of Section 7, extract it, modify it, splice it back in. This broke immediately because editing Section 7 shifts the offsets for Section 8 and everything after it. One change cascades into positional corruption.

The fix is Parse → Edit → Reassemble. Parse the spec into a dictionary of section objects once. Edit any section by key. Reassemble from the dictionary. Editing index 7 cannot affect index 8 because they're independent dictionary entries, not substrings of the same string.

Combined with the append-only Improver pattern, this means the spec is structurally immutable once parsed. The only way content changes is through explicit, targeted modifications that Python controls. The LLM never touches the structural layer.

# What I Struggled With

## The Improver Regression Saga

The User Stories regression consumed more debugging time than any other problem in the program so far. The symptom was clear (scores dropping on untouched sections), but the root cause was hidden behind the LLM's tendency to regenerate rather than edit. Each attempted fix (splice, criterion-level, filtered scorecard) required a full pipeline run to validate, and each one failed in a slightly different way.

What made it frustrating was that every fix felt correct in theory. "Just return the unchanged sections verbatim" is a perfectly reasonable instruction for a human to follow. It's just not how language models work. The insight that you cannot reliably instruct an LLM to leave text unchanged was expensive to learn, but it applies to every multi-agent pipeline, not just this one.

The solution came from an Opus consultation: **append-only output**. Instead of asking the Improver to return the full spec, have it return only XML blocks describing additions and modifications. Python handles the concatenation. The model never sees the sections it shouldn't touch, so it can't corrupt them. **The model cannot destroy what it's never asked to produce.**

## Feature Type Boundary Cases

The Router occasionally misclassified features at the boundary between EXPERIENCE and CAPABILITY. A "progressive profiling form" is technically a form component (EXPERIENCE) but involves backend logic for progressive disclosure (CAPABILITY-adjacent). This didn't fully resolve in Week 8. The Router v2 fix came in Week 9 during the A/B testing work.

## The Rubric Itself Has Opinions

The 100-point rubric I'd been using for manual reviews turned out to encode assumptions I hadn't examined. Some sections weighted criteria that only matter for certain feature types. Some criteria overlapped, letting a single piece of missing information penalize multiple sections. Tuning the rubric and type-aware Reviewer prompt was iterative and took longer than I expected.

# What's Next

The SAFe system is deployed and I'm using it for real specs. Five deployed tools now, with this one as the flagship.

Week 9 shifts to evaluation infrastructure: building the measurement layer that lets me prove the system works and track whether prompt changes make it better or worse. The ±7 point LLM-as-judge variance I noticed this week means I need multiple runs, statistical baselines, and proper A/B testing, not one-off spot checks. The Router classification flakiness needs a controlled comparison. And the 14-25 point bare/boosted spread I'm seeing is a measurable signal that PM-provided context has quantifiable value, something I can design an intake form around.

But the biggest takeaway from this week isn't technical. It's the realization that building AI products is mostly not about AI. It's about workflow design, structured data handling, error recovery, and knowing where the human adds irreplaceable value. The AI agents do the heavy lifting. The PM still provides the judgment. The product is the system that connects them.

The mental model keeps building:

Weeks 1-4: AI that thinks  
Week 5: AI others can use  
Week 6: AI that knows your data  
Week 7: AI that reasons about what it needs to know  
**Week 8: AI that replaces a manual workflow end-to-end**

---

*Week 8 complete. I've evolved from human clipboard to pipeline architect.*
