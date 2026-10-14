import type { PostHog } from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

let client: PostHog | undefined
let queue: ((p: PostHog) => void)[] | undefined
const run = (f: (p: PostHog) => void) => (client ? f(client) : queue?.push(f))

// Analytics are off unless both are set, so self-hosted copies send nothing.
// posthog-js is the biggest library in the app, so it loads after the page has; calls made before then wait in a queue.
if (posthogKey && posthogHost) {
  queue = []
  const start = () =>
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        defaults: '2026-05-30',
        // No cookies or browser storage, so no consent banner: IDs live for the page load only. App re-identifies signed-in users on every load.
        persistence: 'memory',
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
      })
      client = posthog
      queue?.splice(0).forEach((f) => f(posthog))
      queue = undefined
    })
  if (document.readyState === 'complete') start()
  else addEventListener('load', start, { once: true })
}

export default {
  capture: (...args: Parameters<PostHog['capture']>) => run((p) => p.capture(...args)),
  identify: (...args: Parameters<PostHog['identify']>) => run((p) => p.identify(...args)),
  reset: () => run((p) => p.reset()),
  // Persistence is memory-only, so until posthog-js loads there is no stored ID to read.
  get_property: (key: string): unknown => client?.get_property(key),
}
