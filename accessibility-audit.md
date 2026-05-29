# Accessibility Audit — richardthomchick.com
**Date:** 2026-05-28  
**Standard:** WCAG 2.2 AA  
**Codebase:** ~/Dropbox/ai-projects/ai-portfolio  

---

## Issue Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Major    | 10 |
| Minor    | 7 |
| **Total**| **21** |

---

## Critical Issues (blocks access)

---

### C1 — No skip-to-content link
**File:** `src/layouts/BaseLayout.astro`  
**WCAG:** 2.4.1 Bypass Blocks (Level A)

Keyboard users must tab through every nav link on every page before reaching main content. There is no skip link anywhere in the site.

**Fix:** Add as the very first element inside `<body>` in BaseLayout.astro:
```astro
<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:dark:bg-stone-900 focus:text-stone-900 focus:dark:text-stone-100 focus:rounded focus:ring-2 focus:ring-teal-600">
  Skip to main content
</a>
```
Then add `id="main-content"` to each `<main>` element across all pages.

---

### C2 — Search input has no accessible label
**File:** `src/pages/search.astro:16-23`  
**WCAG:** 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions (Level A)

The search `<input>` relies on a placeholder only. Placeholders disappear on focus and are not reliably announced as labels by screen readers.

**Fix:** Add a visually hidden label before the input:
```html
<label for="search-input" class="sr-only">Search journal entries and projects</label>
<input id="search-input" type="search" ... />
```

---

### C3 — Ask AI input has no label
**File:** `src/components/ContentActions.astro:1584`  
**WCAG:** 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions (Level A)

The Ask AI text input is built dynamically in JS with only a placeholder and no `aria-label`. Screen readers may announce nothing or just the placeholder text, which disappears after the user starts typing.

**Fix:** In the `buildAskPanel()` function, add a label before the input:
```js
`<div class="ask-input-row">
  <label for="ask-input" class="sr-only">Ask a question about this ${entityLabel}</label>
  <input type="text" id="ask-input" placeholder="Ask about this ${entityLabel}…" autocomplete="off" />
  <button id="ask-send" aria-label="Send question">→</button>
</div>`
```

---

### C4 — Ask AI send button has no accessible name
**File:** `src/components/ContentActions.astro:1585`  
**WCAG:** 4.1.2 Name, Role, Value (Level A)

The send button renders as `<button id="ask-send">→</button>`. The arrow character is not a meaningful accessible name — screen readers announce it as "right arrow" or skip it.

**Fix:** (Included in C3 fix above)
```html
<button id="ask-send" aria-label="Send question">→</button>
```

---

## Major Issues (significant barrier)

---

### M1 — Canvas animations don't respect prefers-reduced-motion
**Files:** `src/components/FilamentFlash.astro:6-415`, `src/components/Starfield.astro:6-146`  
**WCAG:** 2.3.3 Animation from Interactions (Level AAA — but vestibular safety is expected at AA)

FilamentFlash (comet vectors traversing the screen) and Starfield (twinkling stars, shooting stars) both run unconditionally via `requestAnimationFrame` loops with no check for `prefers-reduced-motion`. Users with vestibular disorders can experience nausea from this ambient motion. All CSS animations in `global.css` are correctly gated; the JS canvas animations are not.

**Fix — FilamentFlash** (end of `src/components/FilamentFlash.astro`):
```js
// ── Bootstrap ────────────────────────────────────────────────────────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

resize();
setOpacity(isDark());
if (!prefersReducedMotion) {
  start();
}

// In the MutationObserver callback, guard start() the same way:
mutObs.observe(document.documentElement, { attributeFilter: ['class'] });
// Replace the existing mutObs handler:
const mutObs = new MutationObserver(() => {
  const dark = isDark();
  setOpacity(dark);
  if (!prefersReducedMotion) {
    dark ? stop() : start();
  }
});
```

**Fix — Starfield** (end of `src/components/Starfield.astro`):
```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

resize();
setOpacity(isDark());
if (!prefersReducedMotion) {
  scheduleNextShoot();
  requestAnimationFrame(draw);
}
```

---

### M2 — teal-600 on white fails contrast (all light-mode links)
**Files:** `src/components/FeaturedEntry.astro:19`, `src/pages/index.astro:67,85`, `src/pages/journal/[...slug].astro:55`, `src/pages/projects/[...slug].astro:49`, `src/components/ProjectCard.astro:32`, `src/components/Header.astro:27`  
**WCAG:** 1.4.3 Contrast Minimum (Level AA)

`text-teal-600` (#0D9488) on white (#FFFFFF) has a contrast ratio of approximately **3.75:1**. WCAG AA requires **4.5:1** for normal-sized text (below 18pt or 14pt bold). Affected elements:

- "Read entry →" (FeaturedEntry)
- "All entries →" / "All projects →" (index)
- "← Journal" / "← Projects" back-navigation links
- "View project →" (ProjectCard)
- Nav link hover color

The dark-mode `text-teal-400` (#2DD4BF) on stone-950 (~10.9:1) passes comfortably.

**Fix:** Replace `text-teal-600` with `text-teal-700` (#0F766E, ~4.55:1 on white) for link text. Keep `dark:text-teal-400` unchanged. Example:
```diff
- class="text-sm text-teal-600 dark:text-teal-400 link-slide font-medium"
+ class="text-sm text-teal-700 dark:text-teal-400 link-slide font-medium"
```
Apply this change everywhere `text-teal-600` is used as link text against a white or near-white background. Also update `prose-a:text-teal-600` in journal/project detail pages to `prose-a:text-teal-700`.

---

### M3 — Active search filter pill fails contrast (white on teal-600)
**File:** `src/pages/search.astro:53-58`  
**WCAG:** 1.4.3 Contrast Minimum (Level AA)

The active filter pill uses `color: white` on `background-color: #0D9488` — the same 3.75:1 ratio.

**Fix:**
```css
.filter-pill.active {
  background-color: #0F766E; /* teal-700 — ~4.55:1 with white */
  color: white;
  border-color: #0F766E;
}
```

---

### M4 — Mobile hamburger button: no aria-expanded, label not updated on toggle
**File:** `src/components/Header.astro:73-83, 215-222`  
**WCAG:** 4.1.2 Name, Role, Value (Level A)

The hamburger `<button>` has a static `aria-label="Open menu"` that is never updated when the menu opens, and there is no `aria-expanded` attribute. Screen reader users cannot tell whether the menu is currently open or closed.

**Fix — HTML (Header.astro line 73):**
```html
<button
  id="mobile-menu-toggle"
  aria-label="Open menu"
  aria-expanded="false"
  aria-controls="mobile-menu"
  class="text-stone-500 ... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 rounded-sm"
>
```

**Fix — JS (Header.astro ~line 216):**
```js
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', function() {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
  });
}
```

---

### M5 — Mobile theme toggle missing focus ring
**File:** `src/components/Header.astro:55-71`  
**WCAG:** 2.4.7 Focus Visible (Level AA)

The mobile theme toggle has no `focus-visible:ring-*` classes, unlike the desktop version at line 36.

**Fix (Header.astro line 58):**
```diff
- class="text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
+ class="text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 rounded-sm"
```

---

### M6 — Desktop nav links have no focus-visible ring
**File:** `src/components/Header.astro:21-30`  
**WCAG:** 2.4.7 Focus Visible (Level AA)

Desktop nav links have only hover (color change) styles with no `focus-visible:ring-*`. Tailwind's preflight resets native browser outlines, so keyboard focus on these links may be invisible.

**Fix:** Add focus-visible styles to the nav link template:
```diff
- class={`text-sm transition-colors no-underline ${currentPath...}`}
+ class={`text-sm transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 rounded-sm ${currentPath...}`}
```

---

### M7 — Share dropdown: no aria-expanded, no role="menu"
**File:** `src/components/ContentActions.astro:56-73, ~914-940`  
**WCAG:** 4.1.2 Name, Role, Value (Level A)

The share button doesn't toggle `aria-expanded`. The dropdown has no `role="menu"` and items have no `role="menuitem"`. Screen readers can't identify this as a popup menu.

**Fix — HTML (ContentActions.astro line 56):**
```html
<button id="share-btn" class="ca-btn" aria-label="Share" aria-expanded="false" aria-haspopup="true">
```

**Fix — Dropdown (line 59):**
```html
<div id="share-dropdown" class="share-dropdown hidden" role="menu">
```

**Fix — Each item (lines 60-72):** Add `role="menuitem"` to each `<button>` and `<a>` within the dropdown.

**Fix — JS (~line 914):**
```js
shareBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = shareDropdown?.classList.contains('hidden');
  shareDropdown?.classList.toggle('hidden');
  shareBtn?.setAttribute('aria-expanded', String(willOpen));
});
// Also set aria-expanded='false' when closing via document click
```

---

### M8 — Summary panel key-takeaway links are `<a>` without `href` (not keyboard-reachable)
**File:** `src/components/ContentActions.astro:964-969`  
**WCAG:** 2.1.1 Keyboard (Level A)

Key-takeaway items in the summary panel are `<a class="summary-link" data-target="...">` with no `href`. Anchor elements without `href` are removed from the tab order — keyboard users cannot reach or activate them.

**Fix:** Change to `<button>` elements in the `keyPointsHtml` template string (~line 964):
```js
`<button type="button" class="summary-link" data-target="${point.headingId}" style="opacity:0;transform:translateY(5px);width:100%;text-align:left;background:none;border:none;cursor:pointer;">
  <i class="ti ti-arrow-right" aria-hidden="true" style="color:#0F6E56;font-size:14px;flex-shrink:0;"></i>
  <span class="summary-link-title">${point.title}</span>
</button>`
```
Remove the separate `keydown` handler — `<button>` activates on Enter natively.

---

### M9 — No live region for search results
**File:** `src/pages/search.astro:43-47`  
**WCAG:** 4.1.3 Status Messages (Level AA)

When search results load, screen reader users receive no announcement. The `#result-list` content appears silently.

**Fix:** Add a visually hidden live region and update it from JS:
```html
<!-- Add before #result-list -->
<div id="search-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
```

In `renderResultList()`:
```js
const statusEl = document.getElementById('search-status');
if (statusEl) {
  statusEl.textContent = filtered.length === 0
    ? 'No results found.'
    : `${filtered.length} result${filtered.length === 1 ? '' : 's'} found.`;
}
```

---

### M10 — Filter pills have no aria-pressed state
**File:** `src/pages/search.astro:27-31`  
**WCAG:** 4.1.2 Name, Role, Value (Level A)

The All / Journal / Projects filter pills toggle visually between active and inactive, but never communicate the selected state to screen readers. A screen reader user cannot determine which filter is currently active.

**Fix — HTML:**
```html
<button data-filter="all" aria-pressed="true" class="filter-pill active ...">All</button>
<button data-filter="journal" aria-pressed="false" class="filter-pill ...">Journal</button>
<button data-filter="project" aria-pressed="false" class="filter-pill ...">Projects</button>
```

**Fix — JS click handler:**
```js
filterPills.forEach(function (pill) {
  pill.addEventListener('click', function () {
    activeFilter = pill.dataset.filter;
    filterPills.forEach(function (p) {
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');
    renderResultList();
  });
});
```

---

## Minor Issues (improvements)

---

### N1 — Canvas elements missing aria-hidden
**Files:** `src/components/FilamentFlash.astro:1-4`, `src/components/Starfield.astro:1-4`  
**WCAG:** 1.1.1 Non-text Content (Level A)

Decorative canvas elements should be hidden from the accessibility tree.

**Fix:**
```html
<canvas id="filament-canvas" aria-hidden="true" style="..."></canvas>
<canvas id="starfield-canvas" aria-hidden="true" style="..."></canvas>
```

---

### N2 — No `<h1>` on home page
**File:** `src/pages/index.astro`, `src/components/FeaturedEntry.astro:17`  
**WCAG:** 1.3.1 Info and Relationships — best practice

The home page has no `<h1>`. The featured entry headline uses `<h2>`. Screen reader users navigating by headings find no page-level heading.

**Fix (FeaturedEntry.astro line 17):** Change to `<h1>`:
```diff
- <h2 class="text-3xl font-medium tracking-tight ...">
+ <h1 class="text-3xl font-medium tracking-tight ...">
```
The "Journal" and "Shipped" `<h2>` headings below remain correct in hierarchy.

---

### N3 — No `<h1>` on search page
**File:** `src/pages/search.astro`  

The search page has no heading in the body. The `<title>` says "Search — Richard Thomchick" but there is no matching `<h1>`.

**Fix:** Add before the form:
```html
<h1 class="text-2xl font-medium tracking-tight text-stone-900 dark:text-stone-100 mb-6">Search</h1>
```

---

### N4 — Mobile nav dropdown has no `<nav>` landmark
**File:** `src/components/Header.astro:87-103`  

The mobile dropdown contains nav links in a plain `<div>`. Screen reader users navigating by landmarks cannot find this navigation via the same mechanism as desktop.

**Fix (Header.astro line 89):**
```html
<nav class="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4" aria-label="Mobile navigation">
  ...links...
</nav>
```

---

### N5 — Theme toggle aria-label doesn't convey current state
**File:** `src/components/Header.astro:209-212` (showIcons function)  

`aria-label="Toggle theme"` is static. A screen reader user cannot determine the current theme mode (light/dark/system) from the button label.

**Fix:** Update `showIcons()` to also set a state-aware label:
```js
const stateLabels = {
  light: 'Theme: Light — click to switch to Dark',
  dark: 'Theme: Dark — click to switch to System',
  system: 'Theme: System — click to switch to Light',
};

function showIcons(state) {
  // ...existing icon logic...
  [btn, btnMobile].forEach(function(b) {
    if (b) b.setAttribute('aria-label', stateLabels[state]);
  });
}
```

---

### N6 — No aria-live region for AI answer streaming in search
**File:** `src/pages/search.astro:39`  

The AI answer streams into `#ai-answer-text` with no `aria-live` region. Screen reader users won't hear the AI response.

**Fix:**
```diff
- <div id="ai-answer-text" class="text-sm leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap"></div>
+ <div id="ai-answer-text" class="text-sm leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap" aria-live="polite" aria-atomic="false"></div>
```

---

### N7 — Dynamically-built icon elements missing aria-hidden
**File:** `src/components/ContentActions.astro:1296, 1389, 1394`  

In `processAnswerText()` and `injectGithubButtons()`, icon `<i>` elements built via JS template strings don't include `aria-hidden="true"`.

**Fix in processAnswerText() (~line 1296):**
```js
`<span class="code-filename"><i class="ti ti-file-code" aria-hidden="true"></i> ${escHtml(lang)}</span>`
```

**Fix in injectGithubButtons() (~line 1389):**
```js
btn.innerHTML = '<i class="ti ti-brand-github" aria-hidden="true"></i> View on GitHub';
```

---

## Screen Reader Walkthrough

### Landing page
1. No skip link — keyboard users tab through 5 nav items + theme toggle before reaching content
2. First landmark: `<header>` (site header)
3. Second landmark: `<main>` — no `<h1>`, first heading is `<h2>` (featured entry headline)
4. "Latest entry · [date]" is in a `<p>` tag, read as body text — acceptable
5. "All entries →" / "All projects →" links: announced with text, clickable — but low contrast in light mode (M2)

### Journal entry page
1. `<h1>` present — page heading correctly announced
2. ContentActions bar: all buttons have `aria-label` — good
3. TOC toggle has `aria-expanded` and `aria-controls` — good
4. Summary/Ask/Listen panels: functional but panels appear without announcement (no live region)

### Search page
1. Input announced by type ("search") — no label text read (C2)
2. Filter pills: screen reader user cannot tell which is active (M10)
3. Results load silently — no announcement (M9)
4. AI answer streams silently — no announcement (N6)

---

## Positive Findings

- `lang="en"` on `<html>` (BaseLayout.astro:28) ✓
- All inline decorative SVG icons use `aria-hidden="true"` ✓
- Footer social icon links have descriptive `aria-label` ✓
- `<time datetime="...">` used for dates in JournalCard ✓
- TOC toggle button has `aria-expanded` + `aria-controls` ✓
- ContentActions primary buttons all have `aria-label` ✓
- Audio player range input has `aria-label="Playback position"` ✓
- Play/pause button updates `aria-label` dynamically ✓
- All CSS animations gated with `@media (prefers-reduced-motion: reduce)` in global.css ✓
- Viewport meta doesn't disable user scaling (`user-scalable` not set) ✓
- Back-to-top button has `aria-label` and focus ring ✓
- Landmark structure (header/main/footer) consistent across all pages ✓
