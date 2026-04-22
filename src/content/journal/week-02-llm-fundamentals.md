---
title: "Week 2: LLM and API Basics"
headline: "Week 2: LLM and API Basics"
week: 2
date: 2026-04-18
summary: "Hands-on experiments with tokens, context windows, streaming, and prompting techniques reveal that AI product management requires an entirely new economic mental model."
tags:
  - tokens
  - context-window
  - prompt-engineering
  - streaming
  - python
  - rate-limits
  - product-management
keyInsights:
  - "Tokens are atomic units of value and experience — you have a budget, you spend on input, you receive on output, and every interaction has a measurable cost."
  - "Semantic anchors (e.g. 'McKinsey-style') compress hundreds of tokens worth of implicit instructions into 3–4 tokens, with deep implications for brand identity in AI contexts."
  - "Streaming is not just a UX trick — it genuinely reduces time-to-value through parallel processing: you start consuming output before generation finishes."
  - "AI product economics differ fundamentally from SaaS: marginal cost per user is a predictable token cost, not near-zero, forcing PMs to think in token budgets, velocity, and efficiency."
  - "Claude's sycophancy is a real reliability risk — it can back down from a correct position under pushback, making it hard to have an honest technical debate."
toolsBuilt:
  - "Conversation History Manager (with sliding-window context compression and configurable token threshold)"
  - "Feature Spec Generator (SAFe-format, with Q&A step to reduce hallucination)"
status: published
---

**Goal**: Understand how LLMs work and gain practical API experience.

---

I started breaking things this week. On purpose. As it turns out, breaking things with purpose was an effective way to vibe-code a few simple Python tools and get hands-on with the basics like tokens, context windows, temperature control, and streaming vs. batch output.

## What I Built This Week

### Conversation History Manager

I learned about context windows and ran four "context stress test" experiments with multi-turn conversations via the Claude API to observe token growth and see how the context window fills up. In the fourth experiment, I deliberately tried to exceed the rate limit with a long input (~50,000+ tokens) and got the following error:

> This request would exceed the rate limit for your organization of 30,000 input tokens per request

On the upside, I didn't spend any money. But it was still a hard fail. In a production app, I would need a way to manage the context window, control costs, and handle errors more gracefully. So the next experiment was to build a simple conversation history manager and test out different context management strategies like sliding windows.

Claude Code helped me take it further with a configurable token threshold (a percentage of the context window, e.g., 80% of 200K tokens). The conversation history manager monitors token usage as messages accumulate. When usage crosses that threshold, it applies a context management strategy and alerts the user:

```
⚠️ THRESHOLD EXCEEDED: 5,234 > 5,000 tokens
🔄 Auto-compressing using 'sliding_window' strategy…
✂️ Removed 8 old messages (sliding window)
✅ Compressed: 2,456 tokens (saved 2,778)
```

Breaking stuff with purpose taught me a lot about rate limits, tier-based constraints, and why error handling matters. But it's also kind of crazy to think about how much effort (and code) goes into Keeping the Thing from Breaking vs. Doing the Thing.

### Feature Spec Generator

I went down a rabbit hole while experimenting with different prompting techniques. I wrote five different prompts for the same task (drafting a feature spec) and compared outputs. Prompt 4, which included "McKinsey-style format," won by a clear margin AND was far more concise than the other techniques. Fewer tokens, better quality. Win-win.

Claude told me this is called "semantic anchoring." To test the impact, I swapped "McKinsey-style" for "professional format" and ran it again. The prompt basically broke. But it led me on a side quest to build something I'd actually use: a feature spec generator tailored to Scaled Agile Framework (SAFe) environments.

At first I felt like I was building a Frankenstein prompt with "McKinsey" and "SAFe" as my anchors. The output was pretty good, but Claude often extrapolated or invented (hallucinated) details instead of asking clarifying questions. So I added a Q&A step, which put a human in the loop and gave Claude the extra context it needed *before* it generated 4,000 tokens of detailed specs. The output quality was noticeably better, and the additional token overhead seemed negligible.

## What I Learned

### Tokens Change Everything

Starting to learn about tokens completely changed my perspective on gen AI. There's a very real, quantifiable cost to this stuff:

- You have a "budget"
- You "spend" tokens on input
- You "receive" tokens as output
- You're literally buying and selling intelligence in token-sized chunks

Tokens also directly impact UX in measurable ways:

- **Time to first token** = how quickly the experience starts
- **Tokens per second** = how smooth it feels (like frame rate in video)
- **Total tokens** = the depth and completeness of the interaction

My new mental model: **tokens are atomic units of value and experience.**

### What Changes for Product Management

With traditional software products, user experience is determined by response time, uptime, and features; the marginal cost per user is almost $0. Netflix can add a million subscribers and the additional cost is trivial.

But with an AI product, user experience is determined by token generation speed, context retention, and output quality; value is measured by intelligence per token; and the marginal cost of every user is a predictable token cost per interaction.

This means PMs need to think about:

- Token budgets in product design
- Token velocity for UX
- Token efficiency for unit economics
- Token allocation across features

No wonder I see token-based pricing everywhere, features that limit context window usage, optimization for token efficiency, and prompt caching becoming a huge deal.

### Semantic Anchors Carry Weight

If pictures are worth 1,000 words, semantic anchors are worth 1,000x their weight in tokens. "McKinsey-style format" costs only 3–4 tokens yet compresses hundreds of tokens worth of implicit instructions about MECE frameworks, executive summaries, and hypothesis-driven structure.

Semantic anchors have deep implications for digital branding. When you say "McKinsey format," Claude doesn't just know the structure — it infers quality bar, depth, tone, detail level, and audience assumptions. Which begs the question: what do AI/ML models infer from your brand name and identity?

## What I Struggled With

- **venv confusion (again):** Couldn't find my venv from Week 1. Had to create a fresh one. The system couldn't find `python`. Had to be reminded to activate the venv.
- **API key in the wrong place:** Put the raw API key string inside `os.environ.get()` instead of setting it as an environment variable. Had to generate a new key.
- **Trailing whitespace crash:** The ConversationManager crashed on Turn 3 because Claude's response had trailing whitespace. Fix was one line (`.strip()`), but it took debugging to find.
- **Filename conventions:** Claude repeatedly produced filenames with underscores and mixed case, while the artifact system saves as lowercase-with-hyphens.

## Final Thought: Can I Really Trust Claude?

This week, I encountered a bit of the false confidence and sycophancy that people complain about. While explaining streaming vs. batch output, Claude confidently told me, "the perceived speed of streaming is faster, but the actual time is the same."

I pushed back: streaming doesn't just *seem* faster from a UX perspective — it *is* faster. Time-to-value is genuinely reduced because you start consuming output before generation finishes. That's parallel processing, not psychology.

Claude backed down immediately and spent several paragraphs validating my framing.

The exchange actually left me *less* confident in my pushback. Was I right? Or was Claude just gassing me up? I have real doubts about whether I can have an honest debate with it. Sycophancy isn't just annoying — it's a reliability problem.
