import fs from 'fs';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index('portfolio-search');

// ── PARITY (copied verbatim from src/pages/api/search.ts) ─────────────
const EMBED_MODEL = 'text-embedding-3-small';
const GEN_MODEL = 'claude-sonnet-4-6';
const GEN_MAX_TOKENS = 800;
const TEXT_FIELD = 'text';
const SLUG_FIELD = 'slug';
const TOPK = { journal: 10, project: 12 };

// System prompt is dynamic in production — entityLabel and slug are interpolated per call.
// Replicated here as a function to match exactly.
function systemPrompt(entityLabel, slug) {
  return `You are an AI assistant embedded in Richard Thomchick's portfolio. Answer questions about this specific ${entityLabel} (slug: ${slug}) using only the provided context. Be concise and direct — 1-3 short paragraphs max. Write in first person as Richard. If the context doesn't contain enough to answer well, say so briefly. Never invent facts. When your answer includes a code block, introduce it first with 1-2 sentences explaining what the code does and where it lives in the project. Show the block. Then follow with a single sentence identifying the most important line or pattern. Never open an answer directly with a heading or a code block — always lead with prose. Only include fenced code blocks in your answer when your context contains [Code: ...] blocks — reproduce the relevant portion with the appropriate language tag. If your context only contains prose descriptions of the implementation, describe the architecture in prose. Never synthesize or reconstruct code that isn't in your provided context.`;
}

// Context formatting copied verbatim from search.ts (journal path — no code-block branch needed
// since golden set questions are all journal/project prose, not code chunks).
function formatContext(matches, pageContext) {
  return matches
    .filter(m => m.metadata?.[TEXT_FIELD])
    .map((m, i) => {
      if (pageContext === 'project' && m.metadata?.chunkType === 'code') {
        const lang = m.metadata?.language || 'text';
        const section = m.metadata?.section || 'General';
        return `[Code: ${section} - ${lang}]\n${m.metadata[TEXT_FIELD]}`;
      }
      const section = m.metadata?.section ? ` — ${m.metadata.section}` : '';
      return `[Source ${i + 1}${section}]\n${m.metadata[TEXT_FIELD]}`;
    })
    .join('\n\n---\n\n');
}
// ── End parity ─────────────────────────────────────────────────────────

// Judge: cheaper model is sufficient for binary PASS/FAIL
const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

function pageType(slug) {
  if (fs.existsSync(`src/content/journal/${slug}.md`)) return 'journal';
  if (fs.existsSync(`src/content/journal/${slug}/index.md`)) return 'journal';
  if (fs.existsSync(`src/content/projects/${slug}.md`)) return 'project';
  console.warn(`  ⚠️  pageType: could not classify slug "${slug}", defaulting to project`);
  return 'project';
}

async function embed(text) {
  const r = await openai.embeddings.create({ model: EMBED_MODEL, input: text });
  return r.data[0].embedding;
}

async function generateAnswer(question, matches, pageContext, slug) {
  const entityLabel = pageContext === 'journal' ? 'journal entry' : 'project';
  const contextBlocks = formatContext(matches, pageContext);
  const resp = await anthropic.messages.create({
    model: GEN_MODEL,
    max_tokens: GEN_MAX_TOKENS,
    system: systemPrompt(entityLabel, slug),
    messages: [{
      role: 'user',
      content: `Context from this ${entityLabel}:\n${contextBlocks || '(no matching content found)'}\n\nQuestion: ${question}`,
    }],
  });
  return resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

async function generateAnswerNoContext(question, pageContext, slug) {
  const entityLabel = pageContext === 'journal' ? 'journal entry' : 'project';
  const resp = await anthropic.messages.create({
    model: GEN_MODEL,
    max_tokens: GEN_MAX_TOKENS,
    system: systemPrompt(entityLabel, slug),
    messages: [{
      role: 'user',
      content: `Context from this ${entityLabel}:\n(no context provided)\n\nQuestion: ${question}`,
    }],
  });
  return resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

async function judge(question, expectedFact, answer) {
  const prompt = `You are evaluating whether an AI answer correctly reflects a known fact.

Question: ${question}
Known fact the answer should reflect: "${expectedFact}"
AI answer: ${answer}

Does the AI answer correctly reflect the known fact? PASS if it conveys the fact accurately (wording may differ). FAIL if it denies, contradicts, omits, or hedges on the fact.

Respond with ONLY a JSON object, no other text: {"verdict": "PASS" or "FAIL", "reason": "one sentence"}`;

  const resp = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { verdict: 'PARSE_ERROR', reason: text.slice(0, 120) };
  }
}

async function main() {
  const golden = JSON.parse(fs.readFileSync('eval/ask-golden-set.json', 'utf8'));
  const results = [];

  for (const entry of golden.entries) {
    process.stdout.write(`  ${entry.id} ... `);
    const ctx = pageType(entry.slug);
    const topK = TOPK[ctx];
    const vector = await embed(entry.question);

    const retrieval = await index.query({
      vector, topK, includeMetadata: true,
      filter: { [SLUG_FIELD]: { '$eq': entry.slug } },
    });

    const rank = retrieval.matches.findIndex(m => m.id === entry.expectedChunkId);
    const retrievalPass = rank >= 0;
    const score = rank >= 0 ? Number(retrieval.matches[rank].score?.toFixed(4)) : null;

    const answer = await generateAnswer(entry.question, retrieval.matches, ctx, entry.slug);
    const groundingVerdict = await judge(entry.question, entry.expectedFact, answer);
    const groundingPass = groundingVerdict.verdict === 'PASS';

    const noContextAnswer = await generateAnswerNoContext(entry.question, ctx, entry.slug);
    const noContextVerdict = await judge(entry.question, entry.expectedFact, noContextAnswer);
    const trainingLeakable = noContextVerdict.verdict === 'PASS';

    const groundedCorrect = retrievalPass && groundingPass;

    results.push({
      id: entry.id,
      slug: entry.slug,
      context: ctx,
      topK,
      type: entry.type,
      retrievalPass,
      rank: rank >= 0 ? rank : 'not-retrieved',
      score,
      groundingVerdict: groundingVerdict.verdict,
      groundingReason: groundingVerdict.reason,
      groundedCorrect,
      trainingLeakable,
      noContextVerdict: noContextVerdict.verdict,
      answerPreview: answer.slice(0, 160),
      noContextAnswerPreview: noContextAnswer.slice(0, 160),
    });

    const rFlag = retrievalPass ? '✅' : '❌';
    const gFlag = groundingPass ? '✅' : '❌';
    const cFlag = groundedCorrect ? '✅' : '❌';
    const leak = trainingLeakable ? ' ⚠️ training-leakable' : '';
    console.log(`${cFlag} grounded-correct | retrieval ${rFlag} (rank ${rank >= 0 ? rank : 'miss'}) | grounding ${gFlag}${leak} | ${entry.id}`);
  }

  const groundedCorrectCount = results.filter(r => r.groundedCorrect).length;
  const retrievalHits = results.filter(r => r.retrievalPass).length;
  const groundingPassCount = results.filter(r => r.groundingVerdict === 'PASS').length;
  const leakable = results.filter(r => r.trainingLeakable);
  const total = results.length;

  const strongCorrect = results.filter(r => !r.trainingLeakable && r.groundedCorrect).length;
  const strongTotal = results.filter(r => !r.trainingLeakable).length;

  const summary = {
    timestamp: new Date().toISOString(),
    total,
    groundedCorrect: `${groundedCorrectCount}/${total}`,
    retrievalHitRate: `${retrievalHits}/${total}`,
    groundingAccuracy: `${groundingPassCount}/${total}`,
    trainingLeakable: `${leakable.length}/${total}`,
    trainingLeakableIds: leakable.map(r => r.id),
    strongTestScore: `${strongCorrect}/${strongTotal}`,
    retrievalFailures: results.filter(r => !r.retrievalPass).map(r => r.id),
    falseGreens: results.filter(r => !r.retrievalPass && r.groundingVerdict === 'PASS').map(r => r.id),
    results,
  };

  fs.mkdirSync('eval/results', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = `eval/results/ask-eval-${stamp}.json`;
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Grounded-correct (headline): ${summary.groundedCorrect}`);
  console.log(`  Retrieval hit rate:        ${summary.retrievalHitRate}`);
  console.log(`  Grounding accuracy:        ${summary.groundingAccuracy}  (may be inflated by training leaks)`);
  console.log(`Training-leakable questions: ${summary.trainingLeakable}  ${leakable.length ? '(' + summary.trainingLeakableIds.join(', ') + ')' : ''}`);
  console.log(`Strong-test score (non-leakable only): ${summary.strongTestScore}`);
  if (summary.falseGreens.length) console.log(`False greens (retrieval miss but grounding pass): ${summary.falseGreens.join(', ')}`);
  console.log(`\nResults written to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
