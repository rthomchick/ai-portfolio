# CLAUDE.md — ai-portfolio

This repo is Richard Thomchick's personal portfolio site (richardthomchick.com). It is a statically generated Astro 6 site deployed to Vercel, styled with Tailwind CSS 4, and extended with a serverless semantic search and RAG layer backed by Pinecone (vectors), OpenAI (embeddings), and Anthropic Claude (synthesis). It serves two audiences: visitors who browse, search, and ask questions, and Richard, who authors content in Notion and publishes it via Claude Code slash commands.

See [TECHNICAL_OVERVIEW.md](TECHNICAL_OVERVIEW.md) for a full architecture reference with diagrams.

---

## Key commands

| Command | When to use |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Full production build (runs `prebuild` → `generate-summaries.ts` first) |
| `npx tsx scripts/generate-summaries.ts` | Regenerate AI summaries standalone (also runs automatically as prebuild) |
| `npx tsx scripts/generate-questions.ts` | Regenerate suggested questions — **manual only, not part of the build** |
| `node --env-file=.env scripts/index-content.mjs` | Re-index all content to Pinecone — run after publishing new entries |
| `/publish-journal` | Claude Code slash command to publish a journal entry |
| `/publish-project` | Claude Code slash command to publish a project page |

---

## Architecture notes

**Rendering mode.** `astro.config.mjs` sets `output: 'static'`. Every route is pre-rendered unless it explicitly opts out with `export const prerender = false`. Without that export, a new API route will be treated as a static page and break at runtime.

**Serverless routes.** Only two exist:
- `/api/search` — active; handles semantic search and Ask AI (SSE stream)
- `/api/semantic-search` — legacy; slated for removal

**Environment variables.**
- Build time: `ANTHROPIC_API_KEY` (required for `generate-summaries.ts`)
- Runtime: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `ANTHROPIC_API_KEY`
- Indexing: all three

**Content collections.**
- `src/content/journal/` — journal entries (Markdown + frontmatter)
- `src/content/projects/` — project pages (Markdown + frontmatter)

**Build-time data.**
- `src/data/summaries/` — AI-generated summaries, one JSON file per entry
- `src/data/questions/` — suggested questions, one JSON file per entry

**Pinecone index.** `portfolio-search`, 1536-dim, cosine similarity, `text-embedding-3-small` embeddings.

**Rate limiting.** `/api/search` uses `@upstash/ratelimit` backed by an Upstash Redis database (`portfolio-ratelimit`), gating requests by IP. Runtime env vars required: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## Mermaid diagram conventions

When generating Mermaid diagrams in any doc:

- No em or en dashes (—, –) anywhere inside a Mermaid code block — not in titles, node labels, edge labels, or subgraph names. Use a plain hyphen (-) or colon (:) instead.
- No raw `<` or `>` inside quoted labels. Write "fewer than 2" instead of "< 2". (`<br>`, `<i>`, `<b>` tags are fine.)
- Prefer `flowchart` over C4 diagram types (`C4Context`, `C4Container`, `C4Component`). C4 support is experimental and renders inconsistently. Use a styled flowchart with classDef to achieve C4-style visual conventions instead.
- After generating diagrams, sweep every Mermaid block in the file for the above before finishing.

Claude Code can verify Mermaid syntax but cannot see rendered output. Flag dense diagrams for a human visual check.

---

## Writing conventions

- Em dashes sparingly in prose — prefer commas, colons, or sentence breaks
- Conversational, first-person voice for journal entries
- Journal entries end with a metrics block and a single italicized closing line
