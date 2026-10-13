import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

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
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    cloudflare(),
    // Uploads source maps on build so production stack traces show real file/line, not minified code.
    // Needs SENTRY_AUTH_TOKEN (an org auth token with project:releases scope) as a build-time env var — not deployed.
    // Without it the plugin isn't loaded, so self-host and CI builds don't contact Sentry at all.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({ org: 'agisse', project: 'agisse', authToken: process.env.SENTRY_AUTH_TOKEN })]
      : []),
  ],
})
