---
title: "Week 19 Journal: Marketing Claim Governance Service, Part 4 — Memory Retest"
headline: "Week 19 Journal: Marketing Claim Governance Service, Part 4 — Memory Retest"
week: 19
date: 2026-07-28
summary: Retested Week 18's Memory hypothesis against real vendor compatibility claims, found the rubric couldn't distinguish well-formed rulings from correct ones and cold-start agents were already consistent without Memory, and killed the Managed Agents approach.
goal: "Retest Week 18's Memory consistency question with a revised hypothesis and a set of compatibility claims from real technology vendors."
tags:
  - managed-agents
  - memory
  - claims-governance
  - mcp
  - rubric-design
keyInsights:
  - "Cold-start rulings were consistent without Memory: the per-platform-family standard, the pointer-as-not-evidence treatment, and the missing-date non-disqualification held in near-identical language across every rationale, varying only in how range notation interacts with lifecycle."
  - "The rubric could not discriminate between well-formed rulings — I wrote it for a different question, whether an isolated grader could apply it without judgment calls, and reused it here without asking whether a gradability instrument could measure consistency."
  - "The outcome measure was never wired: the column meant to hold per-criterion scores is hard-coded to a null value, so no per-criterion breakdown was captured anywhere in the run."
  - "Against the locked answer key, the agent's per-platform-family standard scored 4 of 23, wrong in the same hedging direction every time."
  - "Kill: neither this retest nor the prior week's experiment had a check that the metric could produce two different numbers, so there was nothing for Memory to fix."
status: published
---

## Motivation

[Week 18's hypothesis](https://www.richardthomchick.com/journal/week-18-claims-review-agent#hypothesis) asked whether Memory made the agent agree with itself "more often." Two things are fused there. There's a claim about the world: Memory makes the agent more consistent. And there's a measurement procedure: count how often verdicts match, compare rates. But the test ran each claim once per arm, so there was nothing to count.

This week separates the claim about the world from the instrument that measures it, testing whether an agent with a prior ruling available applies the same evidence standard to a comparable claim, or re-derives from the rubric each time in ways that vary.

I also ditched the synthetic claim material in favor of six real vendor compatibility claims from Dell, Lenovo, and Broadberry, checked against real Red Hat certification records with real certification IDs. I kept the synthetic registry that populates the rest of the system out of this retest set. The agent, the rubric, the Memory store, and the grading are all live.

## Hypothesis

#### An agent with a prior ruling available applies the same evidence standard to a comparable claim, while an agent without one re-derives from the rubric, and re-derivation varies.

*Threshold: Memory-on mean must exceed memory-off by at least one criterion of agreement per ruling.*

*Falsifies if: 1) memory-on shows no more stability than cold-start; 2) memory-on is worse, anchoring to a standard the second claim didn't warrant; or 3) the prior transfers the verdict but not the standard: same conclusion, criterion-level reasoning diverging as much as a cold-start agent's.*

*Level of test: 24 sessions, 6 agreement scores per arm, per-criterion agreement rather than verdict agreement. The third falsifier is the one the prior week's design could not have seen, because standards live in the criteria, not the verdict.*

## Methodology

**Setup**: Claims Desk MCP server on Railway with a Supabase backing store; the Claims Review Agent on Managed Agents, reading claims live via MCP against a nine-criterion Outcomes rubric inherited from the prior week, with Memory mounted read-only. Six Red Hat compatibility claims from different vendors, each with a structured evidence record built from a Red Hat Ecosystem Catalog detail page.

**Test design**: 3 claim pairs × 2 arms × 2 repetitions, pair-interleaved rather than arm-blocked, with Memory cleared between each chain's memory-off and memory-on halves and a hash-before-delete log per clear.

**Held constant**: claims, evidence records, rubric, agent prompt outside the memory-conditional region, model, tooling, run-order position. Varied: presence of the memory_store resource.

## Key Decisions

#### A pointer to a version list is not the same as naming versions

Some vendor claims name Red Hat Enterprise Linux with no version, then point to a page listing supported versions. That pointer never satisfies an automatic check, since those read the stored evidence record, not the claim's words. It counts when judging scope, weighted by where it leads: the certifier's own records can close the gap; the vendor's own page lowers risk without closing it; a dead link does nothing at all.

*Why: The gradient measures how strongly a claim is worded. This is a different question: whether a claim naming no version can be treated as having named one by reference. That belongs with scope.*

*Tradeoff: Reopening a locked pre-commitment, after the rule had already been used once to lock the answer key.*

#### The registry's rulings table stays empty

The Claims Desk has a table for storing review rulings, and nothing has ever written to it. Rulings keep going to the Memory store instead, and a separate table records each session's ruling and grade. No agent-facing tool reads it.

*Why: The tool that fetches a claim also returns any prior ruling on it. Wire up the table and the control arm's second repetition would see the first's ruling through a channel unrelated to Memory, voiding runs in a way that looks like plumbing failure rather than a design error.*

*Tradeoff: Defers the question instead of answering it. Leaves the ruling surface unwritten.*

#### A run whose grading never finished doesn't count

The retest's first run came back failed because the grader hit an overloaded API on its single attempt. It never scored a single criterion, so the run is void.

*Why: The measure is per-criterion agreement, and there is nothing to compare. Not low scores, not partial scores: the grader never ran. Counting it would mean scoring against criteria that were never produced.*

*Tradeoff: Discards a complete, coherent ruling and leaves one arm of one pair with a single ruling instead of two.*

## Findings

Every automatic check returned the same result on all six claims, so the outcome rested entirely on the rubric's two judgment criteria. The rubric returned the same perfect score in both arms. Reading the eleven cold-start rationales directly, I found the same standard in ten of them, varying only on version-range notation.

| Quantity | Result |
|---|---|
| Manipulation check | 24 of 24 pass |
| Per-criterion agreement, memory-on | 7.0 / 7 |
| Per-criterion agreement, memory-off | 7.0 / 7 |
| Verdict-level correctness | 4 of 23 |
| Rationale-level consistency (cold-start) | Identical in 10 of 11; one dimension varies |

#### Red Hat certifications carry forward across minor versions

*Evidence: Red Hat Hardware Certification Program Policy Guide; Red Hat Customer Portal solution 401413 (worked example); HPE certification collateral restating it independently. The host's automated-access policy blocked a direct fetch of the primary source.*

*Lesson: the lock needs sources for the rules it applies, not only for the claims it applies them to. The candidate report had fetched, quoted, resolving claims and an invented rule.*

#### Rubric behavior on compatibility claims

Reading the rubric criterion by criterion against a compatibility claim, I found that only two of the seven criteria in the agreement denominator can vary: whether the verdict matches the evidence standard, and whether the scope note overreaches. Evidence citation, valid verdict, no reputational grounds, internal consistency, and slug addressing are near-constant passes. Compliance currency auto-satisfies on a non-compliance claim type, so I excluded it, and I pulled memory consistency out to serve as the manipulation check.

*Evidence: the nine-criterion rubric text as recorded in Week 18's chat log, read against the retest set. This is a reading of the rubric, not an observation of grading.*

#### The outcome measure returned the same value in both arms

*Evidence: 207 of 207 criteria scored MET across 23 graded runs. The measure was not close to flat, it was flat.*

#### Correctness against the locked verdicts: 4 of 23

I checked each ruling's verdict against the answer key I locked on 2026-08-30, before any session ran. Nineteen of the 23 graded rulings came back `partially` and four `not_substantiated`, all four on the second Broadberry claim. The key holds two `substantiated` and four `not_substantiated`; the agent was wrong in the same hedging direction every time. This measures verdicts only, not the reasoning underneath them.

*Lesson: the correctness-reporting commitment required this, and it is the only pre-committed quantity the data could support. I committed to reporting it on 2026-08-29, before any result, which is why I have it now.*

#### Cold-start rulings are consistent without Memory

*Evidence: I read all 11 memory-off rationales in full. The per-platform-family standard, the pointer-as-not-evidence treatment, and the missing-date non-disqualification held in near-identical language across every one; only how range notation interacts with lifecycle varied between repetitions.*

## What Broke

Two failures carry the week: 1) the outcome measure was never wired, and 2) the instrument built to grade it could never move. A third is smaller, but it outlives the experiment.

#### The outcome measure was never wired

*Class: validity · Severity: existential · Resolution: won't fix*

The column meant to hold per-criterion scores is hard-coded to a null value in the launcher's session-recording step, and nothing else writes to it. The grading step surfaces only an overall result and a block of explanation text, so no per-criterion breakdown is captured anywhere in the run. The column's own comment says it exists so I could score agreement by query rather than by parsing the gitignored run logs, which is exactly what it made impossible. An earlier scoping report had already named the field as a concept with no supplier, before any session ran.

#### The rubric cannot discriminate between well-formed rulings

*Class: validity · Severity: existential · Resolution: won't fix*

The nine criteria ask whether a ruling is well-formed: evidence cited by id, verdict drawn from the enum, reasoning that tracks the standard as the agent applied it, a scope note no broader than the evidence. A competent agent passes all nine every time, because I wrote the rubric for a different question, whether an isolated grader could apply it without judgment calls, and reused it here without asking whether a gradability instrument could measure consistency. Three distinct grader rendering styles appeared across the 23 runs, and every one of them yielded MET on every criterion.

#### Lenovo Press renders its PDFs on demand

*Class: validity · Severity: blocker · Resolution: worked around*

Re-fetching the SR650 V3 product guide returned 187 pages in a file 26KB smaller than the 143-page version I had quoted earlier. Lenovo Press maintains these guides as living HTML documents, and the server renders the current page to PDF on every request. Both documents had also been updated since the first pass. Nothing in the file identifies which version you have, so a claim quoted from one can drift out from under the registry that stores it.

## Interpretation

The flat agreement number and the rubric's design are the same failure seen twice: a ruling applying the wrong standard consistently is exactly as well-formed as one applying the right one, so the number could not move. Reading the rationales supplies what neither the rubric nor a verdict count could. The cold-start agent is consistent almost everywhere the evidence standard speaks, and varies only where it stays silent. That consistency is not correctness. Against the locked answer key, the agent's per-platform-family standard came out 4 of 23, stably wrong in the same way every time.

The carry-forward correction is the other half of the week's real content. The Lenovo pair's correct verdict inverted once I sourced the range-notation policy across three publishers, which also exposed that every pair as originally recommended shared one verdict value: an agent defaulting to "exceeds" would have scored perfectly across the set.

## Limits & Open Risks

The rubric measured neither half of the hypothesis. The rationales reached the second half, that a cold-start agent's re-derivation varies, and largely contradicted it. I never measured the first at all. Untested rather than refuted is the conservative reading of a conjunction where I tested only half.

The consistency reading covers one agent, one standard, six claims checking RHEL certification against Red Hat catalog records. Whether the same holds where the standard poses open questions is untested.

## The Verdict

**Kill.** The retest suffered from the same weakness as the previous week's experiment. Neither had a check that the metric could produce two different numbers. The hypothesis assumed an agent without Memory would be inconsistent. It wasn't, so there was nothing for Memory to fix.

---

*Experiments concluded. Not adopting Managed Agents at this time. Week 20 will complete the remaining deliverables: an agent-readable product page with a set of real-world claims, and a claims manifest an agent can actually verify against.*
