---
title: "Week 4 Journal: AI Product Architecture"
headline: "Week 4 Journal: AI Product Architecture"
week: 4
date: 2026-01-27
summary: "A deep week building multi-agent systems, resilience libraries, and cost optimization tools, shifting from individual AI components to production-grade AI product architecture."
tags:
  - multi-agent
  - tool-use
  - function-calling
  - resilience
  - cost-optimization
  - prompt-engineering
  - asyncio
  - model-routing
keyInsights:
  - "The difference between a component that works and a system that survives production is mostly error handling, validation, and graceful degradation."
  - "Start simple, add complexity only when justified — single-agent to multi-agent only when quality improvement justifies 2-3x cost."
  - "Don't optimize low-volume tools. Save optimization for products with 100+ uses/day."
  - "Context quality > context quantity — focused, relevant context beats comprehensive history."
  - "Knowing when to skip resilience is as important as knowing how to build it."
toolsBuilt:
  - "Multi-Agent Feature Spec Generator (v1 and v2)"
  - "Multi-Agent Conversation Manager"
  - "Multi-Agent ROI Analyzer"
  - "Resilience Library"
  - "Token Profiler"
  - "Smart Model Router"
  - "Parallelized Research Assistant"
  - "Personalization Strategy Assistant"
status: published
---

**Goal**: Build agentic systems that deliver complex outcomes. Break more stuff.

---

# What I Built

This is a long post. It was a long week. But it was well worth the effort to go deeper on agents, tool use, and resilience by revisiting (and up-leveling) some of the products I built in weeks 1-3.

## Day 1: Multi-Agent Feature Spec Generator

I started the week learning about multi-agent architecture patterns (Sequential, Parallel, Hierarchical, Reflexive etc.) and took a stab at redesigning my Feature Spec Generator as a multi-agent system. My first attempt was a hierarchical pattern with a Supervisor agent. It looked ok:

```markdown
Supervisor Agent
↓
├─ Question Generator (asks clarifying questions)
├─ Researcher (checks existing solutions)
├─ Spec Writer (generates specification)
└─ Quality Assurance Specialist (reviews quality)
```

Then I ran the numbers. My envisioned 5-agent Feature Spec Generator would cost $0.15 per run. The original version with the "McKinsey-style" semantic anchor from Week 2? $0.05.

**Is the 3x cost worth it?** This became a defining question of the week. The answer, I discovered, is that it depends a lot on value and scale. For my Feature Spec Generator, used ~10 times/week:

- Single-agent: $0.05 × 10 = $0.50/week = **$26/year**
- Multi-agent: $0.15 × 10 = $1.50/week = **$78/year**
- **Premium: $52/year**

But the multi-agent version:

- Catches build-vs-buy decisions (weeks of engineering saved)
- Incorporates research findings (Adobe Target already exists)
- Has QA review (fewer revision cycles)
- Is executive-ready (builds credibility)

The $52/year cost is meaningless compared to even one avoided engineering mistake or one executive presentation that goes smoothly. But for a high-volume chatbot running 10,000 queries/day, that 3x premium becomes $365,000/year. Definitely harder to justify at scale.

## Day 2: Multi-Agent Conversation Manager

The goal for Tuesday was to understand **how agents coordinate**. To do this, I rebuilt my Conversation Manager tool from Week 2 as a multi-agent system. At first, I tried a rather naive approach: pass everything as parameters.

```python
def run(domain):
    idea = generate_idea(domain)
    critique = critique_idea(idea)
    improved = improve_idea(idea, critique)
    qa_result = qa_check(idea, critique, improved, domain)
    final = finalize(idea, critique, improved, qa_result, domain)
```

This becomes unmaintainable quickly. 5 parameters become 10. 10 become 20. Chaos ensues. The better approach, as I learned, is to coordinate activities through **shared state** context.

```python
class MultiAgentConversationManager:
    def __init__(self):
        self.agents = {}  # Each agent has its own conversation history
        self.shared_context = {}  # Global state all agents can see
```

Each agent maintains its own conversation history (focused context) but can read from and write to shared state (coordination mechanism).

This pattern enabled the Research Assistant, where the Researcher agent runs **multiple times** (once per question) while maintaining independent contexts for each research task but accumulating results in shared state.

## Day 3: Multi-Agent ROI Analyzer

Wednesday's lesson was a deep dive on tool use and function calling. My lab assignment was to gather my tools into a shareable library file, connect a simple agent to the library, and then build a multi-agent ROI Analyzer system that makes use of the tool library.

#### Step 1. The Tool Library

The goal of this exercise was to create a reusable library of 5 tools that my agents can call:

```python
def calculate(expression: str) -> float:
    """Evaluate mathematical expressions"""

def web_search(query: str) -> list:
    """Mock web search (or use real API)"""

def servicenow_lookup(entity: str, field: str) -> dict:
    """Mock ServiceNow data lookup"""

def save_to_database(data: dict) -> bool:
    """Mock database save"""

def generate_image(prompt: str) -> str:
    """Mock image generation (return URL)"""
```

Instead of defining each tool inline (i.e., inside the same script as the agent that used them), the Tool Library pulls tools out of the agent and into a shared interface. This gives every agent a single, consistent "box" of tools with a predictable contract and one canonical schema per tool. Fix it once, fixed everywhere.

#### Step 2: Single Agent + Tool Library Integration

Next, I learned how to build an agent that receives a user request, decides which tools to use (via function calling), calls those tools, and synthesizes results into a response. The result was fascinating. Without tools, I got a generic answer:

- User: "Calculate ROI if personalization increases conversion by 2%"
- Agent: "Approximately $1M additional revenue, around 100% ROI"

With tools:

- User: "Calculate ROI if personalization increases conversion by 2%"
- Agent: [Calls servicenow_lookup("metric", "revenue")]
  [Calls calculate("5000000 * 0.02 * 0.1")]
  "Additional revenue: $10,000. ROI: -98% (investment exceeds return)"

The tool-enabled agent gave the **correct** answer by actually doing the math instead of guessing.

#### Step 3: Multi-Agent ROI Analyzer + Tool Library Integration

My final task was to combine everything I'd built into a solution with multiple tools + multi-agent coordination. I decided to turn my ROI Analyzer from Step 2 into a multi-agent system that:

- Calculates potential revenue impact (based on conversion lift)
- Compares to industry benchmarks (is our target realistic?)
- Factors in costs (engineering time, platform costs)
- Generates executive-ready recommendations (McKinsey-style)

Here's the conversation flow I outlined. To keep things simple, I tried to match each agent to a single tool (but without telling Claude which tool each agent should use):

```markdown
User: "Should we invest $500K to improve personalization and increase conversion by 2%?"
↓
Supervisor Agent: Breaks down into sub-tasks
↓
├─ Data Agent: Gets current metrics (servicenow_lookup)
├─ Calculator Agent: Computes ROI (calculate)
├─ Research Agent: Finds benchmarks (web_search)
└─ Analyst Agent: Synthesizes recommendation
↓
Output: Executive brief with data-driven recommendation
```

On the first run, I encountered a hallucination (it produced a 6,150% ROI that would make executives laugh me out of the room). So Claude showed me how to add steps in the process to ensure realistic conversion economics, assumption validation, and an alert that flags potentially unrealistic scenarios. I ran three different scenarios to simulate conservative, moderate, and aggressive investments, and applied a different conversion lift to each. Here are the results:

| Scenario     | Investment | Conversion Lift | Revenue    | ROI | Payback | Assessment           |
|--------------|------------|-----------------|------------|-----|---------|----------------------|
| Conservative | $250K      | +0.3%           | $468,750   | 88% | 0.5y    | ✅ realistic          |
| Moderate     | $500K      | +0.6%           | $937,500   | 88% | 0.5y    | 🟡 needs validation  |
| Aggressive   | $1M        | +1.0%           | $1,562,500 | 56% | 0.6y    | 🟡 needs validation  |

To be honest, this build was kind of grueling. Not the typical "I built this perfect thing in 45 minutes!" story I see on LinkedIn. But with a bit of prompt engineering, it was good enough to avoid getting laughed out of the room!

## Day 4: Failure Mode Tests and Resilience Library

Day 4 was about making systems that can "survive" production. So I grabbed my ROI Analyzer from Day 3 and systematically broke it to observe various scenarios. For example, what if the API times out? What if a tool returns null? What if you hit rate limits or context window fills mid-task?

Every failure fell into one of five patterns:

1. **Recoverable errors.** Network hiccups, API timeouts, rate limits. Transient failures that resolve themselves.
2. **Validation errors.** Bad inputs that will never work no matter how many times you retry.
3. **Resource exhaustion.** Token budgets running out, quotas exceeded. Can't retry (resources are gone), but can return partial results.
4. **Format mismatches.** LLMs returning JSON sometimes, prose other times. Need multiple parsing strategies with fallbacks.
5. **Catastrophic errors.** Authentication failures, system crashes. Things that can't be fixed programmatically and need human intervention.

After I broke my poor little ROI Analyzer, Claude helped me build it back up into a "production-ready" product with a full set of resilience features to handle for each pattern.

1. **Retry with backoff** for recoverable errors
2. **Fail fast** with validation errors
3. **Degrade gracefully** when resources are exhausted
4. **Parse defensively** with multiple fallbacks to handle format mismatches
5. **Log and alert** catastrophic errors that require human intervention

The resulting output quality was undeniably better. But it was a ton of work and a lot of additional overhead. For example, the retry logic = 2-3x more API calls on failures. Which begs the question: **when is resilience overhead worth it?**

## Day 5: Cost Control and Performance Optimization

My ROI Analyzer works, but it's expensive ($0.15 per analysis). So now it was time to learn where the costs were coming from, and make things 2-3x cheaper without sacrificing quality.

Here's a rundown of today's builds:

| Build | Description |
|---|---|
| **Token Profiler** | Instrumentation layer that identifies where tokens are being spent by wrapping API calls and tracks input tokens, output tokens, per-call cost, and which operation generated the spend. |
| **Optimized ROI Analyzer** | Redesigned to execute 1 LLM call + 4 tool calls ($0.05), down from 5 LLM calls ($0.15). 70% cost reduction by recognizing deterministic steps (lookups, math, validation) that don't need an LLM at all. The LLM's only job is synthesis at the end. |
| **Smart Model Router** | A classification layer that decides which model to call based on task complexity: Simple (factual Q&A, formatting) → Haiku; Complex (analysis, synthesis) → Sonnet. Classification was keyword-heuristic at first (`"analyze"`, `"compare"`, `"synthesize"` → complex; `"extract"`, `"format"`, `"list"` → simple), with prompt length as a fallback signal. The math that made this worth it: adding a ~$0.0001 classification call up front to route the main call saves $0.08 per call on anything classifiable as simple. At 1,000 calls/day, that's ~$29K/year. |
| **Parallelized Research Assistant** | Refactored to run independent research tasks concurrently using `asyncio` after I realized that the validation and research steps don't depend on each other, and can run in parallel instead of sequentially. Here's the agent architecture: `Planner (sequential) → [Q1 + Q2 + Q3 in parallel] → Synthesizer (sequential)`. The outcome was faster by a mile. Sequential 46s → Parallel 16s. Same cost, same quality. |

#### Was the Savings Worth the Effort?

I spent Day 5 learning optimization techniques that save $1-5/year on my current usage. In a practical sense, it was premature. But from a learning standpoint:

- I KNOW how to optimize when it matters
- I have reusable libraries (Smart Model Router, Token Profiler)
- When the time comes to build high-volume products, I'll be ready

## Day 6: Capstone Projects

Day 6 was the integration exam. By this point I had the Resilience Library (Day 4), the Smart Model Router (Day 5), the Multi-Agent Conversation Manager (Day 2), the Tool Library (Day 3), and the Token Profiler (Day 5) all ready to go. Day 6 was about putting them together into apps that a teammate might actually use.

### Feature Spec Generator v2

I returned to my multi-agent Feature Spec Generator from Day 1 and incorporated my learnings from the week. Same "supervisor" agent architecture, but now with full resilience via the library I built on Day 4, smart model routing for cost optimization, and a QA review loop with smart stopping. The cost per run came in at about $0.08 per spec, down from $0.15. 60-90 seconds end-to-end. Executive-ready output.

To make things interesting, I added two additional cost-performance "modes":

- Quick (skip Q&A and research, ~$0.04–0.06)
- Comprehensive (full Q&A + research + QA review with possible revision, ~$0.10–0.15)

For personal brainstorming, $0.05 is appropriate. For a middle-of-the-road feature, the default mode is sufficient. For executive specs guiding $500K engineering investments, the $0.12 cost is irrelevant.

#### Personalization Strategy Assistant

I also built a five-step strategic planning tool that analyzed current personalization tooling and capabilities, identified opportunities, generated A/B test plans in parallel (using `concurrent.futures` for true parallel execution), estimated ROI for each initiative, and prioritized everything into a Q2 roadmap. I used a mix of models (Haiku for capability analysis, Sonnet for opportunity identification and prioritization) and integrated it with my Tool Library to run mock data lookups and calculations.

This was a worthwhile build, but the app was not production-ready IMO since it used a mock data set. In the coming weeks, I will be exploring progressive data source enhancement, from manual config files to Google Sheets integration to real API connections.

# What I Learned

## Applied AI Systems Thinking

This week, I learned to build AI systems (vs. individual components). The difference between a component and a system is profound. A component does one thing. A system orchestrates multiple components to deliver complex outcomes while handling failures, managing costs, and maintaining quality under constraints.

The most valuable learning for me: The difference between a component that works and a system that survives production is mostly error handling, validation, and graceful degradation. Not glamorous, but essential. This shift helped me expand my mental model from components and features to product architecture.

#### AI Product Architecture Principles

Five principles emerged from Week 4 that will guide my AI product development practices:

1. **Start simple, add complexity only when justified.** Single-agent → Multi-agent only when quality improvement justifies 2-3x cost.
2. **Optimize for volume, not vanity.** Don't optimize low-volume tools. Save optimization for products with 100+ uses/day.
3. **Resilience is insurance, apply based on stakes.**
   - High-stakes, low-frequency → Full resilience
   - Low-stakes, high-frequency → Light resilience
   - Low-stakes, low-frequency → Skip resilience
4. **Context quality > context quantity.** Focused, relevant context beats comprehensive history. Give agents only what they need.
5. **Validate outputs against reality.** AI can generate convincing-sounding nonsense. Your job: sanity check the results against domain knowledge.

## The 80-20 Rules of Failure and Resilience

#### Rule 1: 80% of Failures are Recoverable, 20% Need Human Intervention

When I ran my failure experiments on Day 4, I discovered that 80% of these failures were recoverable with proper error handling:

- Retry transient failures (network, timeouts)
- Validate inputs before processing (catch bad data early)
- Monitor budgets and degrade gracefully (skip non-critical steps)
- Parse defensively (handle unexpected formats)

The remaining 20% were catastrophic and required human intervention:

- Authentication failures
- Complete system outages
- Data corruption

For these failure modes, the best approach is to log everything, alert humans, give users a clear error ID to reference.

#### Rule 2: Production Systems Are 80% Resilience, 20% Features

The unglamorous truth: My production ROI Analyzer is 600 lines of code. Only 150 lines are core functionality. The other 450 lines? Error handling, validation, logging, graceful degradation.

Resilience was premature optimization for my current use case. But I built it anyway for:

1. Learning value - I needed to understand the patterns
2. Future proofing - When I build high-volume products, I'm ready
3. Reusability - The library works for any future system

The insight for me: knowing when to skip resilience is as important as knowing how to build it.

## Agent Conflict Resolution

What happens when agents disagree?

**Scenario:** Research Agent says "Adobe Target already does this, just configure it." Spec Writer generates a build-from-scratch architecture.

I explored six resolution strategies:

1. **Hierarchical authority** - Supervisor decides
2. **Weighted voting** - Agents vote with confidence scores
3. **Sequential override** - Last agent wins
4. **Human-in-the-loop** - Ask the user
5. **Confidence thresholds** - Only override if very confident
6. **Explanation + arbiter** - LLM explains contradiction, another LLM decides

For my Feature Spec Generator, I chose **Strategy 5 + 6**: confidence thresholds with explanation when needed.

**Why?**

- Automated most of the time (confidence < 0.75 = no interruption)
- Transparent when decisions matter (shows reasoning)
- Learns from preferences over time
- Fits McKinsey-style "show your work" approach

However, I recognize different products need different strategies. A legal contract reviewer might use human-in-the-loop for all contradictions. A high-volume chatbot might use weighted voting for speed. There is no universal solution. Contradiction resolution is a product decision.

## Smart Stopping

How do you know when to stop? My Research Assistant originally had a hard limit: always generate exactly 3-5 questions and research all of them. But different queries have different complexity:

- "What is machine learning?" → 1-2 questions sufficient
- "Compare technical architectures of 5 CRM platforms" → 8-10 questions needed

Hard limits can waste tokens on simple queries and shortchange complex ones. Claude showed me how to implement dual stopping logic with two conditions:

1. High confidence achieved
2. Budget running low

This gave me two dimensions of control: **quality** and **cost**. Each stopping strategy optimizes for one dimension and constrains the other.

|              | **Low Cost**                                                                                              | **High Cost**                                                                              |
|--------------|----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| **High Quality** | ✅ **Ideal Zone** — confidence stopping ends the loop as soon as quality is good enough, before the budget is spent | ⚠️ Over-investment — kept running past the point where additional research added real value |
| **Low Quality**  | ⚠️ Budget stopping — ran out of budget before quality was sufficient; output is usable but thin            | ❌ Worst case — spent the full budget and still didn't hit quality threshold                |

**Confidence stopping** = "Stop when quality is good enough."
**Budget stopping** = "Stop when cost matters more than incremental quality."

The system automatically balances both, adapting to query complexity while respecting resource constraints. Whichever threshold fires first ends the loop.

# What I Struggled With

- **System-level failure points.** Most of my struggles were variations on one theme: systems break in places components don't. An agent confidently reported nonsense from hardcoded data. A classifier routed on keyword matches, not real complexity. A budget ran out mid-pipeline. These aren't really bugs, they're more like integration or pipeline failures.
- **Retrofitted resilience instead of building it in.** Built the ROI Analyzer on Day 3, learned the five failure patterns on Day 4, then spent half a day patching resilience into code that hadn't been designed for it. Lots and lots of troubleshooting.
- **Delusional (AI-generated) mock data.** My first version of the ROI Analyzer returned 6,150% on every test scenario. The math was correct, but mock data was delusional ($50M revenue, $1,562 AOV). It forced me to confront that the LLM was doing arithmetic it shouldn't have been doing, and that the data layer was modeling an absurd business by accident.
- **Smart Model Router logic.** The router was supposed to decide whether to send the prompt to Haiku or Sonnet based on task complexity. It passed the first three tests but the fourth one failed spectacularly. Eventually I determined the system was essentially asking, "does the prompt *sound* complex?" rather than, "is the *work* complex?" The recommended fix was to tighten the heuristics and default to Sonnet at low confidence intervals, but to make it work well at scale, I might need an LLM to explicitly classify the task complexity upfront.
- **Incorrect model version strings.** Token Profiler crashed on Test 4 with a 404. My first guess (`20250929`, sharing the Sonnet date) failed. Second guess (`20251022`) also failed. I finally tracked down the correct string, `20251001`, after many torturous minutes. I learned the hard way to default to `client.models.list()` when a 404 hits.
- **Lack of venv experience.** I hit a `ModuleNotFoundError: No module named 'dotenv'` error on Day 1 when I ran my first script of the week, the 2-agent Generator → Critic prototype. Technically it was a guardrail to prevent me from breaking system utilities. I got around it with `pip install python-dotenv --break-system-packages`. The flag has appeared in every venv setup since. Claude says it might come back to haunt me in the future.
- **State management mistakes.** `KeyError: 'user_query'` inside the Multi-Agent Conversation Manager on Day 2. `shared_context` was nested but the agent was accessing it directly. Taught me the price of state-management mistakes when multiple agents read from the same object.
- **Defensive parsing was harder than expected.** Multiple `AttributeError` and `JSONDecodeError` catches before the `DefensiveParser` actually handled all four format variations LLMs throw at you (clean JSON, fenced JSON, embedded JSON, prose with JSON-shaped substrings).

# Final Thoughts

Week 4 was where I stopped asking, "how do I make an API call?" and started asking, "how do I orchestrate five API calls across three agents with error recovery and cost controls?" It was sobering to see how much time and overhead goes into making AI systems production-ready. AI ideation is almost instant. Resilience and context management are not. But I feel far more confident that I can tackle AI product architectures and not just simple features and components. Next week will put my confidence to the test when I start deploying to Streamlit.
