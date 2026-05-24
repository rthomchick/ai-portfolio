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

### 3. Extract and download images

Scan the fetched Notion content for any embedded images (these will appear as Notion file URLs, S3 signed URLs, or image blocks).

For each image found:
- Download the image file
- Save it to `public/images/journal/` with a descriptive filename following the pattern: `week-{NN}-{description}.{ext}` (e.g., `week-09-eval-dashboard-quality.png`, `week-11-advisor-cost-comparison.png`)
- Keep filenames lowercase, kebab-case, and descriptive enough to identify without opening the file
- If the image is a screenshot, preserve the original resolution (do not resize)
- If `public/images/journal/` does not exist, create it

### 4. Generate the markdown file

Create a well-formed Astro content file with:

**Frontmatter — generate all fields by reading the Notion content:**
- `title`: Use the Notion page title exactly as-is. Do NOT rewrite or editorialize it.
- `headline`: Set this to the same value as `title`. Do NOT write a creative headline. Richard will write his own editorial headlines later.
- `week`: The week number
- `date`: Extract from the Notion page, or infer from week number (Week 1 = 2026-01-06, each week +7 days)
- `summary`: Write ONE sentence summarizing the entry, suitable for a listing card
- `goal`: Extract the goal statement from the Notion content. It is typically the first line, formatted as italic text starting with "Goal:". Extract only the text after "Goal: " — do not include the "Goal:" prefix or italic markers. If no goal statement is found, omit this field.
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
- **Goal statement:** Remove the goal line from the body content — it is now rendered by the layout from frontmatter. Also remove the horizontal rule (`---`) that immediately follows the goal line, if present. Do NOT remove other horizontal rules elsewhere in the body.
- **Heading hierarchy:** The page title is the only H1. All body headings must start at H2. If the Notion source uses H1s in the body, demote all headings by one level (H1→H2, H2→H3, H3→H4, H4→H5). Do not demote headings inside code blocks.
- **Replace all Notion image URLs** with local paths: `![alt text](/images/journal/week-{NN}-{description}.{ext})`
- Preserve image alt text from Notion if present; if no alt text exists, write a brief descriptive alt text based on the image context (e.g., "Eval dashboard quality scores tab showing score trends across golden set cases")

### 5. Save the file

Save to `src/content/journal/week-{NN}-{slug}.md` where:
- `{NN}` is zero-padded week number (01, 02, etc.)
- `{slug}` is a short kebab-case slug derived from the title

If a file for this week already exists, replace it.

### 6. Verify build

Run `npx astro build` and confirm:
- The new entry appears in the build output with no errors
- All image paths resolve (no broken image references in the build)

### 7. Re-index for semantic search

Run the content indexing script to update the Pinecone search index with the new entry:

```bash
node --env-file=.env scripts/index-content.mjs
```

This re-embeds all content and upserts to the `portfolio-search` Pinecone index. It's idempotent — existing entries get updated, not duplicated.

If the script fails (missing API keys, Pinecone unavailable), log the error and continue with the commit/push. The keyword search (Pagefind) will still work; semantic search will pick up the new content on the next successful index run.

### 8. Generate AI summary

Run the summary generation script to create the build-time summary for the new entry:

```bash
npm run generate-summaries
```

This generates `src/data/summaries/{slug}.json` for any entry that doesn't already have one (or whose markdown has changed). The summary powers the "Summarize" button on the article page.

If the script fails (missing API key, API error), log the error and continue with the commit/push. The article will render without a summary — the Summarize button will be disabled.

### 9. Commit and push

Stage all changes (the markdown file, all new images in `public/images/journal/`, and the summary JSON in `src/data/summaries/`), commit with message "Publish Week {N} journal entry", and push to `origin/main`.

## Important rules

- Do NOT rewrite Richard's prose. You are a converter, not an editor.
- Do NOT invent editorial headlines. Use the title as-is.
- Do NOT render keyInsights, toolsBuilt, or goal in the page body — they belong in frontmatter only and are rendered by the layout.
- Do NOT skip images. Every image in the Notion source must be downloaded and included.
- If an image URL is expired or fails to download, log the failure and continue with the remaining images. Note any missing images in the commit message.
- If the Notion page cannot be found, stop and ask for the Notion page ID.