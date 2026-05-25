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

function toHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const POST: APIRoute = async ({ request }) => {
  let body: {
    query?: string;
    context?: string;
    slug?: string;
    history?: Array<{ q: string; a: string }>;
    stream?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { query, context, slug, history = [] } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Page-scoped Ask AI (journal or project)
  if (context === 'journal' || context === 'project') {
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required for page-scoped search' }), {
        status: 400,
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
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query.trim(),
          });
          const queryEmbedding = embeddingResponse.data[0].embedding;

          // Query scoped to this page's slug
          const pineconeResult = await index.query({
            vector: queryEmbedding,
            topK: 6,
            includeMetadata: true,
            filter: { slug: { '$eq': slug } },
          });

          const matches = pineconeResult.matches || [];

          // Build sources array for the frontend
          const sources = matches
            .filter(m => m.metadata?.section)
            .map(m => ({
              type: 'section',
              heading_text: m.metadata!.section as string,
              heading_id: toHeadingId(m.metadata!.section as string),
            }))
            // Dedupe by heading_id
            .filter((s, i, arr) => arr.findIndex(x => x.heading_id === s.heading_id) === i)
            .slice(0, 3);

          // Also look for cross-page references if fewer than 2 section hits
          let relatedSources: Array<{ type: string; related_slug: string; related_title: string; related_type: string }> = [];
          if (sources.length < 2) {
            const broadResult = await index.query({
              vector: queryEmbedding,
              topK: 4,
              includeMetadata: true,
            });
            relatedSources = (broadResult.matches || [])
              .filter(m => m.metadata?.slug && m.metadata.slug !== slug)
              .map(m => ({
                type: 'related',
                related_slug: m.metadata!.slug as string,
                related_title: m.metadata!.title as string,
                related_type: m.metadata!.type as string,
              }))
              .filter((s, i, arr) => arr.findIndex(x => x.related_slug === s.related_slug) === i)
              .slice(0, 1);
          }

          // Build context for Claude
          const contextBlocks = matches
            .filter(m => m.metadata?.text)
            .map((m, i) => {
              const section = m.metadata?.section ? ` — ${m.metadata.section}` : '';
              return `[Source ${i + 1}${section}]\n${m.metadata!.text}`;
            })
            .join('\n\n---\n\n');

          const entityLabel = context === 'journal' ? 'journal entry' : 'project';

          // Build message history for Claude
          const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
            history.flatMap(h => [
              { role: 'user' as const, content: h.q },
              { role: 'assistant' as const, content: h.a },
            ]);

          const claudeStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 800,
            system: `You are an AI assistant embedded in Richard Thomchick's portfolio. Answer questions about this specific ${entityLabel} (slug: ${slug}) using only the provided context. Be concise and direct — 1-3 short paragraphs max. Write in first person as Richard. If the context doesn't contain enough to answer well, say so briefly. Never invent facts.`,
            messages: [
              ...historyMessages,
              {
                role: 'user',
                content: `Context from this ${entityLabel}:\n${contextBlocks || '(no matching content found)'}\n\nQuestion: ${query.trim()}`,
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

          send('sources', JSON.stringify([...sources, ...relatedSources]));
          send('ai-done', 'done');
          send('done', 'done');
        } catch (error) {
          console.error('Ask AI stream error:', error);
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
  }

  // Site-wide search (original behavior)
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
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query.trim(),
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

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
