---
title: "Week 14 Journal: Buying Group Personalization Advisor, Part 1 — Data Model and Specs"
headline: "Week 14 Journal: Buying Group Personalization Advisor, Part 1 — Data Model and Specs"
week: 14
date: 2026-05-31
summary: "Built the information architecture for a B2B buying group personalization advisor: a canonical data model and a nine-document corpus designed for both human practitioners and AI retrieval."
goal: "Build a robust AI advisor for B2B buying group personalization, starting with a solid data foundation."
tags: ["information-architecture", "rag", "data-modeling", "knowledge-base-design", "retrieval"]
keyInsights:
  - "A spec that isn't the runtime is a feature, not a limitation: making the data model a pure specification that nothing imports made the system governable, since there's exactly one place where a fact like signal weights is true."
  - "Distributed definitions are the enemy of retrieval: the same concept defined in three places, slightly differently, will produce three different answers when an AI retrieves it. Define it once, reference it everywhere."
  - "Two reviewers catch what one misses: where two independent review lenses flagged the same defect, I had high confidence it was real; where they disagreed, the disagreement surfaced an assumption I hadn't made explicit."
  - "Privacy architecture earns its own document: the audience for consent rules (legal, procurement, InfoSec) is different from the audience for signal weights, and coupling them would mean every regulatory update touches the source of truth for scoring."
status: published
---

As Seth Earley likes to say, "there's no AI without IA." For this build, a buying group personalization advisor, I knew I would need a solid data foundation to make it work. So this week, I built the information architecture, including:

- Canonical vocabulary (the data model): one authoritative name and definition for every entity, so nothing gets restated three different ways. This is the labeling system.
- An organization scheme (the operational-vs-specification split across nine documents): a deliberate structure for what goes where. This is the organization system.
- Relationships and navigation (the dependency chain and per-document cross-reference tables): what each document depends on and what depends on it. This is the navigation layer.

> Note: Modeling an enterprise website personalization program requires a lot of proprietary data that I do not possess. For demo purposes, I invented an imaginary company ("Kalder") and a synthetic dataset. References to this organization appear throughout this journal entry (and the build itself).

![Stylized "AI Advisor" title graphic for the buying group personalization advisor project](/images/journal/week-14-ai-advisor-title-graphic.png)

## What I Built

### The Data Model

`kalder_data_model.py` defines every entity the personalization program reasons over. To see why these particular entities exist, it helps to follow the one question the whole system answers: when someone lands on the website, how does it decide what to show them?

The answer runs through a chain, and each entity is a link in it:

- **Buying group roles (Champion, Economic Buyer, Influencer, User, Ratifier)**. B2B purchases aren't made by one person; they're made by a group, and each member wants something different. The Economic Buyer cares about cost and risk. The User cares about whether the thing actually works day to day. Personalization starts by inferring which role a visitor is playing, because that determines what message lands.
- **Signals and their weights**. You can't ask a visitor their role, so you infer it from behavior. Downloading a security whitepaper, requesting a demo, viewing a pricing page: each is a signal. But signals don't count equally for every role. A pricing-page view weighs more toward Economic Buyer than toward User. The model stores twenty cross-role signals and the weight each one carries for each role.
- **Decay windows**. A demo request last week means something very different from a demo request eight months ago. Signals lose predictive value over time, so each one decays on a schedule. This keeps the system reacting to who someone is now, not who they were a year ago.
- **Confidence tiers**. Inference is probabilistic, so the system tracks how sure it is. A visitor with one stale signal is low confidence; one with several recent, corroborating signals is high confidence. Confidence gates behavior: the system only personalizes aggressively when it has earned the right to, and falls back to safe, generic content when it hasn't. Guessing wrong is worse than not guessing.
- **The content node schema**. Personalized pages aren't hand-built for every role-and-stage combination; that wouldn't scale. Instead, pages are assembled at render time from modular content nodes. The schema defines what a node is and what metadata it carries, so the system can pick the right pieces for the right visitor.
- **The JTBD (jobs-to-be-done) code library**. Role is who someone is; the job is what they're trying to accomplish. A Champion researching whether a category of product even fits their problem has a different job than a Champion building an internal business case. The library catalogs these jobs so content can be matched to intent, not just identity.
- **The privacy and consent architecture**. None of the above is allowed to run on a visitor who hasn't consented to it, and the rules differ by jurisdiction. Consent state gates which signals can even be collected, so this isn't a compliance afterthought bolted on at the end; it's a precondition the rest of the model is built around.

Together, these entities form the moving parts of a single decision: infer who the visitor is and what they're trying to do, decide how confident you are, and assemble a page that fits, without ever using data you weren't permitted to use.

The critical design decision: this file is a specification, not a runtime layer. The application never imports it. Instead, every downstream artifact (the corpus documents, the retrieval schema, the simulator's decisioning logic) derives from it. It's the single point where a definition like "what is the signal weight of a demo request for an Economic Buyer" lives authoritatively. Change it here, and everything downstream inherits the change.

```python
MODEL_STATUS = {
    "role": "canonical_specification",
    "description": (
        "This module is the canonical specification from which all downstream "
        "artifacts are derived. It is NOT a runtime data layer: the application "
        "does not import this file directly. Downstream systems derive their "
        "schemas, API contracts, and CMS structures from this specification."
    ),
    "derivation_chain": {
        "direct_consumers": [
            "Document 1: Buying Group Role Architecture",
            "Document 2: Signal Definition and Confidence Model",
            # ... Documents 3 through 9
        ],
        "downstream_systems": {
            "aep":           "Derives attribute schema from BUYING_JOB_CONFIDENCE and CLIENT_ATTRIBUTE_MAP",
            "ml_classifier": "Derives training signal definitions from CROSS_ROLE_WEIGHTS and TITLE_ROLE_MAP",
            "cms":           "Derives content taxonomy from CONTENT_TYPES, MODULE_TYPES, CONTENT_GRAPH_NODE_TYPES",
            "crm":           "Derives stage and role fields from BG_STAGES and CONFIDENCE_TIERS",
            "ai_advisor":    "Reads JTBD_CODES, TITLE_ROLE_MAP, and SOLUTIONS for advisory logic",
        },
    },
}
```

### The Nine-Document Corpus

The data model defines the entities. The corpus explains how they work together, and it's what the Advisor actually retrieves from.

The architecture principle that governed every document: write for two audiences at once. Practitioners need narrative and judgment. Retrieval systems need tight scope boundaries, explicit entity references, and consistent section headers. These pull in opposite directions. The resolution was to separate operational documents (written for humans doing the work) from specification documents (authoritative sources of truth for both humans and machines), and to impose four rules on every document: reference canonical entity names exactly, open with a scope statement, close with a cross-reference table, and use consistent headers across the corpus.

The nine documents:

1. Buying Group Role Architecture is the ontological foundation. Who's in a buying group, how roles are classified, how one person occupies different roles in different solution contexts.
2. Signal Definition and Confidence Model covers every signal, its per-role weight, decay behavior, and consent classification.
3. Audience and Segmentation Architecture covers how accounts and contacts map to cohorts and channels.
4. Content Model and Taxonomy is the content node schema and the rules for assembling pages from graph nodes.
5. Personalization Decisioning Rules is the logic layer between a classified visitor and a served experience.
6. Buying Group Journey and Convergence Model covers stages, the double-diamond diverge/converge structure, and the JTBD code library.
7. Measurement and Experimentation Framework is the metric hierarchy and the experimentation standards that prove the program works.
8. Operational Runbook is what practitioners actually do, week to week.
9. Privacy and Consent Architecture is the standalone consent framework for legal, procurement, and InfoSec review.

![Diagram of the nine-document corpus showing Buying Group Role Architecture as the ontological root](/images/journal/week-14-document-corpus-ontological-root.png)

The documents aren't a flat set. They form a dependency chain. Role Architecture is the root; nothing can be written until it's locked, because every other document references its role definitions. The chain determines authoring order: you can only write a document once everything it depends on exists. Privacy and Consent runs as a parallel track, unblocked once the Signal Definition is done.

![Diagram of the document dependency chain with Role Architecture as the root document other documents depend on](/images/journal/week-14-document-dependency-chain.png)

## What I Learned

### A Spec That Isn't the Runtime Is a Feature, Not a Limitation

My first instinct was to make the data model do something: import it, run it. Making it a pure specification that nothing imports felt wrong at first. But the separation is what makes the system governable. There's exactly one place where "demo request weighs X for an Economic Buyer" is true. Every other system derives from it. When that fact changes, I change it once. A runtime object scattered across an application can't give you that.

### Distributed Definitions Are the Enemy of Retrieval

The single biggest structural lesson: the same concept defined in three places, slightly differently, will produce three different answers when an AI retrieves it. The original instinct in most documentation is to re-explain a concept wherever it's relevant, because it feels helpful to the reader. For RAG, it's poison. Two decisions on this build came from the same principle: collapsing title lookup into a single map, and the entire premise of the Role Architecture document (extracting role definitions into one canonical home). Both are the same lesson at two scales: define it once, reference it everywhere.

### Two Reviewers Catch What One Misses

The data model went through two independent review lenses (one focused on domain logic and one on architectural integrity). The four conflicts between them were more valuable than the agreements. Where both lenses flagged the same defect from different angles (the scoring-order bug), I had high confidence it was real. Where they disagreed, the disagreement surfaced an assumption I hadn't made explicit. Reconciling two rigorous-but-divergent reviews produced a better artifact than either would have alone.

### Privacy Architecture Earns Its Own Document

I initially architected the consent rules as a section of the data model, but later promoted it to a standalone document in recognition that the audience is different. Legal, procurement, and InfoSec evaluate privacy independently and will never read the signal-weight tables. And coupling consent rules to signal weights would mean every regulatory update has to be made in a file that's also the source of truth for scoring.

## Challenges

**Writing for humans and machines simultaneously.** Every document had to satisfy a practitioner who wants narrative judgment and a retrieval system that wants rigid structure. These never fully reconcile. I had to manage the tension rather than resolve it. The operational/specification split was the lever, but individual documents still required constant calibration between "explain this" and "define this."

**Sequencing discipline under the urge to jump ahead.** The dependency chain meant I couldn't write the documents in the order I found interesting. The Decisioning Rules document is the most fun, because it's where the system visibly does something, but it sits near the end of the chain and depends on five upstream documents being locked. Respecting the sequence required resisting the pull to build the exciting part first.

**Resolving review conflicts without a tiebreaker.** When two review tracks disagreed, there was no automatic rule for which wins. Each of the four conflicts had to be reasoned through on its merits, which meant re-deriving the underlying principle rather than counting votes.

## Final Thoughts

This week produced no demo. Nothing animated, nothing a buyer would point at and say "cool." What it produced is the thing that determines whether everything built on top is true: a canonical data model that governs every downstream artifact, and a nine-document corpus structured so an AI can retrieve from it without contradicting itself.

The payoff comes next week. With the knowledge layer locked, Week 15 is where it becomes a product: the builds that turn this corpus into an Advisor people can actually use.

*Week 14 complete. The foundation is poured. Next week, we build on it.*
