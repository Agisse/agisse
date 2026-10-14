// Run: npx tsx local/html-rewriter.check.ts
import { readFileSync } from 'node:fs'
import './html-rewriter.ts'

const html = readFileSync('index.html', 'utf8') // run from the repo root, as npm run check does
const run = async (rw: HTMLRewriter) => rw.transform(new Response(html, { headers: { 'Content-Type': 'text/html' } })).text()

// The two rewrites app.notFound does: <html data-launch> and an empty #root.
const launched = await run(new HTMLRewriter().on('html', { element: (el) => void el.setAttribute('data-launch', '') }))
if (!/^<!doctype html>\s*<html data-launch="" lang="en">/i.test(launched)) throw new Error('data-launch not set on <html>')

const emptied = await run(new HTMLRewriter().on('#root', { element: (el) => void el.setInnerContent('') }))
if (!emptied.includes('<div id="root"></div>')) throw new Error('#root not emptied')
if (emptied.includes('home__title')) throw new Error('the homepage copy is still inside #root')
if (!emptied.includes('</body>') || !emptied.includes('<script type="module"')) throw new Error('lost what follows #root')

// Anything else throws, so a new HTMLRewriter use in the Worker fails here instead of being skipped locally.
let threw = false
try {
  new HTMLRewriter().on('head', { element: () => {} })
} catch {
  threw = true
}
if (!threw) throw new Error('an unknown selector should throw')

console.log('local html-rewriter ok')
