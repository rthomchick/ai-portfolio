import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI();
const pc = new Pinecone();
const index = pc.index('portfolio-search');

const CONTENT_ROOT = new URL('../src/content', import.meta.url).pathname;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const MAX_CHUNK_CHARS = 3200; // ~800 tokens
const OVERLAP_CHARS = 100;

function stripCodeBlocks(text) {
  return text.replace(CODE_BLOCK_RE, '').trim();
}

function chunkByHeadings(body, title, type) {
  const sections = [];
  const lines = body.split('\n');
  let currentHeading = '';
  let currentLines = [];

  const flush = () => {
    const text = currentLines.join('\n').trim();
    if (text.length > 0) sections.push({ heading: currentHeading, text });
    currentLines = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^## /, '').trim();
    } else {
      currentLines.push(line);
    }
  }
  flush();

  // If no h2 headings found, treat whole body as one chunk
  if (sections.length === 0 && body.trim().length > 0) {
    sections.push({ heading: '', text: body.trim() });
  }

  // Split oversized sections at paragraph boundaries
  const chunks = [];
  for (const section of sections) {
    const cleaned = stripCodeBlocks(section.text);
    if (cleaned.length <= MAX_CHUNK_CHARS) {
      chunks.push({ heading: section.heading, text: cleaned });
    } else {
      const paragraphs = cleaned.split(/\n\n+/);
      let current = '';
      for (const para of paragraphs) {
        if (current.length + para.length + 2 > MAX_CHUNK_CHARS && current.length > 0) {
          chunks.push({ heading: section.heading, text: current.trim() });
          // overlap: keep last OVERLAP_CHARS of previous chunk as context
          current = current.slice(-OVERLAP_CHARS) + '\n\n' + para;
        } else {
          current = current ? current + '\n\n' + para : para;
        }
      }
      if (current.trim().length > 0) {
        chunks.push({ heading: section.heading, text: current.trim() });
      }
    }
  }

  return chunks;
}

function buildContextPrefix(entry, chunkHeading) {
  if (entry.type === 'journal') {
    return `${entry.title}${chunkHeading ? ' — ' + chunkHeading : ''}\n\n`;
  }
  return `Project: ${entry.title}${chunkHeading ? ' — ' + chunkHeading : ''}\n\n`;
}

async function embed(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function readEntries(dir, type) {
  const files = await readdir(dir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const entries = [];

  for (const file of mdFiles) {
    const content = await readFile(join(dir, file), 'utf-8');
    const { data: frontmatter, content: body } = matter(content);
    const slug = basename(file, '.md');

    entries.push({
      slug,
      type,
      title: frontmatter.title || slug,
      week: type === 'journal' ? frontmatter.week : frontmatter.weekBuilt,
      url: type === 'journal' ? `/journal/${slug}` : `/projects/${slug}`,
      body,
    });
  }

  return entries;
}

async function upsertBatch(vectors) {
  if (!vectors || vectors.length === 0) return;
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;
    await index.upsert({ records: batch });
  }
}

async function main() {
  console.log('Indexing portfolio content...');

  const journalDir = join(CONTENT_ROOT, 'journal');
  const projectsDir = join(CONTENT_ROOT, 'projects');

  const journalEntries = await readEntries(journalDir, 'journal');
  console.log(`Reading journal entries... found ${journalEntries.length} files`);

  const projectEntries = await readEntries(projectsDir, 'project');
  console.log(`Reading project pages... found ${projectEntries.length} files`);

  const allEntries = [...journalEntries, ...projectEntries];

  // Build all chunks
  const allChunks = [];
  for (const entry of allEntries) {
    const chunks = chunkByHeadings(entry.body, entry.title, entry.type);
    chunks.forEach((chunk, idx) => {
      allChunks.push({ entry, chunk, idx });
    });
  }

  console.log(`Chunking content... ${allChunks.length} chunks created`);

  // Generate embeddings
  const vectors = [];
  for (let i = 0; i < allChunks.length; i++) {
    const { entry, chunk, idx } = allChunks[i];
    const prefix = buildContextPrefix(entry, chunk.heading);
    const textToEmbed = prefix + chunk.text;

    process.stdout.write(`\rGenerating embeddings... ${i + 1}/${allChunks.length}`);
    const embedding = await embed(textToEmbed);

    vectors.push({
      id: `${entry.slug}#${idx}`,
      values: embedding,
      metadata: {
        title: entry.title,
        section: chunk.heading || '',
        type: entry.type,
        week: entry.week ?? null,
        slug: entry.slug,
        url: entry.url,
        text: chunk.text.substring(0, 1000),
        charCount: chunk.text.length,
      },
    });
  }

  console.log('');
  console.log(`Upserting to Pinecone (portfolio-search)...`);
  await upsertBatch(vectors);
  console.log(`done`);
  console.log(`Index complete: ${vectors.length} vectors in portfolio-search`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
