---
title: "Claims Desk"
description: "A deployed marketing-claim governance service: a registry that answers deterministic questions about a claim, an adversarial workflow that argues the judgment calls, and a public record an agent can fetch instead of taking vendor prose at face value."
status: deployed
deployUrl: "https://www.richardthomchick.com/projects/claims-desk/demo"
repoUrl: "https://github.com/rthomchick/claims-desk"
weekBuilt: 16
tags: ["mcp", "agent-skills", "claim-governance", "adversarial-review", "structured-data", "agent-discovery", "supabase"]
problemSolved: "Every company makes claims. \"40% faster deployment.\" \"#1 rated on G2.\" \"SOC 2 Type II certified.\" And every claim carries risk: legal exposure, analyst pushback, procurement scrutiny, the FTC. All too often, this is governed via spreadsheets and helter-skelter email threads between marketing and legal."
architecturePattern: "Claims registry on MCP over Supabase (deterministic hygiene checks, no verdict) + script-orchestrated adversarial workflow (judgment) + read-only JSON route and generated manifest for agent discovery"
techStack: ["Python", "Supabase", "PostgreSQL", "Railway", "Claude Opus", "Claude Sonnet", "Claude Haiku"]
sortOrder: 0
journalSlug: "week-16-marketing-claim-governance-service-part-1"
---

## Motivation

Every company makes claims. "40% faster deployment." "#1 rated on G2." "SOC 2 Type II certified." The Claims Desk is a deployed marketing-claim governance service. It files a claim, holds the evidence offered for it, and then argues about whether that evidence actually holds. I built the filing and the arguing as deliberately separate instruments.

Some claims can be validated in a deterministic manner. Others take judgment to validate. In practice, claim governance is a spreadsheet and an email thread between marketing and legal. The Claims Desk replaces all that with a registry that answers the deterministic questions, an adversary that argues the judgment calls, and a public record an agent can fetch instead of taking the vendor's prose at face value.

## Solution approach

The system splits at the line between what a machine can check and what it has to judge:

- A claims registry holds the structured record and answers deterministic questions about it
- A separate adversarial workflow argues about whether the evidence behind a claim holds

Nothing in the registry renders a substantiation verdict, and that refusal is the load-bearing choice: `check_substantiation` runs its hygiene checks and stops, with its own tool description saying so at tool-list time.

I began with synthetic claims from an invented organization, Kalder. Testing the system exposed the limits of asking an agent to verify invented data against the real world, so I added one real Salesforce claim (FedRAMP compliance). Later, I moved to real system compatibility claims in the wild, using the [Red Hat Ecosystem Catalog](https://catalog.redhat.com/) as the source of truth.

**Key decisions:**

- **I put three of the four reasoning roles on MCP and kept the substantiation check thin: hygiene only, no verdict.** Three downstream callers had to agree on one risk verdict, so judgment lives in one place. See [Week 16 journal](https://www.richardthomchick.com/journal/week-16-marketing-claim-governance-service-part-1) for details.
- **The adversary attacks claim evidence only. I filter reputational and credibility attacks at the prompt level.** The desk answers whether a claim is substantiated, not whether a company is trustworthy. See [Week 17 journal](https://www.richardthomchick.com/journal/week-17-substantiation-adversary) for details.
- **I disclose the synthetic subject on three surfaces: a per-claim subject object in the manifest, ClaimReview JSON-LD on the page, and footer prose for humans.** Each surface has a different reader, and [ClaimReview](http://schema.org/ClaimReview) maps almost directly onto what the registry holds. See [Week 20 journal](https://www.richardthomchick.com/journal/week-20-agent-readable-product-page) for details.

## Architecture

![Claims Desk complete architecture: a four-part system over one shared registry, spanning the Week 16 capability surface, the Week 17 substantiation adversary, the Week 18-19 claims review agent, and the Week 20 agent-readable product page](/images/projects/claims-desk-architecture.svg)

The registry opened with four MCP tools over Supabase, which I reach on the pooler connection with psycopg2 instead of PostgREST, with two Agent Skills carrying the reasoning the tools decline to do. Rulings live in an append-only table that computes verification state on read rather than storing it. A read-only JSON route and a generated manifest sit in front for agents that do not speak MCP, each claim carrying a `substantiation_url` rather than the rationale inline.

Three consumers read that one registry, and the third is what makes the consistency argument concrete. The adversary calls the registry from a script-orchestrated workflow, the manifest over the public HTTP route, and the review agent on Managed Agents remotely over HTTPS. It pushed the registry past a single caller's assumptions: soft-delete replaced a cascade that had been destroying rulings, and `list_claims` exists because the agent needed to find claims.

The adversarial workflow runs outside the registry, orchestrated by a script rather than a model holding the plan in context. I assign models by role, and the loop converges when the adversary stops generating new critical attacks, publishing the convergence mode per claim.

## Findings

The deterministic layer does what it claims: all tools live at the deployment URL, a write from one client readable by another, the risk classifier returning `prohibited` for zero-evidence claims. I verified each directly. What matters is what happened to a claim it cleared.

#### A claim can pass every hygiene check and still receive a `not_substantiated` verdict from the adversary

kalder_resolve, a single synthetic performance claim, passed every hygiene check and still came back `not_substantiated` in three rounds, on attacks no field check could make: circular vendor citations, a causal claim its own disclaimer contradicts, and sources measuring a triage sub-phase while the claim asserts full resolution time. It shows the gap exists; it does not measure how often it occurs in real registries.

The adversary discriminates in both directions, rejecting the synthetic claim above and accepting a real one backed by a government registry. Running it is expensive, and the arc's strongest engineering result is about where that expense sits: moving the orchestration plan into a script more than halved the same task, all of it coordination.

| | **Arm A (plan-in-context)** | **Arm B (plan-in-script)** |
|---|---|---|
| Work tokens | ~300K | ~305K |
| Coordination tokens | ~445K | 0 |
| Total | ~745K | ~322K |
| Relative cost | 2.3× | 1.0× |

#### Plan-in-script incurs zero coordination-model tokens, while plan-in-context incurs roughly 445K for the same two-round adversarial task, a 2.3× total cost difference

I measured it directly, holding claim, model tiers, convergence rule, output schema, and round count constant across arms. One claim, two rounds: the ratio holds at that scale, and the staircase shape is structural, linear in rounds times accumulated context.

#### Three agent classes each completed the full page-to-manifest-to-registry traversal and enumerated all four claims

Three transcripts against the live demo URL, covering browser agents with and without MCP and a server-side fetcher. Four claims, two agent products: directional.

## What broke

A check reported success when the thing it checked never happened. A test suite wrote fixture rulings straight into the production table in a 27-second burst, reporting "6/6 pass against live DB" before I recognized that as a write. The architecture read in reverse: append-only means I can only supersede a bad write, never quietly remove it, and derived-on-read state holds only for readers going through the tool layer, which the suite never did.

#### Eight fixture rulings with canned one-line rationales appeared in the production `review_rulings` table

Blocker, still open.

The manifest generator needed convergence data the registry never exposed, so it parsed the value from rationale prose, telling agents two verdicts were more settled than they were.

#### The manifest published a convergence value of `stable_verdict` on two of three ruled claims, a value that does not exist in the enum

Blocker, fixed.

Over two weeks I asked whether an agent carrying a prior ruling applies a more consistent standard than one starting cold, and neither attempt produced a usable measurement: I wrote the first hypothesis as a rate but tested it with one observation per cell, and the retest returned 207 of 207 criteria met in both arms. The kill condition fired, and I recorded the memory question untested rather than answered.

#### The rubric cannot discriminate between well-formed rulings. I built it to catch malformed ones

Existential, and the one that ended the line of work. I closed it without a fix.

## Limitations and open risks

The headline finding rests on one synthetic performance claim and establishes that the gap exists, not how often it occurs in a real registry. Confirming that the evidence behind a substantiation status is real is out of scope entirely: every Kalder `evidence_url` points at a domain that does not resolve, so I never tested the last hop.

Six failures ship open across the arc:

- A prompt injection whose carrier I never identified (Week 16).
- A deployed lifecycle parameter with no enum constraint, so nothing prevents passing a substantiation value into the lifecycle filter (Week 18).
- An unclosed attribution gap: claim records carry no field tracing a row back to the session that wrote it (Week 18).
- Evidence rows surviving a soft-deleted parent claim, which the substantiation check does not filter (Week 19).
- A second, traceless hard-delete path alongside the registry's soft-delete convention (Week 19).
- A grader with no retry on transient overload, so it records one overloaded call as a completed grading outcome (Week 19).

Separately, 48 test-residue rows remain in the claims table, ten of them active and visible to `list_claims` (Week 20).

## Retrospective

**What went well.** The registry held up as shared infrastructure: every tool live at the deployment URL, a write from one client readable by another, and three consumers reading one risk verdict across three weeks without any one of them deriving a standard of its own. The adversary did the job I built it for, rejecting a metadata-clean synthetic claim and accepting a real one. The claims page and manifest gave agents a path to the evidence, and three agent classes walked it end to end without special handling.

**What went wrong.** The memory question never got a measurement. I used a rubric built to catch malformed rulings and asked it to discriminate between well-formed ones, which it cannot do, and I spent two weeks finding that out. The hypothesis should have been testable before I ran it.

**What I'll carry forward.** Plan-in-script for anything with a loop, since the coordination tax is structural rather than a tuning problem. Check that an instrument can move before committing weeks to it. And compatibility claims look like the right next target: published matrices like the VMware Compatibility Guide are high-volume, machine-checkable, and exactly where an agent reaching the evidence starts to matter commercially.
