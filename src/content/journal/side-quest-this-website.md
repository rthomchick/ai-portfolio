---
title: "Side Quest: Building This Website"
headline: "Side Quest: Building This Website"
date: 2026-06-19
summary: "A retrospective on building richardthomchick.com from a static MVP through a four-phase evolution spanning unified search, AI-powered content interactions, visual animations, and evaluation infrastructure."
goal: "build a website and content workflow to publish information about the projects I've worked on as part of my 6-month AI PM learning plan. Try new stuff."
tags:
  - astro
  - tailwind-css
  - pinecone
  - openai
  - anthropic
  - rag
  - semantic-search
  - pagefind
  - vercel
  - ai-evaluation
  - text-to-speech
  - server-sent-events
  - canvas-animation
keyInsights:
  - "The key constraint I had to build in explicitly: do not rewrite the author's prose. Without that guardrail, Claude Code will try to \"improve\" your writing, as I experienced first-hand."
  - "Baseline: 15/15 grounded-correct, 0/15 training-leakable — system prompt grounding instruction is effective."
  - "Root cause for Ask AI grounding failure: retrieval miss — the grounding chunk existed in Pinecone at rank 9 but journal topK was 6. Fixed by raising journal topK 6 to 10, project topK 8 to 12."
  - "The Summarize feature simulates a typewriter/streaming effect using requestAnimationFrame over ~1100ms — giving the impression of a live AI response even though it's static."
  - "Single Pinecone index holds all content types: journal prose, project prose, project source code. The slug filter and chunkType metadata handle scoping."
toolsBuilt:
  - "Unified site search (keyword + semantic + RAG Ask AI)"
  - "Content Actions toolbar (Summarize, Listen, Ask AI)"
  - "GitHub code blocks feature with inline source links"
  - "AI evaluation infrastructure (15-question golden set)"
  - "Ambient background animation system (Starry Night + Filament Flash)"
  - "/publish-journal Claude Code publishing skill"
status: published
---

I needed a place to publish my journal entries and showcase the projects I've been working on. A few people suggested platforms like Medium and SubStack, but I'm more interested in building cool websites than building a subscriber base (been there, done that, kept the receipts). 

This wasn't a "build a quick portfolio in an afternoon" story. I took some time to make deliberate architectural decisions, learn a new framework, and think about what it means to build an "AI-native" website in the sense that data infrastructure (e.g., vector database), conversational interfaces, and other elements were accounted for as part of the original design (vs. bolting a chatbot onto Drupal or WordPress).

The website came together in four major phases:

1. MVP: Static pages, minimalist design, essential metadata, basic publishing workflow 
2. Discovery: Unified site search with 3 search result tiers (keyword, RAG, Ask AI) 
3. Interactivity: AI Actions toolbar on journal and project pages (Summarize, Listen, Ask AI)
4. Visual accoutrements, infrastructure hardening, AI evaluation: shiny objects, hidden work

Some features are frivolous. Some features do heavy lifting. All of them were fun to build.

## Phase 1: Initial MVP Build

Phase 1 is a static site deployed to [richardthomchick.com](https://www.richardthomchick.com). Built with Astro 5 and Tailwind CSS 4, it ships zero JavaScript to the browser; every page is static HTML. I was tempted to use Hugo, which I already know well. But Astro treats React components as first-class citizens, which will make it easier to implement dynamic features like chat and semantic search.

### Content

The site has five core sections: a homepage with a featured journal entry, recent entries, shipped projects, and a reserved hero slot; individual journal entry and project pages; and an about page. Content lives in markdown files with YAML front matter schemas validated at build time. An entry won't build if a required field is missing; the framework catches it before deployment.

### Design

The visual design is intentionally minimal and spare. For the MVP, I focused on color and typography only. Just barely enough to give the site a coherent design language and a clear upgrade path. UX components, shadow DOM, tokens—all that stuff will come later as I build out the site. My intent is to prioritize conversational UI over traditional components like cards.

![MVP homepage showing minimal typography and color system](/images/journal/side-quest-this-website-mvp-design.png)

### Deployment

Deployment is a one-step operation: `git push` triggers an automatic Vercel rebuild. No CI/CD pipelines yet. I did however automate the publishing workflow by building a reusable Claude Code skill, (`/publish-journal`) that ingests my draft content, generates the markdown file, builds the site to verify no broken references, and then commits and pushes everything. What used to be almost an hour of repetitive tasks is now a single command. 

The key constraint I had to build in explicitly: *do not rewrite the author's prose*. Without that guardrail, Claude Code will try to "improve" your writing, as I experienced first-hand.

## Phase 2: Unified Search

Some people say search isn't sexy, but I love to geek out on information retrieval and I was especially eager to implement RAG and chat alongside traditional keyword search.

Phase 2 adds three-tier search: **keyword** search via Pagefind (built at build time), **semantic** search via OpenAI embeddings and Pinecone, and a **RAG** "Ask AI" mode powered by Claude. The vibe I was chasing: something like AI Mode (Google) or Genius Results (ServiceNow). Type a query, and three things happen simultaneously:

1. Keyword search (Pagefind) runs a keyword search client-side with zero API calls
2. Semantic search (OpenAI embeddings + Pinecone) runs on the server side to find conceptually related content even when the exact words don't match
3. Claude synthesizes an AI answer from the top results and streams it back, with inline citations linking back to specific journal entries and project pages

The AI answer card sits above everything in a teal-accented panel with a grounded, first-person response sourced from the actual journal content. Below it, keyword and semantic results merge into a single ranked list with badges showing which method found each result. Metadata filters (All / Journal / Projects) let readers narrow results on the client side. 

![Search results page showing AI answer card above merged keyword and semantic results](/images/journal/side-quest-this-website-search.png)

## Phase 3: Interactivity (Summarize, Listen, Ask AI)

Phase 3 is where the site started doing things that static sites can't. The centerpiece: a Content Actions feature that enables visitors to interact with the content. Every journal entry and project page now has a horizontal action bar between the header and the body that enables visitors to summarize, listen to, and ask questions about the content. 

![Content Actions toolbar showing Summarize, Listen, and Ask AI buttons above article body](/images/journal/side-quest-this-website-content-actions.png)

**Summarize** 

The Summarize feature loads an AI-generated summary at build time with deep-linked key takeaways that scroll you to the relevant section. Here's how it works:

1. **Build time:** `generate-summaries.ts` runs as a prebuild step, calls the Anthropic API for each content entry, and writes a JSON file to `src/data/summaries/{slug}.json` containing an `overview` string and a `keyPoints` array (each with a `headingId` and `title`)
2. **Server-side (Astro):** The page passes that JSON to `ContentActions` as the `summary` prop, which embeds it in the HTML as a `<script type="application/json">` tag. The button is disabled (`hasSummary = false`) if no summary file exists for the entry.
3. **Client-side on click:** The JS reads the embedded JSON, builds the panel HTML, then **simulates a typewriter/streaming effect** using `requestAnimationFrame` over ~1100ms to animate the `overview` text character-by-character — giving the impression of a live AI response even though it's static. After the text finishes, the key takeaways fade in staggered intervals. Each takeaway is a button that scrolls to the corresponding heading in the article.

![Summarize panel open showing typewriter-animated overview text and deep-linked key takeaways](/images/journal/side-quest-this-website-summarize.png)

**Listen** 

The Listen feature activates a browser-native TTS player. It narrates the content like an audiobook. Good for when you're on the go. No server calls, no audio files. When clicked, it:

1. **Scrapes the article text** from the DOM (`.prose, article, main`), stripping out code blocks, nav, footer, and the toolbar panels themselves
2. **Builds an inline mini-player** with a play/pause button, a progress scrubber, and a time display
3. **Feeds the text to** `window.speechSynthesis` via `SpeechSynthesisUtterance` at 0.95x rate, en-US
4. **Simulates progress** with `requestAnimationFrame` against a word-count estimate (~150 wpm), since the Web Speech API gives no real position data
5. **Supports scrubbing** — dragging the range input slices the article text at the corresponding character offset and restarts synthesis from that point

The button is gated by a `hasAudio` prop (disabled/greyed when false) and a `'speechSynthesis' in window` check, so it silently hides itself in unsupported environments. No audio files are pre-generated or stored; it reads whatever text is live on the page.

![Listen mini-player with play/pause button, progress scrubber, and estimated time remaining](/images/journal/side-quest-this-website-listen.png)

**Ask AI** 

The Ask AI feature is a **live RAG chat panel** scoped to the current page. It uses the same architecture as global search (Phase 2), but with the `context` parameter set to `project` or `journal`. Here's the flow:

1. **Setup (build time):** `generate-questions.ts` pre-generates 3–5 suggested questions per entry and stores them in `src/data/questions/`. These are embedded in the panel as starter buttons. The Ask AI button is disabled if no questions file exists for the entry.
2. **On click:** The panel renders with the suggested questions staggered in. The user can click a starter or type a free-form question.
3. **On submit:** The client POSTs to `/api/search` with the question, the page's `slug`, `context` (journal vs. project), `stream: true`, and the accumulated conversation `history` for multi-turn support.
4. **Streaming response:** `/api/search` returns a **Server-Sent Events** stream. The client reads it with a `ReadableStream` reader, parsing `event: ai-chunk` tokens (flushed to the DOM via `requestAnimationFrame` for smooth rendering) and `event: sources` payloads. Sources render as footer links — either section anchors within the current page (journal entries only) or cross-links to related project/journal pages.
5. **Post-stream:** The Q&A pair is appended to `history` for the next turn.

Answers are explicitly scoped to the current entry. The slug is passed to the API so it can constrain its Pinecone vector search.

![Ask AI panel with suggested starter questions and a streaming RAG answer with source citations](/images/journal/side-quest-this-website-ask-ai.png)

**GitHub Code Blocks**

Last but not least, I built the feature that (maybe) no other portfolio sites have: **Ask AI** on project pages can now answer implementation questions with real code from the corresponding GitHub repo, and includes source filenames, Copy buttons, and deep links to view the source on GitHub.

The GitHub code block functionality is a pipeline that runs across three layers:

**1. Indexing time (`index-content.mjs`):** For project pages that have linked source files, the indexer splits each source file into function/class-level chunks, embeds them, and stores each chunk in Pinecone with a `githubUrl` metadata field that directly links to that file on GitHub (`https://github.com/{repo}/blob/main/{relativePath}`).

**2. API (`/api/search`):** When a question is answered, the Pinecone results include those code chunks. The `githubUrl` from their metadata is passed through to the `sources` SSE event sent back to the client.

**3. Client rendering:** After the full streamed answer arrives, the client checks if the answer text contains any code fences. If it does:
- It replaces the plain-text content with formatted HTML via `processAnswerText()`, which wraps each code block in a styled `<div class="code-block">` with a header bar and copy button
- `injectGithubButtons()` then finds deduplicated `githubUrl` values from the sources and appends a "View on GitHub" link into each code block's header bar, also replacing the generic language label in the filename slot with the actual relative file path (`scripts/index-content.mjs` instead of just `javascript`)

The net effect: when Claude's answer includes a code snippet that came from an indexed source file, the code block automatically gets a GitHub link pointing to the exact file it came from.

![Ask AI answer showing a code block with source filename header and View on GitHub button](/images/journal/side-quest-this-website-github-code-blocks.png)

The table below provides more details about the GitHub code block functionality:

<table>
<colgroup>
<col style="width: 35%">
<col style="width: 65%">
</colgroup>
<tbody>
<tr>
<td><strong>Indexing pipeline (<code>index-content.mjs</code>)</strong></td>
<td>New <code>indexProjectSourceCode()</code> function walks a local repo directory, filters source files (<code>.py</code>, <code>.ts</code>, <code>.js</code>, <code>.mjs</code>; excludes <code>node_modules</code>, <code>__pycache__</code>, <code>.git</code>, etc.), and chunks them at function/class boundaries<br><br>Chunking rules: files ≤100 lines indexed whole; Python splits at <code>def</code>/<code>class</code> boundaries; JS/TS splits at <code>function</code>/<code>class</code>/<code>export</code> boundaries; fallback to 80-line fixed chunks. Max 3000 chars per chunk for embedding, 8000 chars stored in Pinecone metadata for RAG context<br><br>Metadata schema: <code>chunkType: 'code'</code>, <code>language</code>, <code>sourceFile</code> (relative path), <code>githubUrl</code> (full GitHub permalink), <code>section</code> (function/class name extracted from first line)<br>• ID scheme: <code>{slug}#src-{fileIndex}-{chunkIndex}</code> — no collision with prose chunk IDs</td>
</tr>
<tr>
<td><strong>Retrieval (<code>search.ts</code>)</strong></td>
<td>Project-context queries use <code>topK: 8</code> (up from 6) to accommodate code chunks alongside prose<br><br>Code chunks formatted as <code>[Code: {section} - {language}]</code> in Claude's context blocks<br><br><code>githubUrl</code> passed through in the SSE <code>sources</code> event payload</td>
</tr>
<tr>
<td><strong>Grounding discipline</strong></td>
<td>System prompt explicitly restricts code blocks to answers backed by actual <code>[Code: ...]</code> chunks in context<br><br>When only prose chunks are retrieved, Claude answers in prose — no synthesized code blocks that look like they came from the repo but didn't</td>
</tr>
<tr>
<td><strong>Frontend (<code>ContentActions.astro</code>)</strong></td>
<td>Code block header shows <code>sourceFile</code> (e.g., <code>src/api/main.py</code>) instead of language label when source metadata is available<br><br>Copy button + View on GitHub button in code block chrome (GitHub link injected post-stream after <code>sources</code> event provides the URL)<br><br>Jump to anchor pills hidden on project pages (too short to be useful); retained on journal entries<br><br>GitHub buttons deduplicated by URL before rendering</td>
</tr>
<tr>
<td><strong>Architecture</strong></td>
<td>Extensible — adding another project is one entry in the <code>sourceProjects</code> array plus a re-index<br><br>Single Pinecone index (<code>portfolio-search</code>) holds all content types: journal prose, project prose, project source code. The <code>slug</code> filter and <code>chunkType</code> metadata handle scoping<br><br>No new API endpoints, no new indexes, no client-side changes to the search flow</td>
</tr>
</tbody>
</table>

## Phase 4: Visual Accoutrements, Infrastructure Improvements

### Motion and Responsiveness

The motion system is a set of five CSS utility classes plus one JS observer, all defined in `src/styles/global.css:107` and wired up in `src/layouts/BaseLayout.astro:90`. Every effect respects `prefers-reduced-motion`.

<table>
<thead>
<tr>
<th>Effect</th>
<th>Details</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Scroll Reveal (<code>.reveal</code>)</strong></td>
<td>Elements start invisible and translated 20px down. <code>BaseLayout</code> runs a single <code>IntersectionObserver</code> (threshold 0.1) that adds <code>.visible</code> when an element enters the viewport, triggering a <code>fadeSlideUp</code> keyframe animation (0.5s, spring easing). The observer unsubscribes after firing so it only runs once per element.</td>
</tr>
<tr>
<td><strong>Stagger (<code>.stagger &gt; .reveal</code>)</strong></td>
<td>A parent <code>.stagger</code> wrapper applies <code>animation-delay</code> to each <code>.reveal</code> child via <code>:nth-child</code> selectors, capping out at 0.32s for the 8th+ child. Used on card grids so items cascade in (vs. all appearing at once).</td>
</tr>
<tr>
<td><strong>Card Hover Lift (<code>.card-hover</code>)</strong></td>
<td>Pure CSS. Cards translate up 3px with a box-shadow on hover (0.2s spring transition).</td>
</tr>
<tr>
<td><strong>Link Underline Slide (<code>.link-slide</code>)</strong></td>
<td>A <code>::after</code> pseudo-element starts at <code>width: 0</code> and expands to <code>100%</code> on hover, creating a sliding underline from left to right.</td>
</tr>
<tr>
<td><strong>Page Load Fade (<code>.page-enter</code>)</strong></td>
<td>The entire page content wrapper fades in from opacity 0 over 0.3s on every navigation. Applied to the <code>&lt;div class="page-enter"&gt;</code> wrapper in <code>BaseLayout</code>.</td>
</tr>
</tbody>
</table>

### Ambient Background Animation: Starry Night and Neural Field

Dark mode got an ambient upgrade: a canvas-based starfield that renders 220 twinkling stars with randomized shooting stars every 8-18 seconds. The starfield responds to theme changes in real-time via a `MutationObserver` on the HTML element's class list. Toggle from Light to Dark, and the stars fade in over one second. The entire animation runs in a single `<canvas>` element; no DOM elements, no injected stylesheets, no performance overhead in Light mode (the `requestAnimationFrame` loop idles when the canvas opacity is 0).

<video controls style="max-width: 100%; border-radius: 6px; margin: 1rem 0;">
  <source src="/videos/journal/side-quest-starry-night.mov">
</video>

Light mode background system overhauled. Two major changes from v4:

**1. Fade alignment with Starry Night.** Nodes now use a four-state lifecycle (waiting → rising → holding → falling) matching dark mode behavior. Each node reaches exactly 100% of its personal target opacity at apex — no overshoot. Glow effects (`shadowBlur`, `shadowColor`) removed entirely. Opacity range 0.15–0.70 per node for natural brightness variation.

**2. Neural vectors.** The old constellation connection system replaced with directional impulse vectors:
- Angular zig-zag paths, 5–8 segments, traveling left-to-right across the canvas
- Fire every 3–8 seconds at semi-random intervals
- Comet-style fading trail (35% of path length, 24 gradient segments)
- 2.2px leading dot at the signal head
- **Node activation:** any node within 50px of the signal head pulses to near-full opacity, then decays back — neurons firing as the impulse passes
- Mental model: information traveling through a transformer neural network layer to layer, or synaptic impulses racing from neuron to neuron

**Also removed:** weighted edge distribution (70/30 formula). Nodes now distribute uniformly across the full canvas via pure `Math.random()`.

<video controls style="max-width: 100%; border-radius: 6px; margin: 1rem 0;">
  <source src="/videos/journal/side-quest-filament-flash.mov">
</video>

The Starry Night dark mode background is now the official name (parity with Filament Flash). Together they form the ambient background system.

### Infrastructure Hardening

Five targeted changes to reduce attack surface and improve build reliability:

1. **Deleted `/api/semantic-search`**, a legacy non-streaming endpoint not wired to any UI. Also removed `search-v1.astro`, the only file referencing it, itself unreferenced. Attack surface reduced from two serverless functions to one.
2. **Build resilience for generate scripts:** both `generate-summaries.ts` and `generate-questions.ts` wrapped in top-level try/catch that exit 0 on error. A transient Anthropic API hiccup during a Vercel build now logs a warning instead of killing the deploy.
3. **`generate-questions.ts` wired into `prebuild`**: previously a manual step, now runs automatically after `generate-summaries.ts` on every Vercel build. Both scripts are incremental, so the cost per build is near-zero.
4. **Indexer preflight + chunk count logging:** `index-content.mjs` now checks for `OPENAI_API_KEY` and `PINECONE_API_KEY` at startup and exits immediately with a clear error if either key is missing. Summary log at completion reports prose and source-code chunk counts separately.
5. **Rate limiting attempted, reverted:** `vercel.json` with a `ratelimit` block was deployed but failed schema validation. Removed and returned to backlog. The `/api/search` endpoint remains the one genuine liability because each request fans out to OpenAI, Pinecone, and Anthropic with no throttling. I'll need to fix it sooner rather than later.

### Evaluation Infrastructure for Ask AI

Motivated by a P0 grounding failure discovered during a UX audit, I built a full evaluation mechanism for the Ask AI feature.

**Root cause diagnosis:** Ask AI on the Week 9 entry denied a fact the entry states ("I was skeptical at first" about content-addressed hashing). Diagnostic confirmed retrieval miss — the grounding chunk existed in Pinecone at rank 9 but journal topK was 6. Not retrieved. Fixed by raising journal topK 6→10, project topK 8→12.

**Eval mechanism:**
- Golden set: 15 questions across 5 page types (journal + project), weighted toward buried facts
- Retrieval check (deterministic): is the expected chunk ID in the retrieved set, at what rank?
- Grounding check (Sonnet judge): does the generated answer correctly reflect the known fact?
- Negative control: generate answer with empty context — if it passes, the question is training-leakable (model answers from training, not RAG). Result: 0/15 training-leakable — system prompt grounding instruction is effective.
- Composite `groundedCorrect` metric (retrieval AND grounding) as the headline number
- Timestamped JSON results in `eval/results/`

**Baseline: 15/15 grounded-correct, 0/15 training-leakable.** One known open item: `ep-tracker` (rank 11 > project topK 8) — fixed by the topK bump to 12.

**Single source of truth:** `src/config/retrieval.js` exports `RETRIEVAL_TOPK` — both `search.ts` and `run-ask-eval.mjs` import from it. Eliminates the parity-drift bug where the eval silently queried at a different topK than production.

**Chunking experiment:** banked as a documented option. The eval revealed dilution is not systemic (13/15 comfortable at rank 0–2); the targeted topK calibration was the right-sized fix.

## What's Next

### MCP Server

The idea: expose my portfolio content and data (journal entries, project pages, AI summaries, etc.) as callable tools that any MCP-compatible client (Claude, Cursor, etc.) can query directly, without a browser involved. Instead of visiting the site, a client could call tools like `get_journal_entry("week-17")`, `search_projects("RAG")`, or `ask_portfolio("what has Richard built with Pinecone?")` and get structured data back. Under the hood, the server would read from the same sources your site uses (markdown files, Pinecone index, the precomputed summaries in `src/data/`), bypassing the web layer entirely.

The practical use case: someone could drop my MCP server into their Claude setup and have a conversation with my work the same way they'd chat with a codebase. It also makes my content composable; another agent could pull my journal entries as context while drafting something, without knowing my site exists or having to visit it directly.

### Listen v2

AI-generated audio is not my highest priority, but I want to learn how to go beyond the basic Web Speech API, which is admittedly awful in terms of voice quality. I have my eye on ElevenLabs, which I'm also using for my Dino project.

### General-Purpose Portfolio

Once I complete these enhancements, it will likely be time to expand what has been a focused AI build log into a general-purpose portfolio.

---

*Website fully operational at [https://www.richardthomchick.com/](https://www.richardthomchick.com/) with a plethora of bells and whistles. Now back to our regularly scheduled programming.*
