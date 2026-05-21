export const prerender = false;

import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: import.meta.env.PINECONE_API_KEY });
const index = pc.index('portfolio-search');
const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export const POST: APIRoute = async ({ request }) => {
  let body: { query?: string; context?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { query, context } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (context !== 'site') {
    return new Response(JSON.stringify({ error: 'Not implemented' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // Embed query first (needed for Pinecone)
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query.trim(),
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Operation A: Pinecone semantic search
        const pineconeResult = await index.query({
          vector: queryEmbedding,
          topK: 5,
          includeMetadata: true,
        });

        const semanticMatches = (pineconeResult.matches || []).map((match) => ({
          url: match.metadata?.url as string,
          title: match.metadata?.title as string,
          type: match.metadata?.type as string,
          week: match.metadata?.week as number | undefined,
          excerpt: match.metadata?.text as string,
        }));

        send('semantic', JSON.stringify(semanticMatches));

        // Operation B: Claude RAG synthesis using pinecone results as context
        const contextBlocks = semanticMatches
          .map((m, i) => {
            const source =
              m.type === 'journal' ? `Week ${m.week} Journal` : `Project: ${m.title}`;
            return `[Source ${i + 1}: ${source}](${m.url})\n${m.excerpt}`;
          })
          .join('\n\n---\n\n');

        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system:
            "You are a search assistant for Richard Thomchick's AI product development portfolio. Answer the user's question concisely and accurately using only the provided context from his journal entries and project pages. Write in first person as Richard. Be specific — reference actual week numbers, tool names, and findings. Keep answers to 2-3 short paragraphs maximum. If the context doesn't contain enough information to answer well, say so briefly.",
          messages: [
            {
              role: 'user',
              content: `Context:\n${contextBlocks}\n\nQuestion: ${query.trim()}`,
            },
          ],
        });

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            send('ai-chunk', JSON.stringify(event.delta.text));
          }
        }

        send('ai-done', 'done');
        send('done', 'done');
      } catch (error) {
        console.error('Search stream error:', error);
        send('error', JSON.stringify({ message: 'Search failed' }));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
