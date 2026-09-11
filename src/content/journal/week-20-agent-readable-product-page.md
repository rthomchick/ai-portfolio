---
title: "Week 20 Journal: Marketing Claim Governance Service, Part 5 — Discovery"
headline: "Week 20 Journal: Marketing Claim Governance Service, Part 5 — Discovery"
week: 20
date: 2026-08-04
summary: Built a front door for agent discovery — a claims demonstration page, a machine-readable manifest, and a read-only registry endpoint — and verified that three classes of browsing agent could traverse from page to manifest to substantiation status.
goal: 'Create a "front door" for agents to discover and validate claims they encounter on a webpage.'
tags:
  - claims-governance
  - mcp
  - agent-discovery
  - structured-data
  - append-only
  - cors
  - supabase
keyInsights:
  - "All three agent classes completed page → manifest → substantiation status and enumerated every claim in the manifest; none stopped at the visually prominent claim."
  - "The adversary reasons differently about a claim whose evidence link leads somewhere real than about one that dead-ends. Three claims produced three different kinds of failure: no traceable evidence at all, evidence that actively contradicts the claim, and real evidence that does not cover what the claim says."
  - "Some agents will only fetch a URL they arrived at through something they already fetched. Each hop in this traversal hands the agent the next URL, so the chain stays reachable where a bare list of links would not be."
  - "The same append-only design that made the traversal trustworthy to a restricted fetcher also let eight fixture rows sit undetected in the table it governs."
  - "I guard the places where my code calls a database and not the places where it calls a model, and a classifier trip showed that habit is unjustified."
  - "What I would change: verify the identity of anything I specify by name before building on it."
toolsBuilt:
  - Public claims-manifest demonstration page with stable per-claim anchors and ClaimReview structured data
  - Machine-readable claims-manifest.json
  - llms.txt
  - Append-only review_rulings table with a gated write tool and read-time verification
  - Read-only per-claim JSON endpoint with cross-origin access
status: published
---

## Motivation

By now, I had a claims registry behind an [MCP server](https://www.richardthomchick.com/journal/week-16-marketing-claim-governance-service-part-1) and an [adversarial agent loop](https://www.richardthomchick.com/journal/week-17-substantiation-adversary) that attacks a claim's evidence and renders a verdict. A later review agent hedged too much to trust, so the loop stayed the instrument. All of it worked, but none of it was discoverable: the registry answered a program speaking MCP, and only if that program already held a claim's internal ID.

I also wanted to make a website's own claims more legible to an agent reading it. A marketing claim published as prose is unverifiable by a machine: an agent cannot tell a claim backed by reviewed evidence from one backed by nothing. So this week, I built a front door for agent discovery: a webpage, a machine-readable manifest, and a path from any claim on the page to the record of whether it survived review.

## Goal & Success Criteria

1. A browsing agent successfully verifies at least one claim end-to-end: page → manifest → registry.
2. "Verifies" means the agent reaches a substantiation status, not that it confirms the underlying evidence is real.

## Key Decisions

#### Append-only facts, derived state

`review_rulings` is the append-only source of truth, with a four-value verdict column and a `(claim_id, created_at DESC)` index. The tools compute verification state and evidence currency on read. I deprecated `claims.status`.

*Why: rulings are facts, and facts only get appended. A claim's current state is a reading of those facts, not a second thing to keep in sync. The old `claims.status` column tried to hold two unrelated ideas at once, whether a claim had been reviewed and whether its evidence had expired, and it had no slot for two of the four possible verdicts.*

*Tradeoff: with state computed at read time, nothing sits between a ruling being written and an agent reading it. I moved that checkpoint upstream, into the script that decides which rulings get written at all.*

One premise behind this decision turned out false. I cited a verdict three times as confirming it, and that verdict had no artifact anywhere in the system. No row, no repo hit, no git history. The decision still holds on the three runs this week actually produced, but I made it partly for a reason that did not exist.

#### Rulings come from the Week 17 adversary

The Week 17 adversary, a multi-agent workflow that attacks a claim's evidence round after round until it stops finding new problems, produces the rulings. A script decides which ones get written. The manifest records which instrument produced each verdict and when. The Week 18 review agent stays out of the write path: against a locked test set it hedged on nearly everything, getting 19 of 23 wrong.

*Why: the adversary is the stronger instrument on evidence, and it already speaks three of the four verdicts the registry stores.*

*Tradeoff: likely all-red manifest on the synthetic claims, which I frame as the finding that the page cannot oversell to an agent even while overselling to a human.*

#### Fixture rulings get deleted rather than superseded

I deleted the eight fixture rows with a committed script targeting explicit ids, refusing to run if the count differed from eight and printing each row before deletion.

*Why: append-only protects a record of facts from silent revision, and these rows were never facts, only test writes that landed in production.*

*Tradeoff: breaks append-only discipline once, deliberately and in a documented way.*

## What Shipped

I shipped a public claims-manifest demonstration: a page rendering four claims, each with a stable anchor an agent can link to and, on the three that have rulings, `ClaimReview` structured data in a format scrapers already parse. Beside it, a machine-readable `claims-manifest.json` listing each claim's verification state, the instrument that ruled on it, and whether its subject is real, plus an `llms.txt` saying the same in prose. Behind it: an append-only rulings table, a write tool that gates what enters it, verification computed at read time, and a read-only JSON endpoint per claim that a browser-based agent can fetch across origins. Three rulings from the Week 17 adversary back three of the four claims.

## Findings

1. A browsing agent successfully verifies at least one claim end-to-end: page → manifest → registry. **Met.**
2. "Verifies" means the agent reaches a substantiation status, not that it confirms the underlying evidence is real. **Met.**

#### Three agent classes traversed one live artifact

All three agent classes completed page → manifest → substantiation status and enumerated every claim in the manifest; none stopped at the visually prominent claim.

*Evidence: three transcripts; live URL; the server-side fetcher's fetch sequence.*

#### Retrievable evidence changes the shape of the reasoning, not just the verdict

The adversary reasons differently about a claim whose evidence link leads somewhere real than about one that dead-ends. Three claims produced three different kinds of failure: no traceable evidence at all, evidence that actively contradicts the claim, and real evidence that does not cover what the claim says.

*Evidence: three persisted rulings with full rationales, each readable at its claim's `substantiation_url`, reached by three distinct routes.*

#### The artifact carries the argument

External agents reconstructed the arc's central findings and its central limitation from the artifact alone, unprompted.

*Evidence: four agent transcripts across four days, naming Week 17's hygiene-versus-substantiation distinction and the artifact's own provenance limitation.*

#### The manifest is a provenance chain

Some agents will only fetch a URL they arrived at through something they already fetched. Each hop in this traversal hands the agent the next URL, so the chain stays reachable where a bare list of links would not be.

*Evidence: the fetcher refused the same registry endpoint as unprovenanced on Day 1, then retrieved it on Day 4 with no change to the endpoint.*

## What Broke

Three failures were structural. Test fixtures landed in production, indistinguishable from real rulings: a suite reported "6/6 pass against live DB" without recognizing that as a write, and the schema marked no difference. That one is open, and 48 of 71 rows in the claims table are also residue, ten of them still showing as live claims; I scoped this week's cleanup to rulings only.

The second failure inverted a decision's own purpose: the registry never exposed two columns the manifest needed, so the generator scraped them out of the ruling's prose and published a value that does not exist in the vocabulary, telling agents two verdicts were more settled than they were.

The third: a run died mid-loop when the script read a field off an agent that had returned nothing, and three of the seven places where the script calls an agent had no check for that.

#### CORS initially blocked cross-origin fetch from a page context

CORS blocked the pilot agent's attempt to fetch the registry JSON from the browser. The `substantiation_url` is cross-origin from the page, and the Railway server sent no `Access-Control-Allow-Origin` header. I had flagged this exact risk at kickoff and dismissed it on reasoning that covers an agent navigating to a URL but not one fetching from inside a page.

The fix was a permissive header on the read-only route, which I verified on the 200, 404, and preflight paths. Two things worth keeping separate: the header makes the in-page fetch path work, and it is not what unblocked the successful traversal, because that agent navigated rather than fetched. Conflating them would overstate what the fix bought.

**Class:** artifact · **Severity:** blocker · **Resolution:** fixed

#### Unguarded dereference after a provider-side classifier trip

A run threw `TypeError: null is not an object` and terminated after ~200K tokens of completed work. The round-1 adversary hit a safety classifier and returned null; the script then read a field off that null without checking. All three unguarded sites sat in the adversarial loop. The classifier trip itself did not reproduce on retry, and I never established a cause. Only unit tests verify the guard; all 12 agents completed on the retry, so it has never fired in live conditions.

**Class:** artifact · **Severity:** blocker · **Resolution:** worked-around

#### Eight fixture rulings in the production table

A test suite wrote eight rows into `review_rulings` with canned one-line rationales, all in a 27-second burst. On inspection I could not tell them apart from instrument-produced rulings. The suite reported passing while writing to production, and nothing in the schema marked the difference. The fix: transaction-rollback isolation first, then a committed cleanup script deleting the eight by explicit id.

**Class:** validity · **Severity:** blocker · **Resolution:** open

#### The manifest published a value outside its own enum

Two of three ruled claims carried `convergence: "stable_verdict"`, a value that does not exist. `get_claim_status`'s `latest_ruling` query never selected `convergence` or `rounds`, though both are columns on the table. The generator compensated by parsing rationale prose.

**Class:** validity · **Severity:** blocker · **Resolution:** fixed

## Interpretation

The central tension: the same append-only design that made the traversal trustworthy to a restricted fetcher also let eight fixture rows sit undetected in the table it governs. The gate checks that a ruling is well-formed, not who wrote it, and append-only means I can only supersede a bad write, never quietly remove it. Computing state at read time keeps every reader consistent, but only readers that come through the tools, and the test suite wrote straight to the database. I intended neither property. The chain fell out of linking rather than embedding, and a restricted fetcher can follow it where scattered URLs would stop it.

Retrievable evidence changed the adversary's reasoning, not just its verdict, which is the strongest argument for adding the Salesforce claim. Not exposing that reasoning cleanly had a cost: the generator could not read the real value for how a review ended, so it published one saying the opposite. One habit generalizes: I guard the places where my code calls a database and not the places where it calls a model, and a classifier trip showed that habit is unjustified.

## Limits & Open Risks

Confirming that the evidence behind a substantiation status is real was out of scope by design; every synthetic claim evidence link points at a domain that does not resolve, so I never tested the last hop. The fixture contamination remains open: 48 test-residue rows sit in the claims table, ten of them still showing as live claims. I do not know whether the rule about only fetching URLs an agent arrived at is common to server-side fetchers or specific to the one I tested; the chain explains why it did not block this pilot, not whether it would block another. The traversal is one run per class with no repetition, and two of three classes are the same product under different instructions, not independent agents.

## Retrospective

The staging discipline (one claim at a time, so a crash implicates one component rather than the whole path) let the classifier-trip crash and the contaminated rows surface separately rather than as one failure. Reading emitted artifacts instead of reports about them caught the invented convergence value and the Salesforce provenance gap; a summary had called both clean.

What I would change: verify the identity of anything I specify by name before building on it. I specified a claim set from slugs without reading the claim text, cited a verdict from a standing document without checking the registry, and asserted a row count rather than re-querying it. All three trace to one habit.

---

*The registry has a front door now, built to let agents check the claims they encounter. Next week I'll measure how reliably an agent can identify false premises in these claims.*
</content>
</invoke>
