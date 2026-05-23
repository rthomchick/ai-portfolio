# Publish Project Page

Create or update a project page on the Astro portfolio site.

## Input

The user will provide: `$ARGUMENTS`

This should be a project name or slug (e.g., "Dino" or "dino" or "buying-group-advisor").

The user will also provide a **project brief** — either inline in the conversation or as a file path. This brief contains the frontmatter values and body content for the page. Do NOT invent content beyond what the brief provides.

## Steps

### 1. Read the content schema

Read `src/content.config.ts` to get the current project collection schema. Confirm all required frontmatter fields before proceeding.

### 2. Read an existing project for reference

Read one existing project file (e.g., `src/content/projects/safe-feature-spec-system.md`) to confirm formatting conventions: frontmatter field order, body section structure, heading levels, prose style.

### 3. Extract and download images

If the project brief includes image URLs or references to screenshots:
- Download each image file
- Save to `public/images/projects/` with a descriptive filename: `{project-slug}-{description}.{ext}` (e.g., `dino-restaurant-card-ui.png`, `dino-personality-conversation.png`)
- Keep filenames lowercase, kebab-case
- Preserve original resolution
- If `public/images/projects/` does not exist, create it

If no images are referenced, skip this step.

### 4. Generate the markdown file

Create a well-formed Astro content file with:

**Frontmatter — populate from the project brief:**
- `title`: Project name exactly as provided
- `description`: One or two sentences, suitable for the project card on the listing page
- `status`: One of `deployed`, `built`, `in-progress`, `planned`
- `weekBuilt`: The week number when the project was primarily built
- `tags`: Technical topics as lowercase hyphenated strings
- `problemSolved`: One sentence describing the problem this tool addresses
- `architecturePattern`: The primary architecture pattern used
- `techStack`: Array of technology names
- `liveUrl`: URL of the deployed app (if deployed, otherwise omit)
- `repoUrl`: GitHub repository URL (if public, otherwise omit)
- `sortOrder`: Number controlling display position on the projects grid (lower = first). Check existing project files to determine the next appropriate number.

**Body — use the project brief as source material:**
- Structure with H2 headings. Standard sections are:
  - `## What it does` — functional description from the user's perspective
  - `## Architecture decisions` — key technical choices and why they were made
  - `## What I learned` — insights, patterns, or surprises from building it
- Additional sections are allowed if the brief warrants them (e.g., `## Personality engineering` for Dino)
- Do NOT add sections the brief doesn't support. Empty sections are worse than missing ones.
- Do NOT rewrite the user's prose. Clean up formatting and structure, but preserve voice and specifics.
- **Heading hierarchy:** All body headings start at H2. No H1s in the body — the page title is the only H1.
- Replace any image URLs with local paths: `![alt text](/images/projects/{project-slug}-{description}.{ext})`

### 5. Save the file

Save to `src/content/projects/{project-slug}.md`.

If a file for this project already exists, replace it entirely.

### 6. Verify build

Run `npx astro build` and confirm:
- The new project page appears in the build output with no errors
- All image paths resolve
- The projects listing page renders the new card correctly

### 7. Re-index for semantic search

Run the content indexing script to update the Pinecone search index:

```bash
node --env-file=.env scripts/index-content.mjs
```

If the script fails, log the error and continue. Semantic search will catch up on the next successful run.

### 8. Generate AI summary

Run the summary generation script:

```bash
npm run generate-summaries
```

If the script fails, log the error and continue. The page will render without a summary.

### 9. Commit and push

Stage all changes (the markdown file, any new images in `public/images/projects/`, and the summary JSON in `src/data/summaries/`), commit with message "Add/update project page: {project-name}", and push to `origin/main`.

## Important rules

- Do NOT invent content the brief doesn't provide. If a frontmatter field has no answer in the brief, ask the user.
- Do NOT rewrite the user's descriptions. You are a formatter, not an editor.
- Do NOT add empty body sections. Only include sections with real content.
- Match the formatting conventions of existing project pages exactly.
- If the brief is missing critical fields (title, description, status, weekBuilt), stop and ask before generating.