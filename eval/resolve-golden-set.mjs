import fs from 'fs';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index('portfolio-search');

const EMBED_MODEL = 'text-embedding-3-small';
const TEXT_FIELD = 'text';
const SLUG_FIELD = 'slug';
const JOURNAL_TOPK = 10;

const draft = JSON.parse(fs.readFileSync('eval/ask-golden-set-draft.json', 'utf8'));
const resolved = [];
const problems = [];

for (const entry of draft.entries) {
  const emb = await openai.embeddings.create({ model: EMBED_MODEL, input: entry.question });
  const vector = emb.data[0].embedding;

  const wide = await index.query({
    vector, topK: 50, includeMetadata: true,
    filter: { [SLUG_FIELD]: { '$eq': entry.slug } },
  });

  const factLower = entry.expectedFact.toLowerCase();
  const groundingMatch = wide.matches.find(m =>
    (m.metadata?.[TEXT_FIELD] ?? '').toString().toLowerCase().includes(factLower)
  );

  if (!groundingMatch) {
    problems.push(`❌ ${entry.id}: expectedFact "${entry.expectedFact}" not found in any chunk for slug "${entry.slug}"`);
    continue;
  }

  const rankInWide = wide.matches.findIndex(m => m.id === groundingMatch.id);
  const withinProductionTopK = rankInWide < JOURNAL_TOPK;

  resolved.push({
    ...entry,
    expectedChunkId: groundingMatch.id,
    baselineRank: rankInWide,
    baselineScore: Number(groundingMatch.score?.toFixed(4)),
    withinProductionTopK,
  });

  const flag = !withinProductionTopK ? '  ⚠️  OUTSIDE production topK' : (rankInWide >= JOURNAL_TOPK - 2 ? '  ⚠️  near edge' : '');
  console.log(`✅ ${entry.id}: chunk ${groundingMatch.id} @ rank ${rankInWide} score ${groundingMatch.score?.toFixed(4)}${flag}`);
}

fs.writeFileSync('eval/ask-golden-set.json', JSON.stringify({ entries: resolved }, null, 2));

console.log(`\n=== Resolved ${resolved.length}/${draft.entries.length} entries ===`);
if (problems.length) {
  console.log('\nPROBLEMS (fix expectedFact or slug, re-run):');
  problems.forEach(p => console.log(p));
}

const atRisk = resolved.filter(e => !e.withinProductionTopK);
if (atRisk.length) {
  console.log(`\n⚠️  ${atRisk.length} grounding chunks fall OUTSIDE current topK ${JOURNAL_TOPK} — these would miss today:`);
  atRisk.forEach(e => console.log(`   ${e.id} (rank ${e.baselineRank})`));
}

const nearEdge = resolved.filter(e => e.withinProductionTopK && e.baselineRank >= JOURNAL_TOPK - 2);
if (nearEdge.length) {
  console.log(`\n⚠️  ${nearEdge.length} chunks within topK but near the edge (rank ${JOURNAL_TOPK - 2} or ${JOURNAL_TOPK - 1}):`);
  nearEdge.forEach(e => console.log(`   ${e.id} (rank ${e.baselineRank}, score ${e.baselineScore})`));
}
