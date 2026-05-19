// TODO: add rate limiting before this endpoint sees significant traffic
export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI();
const pc = new Pinecone();
const index = pc.index('portfolio-search');

export const POST: APIRoute = async ({ request }) => {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const results = await index.query({
      vector: queryEmbedding,
      topK: 8,
      includeMetadata: true,
    });

    const formattedResults = (results.matches || []).map((match) => ({
      score: match.score,
      title: match.metadata?.title,
      section: match.metadata?.section,
      type: match.metadata?.type,
      week: match.metadata?.week,
      url: match.metadata?.url,
      text: match.metadata?.text,
    }));

    return new Response(JSON.stringify({ results: formattedResults }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
