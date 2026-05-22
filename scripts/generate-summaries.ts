import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'src/content/journal');
const SUMMARIES_DIR = path.join(ROOT, 'src/data/summaries');

fs.mkdirSync(SUMMARIES_DIR, { recursive: true });

const client = new Anthropic();

function toHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractHeadings(body: string): Array<{ text: string; id: string }> {
  return body
    .split('\n')
    .filter(line => /^#{2,4}\s/.test(line))
    .map(line => {
      const text = line.replace(/^#{2,4}\s+/, '').trim();
      return { text, id: toHeadingId(text) };
    });
}

function extractPlainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getFrontmatterField(content: string, field: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return '';
  const fm = match[1];
  const fieldMatch = fm.match(new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return fieldMatch ? fieldMatch[1] : '';
}

function getBody(content: string): string {
  const idx = content.indexOf('\n---\n', 3);
  return idx > -1 ? content.slice(idx + 5) : content;
}

async function generateSummary(slug: string, content: string): Promise<object> {
  const title = getFrontmatterField(content, 'headline') || getFrontmatterField(content, 'title');
  const body = getBody(content);
  const headings = extractHeadings(body);
  const plainText = extractPlainText(body);

  // Sanitize heading text: replace ASCII double-quotes so Claude won’t produce unescaped quotes in JSON strings
  const safeHeadings = headings.map(h => ({ ...h, text: h.text.replace(/"/g, '\x27') }));

  const userPrompt = `Title: ${title}

Headings (use these exact ids for headingId):
${safeHeadings.map(h => `- "${h.text}" (id: "${h.id}")`).join('\n')}

Article text:
${plainText.slice(0, 8000)}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a summary assistant for Richard Thomchick's AI product development journal. Generate a structured summary of the article.

Return a JSON object with this exact structure:
{
  "overview": "A 2-3 sentence summary of the article's main theme and outcome. Write in first person as Richard. Be specific — reference actual tools, findings, and numbers.",
  "keyPoints": [
    {
      "title": "A specific, data-anchored finding or outcome (15 words max)",
      "description": "One sentence elaborating with a concrete detail or number.",
      "sectionName": "The heading text of the section this point comes from",
      "headingId": "The id attribute of the heading this point links to"
    }
  ]
}

Rules:
- Generate 4-7 key points depending on article length.
- Each key point must link to a specific heading from the provided headings list. Use the exact id from the headings array for headingId.
- Lead with numbers and findings, not generalities.
- Write in first person as Richard.
- Return ONLY the JSON object, no markdown backticks, no preamble.`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  // Strip markdown code fences if model wraps the response despite instructions
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(text);
  } catch (e) {
    // Show the problematic section to aid debugging
    if (e instanceof SyntaxError) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        console.error('Raw response excerpt around error position:', JSON.stringify(text.slice(Math.max(0, pos - 60), pos + 60)));
      }
    }
    throw e;
  }
}

const files = fs.readdirSync(JOURNAL_DIR).filter(f => f.endsWith('.md')).sort();

for (const file of files) {
  const slug = file.replace('.md', '');
  const mdPath = path.join(JOURNAL_DIR, file);
  const jsonPath = path.join(SUMMARIES_DIR, `${slug}.json`);

  const mdStat = fs.statSync(mdPath);

  if (fs.existsSync(jsonPath)) {
    const jsonStat = fs.statSync(jsonPath);
    if (jsonStat.mtimeMs > mdStat.mtimeMs) {
      console.log(`⏭  Skipped ${slug} (unchanged)`);
      continue;
    }
  }

  const content = fs.readFileSync(mdPath, 'utf-8');

  try {
    const summary = await generateSummary(slug, content);
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    console.log(`✓  Generated summary for ${slug}`);
  } catch (err) {
    console.error(`✗  Failed ${slug}:`, err);
  }
}
