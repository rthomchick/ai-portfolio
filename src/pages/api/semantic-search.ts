// TODO: add rate limiting before this endpoint sees significant traffic
export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI();
const pc = new Pinecone();
const index = pc.index('portfolio-search');
const anthropic = new Anthropic();

export const POST: APIRoute = async ({ request }) => {
  try {
    const { query, mode = 'semantic' } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Embed the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Query Pinecone
    const results = await index.query({
      vector: queryEmbedding,
      topK: mode === 'rag' ? 5 : 8,
      includeMetadata: true,
    });

    const matches = (results.matches || []).map((match) => ({
      score: match.score,
      title: match.metadata?.title,
      section: match.metadata?.section,
      type: match.metadata?.type,
      week: match.metadata?.week,
      url: match.metadata?.url,
      text: match.metadata?.text,
    }));

    // Step 3: If RAG mode, synthesize with Claude
    if (mode === 'rag' && matches.length > 0) {
      const contextBlocks = matches.map((m, i) => {
        const source = m.type === 'journal' ? `Week ${m.week} Journal` : `Project: ${m.title}`;
        const section = m.section ? ` — ${m.section}` : '';
        return `[Source ${i + 1}: ${source}${section}](${m.url})\n${m.text}`;
      }).join('\n\n---\n\n');

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are answering questions about Richard Thomchick's AI product development portfolio. Use ONLY the provided sources to answer. If the sources don't contain enough information to answer, say so.

Format rules:
- Write a concise, direct answer in 2-4 paragraphs
- Cite sources inline using markdown links: [Week 9 Journal](/journal/week-09-ai-evaluation-system)
- Use the exact URLs provided in the source headers
- Do not invent information beyond what the sources contain
- Write in second person ("you built", "you discovered") since this is Richard's portfolio

Sources:
${contextBlocks}

Question: ${query.trim()}`
          }
        ],
      });

      const answer = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      return new Response(JSON.stringify({
        mode: 'rag',
        answer: answer,
        sources: matches,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Semantic mode: return raw results
    return new Response(JSON.stringify({
      mode: 'semantic',
      results: matches,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
