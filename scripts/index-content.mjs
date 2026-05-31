import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const missingKeys = ['OPENAI_API_KEY', 'PINECONE_API_KEY'].filter(k => !process.env[k]);
if (missingKeys.length > 0) {
  console.error(`[index-content] Missing required environment variables: ${missingKeys.join(', ')}`);
  console.error('[index-content] Set them in .env or export them before running this script.');
  process.exit(1);
}

const openai = new OpenAI();
const pc = new Pinecone();
const index = pc.index('portfolio-search');

const CONTENT_ROOT = new URL('../src/content', import.meta.url).pathname;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const CODE_BLOCK_EXTRACT_RE = /^```(\w*)\n([\s\S]*?)^```/gm;
const MAX_CHUNK_CHARS = 3200; // ~800 tokens
const OVERLAP_CHARS = 100;
const CODE_EMBED_MAX_CHARS = 3000;
const CODE_META_MAX_CHARS = 8000;
const CODE_MIN_CHARS = 50;

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

function extractCodeChunks(body, title) {
  const chunks = [];
  let match;
  CODE_BLOCK_EXTRACT_RE.lastIndex = 0;

  while ((match = CODE_BLOCK_EXTRACT_RE.exec(body)) !== null) {
    const language = match[1] || 'text';
    const code = match[2];

    if (code.trim().length < CODE_MIN_CHARS) continue;

    // Find nearest H2 heading above this block
    const before = body.slice(0, match.index);
    const h2Matches = [...before.matchAll(/^## (.+)$/gm)];
    const section = h2Matches.length > 0
      ? h2Matches[h2Matches.length - 1][1].trim()
      : 'General';

    chunks.push({ language, code, section });
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

async function indexProjectSourceCode(projectConfig) {
  const { slug, repoPath, githubRepo, title, subPath, subPaths, excludeSubPaths } = projectConfig;
  const fs = await import('fs');
  const pathModule = await import('path');

  console.log(`\nIndexing source code for ${slug} from ${repoPath}...`);

  // Walk the repo and collect qualifying source files
  function walkDir(dir, fileList = [], excludeSubs = []) {
    const excludeDirs = ['node_modules', '__pycache__', '.venv', 'venv', '.git', 'dist', 'build'];
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return fileList;
    }
    for (const entry of entries) {
      // Skip venv directories regardless of prefix/suffix naming convention
      if (excludeDirs.some(ex => entry === ex) || entry.includes('venv') || entry.startsWith('venv')) continue;
      if (excludeSubs.includes(entry)) continue;
      const fullPath = pathModule.join(dir, entry);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }
      if (stat.isDirectory()) {
        walkDir(fullPath, fileList, excludeSubs);
      } else if (stat.isFile()) {
        const ext = pathModule.extname(entry);
        if (!['.py', '.ts', '.js', '.mjs'].includes(ext)) continue;
        if (entry.endsWith('.d.ts') || entry.endsWith('.min.js')) continue;
        if (stat.size > 100 * 1024) continue;
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  // Determine which directories to walk
  let rootsToWalk;
  if (subPath) {
    rootsToWalk = [pathModule.join(repoPath, subPath)];
  } else if (subPaths) {
    rootsToWalk = subPaths.map(p => pathModule.join(repoPath, p));
  } else {
    rootsToWalk = [repoPath];
  }

  // Walk each root, collecting all source files
  const sourceFiles = [];
  for (const root of rootsToWalk) {
    if (fs.existsSync(root)) {
      walkDir(root, sourceFiles, excludeSubPaths || []);
    } else {
      console.warn(`  ⚠️  Path not found, skipping: ${root}`);
    }
  }

  console.log(`  Found ${sourceFiles.length} source files`);

  const allChunks = [];

  for (let fileIndex = 0; fileIndex < sourceFiles.length; fileIndex++) {
    const filePath = sourceFiles[fileIndex];
    const relativeFilePath = pathModule.relative(repoPath, filePath);
    const ext = pathModule.extname(filePath);
    const language = ext === '.py' ? 'python' : ext === '.ts' ? 'typescript' : 'javascript';
    const filename = pathModule.basename(filePath, ext);

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch { continue; }
    if (!content.trim()) continue;

    const lines = content.split('\n');
    const githubUrl = `https://github.com/${githubRepo}/blob/main/${relativeFilePath}`;

    // Determine split points
    let chunks = [];
    if (lines.length <= 100) {
      chunks = [content];
    } else if (language === 'python') {
      const regex = /^(async def |def |class )/gm;
      const indices = [];
      let match;
      while ((match = regex.exec(content)) !== null) indices.push(match.index);
      if (indices.length < 2) {
        chunks = [content.slice(0, 3000)];
      } else {
        for (let i = 0; i < indices.length; i++) {
          const start = indices[i];
          const end = indices[i + 1] ?? content.length;
          let chunk = content.slice(start, end);
          if (chunk.length > 3000) {
            const cutoff = content.lastIndexOf('\n', start + 3000);
            chunk = content.slice(start, cutoff > start ? cutoff : start + 3000);
          }
          chunks.push(chunk);
        }
      }
    } else {
      const regex = /^(export |function |class |const \w+ = (?:async )?(?:function|\(|async \())/gm;
      const indices = [];
      let match;
      while ((match = regex.exec(content)) !== null) indices.push(match.index);
      if (indices.length < 2) {
        chunks = [content.slice(0, 3000)];
      } else {
        for (let i = 0; i < indices.length; i++) {
          const start = indices[i];
          const end = indices[i + 1] ?? content.length;
          let chunk = content.slice(start, end);
          if (chunk.length > 3000) {
            const cutoff = content.lastIndexOf('\n', start + 3000);
            chunk = content.slice(start, cutoff > start ? cutoff : start + 3000);
          }
          chunks.push(chunk);
        }
      }
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunkContent = chunks[chunkIndex].trim();
      if (!chunkContent) continue;

      // Extract section name from first line
      const firstLine = chunkContent.split('\n')[0];
      let section = filename;
      const pyMatch = firstLine.match(/^(?:async )?def (\w+)|^class (\w+)/);
      const jsMatch = firstLine.match(/^(?:export (?:default |async )?)?(?:function|class) (\w+)|^(?:export )?const (\w+)/);
      if (pyMatch) section = pyMatch[1] || pyMatch[2];
      else if (jsMatch) section = jsMatch[1] || jsMatch[2];

      const embeddingText = `${title} — ${section}\nFile: ${relativeFilePath}\nLanguage: ${language}\n\n${chunkContent.slice(0, 3000)}`;

      allChunks.push({
        id: `${slug}#src-${fileIndex}-${chunkIndex}`,
        embeddingText,
        metadata: {
          title,
          section,
          type: 'project',
          chunkType: 'code',
          language,
          slug,
          url: `/projects/${slug}`,
          sourceFile: relativeFilePath,
          githubUrl,
          text: chunkContent.slice(0, 8000),
          charCount: chunkContent.length,
        },
      });
    }
  }

  console.log(`  Created ${allChunks.length} source code chunks from ${sourceFiles.length} files`);
  return allChunks;
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

  // Build all prose chunks
  const allChunks = [];
  for (const entry of allEntries) {
    const chunks = chunkByHeadings(entry.body, entry.title, entry.type);
    chunks.forEach((chunk, idx) => {
      allChunks.push({ entry, chunk, idx });
    });
  }

  // Build code chunks for project entries only
  const allCodeChunks = [];
  for (const entry of projectEntries) {
    const codeChunks = extractCodeChunks(entry.body, entry.title);
    codeChunks.forEach((chunk, idx) => {
      allCodeChunks.push({ entry, chunk, idx });
    });
  }

  const totalChunks = allChunks.length + allCodeChunks.length;
  console.log(`Chunking content... ${allChunks.length} prose + ${allCodeChunks.length} code chunks created`);

  // Generate embeddings
  const vectors = [];
  let embeddingCount = 0;

  for (let i = 0; i < allChunks.length; i++) {
    const { entry, chunk, idx } = allChunks[i];
    const prefix = buildContextPrefix(entry, chunk.heading);
    const textToEmbed = prefix + chunk.text;

    process.stdout.write(`\rGenerating embeddings... ${++embeddingCount}/${totalChunks}`);
    const embedding = await embed(textToEmbed);

    vectors.push({
      id: `${entry.slug}#${idx}`,
      values: embedding,
      metadata: {
        title: entry.title,
        section: chunk.heading || '',
        type: entry.type,
        chunkType: 'prose',
        week: entry.week ?? null,
        slug: entry.slug,
        url: entry.url,
        text: chunk.text.substring(0, 1000),
        charCount: chunk.text.length,
      },
    });
  }

  for (let i = 0; i < allCodeChunks.length; i++) {
    const { entry, chunk, idx } = allCodeChunks[i];
    const prefix = `Project: ${entry.title} — ${chunk.section}\nLanguage: ${chunk.language}\n\n`;
    const textToEmbed = prefix + chunk.code.slice(0, CODE_EMBED_MAX_CHARS);

    process.stdout.write(`\rGenerating embeddings... ${++embeddingCount}/${totalChunks}`);
    const embedding = await embed(textToEmbed);

    vectors.push({
      id: `${entry.slug}#code-${idx}`,
      values: embedding,
      metadata: {
        title: entry.title,
        section: chunk.section,
        type: 'project',
        chunkType: 'code',
        language: chunk.language,
        slug: entry.slug,
        url: entry.url,
        text: chunk.code.slice(0, CODE_META_MAX_CHARS),
        charCount: chunk.code.length,
      },
    });
  }

  // Source code indexing
  const sourceProjects = [
    // ── Already indexed ────────────────────────────────────────────────
    {
      slug: 'dino',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/dino'),
      githubRepo: 'rthomchick/dino',
      title: 'Dino',
    },

    // ── SAFe system — scoped by subdirectory ──────────────────────────
    {
      slug: 'safe-feature-spec-system',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/safe-feature-system'),
      githubRepo: 'rthomchick/safe-feature-system',
      title: 'SAFe Feature Spec System',
      excludeSubPaths: ['evaluation', 'intake_copilot', 'pages'],
    },
    {
      slug: 'evaluation-pipeline',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/safe-feature-system'),
      githubRepo: 'rthomchick/safe-feature-system',
      title: 'Evaluation Pipeline',
      subPath: 'evaluation',
    },
    {
      slug: 'responsible-ai-dashboard',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/safe-feature-system'),
      githubRepo: 'rthomchick/safe-feature-system',
      title: 'Responsible AI Dashboard',
      subPaths: ['evaluation', 'pages'],
    },
    {
      slug: 'intake-copilot',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/safe-feature-system'),
      githubRepo: 'rthomchick/safe-feature-system',
      title: 'Intake Copilot',
      subPath: 'intake_copilot',
    },

    // ── Standalone repos ───────────────────────────────────────────────
    {
      slug: 'knowledge-assistant',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/knowledge-assistant'),
      githubRepo: 'rthomchick/knowledge-assistant',
      title: 'Knowledge Assistant',
    },
    {
      slug: 'signal-definition-app',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/signal-definition-app'),
      githubRepo: 'rthomchick/signal-definition-app',
      title: 'Signal Definition App',
    },
    {
      slug: 'roi-analyzer',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/roi-analyzer'),
      githubRepo: 'rthomchick/roi-analyzer',
      title: 'ROI Analyzer',
    },
    {
      slug: 'feature-spec-generator',
      repoPath: join(process.env.HOME, 'Dropbox/ai-projects/feature-spec-generator'),
      githubRepo: 'rthomchick/feature-spec-generator',
      title: 'Feature Spec Generator',
    },
  ];

  let totalSourceChunks = 0;
  for (const project of sourceProjects) {
    const sourceChunks = await indexProjectSourceCode(project);
    if (sourceChunks.length > 0) {
      const BATCH = 20;
      for (let i = 0; i < sourceChunks.length; i += BATCH) {
        const batch = sourceChunks.slice(i, i + BATCH);
        const embeddingRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(c => c.embeddingText),
        });
        const srcVectors = batch.map((chunk, j) => ({
          id: chunk.id,
          values: embeddingRes.data[j].embedding,
          metadata: chunk.metadata,
        }));
        await upsertBatch(srcVectors);
        console.log(`  Upserted source chunks ${i + 1}–${Math.min(i + BATCH, sourceChunks.length)} of ${sourceChunks.length}`);
      }
    }
    totalSourceChunks += sourceChunks.length;
  }

  console.log('');
  console.log(`Upserting to Pinecone (portfolio-search)...`);
  await upsertBatch(vectors);
  console.log(`done`);
  console.log(`[index-content] Done. ${allChunks.length} prose + ${allCodeChunks.length} code + ${totalSourceChunks} source-code chunks upserted.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
