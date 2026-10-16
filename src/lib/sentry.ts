import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import { scrubUrl } from '../../shared/scrub-url'

const dsn = import.meta.env?.VITE_SENTRY_DSN

// Clicks and key presses carry the element's label, console lines can quote a CV: only page changes and requests stay,
// with their addresses scrubbed like PostHog's.
export const beforeBreadcrumb = (b: Breadcrumb): Breadcrumb | null => {
  if (b.category !== 'navigation' && b.category !== 'fetch' && b.category !== 'xhr') return null
  for (const k of ['url', 'from', 'to']) if (typeof b.data?.[k] === 'string') b.data[k] = scrubUrl(b.data[k])
  return b
}

export const beforeSend = (e: ErrorEvent): ErrorEvent => {
  if (e.request) {
    if (e.request.url) e.request.url = scrubUrl(e.request.url)
    delete e.request.query_string
    delete e.request.cookies
    if (e.request.headers?.Referer) e.request.headers.Referer = scrubUrl(e.request.headers.Referer)
  }
  return e
}

const dnt = [navigator.doNotTrack, (window as { doNotTrack?: string }).doNotTrack].some((v) => v === '1' || v === 'yes')

// Off unless VITE_SENTRY_DSN is set, so self-hosted copies send nothing; off when the browser asks not to be tracked.
// The SDK loads after the page has, like PostHog, so it costs the first paint nothing; an error before then isn't reported.
if (dsn && !dnt) {
  const start = () =>
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({
        dsn,
        // No user, cookies or query strings; the browser and OS come from the User-Agent header.
        dataCollection: { userInfo: false, cookies: false, urlQueryParams: false, httpBodies: [], stackFrameVariables: false },
        // Errors only: no tracing, no replay, and no session pings on every page load.
        integrations: (all) => all.filter((i) => i.name !== 'BrowserSession'),
        beforeBreadcrumb,
        beforeSend,
      }),
    )
  if (document.readyState === 'complete') start()
  else addEventListener('load', start, { once: true })
}
