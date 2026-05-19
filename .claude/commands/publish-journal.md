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
- **Replace all Notion image URLs** with local paths: `![alt text](/images/journal/week-{NN}-{description}.{ext})`
- Preserve image alt text from Notion if present; if no alt text exists, write a brief descriptive alt text based on the image context (e.g., "Eval dashboard quality scores tab showing score trends across golden set cases")

### 5. Save the file

Save to `src/content/journal/week-{NN}-{slug}.md` where:
- `{NN}` is zero-padded week number (01, 02, etc.)
- `{slug}` is a short kebab-case slug derived from the title

If a file for this week already exists, replace it.

### 6. Verify

Run `npx astro build` and confirm:
- The new entry appears in the build output with no errors
- All image paths resolve (no broken image references in the build)

### 7. Commit and push

Stage all changes (the markdown file AND all new images in `public/images/journal/`), commit with message "Publish Week {N} journal entry", and push to `origin/main`.

## Important rules

- Do NOT rewrite Richard's prose. You are a converter, not an editor.
- Do NOT invent editorial headlines. Use the title as-is.
- Do NOT render keyInsights or toolsBuilt in the page body.
- Do NOT skip images. Every image in the Notion source must be downloaded and included.
- If an image URL is expired or fails to download, log the failure and continue with the remaining images. Note any missing images in the commit message.
- If the Notion page cannot be found, stop and ask for the Notion page ID.