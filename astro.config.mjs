// @ts-check

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.richardthomchick.com',
  output: 'static',
  adapter: vercel(),
  integrations: [mdx(), sitemap(), pagefind()],
  vite: {
    plugins: [tailwindcss()]
  }
});
