// Run from the repo root: npx tsx worker/lib/csp.check.ts
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { APP_CSP } from './csp.ts'

const html = readFileSync('index.html', 'utf8')
// Only script blocks without a type run; JSON-LD and the module entry don't need a hash.
for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`
  if (!APP_CSP.includes(hash)) throw new Error(`index.html's inline script changed: put ${hash} in worker/lib/csp.ts`)
}
if (/\son[a-z]+=/i.test(html)) throw new Error('index.html has an inline event handler, which the CSP blocks')
// A form posting anywhere else would be blocked by form-action.
for (const file of readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.tsx'))) {
  for (const [, url] of readFileSync(`src/${file}`, 'utf8').matchAll(/<form[^>]*\saction="(https?:\/\/[^/"]+)/g)) {
    if (!APP_CSP.includes(url)) throw new Error(`${file} posts a form to ${url}: add it to form-action in worker/lib/csp.ts`)
  }
}
console.log('csp ok')
