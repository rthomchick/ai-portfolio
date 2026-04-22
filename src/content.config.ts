import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    headline: z.string(),
    week: z.number(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()),
    keyInsights: z.array(z.string()).optional(),
    toolsBuilt: z.array(z.string()).optional(),
    status: z.enum(['draft', 'published']).default('published'),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['deployed', 'built', 'planning']),
    deployUrl: z.string().optional(),
    repoUrl: z.string().optional(),
    weekBuilt: z.number(),
    tags: z.array(z.string()),
    problemSolved: z.string(),
    architecturePattern: z.string().optional(),
    techStack: z.array(z.string()),
    sortOrder: z.number().default(0),
  }),
});

export const collections = { journal, projects };
