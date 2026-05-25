import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env if present (mirrors how generate-summaries picks up keys in dev)
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'src/content/journal');
const PROJECTS_DIR = path.join(ROOT, 'src/content/projects');
const QUESTIONS_JOURNAL_DIR = path.join(ROOT, 'src/data/questions/journal');
const QUESTIONS_PROJECTS_DIR = path.join(ROOT, 'src/data/questions/projects');

fs.mkdirSync(QUESTIONS_JOURNAL_DIR, { recursive: true });
fs.mkdirSync(QUESTIONS_PROJECTS_DIR, { recursive: true });

const client = new Anthropic();

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

async function generateJournalQuestions(slug: string, content: string): Promise<object> {
  const title = getFrontmatterField(content, 'headline') || getFrontmatterField(content, 'title');
  const plainText = extractPlainText(getBody(content));

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are generating suggested questions for an "Ask AI" panel on a PM's portfolio journal entry.

The questions should be:
- Specific to this entry's actual content — not generic
- Reflective in tone: what did you learn, what surprised you, why did you choose X
- Answerable from the entry text alone
- Written as a reader would naturally ask them — conversational, not formal

Entry title: ${title}
Entry content: ${plainText.slice(0, 6000)}

Return exactly 3 questions as a JSON array. No preamble, no markdown, no explanation.
["question 1", "question 2", "question 3"]`,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const questions = JSON.parse(text);
  return { questions };
}

async function generateProjectQuestions(slug: string, content: string): Promise<object> {
  const title = getFrontmatterField(content, 'title');
  const plainText = extractPlainText(getBody(content));

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are generating suggested questions for an "Ask AI" panel on a PM's portfolio project page.

The questions should be:
- Technical and evaluative in tone: how does X work, show me the implementation of Y, what does Z do
- Specific to this project's architecture, decisions, and code
- The kind of question a hiring manager or engineer would ask when evaluating the work

Project title: ${title}
Project content: ${plainText.slice(0, 6000)}

Return exactly 3 questions as a JSON array. No preamble, no markdown, no explanation.
["question 1", "question 2", "question 3"]`,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const questions = JSON.parse(text);
  return { questions };
}

async function processDirectory(
  contentDir: string,
  outputDir: string,
  type: 'journal' | 'project'
): Promise<void> {
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md')).sort();

  for (const file of files) {
    const slug = file.replace('.md', '');
    const mdPath = path.join(contentDir, file);
    const jsonPath = path.join(outputDir, `${slug}.json`);

    const mdStat = fs.statSync(mdPath);

    if (fs.existsSync(jsonPath)) {
      const jsonStat = fs.statSync(jsonPath);
      if (jsonStat.mtimeMs > mdStat.mtimeMs) {
        console.log(`⏭  Skipped ${type}/${slug} (unchanged)`);
        continue;
      }
    }

    const content = fs.readFileSync(mdPath, 'utf-8');

    try {
      const data =
        type === 'journal'
          ? await generateJournalQuestions(slug, content)
          : await generateProjectQuestions(slug, content);
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
      console.log(`✓  Generated questions for ${type}/${slug}`);
    } catch (err) {
      console.error(`✗  Failed ${type}/${slug}:`, err);
    }
  }
}

await processDirectory(JOURNAL_DIR, QUESTIONS_JOURNAL_DIR, 'journal');
await processDirectory(PROJECTS_DIR, QUESTIONS_PROJECTS_DIR, 'project');
