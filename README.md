# AI Product Portfolio

A portfolio site and learning journal documenting a six-month AI product development program. Built with Astro and Tailwind CSS, deployed on Vercel.

**Live site:** [richardthomchick.com](https://www.richardthomchick.com)

## What this is

A Senior Product Manager's hands-on journey from zero AI experience to shipping production AI tools. The site serves as both a portfolio of deployed tools and a weekly journal capturing the technical decisions, architecture patterns, and lessons learned along the way.

## What's on the site

**Journal** — Weekly entries covering topics from LLM fundamentals and API basics through multi-agent systems, RAG pipelines, evaluation infrastructure, and responsible AI governance. Each entry focuses on what was built, what broke, and what the fix taught.

**Projects** — Deployed AI tools including a multi-agent SAFe feature spec system, a RAG-powered knowledge assistant, an ROI analyzer, and more. Each project page documents the problem solved, architecture pattern used, and key learnings.

## Tech stack

- [Astro](https://astro.build) 5.x — static site generator
- [Tailwind CSS](https://tailwindcss.com) 4.x — utility-first CSS with `@tailwindcss/typography`
- [Vercel](https://vercel.com) — hosting and deployment
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) — typography
- Dark mode with class-based toggling and system preference detection

## Project structure

```
src/
├── content/
│   ├── journal/        # Markdown journal entries (weekly)
│   └── projects/       # Markdown project pages
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── ThemeToggle.astro
│   ├── FeaturedEntry.astro
│   ├── JournalCard.astro
│   └── ProjectCard.astro
├── layouts/
│   └── BaseLayout.astro
├── pages/
│   ├── index.astro
│   ├── about.astro
│   ├── journal/
│   └── projects/
└── styles/
    └── global.css
```

## Local development

```bash
npm install
npm run dev
```

The dev server runs at `localhost:4321`.

## Adding content

Journal entries and project pages are Markdown files with YAML frontmatter in `src/content/journal/` and `src/content/projects/`. The site rebuilds automatically on push to `main` via Vercel.

A Claude Code command is available for publishing journal entries from Notion:

```bash
/project:publish-journal Week N
```

## Built with

The site itself, the journal content, and every tool documented on it were built using Claude (Anthropic). The development workflow uses Claude Code for file-level implementation and Claude.ai for architectural decisions and documentation.
