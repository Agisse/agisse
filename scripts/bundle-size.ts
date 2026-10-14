// What the first page load downloads, from `npm run build`'s output: the entry script, its modulepreloads
// and stylesheets from dist/client/index.html, gzipped, plus the biggest packages and files in that JS.
// Usage: npx tsx scripts/bundle-size.ts [top=15]
// CI: `--check` fails when the initial JS is more than 10% over scripts/bundle-budget.json. Raising that number is a
// deliberate change in the PR that needs it, with the reason in the PR body.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { SourceMapConsumer } from 'source-map-js'

const dir = 'dist/client'
const html = readFileSync(`${dir}/index.html`, 'utf8')
const local = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1]).filter((p) => p.startsWith('/assets/'))
const js = local(/<script[^>]+src="([^"]+)"/g).concat(local(/<link rel="modulepreload"[^>]+href="([^"]+)"/g))
const css = local(/<link rel="stylesheet"[^>]+href="([^"]+)"/g)
const kb = (n: number) => Math.round(n / 100) / 10 // kB, as vite build prints them
const gz = (files: string[]) => kb(files.reduce((n, f) => n + gzipSync(readFileSync(dir + f)).length, 0))

/** Minified bytes per package (or per src/ file), from each chunk's sourcemap. */
function modules(file: string, into: Map<string, number>) {
  const lines = readFileSync(dir + file, 'utf8').split('\n')
  const map = new SourceMapConsumer(JSON.parse(readFileSync(`${dir}${file}.map`, 'utf8')))
  let prev: { line: number; col: number; name: string } | null = null
  const add = (end: number) => prev && into.set(prev.name, (into.get(prev.name) ?? 0) + end - prev.col)
  map.eachMapping((m) => {
    if (prev && prev.line !== m.generatedLine) add(lines[prev.line - 1].length)
    else add(m.generatedColumn)
    const pkg = m.source?.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]
    prev = { line: m.generatedLine, col: m.generatedColumn, name: pkg ?? m.source?.replace(/^.*?\/(src|shared)\//, '$1/') ?? '(none)' }
  })
  if (prev) add(lines[prev.line - 1].length)
}

const sizes = new Map<string, number>()
for (const f of js) modules(f, sizes)
const args = process.argv.slice(2).filter((a) => a !== '--check')
const top = Number(args[0] ?? 15)
console.log(
  JSON.stringify(
    {
      initialJsGzipKb: gz(js),
      initialCssGzipKb: gz(css),
      files: [...js, ...css],
      biggestMinifiedKb: Object.fromEntries([...sizes].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => [k, kb(v)])),
    },
    null,
    2,
  ),
)

if (process.argv.includes('--check')) {
  const budget = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8')).initialJsGzipKb as number
  if (gz(js) > budget * 1.1) {
    console.error(`Initial JS is ${gz(js)} kB gzipped, more than 10% over the budget of ${budget} kB (scripts/bundle-budget.json).`)
    process.exit(1)
  }
}
