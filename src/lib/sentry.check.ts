// Run: npx tsx src/lib/sentry.check.ts
import type { ErrorEvent } from '@sentry/react'
;(globalThis as { navigator?: object }).navigator ??= {}
;(globalThis as { window?: object }).window ??= {}
const { beforeBreadcrumb, beforeSend } = await import('./sentry.ts')

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(beforeBreadcrumb({ category: 'ui.click', message: 'button[aria-label="Email Jane Doe"]' }), null, 'click dropped')
eq(beforeBreadcrumb({ category: 'ui.input' }), null, 'input dropped')
eq(beforeBreadcrumb({ category: 'console', message: 'my CV text' }), null, 'console dropped')
eq(
  beforeBreadcrumb({ category: 'navigation', data: { from: '/reset-password?token=abc', to: '/jobs/3f2a9c1e-8b7d-4e6f-a1b2-c3d4e5f60718' } })?.data,
  { from: '/reset-password', to: '/jobs/:id' },
  'navigation scrubbed',
)
eq(beforeBreadcrumb({ category: 'fetch', data: { url: '/api/jobs/k2j4h5g6f7?q=x', status_code: 500 } })?.data, { url: '/api/jobs/:id', status_code: 500 }, 'fetch scrubbed')

const e = beforeSend({
  type: undefined,
  request: { url: 'https://agisse.xyz/?invite=Xy7-k2pQ', query_string: 'invite=Xy7-k2pQ', cookies: { a: 'b' }, headers: { Referer: 'https://agisse.xyz/consent?sig=s', 'User-Agent': 'UA' } },
} as ErrorEvent)
eq(e.request, { url: 'https://agisse.xyz/', headers: { Referer: 'https://agisse.xyz/consent', 'User-Agent': 'UA' } }, 'event request scrubbed')
console.log('sentry ok')
