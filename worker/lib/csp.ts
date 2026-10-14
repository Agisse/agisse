// Content-Security-Policy for the HTML pages (the JSON API and the hashed build files don't need one).
// The hash is index.html's inline theme script; csp.check.ts fails when the script changes without it.
const base = "object-src 'none'; base-uri 'self'; frame-ancestors 'self'"

// Third parties the app loads: Turnstile on sign-in, PostHog (agisse.xyz uses eu.i.posthog.com and its
// eu-assets host; a self-hosted PostHog behind another host needs adding here), the map's tiles,
// place search, and the OpenRouter key exchange. Images come from logo.dev and any https link.
export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'sha256-NCz9WXG9nTu2YLXwq7kshkt6Dc6ut5sWdRMh6d07J+I=' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://*.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.posthog.com https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://openrouter.ai",
  "worker-src 'self' blob:",
  'frame-src https://challenges.cloudflare.com',
  base,
].join('; ')

// The docs are VitePress, whose pages carry inline scripts, so only the base rules apply there.
export const DOCS_CSP = base
