# Publish Journal Entry

Publish a journal entry from Notion to the Astro portfolio site.

## Input

The user will provide: `$ARGUMENTS`

This should be a week number (e.g., "Week 4" or just "4").

## Steps

### 1. Find the Notion journal page

Search Notion for "Week {n} Journal" to locate the source page. Fetch the full page content.

### 2. Read the content schema

Read `src/content.config.ts` to get the current frontmatter schema for the journal collection.

### 3. Generate the markdown file

Create a well-formed Astro content file with:

**Frontmatter — generate all fields by reading the Notion content:**
- `title`: Use the Notion page title exactly as-is. Do NOT rewrite or editorialize it.
- `headline`: Set this to the same value as `title`. Do NOT write a creative headline. Richard will write his own editorial headlines later.
- `week`: The week number
- `date`: Extract from the Notion page, or infer from week number (Week 1 = 2026-01-06, each week +7 days)
- `summary`: Write ONE sentence summarizing the entry, suitable for a listing card
- `tags`: Extract technical topics mentioned in the content (lowercase, hyphenated)
- `keyInsights`: Extract 3-5 key learnings directly stated in the content. Do NOT invent or rephrase — use Richard's own wording.
- `toolsBuilt`: List any tools explicitly mentioned as built or shipped
- `status`: published

**Body — preserve Richard's writing:**
- Use the Notion content as the markdown body
- Clean up any Notion export artifacts (extra blank lines, broken formatting, Unicode issues)
- Do NOT add, remove, or rewrite any sections
- Do NOT add a "Key Insights" or "Tools Built" section to the body — that data belongs in frontmatter only, and is not rendered on the entry page
- Preserve all headings, code blocks, and structure exactly as authored

### 4. Save the file

Save to `src/content/journal/week-{NN}-{slug}.md` where:
- `{NN}` is zero-padded week number (01, 02, etc.)
- `{slug}` is a short kebab-case slug derived from the title

If a file for this week already exists, replace it.

### 5. Verify

Run `npx astro build` and confirm the new entry appears in the build output with no errors.

## Important rules

- Do NOT rewrite Richard's prose. You are a converter, not an editor.
- Do NOT invent editorial headlines. Use the title as-is.
- Do NOT render keyInsights or toolsBuilt in the page body.
- If the Notion page cannot be found, stop and ask for the Notion page ID.
