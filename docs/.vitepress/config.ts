import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Agisse',
  description: 'Docs for Agisse, the AI job search assistant: connect it to Claude, Codex or Cursor over MCP, or use the browser extension.',
  lang: 'en',
  cleanUrls: true,
  lastUpdated: true,
  base: '/docs/',
  outDir: '../public/docs',
  sitemap: { hostname: 'https://agisse.xyz/docs/' },
  // Dynamic guide pages carry their title and description in params (see catalog.ts).
  transformPageData(page) {
    if (page.params?.title) {
      page.title = page.params.title
      page.description = page.params.description
    }
  },
  themeConfig: {
    nav: [
      { text: 'Extension', link: '/extension' },
      { text: 'MCP', link: '/mcp' },
      { text: 'Guides', link: '/guides/' },
    ],
    sidebar: [
      { text: 'Guides', items: [{ text: 'Extension', link: '/extension' }, { text: 'MCP', link: '/mcp' }] },
      { text: 'How it works', items: [{ text: 'Architecture', link: '/architecture' }] },
      { text: 'Selection processes', items: [{ text: 'All employers and tests', link: '/guides/' }] },
      { text: 'Legal', items: [{ text: 'Privacy', link: '/privacy' }, { text: 'Terms', link: '/terms' }, { text: 'Imprint', link: '/imprint' }] },
    ],
  },
})
