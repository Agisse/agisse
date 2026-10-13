import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

// Analytics are off unless both are set, so self-hosted copies send nothing.
if (posthogKey && posthogHost) {
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
}

export default posthog
