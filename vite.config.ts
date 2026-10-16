import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const entry = new URL('./src/main.tsx', import.meta.url).pathname
let firstPaint: Set<string> | undefined

/** Our files that src/main.tsx imports statically; rolldown adds the package code they use. Without this, modules the
 *  landing shares with lazy pages split into many small chunks, and the extra requests cost the landing ~160 ms of first
 *  paint on a throttled phone. Packages stay out of the walk: a barrel such as lucide-react's index imports every icon,
 *  and each icon some lazy page uses would join the landing. */
function firstPaintChunk(id: string, ctx: { getModuleInfo(id: string): { importedIds: readonly string[] } | null }) {
  if (!firstPaint) {
    firstPaint = new Set()
    const todo = [entry]
    for (let next; (next = todo.pop()); ) {
      if (firstPaint.has(next) || next.includes('/node_modules/')) continue
      firstPaint.add(next)
      todo.push(...(ctx.getModuleInfo(next)?.importedIds ?? []))
    }
  }
  return firstPaint.has(id) ? 'index' : null
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    sourcemap: true,
  },
  environments: {
    client: { build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: firstPaintChunk }] } } } } },
  },
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Self-hosting: SELF_HOST_DOMAIN replaces the agisse.xyz routes with your domain, or with none for `workers.dev`.
    cloudflare({
      config: (worker) => {
        const domain = process.env.SELF_HOST_DOMAIN
        if (domain) worker.routes = domain === 'workers.dev' ? [] : [{ pattern: domain, custom_domain: true }]
        if (domain) worker.vars = { ...worker.vars, APP_URL: domain === 'workers.dev' ? '' : `https://${domain}` }
      },
    }),
    // Uploads source maps on build so production stack traces show real file/line, not minified code.
    // Needs SENTRY_AUTH_TOKEN (an org auth token with project:releases scope) as a build-time env var — not deployed.
    // Without it the plugin isn't loaded, so self-host and CI builds don't contact Sentry at all.
    // The browser's maps are deleted once uploaded, so agisse.xyz never serves them.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG ?? 'agisse',
            project: process.env.SENTRY_PROJECT ?? 'agisse',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: { filesToDeleteAfterUpload: ['dist/client/**/*.map'] },
          }),
        ]
      : []),
  ],
})
