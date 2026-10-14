// Run from the repo root: npx tsx worker/lib/csp.check.ts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { APP_CSP } from './csp.ts'

const html = readFileSync('index.html', 'utf8')
// Only script blocks without a type run; JSON-LD and the module entry don't need a hash.
for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`
  if (!APP_CSP.includes(hash)) throw new Error(`index.html's inline script changed: put ${hash} in worker/lib/csp.ts`)
}
if (/\son[a-z]+=/i.test(html)) throw new Error('index.html has an inline event handler, which the CSP blocks')
console.log('csp ok')
